import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBangkokDateLabel,
  getFallbackWeatherInfo,
  getTimePeriodInfo,
  parseOpenMeteoWeather,
} from './weather';

test('getTimePeriodInfo maps morning, noon, afternoon, evening cleanly', () => {
  assert.deepEqual(getTimePeriodInfo(7), {
    periodLabel: 'Buổi sáng',
    greetingPeriod: 'buổi sáng',
  });
  assert.deepEqual(getTimePeriodInfo(12), {
    periodLabel: 'Buổi trưa',
    greetingPeriod: 'buổi trưa',
  });
  assert.deepEqual(getTimePeriodInfo(16), {
    periodLabel: 'Buổi chiều',
    greetingPeriod: 'buổi chiều',
  });
  assert.deepEqual(getTimePeriodInfo(20), {
    periodLabel: 'Buổi tối',
    greetingPeriod: 'buổi tối',
  });
});

test('parseOpenMeteoWeather parses live temperature, is_day, and Bangkok time correctly', () => {
  const samplePayload = {
    current: {
      time: '2026-11-18T17:45',
      temperature_2m: 26.4,
      is_day: 1,
    },
    hourly: {
      time: ['2026-11-18T17:00'],
      temperature_2m: [26.1],
    },
  };

  const parsed = parseOpenMeteoWeather(samplePayload, new Date(), 'server');
  assert.equal(parsed.temperatureC, 26.4);
  assert.equal(parsed.isDay, true);
  assert.equal(parsed.weatherEmoji, '☀️');
  assert.equal(parsed.periodLabel, 'Buổi chiều');
  assert.equal(parsed.greetingPeriod, 'buổi chiều');
  assert.equal(parsed.hour, 17);
  assert.equal(parsed.hanoiDateHeader, 'THỨ TƯ, 18/11');
  assert.equal(parsed.source, 'server');
});

test('parseOpenMeteoWeather falls back to hourly temperature and night icon when needed', () => {
  const nightPayload = {
    current: {
      time: '2026-11-18T21:15',
      is_day: 0,
    },
    hourly: {
      time: ['2026-11-18T21:00'],
      temperature_2m: [21.8],
    },
  };

  const parsed = parseOpenMeteoWeather(nightPayload);
  assert.equal(parsed.temperatureC, 21.8);
  assert.equal(parsed.isDay, false);
  assert.equal(parsed.weatherEmoji, '🌙');
  assert.equal(parsed.periodLabel, 'Buổi tối');
});

test('getFallbackWeatherInfo returns null temperature instead of fake number', () => {
  const fallback = getFallbackWeatherInfo(new Date('2026-11-18T02:00:00Z')); // 09:00 Bangkok
  assert.equal(fallback.temperatureC, null);
  assert.equal(fallback.periodLabel, 'Buổi sáng');
  assert.equal(
    formatBangkokDateLabel({ year: 2026, month: 11, day: 18 }),
    'THỨ TƯ, 18/11'
  );
});
