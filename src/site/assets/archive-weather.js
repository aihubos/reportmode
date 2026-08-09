(function (root) {
  "use strict";

  var API_BASE = "https://api.open-meteo.com/v1/forecast";
  var LOCATION = "경기도 화성시 동탄8동";
  var LATITUDE = "37.1622202";
  var LONGITUDE = "127.1055509";
  var SEOUL_TIME_ZONE = "Asia/Seoul";
  var CACHE_KEY = "reporthub:weather:dongtan8:v1";
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var WEATHER_TEXT = {
    0: "맑음",
    1: "대체로 맑음",
    2: "구름 조금",
    3: "흐림",
    45: "안개",
    48: "서리 안개",
    51: "이슬비",
    53: "약한 비",
    55: "비",
    56: "약한 어는비",
    57: "어는비",
    61: "약한 비",
    63: "비",
    65: "강한 비",
    66: "약한 어는비",
    67: "어는비",
    71: "약한 눈",
    73: "눈",
    75: "강한 눈",
    77: "진눈깨비",
    80: "소나기",
    81: "소나기",
    82: "강한 소나기",
    85: "약한 눈비",
    86: "강한 눈비",
    95: "뇌우",
    96: "약한 우박",
    99: "우박 동반 뇌우"
  };

  function getWeatherText(code) {
    return WEATHER_TEXT[Number(code)] || "날씨";
  }

  function rounded(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : 0;
  }

  function formatDayLabel(value) {
    var parts = String(value || "").split("-");
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(String(value) + "T00:00:00+09:00");
    var weekday = new Intl.DateTimeFormat("ko-KR", {
      timeZone: SEOUL_TIME_ZONE,
      weekday: "short"
    }).format(date);
    return month + "." + day + " (" + weekday + ")";
  }

  function buildWeatherView(payload) {
    var current = payload && payload.current ? payload.current : {};
    var daily = payload && payload.daily ? payload.daily : {};
    var times = Array.isArray(daily.time) ? daily.time : [];
    if (!times.length) throw new Error("weather_daily_missing");

    var days = times.slice(0, 5).map(function (date, index) {
      var code = Array.isArray(daily.weather_code) ? daily.weather_code[index] : 0;
      return {
        date: String(date),
        label: formatDayLabel(date),
        code: Number(code) || 0,
        text: getWeatherText(code),
        high: rounded(Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[index] : 0),
        low: rounded(Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[index] : 0),
        precipitation: rounded(Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[index] : 0)
      };
    });
    var today = days[0];
    var currentCode = Number(current.weather_code);
    if (!Number.isFinite(currentCode)) currentCode = today.code;

    return {
      location: LOCATION,
      current: {
        temperature: rounded(current.temperature_2m === undefined ? today.high : current.temperature_2m),
        code: currentCode,
        text: getWeatherText(currentCode)
      },
      today: today,
      forecast: days.slice(1, 5)
    };
  }

  function buildUrl() {
    var params = new URLSearchParams({
      latitude: LATITUDE,
      longitude: LONGITUDE,
      timezone: SEOUL_TIME_ZONE,
      forecast_days: "7",
      current: "temperature_2m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    });
    return API_BASE + "?" + params.toString();
  }

  function readCache() {
    try {
      var cached = JSON.parse(root.localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !cached.savedAt || !cached.payload) return null;
      if (Date.now() - Number(cached.savedAt) > CACHE_TTL_MS) return null;
      return cached.payload;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      root.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload: payload }));
    } catch (_error) {
      // Weather still works when storage is blocked.
    }
  }

  function setText(card, selector, value) {
    var output = card.querySelector(selector);
    if (output) output.textContent = value;
  }

  function renderSuccess(card, payload) {
    var view = buildWeatherView(payload);
    var status = card.querySelector("[data-weather-status]");
    var content = card.querySelector("[data-weather-content]");
    var retry = card.querySelector("[data-weather-retry]");
    var forecast = card.querySelector("[data-weather-forecast]");
    var updated = new Intl.DateTimeFormat("ko-KR", {
      timeZone: SEOUL_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(new Date());

    setText(card, "[data-weather-location]", view.location);
    setText(card, "[data-weather-updated]", updated + " 업데이트");
    setText(card, "[data-weather-temperature]", view.current.temperature + "°");
    setText(card, "[data-weather-condition]", view.current.text);
    setText(card, "[data-weather-high-low]", "최고 " + view.today.high + "° · 최저 " + view.today.low + "°");
    setText(card, "[data-weather-precipitation]", "강수 " + view.today.precipitation + "%");

    if (forecast) {
      forecast.innerHTML = view.forecast.map(function (day) {
        return '<li class="archive-weather-day">' +
          '<span class="archive-weather-day-date">' + day.label + '</span>' +
          '<span class="archive-weather-day-condition">' + day.text + ' · 강수 ' + day.precipitation + '%</span>' +
          '<strong>' + day.high + '° <small>/ ' + day.low + '°</small></strong>' +
          '</li>';
      }).join("");
    }

    if (status) status.hidden = true;
    if (content) content.hidden = false;
    if (retry) retry.hidden = true;
    card.classList.remove("is-loading", "is-error");
    card.classList.add("is-ready");
    card.setAttribute("aria-busy", "false");
  }

  function renderLoading(card) {
    var status = card.querySelector("[data-weather-status]");
    var content = card.querySelector("[data-weather-content]");
    var retry = card.querySelector("[data-weather-retry]");
    if (status) {
      status.hidden = false;
      status.textContent = "날씨를 불러오는 중입니다.";
    }
    if (content) content.hidden = true;
    if (retry) retry.hidden = true;
    card.classList.remove("is-ready", "is-error");
    card.classList.add("is-loading");
    card.setAttribute("aria-busy", "true");
  }

  function renderError(card) {
    var status = card.querySelector("[data-weather-status]");
    var content = card.querySelector("[data-weather-content]");
    var retry = card.querySelector("[data-weather-retry]");
    if (status) {
      status.hidden = false;
      status.textContent = "날씨를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (content) content.hidden = true;
    if (retry) retry.hidden = false;
    card.classList.remove("is-loading", "is-ready");
    card.classList.add("is-error");
    card.setAttribute("aria-busy", "false");
  }

  function loadWeather(card, force) {
    if (!force) {
      var cached = readCache();
      if (cached) {
        renderSuccess(card, cached);
        return Promise.resolve(cached);
      }
    }

    renderLoading(card);
    if (typeof root.fetch !== "function") {
      renderError(card);
      return Promise.reject(new Error("weather_fetch_unavailable"));
    }

    return root.fetch(buildUrl(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("weather_fetch_failed");
        return response.json();
      })
      .then(function (payload) {
        buildWeatherView(payload);
        writeCache(payload);
        renderSuccess(card, payload);
        return payload;
      })
      .catch(function (error) {
        renderError(card);
        return Promise.reject(error);
      });
  }

  function install() {
    var cards = document.querySelectorAll("[data-archive-weather]");
    Array.prototype.forEach.call(cards, function (card) {
      var retry = card.querySelector("[data-weather-retry]");
      if (retry) {
        retry.addEventListener("click", function () {
          loadWeather(card, true).catch(function () {});
        });
      }
      loadWeather(card, false).catch(function () {});
    });
  }

  root.ReportHubWeather = {
    LOCATION: LOCATION,
    buildWeatherView: buildWeatherView,
    getWeatherText: getWeatherText,
    install: install,
    loadWeather: loadWeather
  };

  if (document.body) install();
})(typeof globalThis !== "undefined" ? globalThis : this);
