import { useEffect, useState } from 'react';
import {
  DEFAULT_OPEN_METEO_URL,
  getFallbackWeatherInfo,
  parseOpenMeteoWeather,
  type OpenMeteoWeatherInfo,
} from '../utils/weather';

const WEATHER_REFRESH_MS = 10 * 60 * 1000;

let cachedWeather: { data: OpenMeteoWeatherInfo; fetchedAt: number } | null =
  null;

async function fetchLiveWeather(): Promise<OpenMeteoWeatherInfo> {
  if (cachedWeather && Date.now() - cachedWeather.fetchedAt < WEATHER_REFRESH_MS) {
    return cachedWeather.data;
  }

  // 1) Try local backend proxy (/api/weather) when running with server.ts
  try {
    const res = await fetch('/api/weather');
    if (res.ok) {
      const json = (await res.json()) as {
        ok?: boolean;
        weather?: {
          current?: { time?: string; temperature_2m?: number; is_day?: number };
          hourly?: { time?: string[]; temperature_2m?: number[] };
        };
        temperatureC?: number | null;
        isDay?: boolean;
      };
      if (json.ok && json.weather) {
        const parsed = parseOpenMeteoWeather(json.weather, new Date(), 'server');
        cachedWeather = { data: parsed, fetchedAt: Date.now() };
        return parsed;
      }
      if (json.ok && typeof json.temperatureC === 'number') {
        const fallback = getFallbackWeatherInfo();
        const merged: OpenMeteoWeatherInfo = {
          ...fallback,
          temperatureC: json.temperatureC,
          isDay: typeof json.isDay === 'boolean' ? json.isDay : fallback.isDay,
          weatherEmoji:
            (typeof json.isDay === 'boolean' ? json.isDay : fallback.isDay)
              ? '☀️'
              : '🌙',
          source: 'server',
        };
        cachedWeather = { data: merged, fetchedAt: Date.now() };
        return merged;
      }
    }
  } catch {
    // Fall through to direct Open-Meteo CORS request (e.g., static Vercel deployment)
  }

  // 2) Direct Open-Meteo fallback (CORS-enabled public endpoint)
  try {
    const directRes = await fetch(DEFAULT_OPEN_METEO_URL);
    if (directRes.ok) {
      const raw = await directRes.json();
      const parsed = parseOpenMeteoWeather(
        raw,
        new Date(),
        'open_meteo_direct'
      );
      cachedWeather = { data: parsed, fetchedAt: Date.now() };
      return parsed;
    }
  } catch {
    // Offline fallback without synthetic temperature
  }

  return getFallbackWeatherInfo();
}

export function useOpenMeteoWeather(): OpenMeteoWeatherInfo {
  const [weather, setWeather] = useState<OpenMeteoWeatherInfo>(
    () => cachedWeather?.data ?? getFallbackWeatherInfo()
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      const next = await fetchLiveWeather();
      if (active) setWeather(next);
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, WEATHER_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return weather;
}
