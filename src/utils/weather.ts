export const DEFAULT_OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&hourly=temperature_2m&current=temperature_2m,is_day&timezone=Asia%2FBangkok';

export type DayPeriodLabel =
  | 'Buổi sáng'
  | 'Buổi trưa'
  | 'Buổi chiều'
  | 'Buổi tối';

export interface OpenMeteoWeatherInfo {
  temperatureC: number | null;
  isDay: boolean;
  weatherEmoji: string;
  periodLabel: DayPeriodLabel;
  greetingPeriod: string;
  hanoiDateHeader: string;
  hour: number;
  locationLabel: string;
  updatedAt: string | null;
  source: 'server' | 'open_meteo_direct' | 'fallback';
}

const VI_WEEKDAYS_BY_INDEX = [
  'CHỦ NHẬT',
  'THỨ HAI',
  'THỨ BA',
  'THỨ TƯ',
  'THỨ NĂM',
  'THỨ SÁU',
  'THỨ BẢY',
];

export function getBangkokDateParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekdayIndex: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(date);
    const getNum = (type: Intl.DateTimeFormatPartTypes, fallback: number) => {
      const val = Number(parts.find((p) => p.type === type)?.value);
      return Number.isFinite(val) ? val : fallback;
    };
    const wdShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
    const wdMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const rawHour = getNum('hour', date.getHours());
    return {
      year: getNum('year', date.getFullYear()),
      month: getNum('month', date.getMonth() + 1),
      day: getNum('day', date.getDate()),
      hour: rawHour === 24 ? 0 : rawHour,
      minute: getNum('minute', date.getMinutes()),
      weekdayIndex: wdMap[wdShort] ?? date.getDay(),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekdayIndex: date.getDay(),
    };
  }
}

export function getTimePeriodInfo(hour: number): {
  periodLabel: DayPeriodLabel;
  greetingPeriod: string;
} {
  if (hour < 11) {
    return { periodLabel: 'Buổi sáng', greetingPeriod: 'buổi sáng' };
  }
  if (hour < 14) {
    return { periodLabel: 'Buổi trưa', greetingPeriod: 'buổi trưa' };
  }
  if (hour < 18) {
    return { periodLabel: 'Buổi chiều', greetingPeriod: 'buổi chiều' };
  }
  return { periodLabel: 'Buổi tối', greetingPeriod: 'buổi tối' };
}

export function formatBangkokDateLabel(parts: {
  year: number;
  month: number;
  day: number;
  weekdayIndex?: number;
}): string {
  const wdIdx =
    typeof parts.weekdayIndex === 'number'
      ? parts.weekdayIndex
      : new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const weekday = VI_WEEKDAYS_BY_INDEX[wdIdx] ?? 'HÔM NAY';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${weekday}, ${dd}/${mm}`;
}

export function getFallbackWeatherInfo(
  now: Date = new Date()
): OpenMeteoWeatherInfo {
  const parts = getBangkokDateParts(now);
  const { periodLabel, greetingPeriod } = getTimePeriodInfo(parts.hour);
  const isDay = parts.hour >= 6 && parts.hour < 18;
  return {
    temperatureC: null,
    isDay,
    weatherEmoji: isDay ? '☀️' : '🌙',
    periodLabel,
    greetingPeriod,
    hanoiDateHeader: formatBangkokDateLabel(parts),
    hour: parts.hour,
    locationLabel: 'Hà Nội',
    updatedAt: null,
    source: 'fallback',
  };
}

export function parseOpenMeteoWeather(
  raw: unknown,
  now: Date = new Date(),
  source: OpenMeteoWeatherInfo['source'] = 'open_meteo_direct'
): OpenMeteoWeatherInfo {
  const fallback = getFallbackWeatherInfo(now);
  if (!raw || typeof raw !== 'object') return fallback;

  const payload = raw as {
    current?: {
      time?: unknown;
      temperature_2m?: unknown;
      is_day?: unknown;
    };
    hourly?: {
      time?: unknown[];
      temperature_2m?: unknown[];
    };
  };

  const current = payload.current;
  const bangkokNow = getBangkokDateParts(now);

  let hour = bangkokNow.hour;
  let year = bangkokNow.year;
  let month = bangkokNow.month;
  let day = bangkokNow.day;
  let weekdayIndex = bangkokNow.weekdayIndex;
  let updatedAt: string | null = null;

  if (typeof current?.time === 'string') {
    const match = current.time.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
      hour = Number(match[4]);
      weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      updatedAt = current.time;
    }
  }

  let tempVal: number | null =
    typeof current?.temperature_2m === 'number' &&
    Number.isFinite(current.temperature_2m)
      ? Math.round(current.temperature_2m * 10) / 10
      : null;

  // Fallback to matching hourly temperature if current temperature is missing
  if (
    tempVal === null &&
    Array.isArray(payload.hourly?.time) &&
    Array.isArray(payload.hourly?.temperature_2m)
  ) {
    const targetPrefix = `${year}-${String(month).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}T${String(hour).padStart(2, '0')}:`;
    const idx = payload.hourly.time.findIndex(
      (t) => typeof t === 'string' && t.startsWith(targetPrefix)
    );
    const candidate = idx >= 0 ? payload.hourly.temperature_2m[idx] : null;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      tempVal = Math.round(candidate * 10) / 10;
    }
  }

  const isDay =
    typeof current?.is_day === 'number'
      ? current.is_day === 1
      : hour >= 6 && hour < 18;

  const { periodLabel, greetingPeriod } = getTimePeriodInfo(hour);

  return {
    temperatureC: tempVal,
    isDay,
    weatherEmoji: isDay ? '☀️' : '🌙',
    periodLabel,
    greetingPeriod,
    hanoiDateHeader: formatBangkokDateLabel({
      year,
      month,
      day,
      weekdayIndex,
    }),
    hour,
    locationLabel: 'Hà Nội',
    updatedAt,
    source,
  };
}
