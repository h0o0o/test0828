
// 경기도 주요 시별 격자 좌표 (기상청 격자 좌표계)
const cityCoordinates = {
    '안산시': { nx: 58, ny: 121 },
    '수원시': { nx: 60, ny: 121 },
    '성남시': { nx: 62, ny: 123 },
    '고양시': { nx: 57, ny: 128 },
    '용인시': { nx: 64, ny: 119 },
    '부천시': { nx: 56, ny: 125 },
    '안양시': { nx: 59, ny: 123 },
    '남양주시': { nx: 64, ny: 128 },
    '화성시': { nx: 57, ny: 119 },
    '평택시': { nx: 62, ny: 114 }
};

// API 설정
const API_KEY = '0b6852c6797d0449bb3c040bba521b9825c6361c3b80afea0d1060ab45ae9381';
const API_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

// DOM 요소
const citySelect = document.getElementById('citySelect');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherContainer = document.getElementById('weatherContainer');
const loading = document.getElementById('loading');
const error = document.getElementById('error');

// 이벤트 리스너
citySelect.addEventListener('change', function() {
    getWeatherBtn.disabled = !this.value;
});

getWeatherBtn.addEventListener('click', getWeather);

// 현재 날짜/시간 포맷팅
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    let hour = now.getHours();
    
    // 기상청 API는 특정 시간에만 데이터를 제공 (02, 05, 08, 11, 14, 17, 20, 23시)
    const apiHours = [2, 5, 8, 11, 14, 17, 20, 23];
    let baseHour = 2; // 기본값
    
    for (let i = 0; i < apiHours.length; i++) {
        if (hour >= apiHours[i]) {
            baseHour = apiHours[i];
        }
    }
    
    return {
        date: `${year}${month}${day}`,
        time: String(baseHour).padStart(2, '0') + '00',
        displayTime: now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long'
        })
    };
}

// 날씨 아이콘 및 상태 매핑
function getWeatherIcon(skyCode, ptyCode) {
    // PTY (강수형태): 0-없음, 1-비, 2-비/눈, 3-눈, 4-소나기
    // SKY (하늘상태): 1-맑음, 3-구름많음, 4-흐림
    
    if (ptyCode > 0) {
        if (ptyCode === 1 || ptyCode === 4) {
            return { icon: 'fas fa-cloud-rain weather-rainy', status: '비' };
        } else if (ptyCode === 2) {
            return { icon: 'fas fa-cloud-rain weather-rainy', status: '진눈깨비' };
        } else if (ptyCode === 3) {
            return { icon: 'fas fa-snowflake weather-snowy', status: '눈' };
        }
    }
    
    if (skyCode === 1) {
        return { icon: 'fas fa-sun weather-sunny', status: '맑음' };
    } else if (skyCode === 3) {
        return { icon: 'fas fa-cloud-sun weather-cloudy', status: '구름많음' };
    } else {
        return { icon: 'fas fa-cloud weather-cloudy', status: '흐림' };
    }
}

// API 호출
async function getWeather() {
    const selectedCity = citySelect.value;
    if (!selectedCity) return;

    const coordinates = cityCoordinates[selectedCity];
    const dateTime = getCurrentDateTime();

    showLoading();

    const url = new URL(API_URL);
    url.searchParams.append('serviceKey', API_KEY);
    url.searchParams.append('pageNo', '1');
    url.searchParams.append('numOfRows', '1000');
    url.searchParams.append('dataType', 'JSON');
    url.searchParams.append('base_date', dateTime.date);
    url.searchParams.append('base_time', dateTime.time);
    url.searchParams.append('nx', coordinates.nx);
    url.searchParams.append('ny', coordinates.ny);

    // 더 안정적인 프록시 서비스 시도
    const proxies = [
        {
            url: `https://api.allorigins.win/get?url=${encodeURIComponent(url.toString())}`,
            type: 'allorigins'
        },
        {
            url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url.toString())}`,
            type: 'direct'
        },
        {
            url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url.toString())}`,
            type: 'direct'
        },
        {
            url: `https://cors-anywhere.herokuapp.com/${url.toString()}`,
            type: 'direct'
        }
    ];

    for (let i = 0; i < proxies.length; i++) {
        try {
            console.log(`프록시 ${i + 1} 시도 중...`);
            
            const response = await fetch(proxies[i].url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let data = await response.json();
            
            // allorigins 프록시인 경우 contents 필드에서 실제 데이터 추출
            if (proxies[i].type === 'allorigins' && data.contents) {
                try {
                    data = JSON.parse(data.contents);
                } catch (e) {
                    throw new Error('JSON 파싱 오류');
                }
            }
            
            console.log('API 응답 받음:', data);

            if (data.response?.header?.resultCode === '00') {
                parseWeatherData(data.response.body.items.item, selectedCity, dateTime.displayTime);
                return; // 성공시 함수 종료
            } else {
                throw new Error(`API 응답 오류: ${data.response?.header?.resultMsg || 'Unknown error'}`);
            }
        } catch (err) {
            console.log(`프록시 ${i + 1} 실패:`, err.message);
            
            // 마지막 프록시도 실패한 경우
            if (i === proxies.length - 1) {
                console.error('모든 프록시 시도 실패:', err);
                // 목업 데이터로 데모 표시
                showMockWeatherData(selectedCity, dateTime.displayTime);
            }
        }
    }
}

// 날씨 데이터 파싱
function parseWeatherData(items, cityName, currentTime) {
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0') + '00';
    
    // 현재 시간의 데이터 추출
    const currentData = {};
    
    items.forEach(item => {
        if (item.fcstTime === currentHour) {
            currentData[item.category] = item.fcstValue;
        }
    });

    // 가장 가까운 시간 데이터가 없을 경우 첫 번째 시간대 데이터 사용
    if (Object.keys(currentData).length === 0) {
        const firstTime = items[0]?.fcstTime;
        items.forEach(item => {
            if (item.fcstTime === firstTime) {
                currentData[item.category] = item.fcstValue;
            }
        });
    }

    const weatherInfo = {
        temperature: currentData.TMP || '--',
        humidity: currentData.REH || '--',
        windSpeed: currentData.WSD || '--',
        rainProbability: currentData.POP || '--',
        skyStatus: parseInt(currentData.SKY) || 1,
        precipitationType: parseInt(currentData.PTY) || 0
    };

    displayWeatherData(weatherInfo, cityName, currentTime);
}

// 날씨 정보 화면 표시
function displayWeatherData(weatherInfo, cityName, currentTime) {
    const weatherIcon = getWeatherIcon(weatherInfo.skyStatus, weatherInfo.precipitationType);
    
    document.getElementById('cityName').textContent = cityName;
    document.getElementById('currentTime').textContent = currentTime;
    document.getElementById('temperature').textContent = weatherInfo.temperature;
    document.getElementById('humidity').textContent = weatherInfo.humidity + '%';
    document.getElementById('windSpeed').textContent = weatherInfo.windSpeed + 'm/s';
    document.getElementById('rainProbability').textContent = weatherInfo.rainProbability + '%';
    document.getElementById('visibility').textContent = '10km'; // 기상청 API에서 제공하지 않는 정보
    
    const iconElement = document.getElementById('weatherIcon');
    iconElement.className = weatherIcon.icon;
    document.getElementById('weatherStatus').textContent = weatherIcon.status;

    hideLoading();
    hideError();
    weatherContainer.style.display = 'block';
}

// 로딩 표시
function showLoading() {
    loading.style.display = 'block';
    weatherContainer.style.display = 'none';
    error.style.display = 'none';
}

// 로딩 숨김
function hideLoading() {
    loading.style.display = 'none';
}

// 에러 표시
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    error.style.display = 'block';
    weatherContainer.style.display = 'none';
    loading.style.display = 'none';
}

// 에러 숨김
function hideError() {
    error.style.display = 'none';
}

// 목업 데이터 표시 (프록시 실패시 데모용)
function showMockWeatherData(cityName, currentTime) {
    console.log('목업 데이터로 데모 표시');
    
    const mockData = {
        temperature: '22',
        humidity: '65',
        windSpeed: '2.1',
        rainProbability: '20',
        skyStatus: 1,
        precipitationType: 0
    };

    displayWeatherData(mockData, cityName, currentTime);
    
    // 목업 데이터 알림 표시
    const weatherContainer = document.getElementById('weatherContainer');
    if (!document.getElementById('mockNotice')) {
        const notice = document.createElement('div');
        notice.id = 'mockNotice';
        notice.style.cssText = `
            background: #fff3cd;
            color: #856404;
            padding: 10px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 0.9rem;
            text-align: center;
            border: 1px solid #ffeaa7;
        `;
        notice.innerHTML = '<i class="fas fa-info-circle"></i> 현재 프록시 서비스 불안정으로 데모 데이터가 표시됩니다.';
        weatherContainer.appendChild(notice);
    }
}

// 페이지 로드시 현재 시간 표시
document.addEventListener('DOMContentLoaded', function() {
    console.log('경기도 날씨 앱이 로드되었습니다.');
});
