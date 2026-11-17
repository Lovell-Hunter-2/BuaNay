import { useState } from 'react';
import { createPortal } from 'react-dom';
import { loadDishBank } from '../data/dishes';
import type {
  BudgetLevel,
  FoodSwapResponse,
  MealDiningMode,
  MealEntry,
  MealSlot,
  MealSuggestion,
  UserProfile,
} from '../types/nutrition';
import {
  pickTier1FoodSwapsSmart,
  pickTier1MenuSuggestions,
  type CuisineFilter,
} from '../utils/dishMatcher';
import {
  BUDGET_OPTIONS,
  MEAL_SLOTS,
  QUICK_AVAILABLE_INGREDIENTS,
  formatViNumber,
  getGoalLabel,
  parseApiJson,
  type DailyTotals,
} from '../utils/nutrition';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  PlusIcon,
  UtensilsIcon,
} from './Icons';

const CUISINE_FILTERS: Array<{ id: CuisineFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'vietnam', label: 'Món Việt' },
  { id: 'healthy_intl', label: 'Quốc tế' },
  { id: 'drink', label: 'Uống & Xế' },
];

interface MealSuggestionsScreenProps {
  profile: UserProfile;
  totals: DailyTotals;
  defaultSlot: MealSlot;
  initialMode?: 'menu' | 'swap';
  initialCraving?: string;
  initialSlot?: MealSlot;
  onBack: () => void;
  onOpenGuide: () => void;
  onLogSuggestedMeal: (meal: Omit<MealEntry, 'id'>) => void;
  onFeedbackSuggestion?: (
    dishName: string,
    action: 'liked' | 'disliked' | 'tried'
  ) => void;
}

export function MealSuggestionsScreen({
  profile,
  totals,
  defaultSlot,
  initialMode = 'menu',
  initialCraving = '',
  initialSlot,
  onBack,
  onOpenGuide,
  onLogSuggestedMeal,
  onFeedbackSuggestion,
}: MealSuggestionsScreenProps) {
  const [mode, setMode] = useState<'menu' | 'swap'>(initialMode);
  const [diningMode, setDiningMode] = useState<MealDiningMode>('eat_out');
  const [budgetOverride, setBudgetOverride] = useState<BudgetLevel>(
    profile.budgetLevel ?? 'balanced'
  );
  const [availableIngredients, setAvailableIngredients] = useState('');
  const [preferredSlot, setPreferredSlot] = useState<MealSlot>(
    initialSlot ?? defaultSlot
  );
  const [cuisineFilter, setCuisineFilter] = useState<CuisineFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [summaryTip, setSummaryTip] = useState<string>('');
  const [suggestionSource, setSuggestionSource] = useState<
    'local_bank' | 'gemini_ai' | null
  >(null);
  const [varietySeed, setVarietySeed] = useState<number>(() =>
    Math.floor(Date.now() % 1000)
  );
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [shownDishNames, setShownDishNames] = useState<string[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<MealSuggestion | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const [cravingDish, setCravingDish] = useState(initialCraving);
  const [swapResult, setSwapResult] = useState<FoodSwapResponse | null>(null);
  const [swapShownMap, setSwapShownMap] = useState<Record<string, string[]>>({});
  const [swapSource, setSwapSource] = useState<
    'local_bank' | 'gemini_ai' | null
  >(null);

  const feedback = profile.suggestionFeedback ?? {
    liked: [],
    disliked: [],
    tried: [],
  };

  const remaining = {
    calories: Math.max(0, profile.targetCalories - totals.calories),
    protein: Math.max(0, profile.targets.protein - totals.protein),
    carbs: Math.max(0, profile.targets.carbs - totals.carbs),
    fiber: Math.max(0, profile.targets.fiber - totals.fiber),
    fat: Math.max(0, profile.targets.fat - totals.fat),
  };

  const toggleQuickIngredient = (ing: string) => {
    const parts = availableIngredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === ing.toLowerCase());
    const next = exists
      ? parts.filter((p) => p.toLowerCase() !== ing.toLowerCase())
      : [...parts, ing];
    setAvailableIngredients(next.join(', '));
  };

  const fetchMenuFromGemini = async () => {
    const effectiveProfile: UserProfile = {
      ...profile,
      budgetLevel: budgetOverride,
    };
    const res = await fetch('/api/suggest-meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'menu',
        diningMode,
        availableIngredients:
          diningMode === 'home_cook' ? availableIngredients.trim() : '',
        profile: effectiveProfile,
        remaining,
        preferredSlot,
      }),
    });
    const data = await parseApiJson<{
      summaryTip?: string;
      suggestions?: MealSuggestion[];
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lấy thực đơn gợi ý.');
    }
    setSummaryTip(data.summaryTip || '');
    setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    setSuggestionSource('gemini_ai');
  };

  const fetchMenuSuggestions = async (forceAi = false) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      if (!forceAi) {
        const dishes = await loadDishBank();
        const nextSeed = varietySeed + 1;
        setVarietySeed(nextSeed);
        const effectiveProfile: UserProfile = {
          ...profile,
          budgetLevel: budgetOverride,
        };
        let tier1 = pickTier1MenuSuggestions({
          dishes,
          profile: effectiveProfile,
          remaining,
          diningMode,
          preferredSlot,
          budgetOverride,
          availableIngredients:
            diningMode === 'home_cook' ? availableIngredients.trim() : '',
          excludeNames: shownDishNames,
          cuisineFilter,
          varietySeed: nextSeed,
        });

        // If user cycled through all matching items in pool, reset cycle cleanly
        if (tier1.suggestions.length === 0 && shownDishNames.length > 0) {
          tier1 = pickTier1MenuSuggestions({
            dishes,
            profile: effectiveProfile,
            remaining,
            diningMode,
            preferredSlot,
            budgetOverride,
            availableIngredients:
              diningMode === 'home_cook' ? availableIngredients.trim() : '',
            excludeNames: [],
            cuisineFilter,
            varietySeed: nextSeed + 17,
          });
          setShownDishNames([]);
        }

        if (!tier1.usedIngredientFallbackToAi && tier1.suggestions.length > 0) {
          setSummaryTip(tier1.summaryTip);
          setSuggestions(tier1.suggestions);
          setSuggestionSource('local_bank');
          setShownDishNames((prev) => [
            ...prev,
            ...tier1.suggestions.map((s) => s.name),
          ]);
          return;
        }
      }

      await fetchMenuFromGemini();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ gợi ý AI.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFoodSwaps = async (forceAi = false) => {
    const cleanCraving = cravingDish.trim();
    if (!cleanCraving) {
      setErrorMsg('Vui lòng nhập món bạn đang thèm hoặc muốn tìm đồ thay thế.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      if (!forceAi) {
        const dishes = await loadDishBank();
        const cravingKey = cleanCraving.toLowerCase();
        const prevSwaps = swapShownMap[cravingKey] ?? [];
        const nextSeed = varietySeed + 1;
        setVarietySeed(nextSeed);

        let localSwap = pickTier1FoodSwapsSmart({
          dishes,
          cravingDish: cleanCraving,
          profile: { ...profile, budgetLevel: budgetOverride },
          excludeNames: prevSwaps,
          varietySeed: nextSeed,
        });

        // Reset rotation if user cycled through all matching swaps for this craving
        if (!localSwap && prevSwaps.length > 0) {
          localSwap = pickTier1FoodSwapsSmart({
            dishes,
            cravingDish: cleanCraving,
            profile: { ...profile, budgetLevel: budgetOverride },
            excludeNames: [],
            varietySeed: nextSeed + 13,
          });
          if (localSwap) {
            setSwapShownMap((prev) => ({
              ...prev,
              [cravingKey]: localSwap!.swaps.map((s) => s.alternativeName),
            }));
          }
        } else if (localSwap) {
          setSwapShownMap((prev) => ({
            ...prev,
            [cravingKey]: [
              ...prevSwaps,
              ...localSwap!.swaps.map((s) => s.alternativeName),
            ],
          }));
        }

        if (localSwap) {
          setSwapResult(localSwap);
          setSwapSource('local_bank');
          return;
        }
      }

      const res = await fetch('/api/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'swap',
          profile: { ...profile, budgetLevel: budgetOverride },
          remaining,
          cravingDish: cravingDish.trim(),
        }),
      });
      const data = await parseApiJson<{
        swapResult?: FoodSwapResponse;
        error?: string;
      }>(res);
      if (!res.ok || !data.swapResult) {
        throw new Error(data.error || 'Không thể tìm đồ thay thế.');
      }
      setSwapResult(data.swapResult);
      setSwapSource('gemini_ai');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ gợi ý AI.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (
    dishName: string,
    action: 'liked' | 'disliked' | 'tried'
  ) => {
    onFeedbackSuggestion?.(dishName, action);
    if (action === 'disliked') {
      setSuggestions((prev) =>
        prev.filter((s) => s.name.toLowerCase() !== dishName.toLowerCase())
      );
      setFeedbackNotice(
        `Đã ẩn "${dishName}" — AI sẽ tránh gợi ý lại món này lần sau.`
      );
    } else if (action === 'liked') {
      setFeedbackNotice(`Đã lưu "${dishName}" vào danh sách món yêu thích!`);
    } else {
      setFeedbackNotice(`Đã đánh dấu đã thử "${dishName}".`);
    }
    window.setTimeout(() => {
      setFeedbackNotice(null);
    }, 2600);
  };

  const handleLogSuggestion = (item: MealSuggestion) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const validSlot: MealSlot = MEAL_SLOTS.includes(item.slot)
      ? item.slot
      : preferredSlot;

    onFeedbackSuggestion?.(item.name, 'tried');
    setActiveRecipe(null);

    onLogSuggestedMeal({
      slot: validSlot,
      name: item.name,
      time: `${hh}:${mm}`,
      calories: Math.round(item.calories),
      protein: Math.round(item.protein),
      carbs: Math.round(item.carbs),
      fiber: Math.round(item.fiber),
      fat: Math.round(item.fat),
      sodiumMg: item.sodiumMg,
      sugarG: item.sugarG,
      contexts:
        (item.diningMode ?? diningMode) === 'home_cook'
          ? ['Tự nấu ít dầu']
          : ['Ăn ngoài quán'],
      isHealthy: true,
      portionEstimate: item.portionEstimate,
      summaryNote: item.whyItFits,
    });
  };

  const isInList = (list: string[], name: string) =>
    list.some((x) => x.toLowerCase() === name.toLowerCase());

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[110px] md:pb-[48px]">
      <header className="flex items-center justify-between gap-[10px] mb-[16px]">
        <div className="flex items-center gap-[12px] min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại trang chủ"
            className="md:hidden w-[40px] h-[40px] shrink-0 rounded-full bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#2D2416] cursor-pointer hover:border-[#C5B890] transition-colors"
            style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[20px] md:text-[24px] font-extrabold text-[#2D2416] m-0">
              Thực đơn & Đồ thay thế
            </h1>
            <p className="text-[11px] md:text-[12px] font-semibold text-[#9E8E78] m-0 truncate">
              Cá nhân hóa cho {profile.name} · BMI {profile.bmi} ·{' '}
              {getGoalLabel(profile.goal)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenGuide}
          className="shrink-0 px-[10px] md:px-[14px] py-[6px] md:py-[8px] rounded-full md:rounded-[12px] bg-[#FFEEDD] border border-[#FF8A3D]/45 text-[#CC5F1A] text-[11px] md:text-[12px] font-bold cursor-pointer flex items-center gap-[5px] whitespace-nowrap"
        >
          <BookOpenIcon size={14} />
          <span>Cẩm nang</span>
        </button>
      </header>

      <div className="md:flex md:items-center md:justify-between md:gap-[16px] mb-[14px]">
        {/* Remaining budget summary */}
        <div className="neo-card p-[14px] mb-[14px] md:mb-0 md:flex-1">
          <div className="flex items-center justify-between text-[12px] gap-[10px]">
            <span className="font-bold text-[#6B5D47]">Còn lại hôm nay:</span>
            <span className="font-extrabold text-[#FF8A3D] tabular-nums">
              {formatViNumber(remaining.calories)} kcal · {remaining.protein}g Đạm ·{' '}
              {remaining.fiber}g Xơ
            </span>
          </div>
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-2 gap-[8px] md:w-[320px] shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('menu');
              setErrorMsg(null);
            }}
            className={`py-[10px] px-[12px] rounded-[14px] text-[13px] border-[1.5px] cursor-pointer transition-all whitespace-nowrap ${
              mode === 'menu'
                ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-extrabold'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
            }`}
          >
            Gợi ý thực đơn
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('swap');
              setErrorMsg(null);
            }}
            className={`py-[10px] px-[12px] rounded-[14px] text-[13px] border-[1.5px] cursor-pointer transition-all whitespace-nowrap ${
              mode === 'swap'
                ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-extrabold'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
            }`}
          >
            Tìm đồ thay thế
          </button>
        </div>
      </div>

      {mode === 'menu' ? (
        <div className="md:grid md:grid-cols-12 md:gap-[20px] md:items-start">
          <div className="md:col-span-4 md:neo-card md:p-[16px]">
          {/* Dining Mode Split: Eat Out vs Home Cook */}
          <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
            HÌNH THỨC BỮA ĂN
          </p>
          <div className="grid grid-cols-2 gap-[8px] mb-[12px]">
            <button
              type="button"
              onClick={() => setDiningMode('eat_out')}
              className={`py-[9px] px-[10px] rounded-[12px] text-[12px] border-[1.5px] cursor-pointer transition-colors ${
                diningMode === 'eat_out'
                  ? 'bg-[#FFFDF5] border-[#FF8A3D] text-[#CC5F1A] font-extrabold'
                  : 'bg-[#F2EBD8] border-[#DDD0B0] text-[#6B5D47] font-semibold'
              }`}
            >
              Ăn ngoài / Đặt món
            </button>
            <button
              type="button"
              onClick={() => setDiningMode('home_cook')}
              className={`py-[9px] px-[10px] rounded-[12px] text-[12px] border-[1.5px] cursor-pointer transition-colors ${
                diningMode === 'home_cook'
                  ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-extrabold'
                  : 'bg-[#F2EBD8] border-[#DDD0B0] text-[#6B5D47] font-semibold'
              }`}
            >
              Tự nấu tại nhà
            </button>
          </div>

          {diningMode === 'eat_out' ? (
            <div className="mb-[12px]">
              <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[6px]">
                NGÂN SÁCH BỮA NÀY
              </p>
              <div className="grid grid-cols-3 gap-[6px]">
                {BUDGET_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetOverride(b.id)}
                    className={`py-[7px] px-[6px] rounded-[10px] text-[11px] border-[1.5px] cursor-pointer ${
                      budgetOverride === b.id
                        ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                        : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                    }`}
                  >
                    {b.id === 'economy'
                      ? 'Tiết kiệm'
                      : b.id === 'balanced'
                      ? 'Vừa túi'
                      : 'Thoải mái'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="neo-card p-[12px] mb-[12px]">
              <label
                htmlFor="available-ingredients-input"
                className="block text-[11px] font-bold tracking-[0.04em] text-[#037A5B] mb-[6px]"
              >
                NGUYÊN LIỆU ĐANG CÓ SẴN TRONG TỦ LẠNH
              </label>
              <input
                id="available-ingredients-input"
                type="text"
                value={availableIngredients}
                onChange={(e) => setAvailableIngredients(e.target.value)}
                placeholder="Ví dụ: Trứng gà, ức gà, cà chua, rau cải..."
                className="w-full px-[12px] py-[9px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-medium text-[#2D2416] placeholder:text-[#9E8E78] focus:outline-none focus:border-[#06D6A0]"
              />
              <div className="flex flex-wrap gap-[5px] mt-[8px]">
                {QUICK_AVAILABLE_INGREDIENTS.map((ing) => {
                  const selected = availableIngredients
                    .toLowerCase()
                    .includes(ing.toLowerCase());
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => toggleQuickIngredient(ing)}
                      className={`px-[9px] py-[4px] rounded-full text-[11px] font-semibold border cursor-pointer ${
                        selected
                          ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B]'
                          : 'bg-[#F2EBD8] border-[#DDD0B0] text-[#6B5D47]'
                      }`}
                    >
                      {selected ? `✓ ${ing}` : `+ ${ing}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
            GỢI Ý CHO BUỔI NÀO?
          </p>
          <div className="grid grid-cols-4 gap-[8px] mb-[12px]">
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => {
                  setPreferredSlot(slot);
                  setShownDishNames([]);
                }}
                className={`py-[8px] rounded-[12px] text-[12px] border-[1.5px] cursor-pointer ${
                  preferredSlot === slot
                    ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[6px]">
            PHONG CÁCH MÓN
          </p>
          <div className="grid grid-cols-4 gap-[6px] mb-[12px]">
            {CUISINE_FILTERS.map((cf) => (
              <button
                key={cf.id}
                type="button"
                onClick={() => {
                  setCuisineFilter(cf.id);
                  setShownDishNames([]);
                }}
                className={`py-[7px] px-[4px] rounded-[10px] text-[11px] border-[1.5px] cursor-pointer whitespace-nowrap ${
                  cuisineFilter === cf.id
                    ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                }`}
              >
                {cf.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchMenuSuggestions(false)}
            disabled={isLoading}
            className="w-full py-[13px] rounded-[20px] bg-[#FF8A3D] text-white text-[15px] font-bold neo-cta cursor-pointer disabled:opacity-70"
          >
            {isLoading
              ? diningMode === 'home_cook'
                ? 'Đang lọc món tự nấu & công thức phù hợp...'
                : 'Đang lọc thực đơn ăn ngoài phù hợp...'
              : suggestions.length > 0
              ? 'Gợi ý 3 món khác'
              : diningMode === 'home_cook'
              ? 'Gợi ý món tự nấu & công thức'
              : 'Tạo thực đơn ăn ngoài ngay'}
          </button>
          </div>

          <div className="md:col-span-8">

          {errorMsg && (
            <p
              role="alert"
              className="mt-[12px] text-[12px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[12px] px-[12px] py-[9px] m-0"
            >
              {errorMsg}
            </p>
          )}

          {feedbackNotice && (
            <div
              role="status"
              className="mt-[12px] text-[12px] font-bold text-[#037A5B] bg-[#D4F7EE] border border-[#06D6A0] rounded-[12px] px-[12px] py-[8px]"
            >
              {feedbackNotice}
            </div>
          )}

          {summaryTip && (
            <div className="mt-[14px] md:mt-0 md:mb-[14px] rounded-[14px] p-[12px] bg-[#FFF9ED] border-[1.5px] border-[#DDD0B0]">
              <div className="flex items-center justify-between gap-[8px] mb-[6px]">
                <span
                  className={`inline-block rounded-full px-[8px] py-[2px] text-[10px] font-extrabold whitespace-nowrap ${
                    suggestionSource === 'gemini_ai'
                      ? 'bg-[#FFEEDD] text-[#CC5F1A]'
                      : 'bg-[#D4F7EE] text-[#037A5B]'
                  }`}
                >
                  {suggestionSource === 'gemini_ai'
                    ? 'Thực đơn thiết kế riêng'
                    : 'Gợi ý theo hồ sơ dinh dưỡng'}
                </span>
                {suggestionSource === 'local_bank' && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void fetchMenuSuggestions(true)}
                    className="text-[11px] font-bold text-[#CC5F1A] cursor-pointer hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Sáng tạo thực đơn khác →
                  </button>
                )}
              </div>
              <p className="text-[12px] font-medium text-[#2D2416] leading-relaxed m-0">
                {summaryTip}
              </p>
            </div>
          )}

          {suggestions.length === 0 && !isLoading && !errorMsg && (
            <div className="neo-card p-[24px] mt-[14px] md:mt-0 text-center flex flex-col items-center gap-[8px]">
              <span className="w-[44px] h-[44px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] flex items-center justify-center text-[#9E8E78]">
                <UtensilsIcon size={20} />
              </span>
              <p className="text-[13px] font-semibold text-[#6B5D47] m-0 leading-relaxed max-w-[44ch]">
                {diningMode === 'home_cook'
                  ? 'Chọn nguyên liệu sẵn có trong tủ lạnh (hoặc bỏ trống) để nhận gợi ý món tự nấu Việt & quốc tế kèm công thức chi tiết.'
                  : `Bấm nút phía ${diningMode === 'eat_out' ? 'trên (hoặc bên trái)' : 'trên'} để nhận 3 gợi ý phù hợp với BMI ${profile.bmi}, ngân sách và lượng calo còn lại.`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[12px] mt-[14px] md:mt-0">
            {suggestions.map((item, idx) => {
              const liked = isInList(feedback.liked, item.name);
              const tried = isInList(feedback.tried, item.name);
              const hasRecipe = Boolean(
                item.recipe &&
                  (item.recipe.ingredients?.length > 0 ||
                    item.recipe.steps?.length > 0)
              );

              return (
                <article key={`${item.name}-${idx}`} className="neo-card p-[14px]">
                  <div className="flex items-start justify-between gap-[8px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-[5px] flex-wrap">
                        <span className="inline-block rounded-full px-[9px] py-[2px] text-[10px] font-bold bg-[#D4F7EE] text-[#037A5B]">
                          {item.slot}
                        </span>
                        {item.estimatedCostVnd && (
                          <span className="inline-block rounded-full px-[8px] py-[2px] text-[10px] font-bold bg-[#FFF3CD] text-[#9A6700]">
                            {item.estimatedCostVnd}
                          </span>
                        )}
                        {typeof item.prepMinutes === 'number' &&
                          item.prepMinutes > 0 && (
                            <span className="inline-block rounded-full px-[8px] py-[2px] text-[10px] font-bold bg-[#FFEEDD] text-[#CC5F1A]">
                              ~{item.prepMinutes} phút
                            </span>
                          )}
                      </div>
                      <h2 className="text-[16px] font-extrabold text-[#2D2416] m-0 mt-[5px]">
                        {item.name}
                      </h2>
                      <p className="text-[11px] font-semibold text-[#6B5D47] m-0 mt-[2px]">
                        {item.portionEstimate}
                      </p>
                    </div>
                    <span className="shrink-0 text-[16px] font-extrabold text-[#FF8A3D] tabular-nums">
                      {item.calories} kcal
                    </span>
                  </div>

                  <div className="flex items-center gap-[10px] mt-[8px] text-[11px] font-bold tabular-nums flex-wrap">
                    <span className="text-[#FF6B6B]">Đạm {item.protein}g</span>
                    <span className="text-[#E8A500]">
                      Tinh bột {item.carbs}g
                    </span>
                    <span className="text-[#2EC4B6]">Xơ {item.fiber}g</span>
                    <span className="text-[#9D7BFF]">Béo {item.fat}g</span>
                  </div>

                  <p className="text-[12px] font-medium text-[#2D2416] m-0 mt-[8px] leading-relaxed">
                    {item.whyItFits}
                  </p>

                  <p className="text-[11px] font-semibold text-[#037A5B] bg-[#D4F7EE]/70 rounded-[10px] px-[10px] py-[7px] m-0 mt-[8px] leading-snug">
                    Mẹo thay thế: {item.swapTip}
                  </p>

                  {/* Feedback Loop Row */}
                  <div className="grid grid-cols-3 gap-[6px] mt-[10px]">
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.name, 'liked')}
                      className={`py-[6px] rounded-[10px] text-[11px] font-bold border cursor-pointer ${
                        liked
                          ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B]'
                          : 'bg-[#FFF9ED] border-[#DDD0B0] text-[#6B5D47]'
                      }`}
                    >
                      {liked ? '✓ Đã thích' : 'Thích'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.name, 'disliked')}
                      className="py-[6px] rounded-[10px] text-[11px] font-bold border bg-[#FFF9ED] border-[#DDD0B0] text-[#6B5D47] hover:border-[#FF6B6B] hover:text-[#C94A4A] cursor-pointer"
                    >
                      Không hợp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.name, 'tried')}
                      className={`py-[6px] rounded-[10px] text-[11px] font-bold border cursor-pointer ${
                        tried
                          ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
                          : 'bg-[#FFF9ED] border-[#DDD0B0] text-[#6B5D47]'
                      }`}
                    >
                      {tried ? '✓ Đã thử' : 'Đã thử'}
                    </button>
                  </div>

                  <div className="flex gap-[8px] mt-[8px]">
                    {hasRecipe && (
                      <button
                        type="button"
                        onClick={() => setActiveRecipe(item)}
                        className="flex-1 py-[9px] rounded-[12px] bg-[#D4F7EE] border-[1.5px] border-[#06D6A0] text-[12px] font-extrabold text-[#037A5B] cursor-pointer"
                      >
                        Xem công thức
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLogSuggestion(item)}
                      className="flex-1 py-[9px] rounded-[12px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-bold text-[#2D2416] cursor-pointer flex items-center justify-center gap-[5px] transition-colors"
                    >
                      <PlusIcon size={15} />
                      <span>Chọn ăn & lưu</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          </div>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-12 md:gap-[20px] md:items-start">
          <div className="md:col-span-4 md:neo-card md:p-[16px]">
          <label
            htmlFor="swap-craving-input"
            className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[8px]"
          >
            BẠN ĐANG THÈM HOẶC ĐỊNH ĂN MÓN GÌ?
          </label>
          <input
            id="swap-craving-input"
            type="text"
            value={cravingDish}
            onChange={(e) => {
              setCravingDish(e.target.value);
              setErrorMsg(null);
            }}
            placeholder="Ví dụ: Trà sữa trân châu, Cơm tấm sườn bì chả, Mì gói..."
            className="w-full px-[14px] py-[12px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[14px] font-medium text-[#2D2416] placeholder:text-[#9E8E78] focus:outline-none focus:border-[#06D6A0]"
          />

          <button
            type="button"
            onClick={() => void fetchFoodSwaps(false)}
            disabled={isLoading}
            className="w-full mt-[12px] py-[13px] rounded-[20px] bg-[#06D6A0] text-[#033F2E] text-[15px] font-extrabold border-[1.5px] border-[#037A5B] cursor-pointer disabled:opacity-70 flex items-center justify-center gap-[6px]"
            style={{ boxShadow: '0 3px 0 #037A5B' }}
          >
            <CheckIcon size={18} />
            <span>
              {isLoading
                ? 'Đang tìm món thay thế...'
                : 'Tìm đồ thay thế phù hợp'}
            </span>
          </button>

          {errorMsg && (
            <p
              role="alert"
              className="mt-[12px] text-[12px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[12px] px-[12px] py-[9px] m-0"
            >
              {errorMsg}
            </p>
          )}
          </div>

          <div className="md:col-span-8">
          {!swapResult && !isLoading && !errorMsg && (
            <div className="hidden md:flex neo-card p-[24px] text-center flex-col items-center gap-[8px]">
              <span className="w-[44px] h-[44px] rounded-full bg-[#D4F7EE] border border-[#06D6A0]/50 flex items-center justify-center text-[#037A5B]">
                <CheckIcon size={20} />
              </span>
              <p className="text-[13px] font-semibold text-[#6B5D47] m-0 leading-relaxed max-w-[44ch]">
                Nhập tên món bạn đang thèm ở cột bên trái (ví dụ: Trà sữa, Cơm tấm sườn bì chả, Gà rán...) để BữaNay gợi ý các lựa chọn nhẹ calo hơn mà vẫn hợp khẩu vị.
              </p>
            </div>
          )}

          {swapResult && (
            <div className="mt-[14px] md:mt-0 flex flex-col gap-[10px]">
              <div className="rounded-[14px] p-[12px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] flex items-center justify-between gap-[8px]">
                <span className="text-[12px] font-bold text-[#6B5D47] min-w-0 truncate">
                  Món gốc:{' '}
                  <strong className="text-[#2D2416]">
                    {swapResult.originalDish}
                  </strong>
                </span>
                <span className="text-[13px] font-extrabold text-[#FF6B6B] tabular-nums shrink-0">
                  ~{swapResult.originalEstimatedCalories} kcal
                </span>
              </div>

              {swapSource === 'local_bank' && (
                <div className="flex items-center justify-between gap-[8px] px-[4px]">
                  <span className="text-[10px] font-extrabold text-[#037A5B] whitespace-nowrap">
                    Lựa chọn thay thế tối ưu
                  </span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void fetchFoodSwaps(true)}
                    className="text-[11px] font-bold text-[#CC5F1A] cursor-pointer hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Xem thêm gợi ý chuyên sâu →
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px] md:gap-[12px]">
              {swapResult.swaps.map((sw, idx) => (
                <article
                  key={`${sw.alternativeName}-${idx}`}
                  className="neo-card p-[14px]"
                >
                  <div className="flex items-start justify-between gap-[8px]">
                    <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                      {sw.alternativeName}
                    </h2>
                    <span className="shrink-0 rounded-full px-[9px] py-[3px] text-[11px] font-bold bg-[#D4F7EE] text-[#037A5B] tabular-nums whitespace-nowrap">
                      {sw.calories} kcal (
                      {sw.calorieDiff > 0
                        ? `+${sw.calorieDiff}`
                        : sw.calorieDiff}
                      )
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#FF6B6B] m-0 mt-[4px] tabular-nums">
                    Đạm ~{sw.protein}g
                  </p>
                  <p className="text-[12px] font-medium text-[#2D2416] m-0 mt-[6px] leading-relaxed">
                    {sw.reason}
                  </p>
                  <p className="text-[11px] font-semibold text-[#6B5D47] bg-[#FFF9ED] rounded-[10px] px-[10px] py-[7px] m-0 mt-[8px]">
                    Cách gọi/chế biến: {sw.howToOrderOrCook}
                  </p>
                </article>
              ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Recipe Portal Modal */}
      {activeRecipe &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-modal-title"
            className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
            onClick={() => setActiveRecipe(null)}
          >
            <div
              className="w-full max-w-[360px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[22px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[18px] animate-screen-fade"
              style={{
                boxShadow:
                  '0 4px 0 var(--border-dark), 0 12px 32px rgba(45, 36, 22, 0.24)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-[10px]">
                <div>
                  <span className="inline-block rounded-full px-[9px] py-[2px] text-[10px] font-bold bg-[#D4F7EE] text-[#037A5B]">
                    CÔNG THỨC TỰ NẤU{' '}
                    {activeRecipe.prepMinutes
                      ? `· ~${activeRecipe.prepMinutes} PHÚT`
                      : ''}
                  </span>
                  <h2
                    id="recipe-modal-title"
                    className="text-[18px] font-extrabold text-[#2D2416] m-0 mt-[4px]"
                  >
                    {activeRecipe.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRecipe(null)}
                  className="shrink-0 px-[10px] py-[5px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] text-[11px] font-bold text-[#6B5D47] cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              <div className="flex items-center gap-[8px] mt-[8px] text-[11px] font-bold tabular-nums flex-wrap">
                <span className="text-[#FF8A3D]">{activeRecipe.calories} kcal</span>
                <span className="text-[#FF6B6B]">Đạm {activeRecipe.protein}g</span>
                <span className="text-[#E8A500]">Tinh bột {activeRecipe.carbs}g</span>
                <span className="text-[#2EC4B6]">Xơ {activeRecipe.fiber}g</span>
              </div>

              {activeRecipe.recipe?.ingredients &&
                activeRecipe.recipe.ingredients.length > 0 && (
                  <div className="mt-[12px] rounded-[14px] bg-[#FFF9ED] border border-[#DDD0B0] p-[12px]">
                    <p className="text-[11px] font-extrabold text-[#CC5F1A] m-0 mb-[6px]">
                      NGUYÊN LIỆU & ĐỊNH LƯỢNG
                    </p>
                    <ul className="m-0 pl-[16px] text-[12px] font-medium text-[#2D2416] flex flex-col gap-[4px]">
                      {activeRecipe.recipe.ingredients.map((ing, i) => (
                        <li key={i}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {activeRecipe.recipe?.steps &&
                activeRecipe.recipe.steps.length > 0 && (
                  <div className="mt-[12px]">
                    <p className="text-[11px] font-extrabold text-[#037A5B] m-0 mb-[6px]">
                      CÁC BƯỚC THỰC HIỆN
                    </p>
                    <ol className="m-0 pl-0 list-none flex flex-col gap-[7px]">
                      {activeRecipe.recipe.steps.map((step, i) => (
                        <li
                          key={i}
                          className="rounded-[12px] bg-[#F2EBD8]/70 border border-[#DDD0B0] px-[10px] py-[8px] text-[12px] font-medium text-[#2D2416] flex gap-[8px]"
                        >
                          <span className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#06D6A0] text-[#033F2E] font-extrabold text-[11px] flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

              {activeRecipe.recipe?.cookTip && (
                <p className="text-[11px] font-semibold text-[#037A5B] bg-[#D4F7EE]/70 rounded-[10px] px-[10px] py-[8px] m-0 mt-[10px]">
                  Mẹo bếp nhanh: {activeRecipe.recipe.cookTip}
                </p>
              )}

              <button
                type="button"
                onClick={() => handleLogSuggestion(activeRecipe)}
                className="w-full mt-[14px] py-[12px] rounded-[16px] bg-[#FF8A3D] text-white text-[14px] font-bold neo-cta cursor-pointer"
              >
                Đã nấu & Lưu vào nhật ký hôm nay
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
