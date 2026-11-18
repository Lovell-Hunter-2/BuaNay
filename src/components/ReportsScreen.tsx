import { useEffect, useMemo, useState } from 'react';
import type {
  MealSlot,
  MealsByDate,
  ReportInsightResult,
  UserProfile,
  WeightEntry,
} from '../types/nutrition';
import {
  MEAL_SLOTS,
  formatViNumber,
  getLocalPeriodRuleInsight,
  getPeriodReportStats,
  getWeightChangeStats,
  parseApiJson,
  type DailyTotals,
} from '../utils/nutrition';
import { MamMascot3D } from './MamMascot3D';

const REPORT_AI_CACHE_KEY = 'buanay_report_ai_cache_v1';

interface ReportsScreenProps {
  profile: UserProfile;
  totals: DailyTotals;
  mealsByDate: MealsByDate;
  weightHistory: WeightEntry[];
  onLogWeight: (weightKg: number) => void;
}

export function ReportsScreen({
  profile,
  totals,
  mealsByDate,
  weightHistory,
  onLogWeight,
}: ReportsScreenProps) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [weightInput, setWeightInput] = useState(String(profile.weightKg));
  const [weightSavedNotice, setWeightSavedNotice] = useState(false);
  const [aiInsight, setAiInsight] = useState<ReportInsightResult | null>(null);
  const [aiPeriodTag, setAiPeriodTag] = useState<'week' | 'month' | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const stats = useMemo(
    () => getPeriodReportStats(mealsByDate, profile, period),
    [mealsByDate, profile, period]
  );

  const reportCacheKey = `${period}:${stats.loggedDaysCount}:${stats.totalMealsCount}:${stats.avgCalories}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REPORT_AI_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ReportInsightResult>;
      const cached = parsed[reportCacheKey];
      if (cached) {
        setAiInsight(cached);
        setAiPeriodTag(period);
      }
    } catch {
      // Ignore corrupt cache safely
    }
  }, [reportCacheKey, period]);

  const localInsight = useMemo(
    () => getLocalPeriodRuleInsight(stats, profile),
    [stats, profile]
  );

  const activeInsight =
    aiInsight && aiPeriodTag === period ? aiInsight : localInsight;
  const isShowingAiInsight = Boolean(aiInsight && aiPeriodTag === period);

  const weightStats = useMemo(
    () => getWeightChangeStats(weightHistory),
    [weightHistory]
  );

  const maxChartCalories = Math.max(
    profile.targetCalories * 1.1,
    ...stats.buckets.map((b) => b.avgCalories),
    1000
  );

  const useAvgMacros = stats.loggedDaysCount > 0;
  const macroDisplay = useAvgMacros ? stats.avgMacros : totals;

  const macroTargets = [
    {
      label: 'Đạm (Protein)',
      current: macroDisplay.protein,
      target: profile.targets.protein,
      color: 'var(--protein)',
    },
    {
      label: 'Tinh bột (Carbs)',
      current: macroDisplay.carbs,
      target: profile.targets.carbs,
      color: 'var(--carbs)',
    },
    {
      label: 'Chất xơ (Fiber)',
      current: macroDisplay.fiber,
      target: profile.targets.fiber,
      color: 'var(--fiber)',
    },
    {
      label: 'Chất béo (Fat)',
      current: macroDisplay.fat,
      target: profile.targets.fat,
      color: 'var(--fat)',
    },
  ];

  const sodiumTarget = profile.healthConditions?.includes('Huyết áp cao')
    ? 1500
    : 2000;
  const sugarTarget = profile.healthConditions?.includes('Đường huyết nhạy cảm')
    ? 20
    : 25;

  const handleSaveWeight = () => {
    const val = Number(weightInput);
    if (!Number.isFinite(val) || val < 30 || val > 200) return;
    onLogWeight(val);
    setWeightSavedNotice(true);
    window.setTimeout(() => setWeightSavedNotice(false), 2400);
  };

  const handleFetchAiInsight = async (forceRefresh = false) => {
    setAiError(null);
    if (!forceRefresh) {
      try {
        const raw = window.localStorage.getItem(REPORT_AI_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, ReportInsightResult>;
          if (parsed[reportCacheKey]) {
            setAiInsight(parsed[reportCacheKey]);
            setAiPeriodTag(period);
            return;
          }
        }
      } catch {
        // Proceed to API fetch if cache unreadable
      }
    }

    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'report_insight',
          period,
          profile,
          reportStats: {
            loggedDaysCount: stats.loggedDaysCount,
            totalMealsCount: stats.totalMealsCount,
            uniqueDishesCount: stats.uniqueDishesCount,
            avgCalories: stats.avgCalories,
            avgMacros: stats.avgMacros,
            slotCalorieShare: stats.slotCalorieShare,
            deficientNutrients: stats.deficientNutrients,
          },
        }),
      });
      const data = await parseApiJson<{
        insight?: ReportInsightResult;
        error?: string;
      }>(res);
      if (!res.ok || !data.insight) {
        throw new Error(data.error || 'Không thể lấy phân tích AI lúc này.');
      }
      setAiInsight(data.insight);
      setAiPeriodTag(period);
      try {
        const raw = window.localStorage.getItem(REPORT_AI_CACHE_KEY);
        const existing = raw
          ? (JSON.parse(raw) as Record<string, ReportInsightResult>)
          : {};
        existing[reportCacheKey] = data.insight;
        window.localStorage.setItem(
          REPORT_AI_CACHE_KEY,
          JSON.stringify(existing)
        );
      } catch {
        // Ignore storage quota errors safely
      }
    } catch (err: unknown) {
      setAiError(
        err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ AI.'
      );
    } finally {
      setIsLoadingAi(false);
    }
  };

  const chartPoints = useMemo(() => {
    const recent = weightHistory.slice(-7);
    if (recent.length < 2) return null;
    const minW = Math.min(...recent.map((w) => w.weightKg)) - 0.5;
    const maxW = Math.max(...recent.map((w) => w.weightKg)) + 0.5;
    const span = Math.max(1, maxW - minW);
    const width = 280;
    const height = 64;
    const coords = recent.map((entry, idx) => {
      const x = Math.round((idx / (recent.length - 1)) * (width - 24) + 12);
      const y = Math.round(
        height - 10 - ((entry.weightKg - minW) / span) * (height - 20)
      );
      return { x, y, entry };
    });
    return {
      coords,
      polyline: coords.map((c) => `${c.x},${c.y}`).join(' '),
      width,
      height,
    };
  }, [weightHistory]);

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[105px] md:pb-[48px]">
      <div className="md:flex md:items-end md:justify-between md:gap-[16px] mb-[14px] md:mb-[18px]">
        <header className="mb-[14px] md:mb-0">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#9E8E78] m-0">
            DỮ LIỆU THỰC TẾ {period === 'week' ? '7 NGÀY' : '30 NGÀY'}
          </p>
          <h1 className="text-[22px] md:text-[24px] font-extrabold text-[#2D2416] m-0 mt-[2px]">
            Báo cáo dinh dưỡng
          </h1>
        </header>

        {/* Period Toggle */}
        <div className="grid grid-cols-2 gap-[8px] md:w-[320px] shrink-0">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`py-[9px] px-[12px] rounded-[14px] text-[13px] border-[1.5px] cursor-pointer transition-all whitespace-nowrap ${
              period === 'week'
                ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-extrabold'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
            }`}
          >
            Tuần (7 ngày)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`py-[9px] px-[12px] rounded-[14px] text-[13px] border-[1.5px] cursor-pointer transition-all whitespace-nowrap ${
              period === 'month'
                ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-extrabold'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
            }`}
          >
            Tháng (30 ngày)
          </button>
        </div>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-[18px] md:items-start">
        <div className="md:col-span-7 flex flex-col gap-[14px]">
      {/* Period Calories Chart Card */}
      <section className="neo-card p-[16px]">
        <div className="flex items-baseline justify-between gap-[8px]">
          <div>
            <p className="text-[10px] font-bold tracking-[0.06em] text-[#9E8E78] m-0">
              {stats.loggedDaysCount > 0
                ? `TRUNG BÌNH ${stats.loggedDaysCount}/${stats.totalDaysWindow} NGÀY ĐÃ GHI`
                : 'CHƯA CÓ DỮ LIỆU GHI NHẬN'}
            </p>
            <div className="flex items-baseline gap-[6px] mt-[3px] tabular-nums">
              <span className="text-[28px] font-extrabold text-[#CC5F1A] leading-none">
                {formatViNumber(stats.avgCalories)}
              </span>
              <span className="text-[13px] font-semibold text-[#9E8E78]">
                kcal / ngày
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#037A5B] bg-[#D4F7EE] px-[10px] py-[4px] rounded-full whitespace-nowrap">
            Mục tiêu {formatViNumber(profile.targetCalories)}
          </span>
        </div>

        <div
          className={`mt-[18px] grid gap-[8px] items-end h-[132px] ${
            stats.buckets.length === 4 ? 'grid-cols-4' : 'grid-cols-7'
          }`}
        >
          {stats.buckets.map((item) => {
            const heightPct =
              item.avgCalories === 0
                ? 4
                : Math.max(
                    12,
                    Math.round((item.avgCalories / maxChartCalories) * 100)
                  );
            const overTarget = item.avgCalories > item.target;

            return (
              <div
                key={item.label}
                className="flex flex-col items-center justify-end h-full gap-[6px]"
              >
                <span className="text-[9px] font-bold text-[#9E8E78] tabular-nums">
                  {item.avgCalories > 0
                    ? `${formatViNumber(item.avgCalories)}`
                    : '0'}
                </span>
                <div className="w-full flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[28px] rounded-t-[8px] rounded-b-[4px] border-[1.5px] transition-all duration-300"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor:
                        item.avgCalories === 0
                          ? 'var(--bg2)'
                          : item.isCurrent
                          ? 'var(--accent)'
                          : overTarget
                          ? 'var(--protein-soft)'
                          : 'var(--primary-soft)',
                      borderColor:
                        item.avgCalories === 0
                          ? 'var(--border)'
                          : item.isCurrent
                          ? '#CC5F1A'
                          : overTarget
                          ? 'var(--protein)'
                          : 'var(--primary)',
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] text-center leading-tight ${
                    item.isCurrent
                      ? 'font-extrabold text-[#FF8A3D]'
                      : 'font-semibold text-[#6B5D47]'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Macro Target Completion */}
      <section className="neo-card p-[16px]">
        <h2 className="text-[16px] font-extrabold text-[#2D2416] m-0 mb-[4px]">
          {useAvgMacros
            ? `Trung bình chất dinh dưỡng (${period === 'week' ? '7 ngày' : '30 ngày'})`
            : 'Mức đạt chất dinh dưỡng hôm nay'}
        </h2>
        <p className="text-[11px] font-medium text-[#9E8E78] m-0 mb-[14px]">
          So sánh với mục tiêu cá nhân hóa của {profile.name}
        </p>

        <div className="flex flex-col gap-[12px]">
          {macroTargets.map((macro) => {
            const pct = Math.min(
              100,
              Math.round((macro.current / Math.max(macro.target, 1)) * 100)
            );
            return (
              <div key={macro.label}>
                <div className="flex items-center justify-between text-[12px] mb-[5px]">
                  <span className="font-bold text-[#2D2416]">{macro.label}</span>
                  <span className="font-bold text-[#6B5D47] tabular-nums">
                    {macro.current}g / {macro.target}g ({pct}%)
                  </span>
                </div>
                <div className="h-[9px] w-full rounded-full bg-[#EDE5CC] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: macro.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Micronutrients: Sodium & Free Sugar Today */}
        <div className="mt-[14px] pt-[12px] border-t border-[#EDE5CC]">
          <p className="text-[11px] font-extrabold text-[#6B5D47] m-0 mb-[8px]">
            VI CHẤT CẦN KIỂM SOÁT HÔM NAY (THEO NGƯỠNG WHO)
          </p>
          <div className="grid grid-cols-2 gap-[8px]">
            <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px]">
              <span className="block text-[10px] font-bold text-[#6B5D47]">
                Natri (muối)
              </span>
              <span
                className={`block text-[15px] font-extrabold mt-[2px] tabular-nums ${
                  totals.sodiumMg > sodiumTarget
                    ? 'text-[#D64545]'
                    : 'text-[#2D2416]'
                }`}
              >
                {formatViNumber(totals.sodiumMg)} / {formatViNumber(sodiumTarget)} mg
              </span>
            </div>
            <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px]">
              <span className="block text-[10px] font-bold text-[#6B5D47]">
                Đường tự do
              </span>
              <span
                className={`block text-[15px] font-extrabold mt-[2px] tabular-nums ${
                  totals.sugarG > sugarTarget
                    ? 'text-[#D64545]'
                    : 'text-[#2D2416]'
                }`}
              >
                {totals.sugarG} / {sugarTarget} g
              </span>
            </div>
          </div>
        </div>
      </section>
        </div>

        <div className="md:col-span-5 flex flex-col gap-[14px] mt-[14px] md:mt-0">
      {/* Real Weight Tracking Card */}
      <section className="neo-card p-[16px]">
        <div className="flex items-start justify-between gap-[8px]">
          <div>
            <p className="text-[10px] font-bold tracking-[0.05em] text-[#9E8E78] m-0">
              NHẬT KÝ CÂN NẶNG THỰC TẾ
            </p>
            <div className="flex items-baseline gap-[6px] mt-[2px] tabular-nums">
              <span className="text-[24px] font-extrabold text-[#2D2416]">
                {profile.weightKg} kg
              </span>
              <span className="text-[12px] font-semibold text-[#6B5D47]">
                · BMI {profile.bmi}
              </span>
            </div>
          </div>

          {weightHistory.length >= 2 && (
            <span
              className={`px-[9px] py-[3px] rounded-full text-[11px] font-bold tabular-nums ${
                weightStats.deltaKg === 0
                  ? 'bg-[#F2EBD8] text-[#6B5D47]'
                  : weightStats.deltaKg < 0
                  ? 'bg-[#D4F7EE] text-[#037A5B]'
                  : 'bg-[#FFEEDD] text-[#CC5F1A]'
              }`}
            >
              {weightStats.deltaKg > 0
                ? `+${weightStats.deltaKg}`
                : weightStats.deltaKg}{' '}
              kg
            </span>
          )}
        </div>

        {chartPoints ? (
          <div className="mt-[10px] rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px]">
            <svg
              viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
              className="w-full h-[64px] overflow-visible"
              aria-label="Biểu đồ cân nặng theo thời gian"
            >
              <polyline
                fill="none"
                stroke="#06D6A0"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartPoints.polyline}
              />
              {chartPoints.coords.map((c) => (
                <circle
                  key={c.entry.dateKey}
                  cx={c.x}
                  cy={c.y}
                  r="4"
                  fill="#FF8A3D"
                  stroke="#FFFDF5"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <div className="flex items-center justify-between text-[10px] font-semibold text-[#9E8E78] mt-[4px] tabular-nums">
              <span>
                {chartPoints.coords[0].entry.dateKey.slice(5)} (
                {chartPoints.coords[0].entry.weightKg}kg)
              </span>
              <span>
                {chartPoints.coords[chartPoints.coords.length - 1].entry.dateKey.slice(5)} (
                {chartPoints.coords[chartPoints.coords.length - 1].entry.weightKg}kg)
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[8px]">
            Cập nhật cân nặng vào các ngày khác nhau để vẽ biểu đồ biến động thực tế của riêng bạn.
          </p>
        )}

        <div className="flex items-center gap-[8px] mt-[10px]">
          <input
            type="number"
            step="0.1"
            min={30}
            max={200}
            aria-label="Cân nặng hôm nay (kg)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="w-[96px] px-[10px] py-[8px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-extrabold text-[#2D2416] tabular-nums"
          />
          <button
            type="button"
            onClick={handleSaveWeight}
            className="flex-1 py-[9px] rounded-[12px] bg-[#06D6A0] text-[#033F2E] text-[12px] font-extrabold border-[1.5px] border-[#037A5B] cursor-pointer"
          >
            Cập nhật cân nặng hôm nay
          </button>
        </div>
        {weightSavedNotice && (
          <p className="text-[11px] font-bold text-[#037A5B] m-0 mt-[6px]">
            Đã lưu cân nặng {profile.weightKg}kg và cập nhật lại BMI/KPI!
          </p>
        )}
      </section>

      {/* Meal Slot Share & Dish Variety */}
      <section className="neo-card p-[16px]">
        <div className="flex items-center justify-between gap-[8px] mb-[12px]">
          <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
            Phân bổ bữa & Đa dạng món
          </h2>
          <span className="rounded-full px-[10px] py-[3px] text-[11px] font-bold bg-[#FFEEDD] text-[#CC5F1A] tabular-nums">
            {stats.uniqueDishesCount} món khác nhau
          </span>
        </div>

        <div className="grid grid-cols-4 gap-[6px]">
          {MEAL_SLOTS.map((slot: MealSlot) => (
            <div
              key={slot}
              className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[8px] text-center"
            >
              <span className="block text-[11px] font-bold text-[#6B5D47]">
                {slot}
              </span>
              <span className="block text-[15px] font-extrabold text-[#2D2416] mt-[2px] tabular-nums">
                {stats.slotCalorieShare[slot]}%
              </span>
              <span className="block text-[10px] font-semibold text-[#9E8E78] tabular-nums">
                {stats.slotCounts[slot]} bữa
              </span>
            </div>
          ))}
        </div>

        {stats.deficientNutrients.length > 0 && (
          <div className="mt-[12px] flex flex-wrap items-center gap-[6px]">
            <span className="text-[11px] font-bold text-[#6B5D47]">
              Cần chú ý:
            </span>
            {stats.deficientNutrients.map((nut) => (
              <span
                key={nut}
                className="px-[9px] py-[3px] rounded-full text-[11px] font-bold bg-[#FFE8E8] text-[#C94A4A] border border-[#FF6B6B]/40"
              >
                {nut}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Mầm AI Report Companion Card */}
      <section className="neo-card p-[16px]">
        <div className="flex items-center gap-[12px]">
          <MamMascot3D size={52} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.05em] text-[#037A5B] m-0">
              NHẬN XÉT TỪ MẦM
            </p>
            <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0 mt-[2px]">
              {activeInsight.headline}
            </h2>
          </div>
        </div>

        <div className="mt-[12px] flex flex-col gap-[8px] text-[12px] font-medium text-[#2D2416] leading-relaxed">
          <div className="rounded-[12px] bg-[#D4F7EE]/60 border border-[#06D6A0]/40 p-[10px]">
            <strong className="text-[#037A5B] block text-[11px] mb-[2px]">
              Điểm tích cực
            </strong>
            {activeInsight.strengths}
          </div>
          <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px]">
            <strong className="text-[#CC5F1A] block text-[11px] mb-[2px]">
              Điểm cần lưu ý
            </strong>
            {activeInsight.watchOut}
          </div>
          <div className="rounded-[12px] bg-[#F2EBD8]/70 border border-[#DDD0B0] p-[10px]">
            <strong className="text-[#2D2416] block text-[11px] mb-[2px]">
              Gợi ý nhẹ nhàng tiếp theo
            </strong>
            {activeInsight.actionTip}
          </div>
        </div>

        {stats.loggedDaysCount > 0 && (
          <button
            type="button"
            onClick={() => void handleFetchAiInsight(isShowingAiInsight)}
            disabled={isLoadingAi}
            className="w-full mt-[12px] py-[10px] rounded-[14px] bg-[#06D6A0] text-[#033F2E] text-[13px] font-extrabold border-[1.5px] border-[#037A5B] cursor-pointer disabled:opacity-70"
            style={{ boxShadow: '0 2px 0 #037A5B' }}
          >
            {isLoadingAi
              ? 'Mầm đang đọc dữ liệu...'
              : isShowingAiInsight
              ? 'Làm mới nhận xét chuyên sâu'
              : 'Phân tích chuyên sâu xu hướng'}
          </button>
        )}

        {aiError && (
          <p
            role="alert"
            className="mt-[8px] text-[11px] font-semibold text-[#C94A4A] m-0"
          >
            {aiError}
          </p>
        )}

        <p className="text-[10px] font-medium text-[#9E8E78] m-0 mt-[10px] leading-snug">
          * Lưu ý: Báo cáo dinh dưỡng mang tính tham khảo hỗ trợ thói quen ăn uống, không thay thế tư vấn hoặc chẩn đoán y tế chuyên môn.
        </p>
      </section>
        </div>
      </div>
    </div>
  );
}
