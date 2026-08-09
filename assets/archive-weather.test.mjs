import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const scriptUrl = new URL("./archive-weather.js", import.meta.url);

test("archive weather maps Open-Meteo data into current plus four forecast days", () => {
  assert.equal(fs.existsSync(scriptUrl), true, "archive-weather.js must exist");
  const script = fs.readFileSync(scriptUrl, "utf8");
  const context = { document: { body: null } };
  vm.runInNewContext(script, context);

  const payload = {
    current: { temperature_2m: 29.6, weather_code: 1 },
    daily: {
      time: ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
      weather_code: [1, 2, 61, 71, 95, 0],
      temperature_2m_max: [33.2, 31.8, 29.1, 26.8, 28.4, 30.1],
      temperature_2m_min: [25.1, 24.8, 23.6, 21.9, 22.8, 23.3],
      precipitation_probability_max: [10, 20, 70, 60, 80, 5],
    },
  };
  const view = context.ReportHubWeather.buildWeatherView(payload);

  assert.equal(view.current.temperature, 30);
  assert.equal(view.current.text, "대체로 맑음");
  assert.equal(view.today.high, 33);
  assert.equal(view.forecast.length, 4);
  assert.equal(view.forecast[3].text, "뇌우");
  assert.equal(view.forecast[3].precipitation, 80);
});

test("archive weather keeps fetch, cache, and retry behavior isolated", () => {
  const script = fs.readFileSync(scriptUrl, "utf8");
  assert.match(script, /https:\/\/api\.open-meteo\.com\/v1\/forecast/);
  assert.match(script, /37\.1622202/);
  assert.match(script, /127\.1055509/);
  assert.match(script, /Asia\/Seoul/);
  assert.match(script, /10 \* 60 \* 1000/);
  assert.match(script, /data-weather-retry/);
});
