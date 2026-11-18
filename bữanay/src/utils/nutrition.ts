import type {
  ActivityLevel,
  AnalyzedMealResult,
  BudgetLevel,
  ContextOption,
  CookingSkill,
  CookingTime,
  Gender,
  MacroValues,
  MascotMood,
  MealBudgetRange,
  MealEntry,
  MealSlot,
  MealsByDate,
  NotificationItem,
  PeriodBucketStat,
  PeriodReportStats,
  ReportInsightResult,
  SuggestionFeedback,
  UserGoal,
  UserProfile,
  WeeklyDayStat,
  WeightEntry,
} from '../types/nutrition';

export const CONTEXT_OPTIONS: ContextOption[] = [
  'Ăn ngoài quán',
  'Tự nấu ít dầu',
  'Ít cơm',
  'Nhiều cơm',
  'Ăn một nửa',
];

export const MEAL_SLOTS: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];

export const GOAL_OPTIONS: Array<{
  id: UserGoal;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'lose_fat',
    label: 'Giảm mỡ bền vững',
    subtitle: 'Thâm hụt nhẹ ~400 kcal/ngày, ưu tiên đạm để giữ cơ',
  },
  {
    id: 'maintain',
    label: 'Giữ dáng & ăn lành mạnh',
    subtitle: 'Cân bằng năng lượng, cải thiện chất lượng bữa ăn hằng ngày',
  },
  {
    id: 'build_muscle',
    label: 'Tập gym & tăng cơ',
    subtitle: 'Đạm cao phục hồi cơ bắp, dư nhẹ calo tập luyện hiệu quả',
  },
  {
    id: 'gain_weight',
    label: 'Tăng cân khỏe mạnh',
    subtitle: 'Tăng năng lượng lành mạnh +350 kcal/ngày, không tích mỡ xấu',
  },
];

export const ACTIVITY_OPTIONS: Array<{
  id: ActivityLevel;
  label: string;
  subtitle: string;
  multiplier: number;
}> = [
  {
    id: 'sedentary',
    label: 'Ít vận động',
    subtitle: 'Làm văn phòng, ngồi nhiều, ít tập thể dục',
    multiplier: 1.2,
  },
  {
    id: 'light',
    label: 'Vận động nhẹ',
    subtitle: 'Đi bộ hoặc tập 1–3 buổi/tuần',
    multiplier: 1.375,
  },
  {
    id: 'moderate',
    label: 'Vận động vừa',
    subtitle: 'Tập gym / thể thao 3–5 buổi/tuần',
    multiplier: 1.55,
  },
  {
    id: 'active',
    label: 'Năng động cao',
    subtitle: 'Tập luyện cường độ cao 6–7 buổi/tuần',
    multiplier: 1.725,
  },
];

export const DIETARY_TAG_OPTIONS: string[] = [
  'Ưu tiên cơm nhà',
  'Hay ăn ngoài quán',
  'Thích món nước (phở, bún)',
  'Ít tinh bột',
  'Ăn chay linh hoạt',
  'Không ăn cay',
  'Hạn chế đường & trà sữa',
  'Dị ứng hải sản',
];

export const BUDGET_OPTIONS: Array<{
  id: BudgetLevel;
  label: string;
  subtitle: string;
}> = [
  { id: 'economy', label: 'Tiết kiệm (<45k/bữa)', subtitle: 'Quán bình dân, tự nấu gọn' },
  { id: 'balanced', label: 'Vừa phải (45–80k)', subtitle: 'Đa dạng cơm, bún, đồ healthy' },
  { id: 'flexible', label: 'Thoải mái (>80k)', subtitle: 'Không giới hạn ngân sách' },
];

export const MEAL_BUDGET_RANGE_OPTIONS: Array<{
  id: MealBudgetRange;
  label: string;
  shortLabel: string;
  minVnd: number;
  maxVnd: number | null;
  fallbackBudgetLevel: BudgetLevel;
}> = [
  {
    id: 'under_50k',
    label: 'Dưới 50.000đ',
    shortLabel: 'Dưới 50k',
    minVnd: 0,
    maxVnd: 49999,
    fallbackBudgetLevel: 'economy',
  },
  {
    id: '50_80k',
    label: '50.000đ – 80.000đ',
    shortLabel: '50 - 80k',
    minVnd: 50000,
    maxVnd: 80000,
    fallbackBudgetLevel: 'balanced',
  },
  {
    id: '85_150k',
    label: '85.000đ – 150.000đ',
    shortLabel: '85 - 150k',
    minVnd: 85000,
    maxVnd: 150000,
    fallbackBudgetLevel: 'flexible',
  },
  {
    id: 'over_150k',
    label: 'Trên 150.000đ',
    shortLabel: 'Trên 150k',
    minVnd: 150001,
    maxVnd: null,
    fallbackBudgetLevel: 'flexible',
  },
];

export function budgetLevelToMealRange(level?: BudgetLevel): MealBudgetRange {
  if (level === 'economy') return 'under_50k';
  if (level === 'flexible') return '85_150k';
  return '50_80k';
}

export function mealRangeToBudgetLevel(
  range?: MealBudgetRange,
  customBudgetVnd?: number | null
): BudgetLevel {
  if (typeof customBudgetVnd === 'number' && customBudgetVnd > 0) {
    if (customBudgetVnd < 50000) return 'economy';
    if (customBudgetVnd <= 80000) return 'balanced';
    return 'flexible';
  }
  return (
    MEAL_BUDGET_RANGE_OPTIONS.find((r) => r.id === range)?.fallbackBudgetLevel ??
    'balanced'
  );
}

/**
 * Parses user-entered budget values such as:
 * "45", "45k", "65.000", "120000", "90.000đ", "150 nghìn"
 * Bare numbers under 1000 are interpreted in thousands of VND (e.g. 65 -> 65,000đ).
 */
export function normalizeCustomBudgetVnd(rawInput: string): number | null {
  const cleaned = rawInput.trim().toLowerCase();
  if (!cleaned) return null;

  const hasThousandSuffix = /(?:k|nghin|nghìn)\b/.test(cleaned);
  const strippedCurrency = cleaned
    .replace(/vnđ|vnd|đ|nghìn|nghin|k/g, '')
    .trim();

  if (!strippedCurrency || !/\d/.test(strippedCurrency)) return null;

  let value = 0;
  if (hasThousandSuffix) {
    const normalizedNum = strippedCurrency.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalizedNum);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    value = Math.round(parsed * 1000);
  } else {
    const digitsOnly = strippedCurrency.replace(/[.,\s]/g, '');
    if (!/^\d+$/.test(digitsOnly)) return null;
    const parsed = Number(digitsOnly);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    value = parsed < 1000 ? parsed * 1000 : parsed;
  }

  if (value < 5000 || value > 5000000) return null;
  return Math.round(value);
}

export function parseDishCostVndRange(
  estimatedCostVnd?: string,
  fallbackBudgetLevel?: BudgetLevel
): { min: number; max: number } {
  if (estimatedCostVnd && estimatedCostVnd.trim()) {
    const raw = estimatedCostVnd.toLowerCase();
    const matches = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(k)?/g)];
    const values: number[] = [];
    for (const m of matches) {
      const token = m[1];
      const hasK = Boolean(m[2]);
      if (hasK) {
        const n = Number(token.replace(',', '.'));
        if (Number.isFinite(n) && n > 0) values.push(Math.round(n * 1000));
      } else {
        const digits = token.replace(/[.,]/g, '');
        const n = Number(digits);
        if (Number.isFinite(n) && n >= 1000) {
          values.push(Math.round(n));
        } else if (Number.isFinite(n) && n > 0 && n < 1000 && raw.includes('k')) {
          values.push(Math.round(n * 1000));
        }
      }
    }
    if (values.length > 0) {
      return {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  }

  if (fallbackBudgetLevel === 'economy') return { min: 20000, max: 45000 };
  if (fallbackBudgetLevel === 'flexible') return { min: 85000, max: 140000 };
  return { min: 45000, max: 80000 };
}

export function formatMealBudgetSummary(
  budgetRange?: MealBudgetRange,
  customBudgetVnd?: number | null
): string {
  if (typeof customBudgetVnd === 'number' && customBudgetVnd > 0) {
    return `tự chọn ~${formatViNumber(customBudgetVnd)}đ`;
  }
  const found = MEAL_BUDGET_RANGE_OPTIONS.find((r) => r.id === budgetRange);
  return found ? found.shortLabel : '50 - 80k';
}

export const COOKING_TIME_OPTIONS: Array<{
  id: CookingTime;
  label: string;
}> = [
  { id: 'no_cook', label: 'Không nấu / Ăn ngoài' },
  { id: 'under_15', label: 'Nhanh <15 phút' },
  { id: '15_to_30', label: '15–30 phút' },
  { id: 'flexible', label: 'Thoải mái >30p' },
];

export const COOKING_SKILL_OPTIONS: Array<{
  id: CookingSkill;
  label: string;
}> = [
  { id: 'basic', label: 'Cơ bản (luộc, chiên, xào nhanh)' },
  { id: 'intermediate', label: 'Khá (nấu được món gia đình)' },
  { id: 'confident', label: 'Tự tin nấu nhiều món' },
];

export const KITCHEN_TOOL_OPTIONS: string[] = [
  'Bếp gas / bếp từ',
  'Nồi chiên không dầu',
  'Lò vi sóng',
  'Nồi cơm điện đa năng',
];

export const HEALTH_CONDITION_OPTIONS: string[] = [
  'Bình thường',
  'Đau dạ dày',
  'Mỡ máu cao',
  'Đường huyết nhạy cảm',
  'Huyết áp cao',
];

export const QUICK_AVAILABLE_INGREDIENTS: string[] = [
  'Trứng gà',
  'Ức gà',
  'Đậu phụ',
  'Thịt heo bằm',
  'Rau cải / xà lách',
  'Cà chua',
  'Cơm nguội / gạo',
  'Yến mạch',
];

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): {
  label: string;
  tone: 'under' | 'normal' | 'over' | 'obese';
  advice: string;
} {
  if (bmi <= 0) {
    return { label: 'Chưa xác định', tone: 'normal', advice: '' };
  }
  if (bmi < 18.5) {
    return {
      label: 'Thiếu cân',
      tone: 'under',
      advice: 'Chỉ số BMI dưới chuẩn — nên ưu tiên tăng cân khỏe mạnh và đủ đạm.',
    };
  }
  if (bmi < 23) {
    return {
      label: 'Cân đối',
      tone: 'normal',
      advice: 'Chỉ số BMI chuẩn châu Á — lý tưởng để giữ dáng hoặc tăng cơ nạc.',
    };
  }
  if (bmi < 25) {
    return {
      label: 'Thừa cân nhẹ',
      tone: 'over',
      advice: 'Chạm ngưỡng thừa cân nhẹ — giảm mỡ nhẹ nhàng và tăng rau xanh sẽ rất hiệu quả.',
    };
  }
  return {
    label: 'Thừa cân',
    tone: 'obese',
    advice: 'Nên tạo mức thâm hụt calo vừa phải và tăng cường chất xơ, đạm nạc.',
  };
}

export interface ProfileDraftInput {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: UserGoal;
  activityLevel: ActivityLevel;
  dietaryTags: string[];
  dietaryNote: string;
  dislikedFoods?: string;
  budgetLevel?: BudgetLevel;
  cookingTime?: CookingTime;
  cookingSkill?: CookingSkill;
  kitchenTools?: string[];
  healthConditions?: string[];
  suggestionFeedback?: SuggestionFeedback;
}

export function buildUserProfile(
  input: ProfileDraftInput,
  createdAt = new Date().toISOString()
): UserProfile {
  const safeAge = Math.max(14, Math.min(90, Math.round(input.age)));
  const safeHeight = Math.max(120, Math.min(220, Math.round(input.heightCm)));
  const safeWeight = Math.max(30, Math.min(200, Math.round(input.weightKg * 10) / 10));

  const bmi = calculateBMI(safeWeight, safeHeight);
  const bmiInfo = getBMICategory(bmi);

  // Mifflin-St Jeor BMR
  const bmrRaw =
    10 * safeWeight +
    6.25 * safeHeight -
    5 * safeAge +
    (input.gender === 'male' ? 5 : -161);
  const bmr = Math.round(bmrRaw);

  const activityObj =
    ACTIVITY_OPTIONS.find((a) => a.id === input.activityLevel) ??
    ACTIVITY_OPTIONS[1];
  const tdee = Math.round(bmr * activityObj.multiplier);

  const minSafeCalories = input.gender === 'male' ? 1400 : 1200;
  let rawTarget = tdee;
  if (input.goal === 'lose_fat') {
    rawTarget = Math.max(minSafeCalories, tdee - 400);
  } else if (input.goal === 'gain_weight') {
    rawTarget = tdee + 350;
  } else if (input.goal === 'build_muscle') {
    rawTarget = tdee + 250;
  }
  const targetCalories = Math.round(rawTarget / 10) * 10;

  const proteinFactor =
    input.goal === 'build_muscle'
      ? 1.9
      : input.goal === 'lose_fat'
      ? 1.6
      : input.goal === 'gain_weight'
      ? 1.5
      : 1.3;
  const protein = Math.round(safeWeight * proteinFactor);
  const fatRatio = input.goal === 'lose_fat' ? 0.25 : 0.27;
  const fat = Math.round((targetCalories * fatRatio) / 9);
  const carbs = Math.max(
    80,
    Math.round((targetCalories - protein * 4 - fat * 9) / 4)
  );
  const fiber = Math.max(
    20,
    Math.min(40, Math.round((targetCalories / 1000) * 14))
  );

  // ~35ml/kg body weight, in 200ml cups
  const waterTargetCups = Math.max(
    8,
    Math.min(18, Math.round((safeWeight * 35) / 200))
  );

  return {
    name: input.name.trim() || 'Bạn',
    gender: input.gender,
    age: safeAge,
    heightCm: safeHeight,
    weightKg: safeWeight,
    goal: input.goal,
    activityLevel: input.activityLevel,
    dietaryTags: [...input.dietaryTags],
    dietaryNote: input.dietaryNote.trim(),
    dislikedFoods: (input.dislikedFoods ?? '').trim(),
    budgetLevel: input.budgetLevel ?? 'balanced',
    cookingTime: input.cookingTime ?? 'under_15',
    cookingSkill: input.cookingSkill ?? 'basic',
    kitchenTools: input.kitchenTools ? [...input.kitchenTools] : ['Bếp gas / bếp từ'],
    healthConditions: input.healthConditions ? [...input.healthConditions] : [],
    suggestionFeedback: input.suggestionFeedback ?? {
      liked: [],
      disliked: [],
      tried: [],
    },
    bmi,
    bmiCategory: bmiInfo.label,
    bmr,
    tdee,
    targetCalories,
    targets: { protein, carbs, fiber, fat },
    waterTargetCups,
    createdAt,
  };
}

export function getGoalLabel(goal: UserGoal): string {
  return GOAL_OPTIONS.find((g) => g.id === goal)?.label ?? 'Giữ dáng';
}

export function getActivityLabel(activity: ActivityLevel): string {
  return ACTIVITY_OPTIONS.find((a) => a.id === activity)?.label ?? 'Vận động nhẹ';
}

export function getBudgetLabel(budget?: BudgetLevel): string {
  return (
    BUDGET_OPTIONS.find((b) => b.id === budget)?.label ??
    BUDGET_OPTIONS[1].label
  );
}

export function getCookingTimeLabel(time?: CookingTime): string {
  return (
    COOKING_TIME_OPTIONS.find((c) => c.id === time)?.label ??
    COOKING_TIME_OPTIONS[1].label
  );
}

export function getCookingSkillLabel(skill?: CookingSkill): string {
  return (
    COOKING_SKILL_OPTIONS.find((s) => s.id === skill)?.label ??
    COOKING_SKILL_OPTIONS[0].label
  );
}

export function formatViNumber(value: number): string {
  const rounded = Math.round(value);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatWaterLiters(cups: number): string {
  const liters = (cups * 0.2).toFixed(1);
  return liters.endsWith('.0') ? liters.slice(0, -2) : liters;
}

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return getLocalDateKey(dt);
}

const VI_WEEKDAYS = [
  'CHỦ NHẬT',
  'THỨ HAI',
  'THỨ BA',
  'THỨ TƯ',
  'THỨ NĂM',
  'THỨ SÁU',
  'THỨ BẢY',
];

const VI_WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function formatViDateHeader(date: Date = new Date()): string {
  const weekday = VI_WEEKDAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${weekday}, ${day}/${month} 🌤️`;
}

export function getTimeGreeting(name: string, date: Date = new Date()): string {
  const hour = date.getHours();
  const period =
    hour < 11
      ? 'buổi sáng'
      : hour < 14
      ? 'buổi trưa'
      : hour < 18
      ? 'buổi chiều'
      : 'buổi tối';
  return `Chào ${period}, ${name}!`;
}

export interface DailyTotals extends MacroValues {
  sodiumMg: number;
  sugarG: number;
  remaining: number;
  overage: number;
  percent: number;
  clampedPercent: number;
  slotsLogged: MealSlot[];
}

export function computeDailyTotals(
  meals: MealEntry[],
  targetCalories: number
): DailyTotals {
  const totals = meals.reduce<{
    calories: number;
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
    sodiumMg: number;
    sugarG: number;
  }>(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fiber: acc.fiber + meal.fiber,
      fat: acc.fat + meal.fat,
      sodiumMg: acc.sodiumMg + (meal.sodiumMg ?? 0),
      sugarG: acc.sugarG + (meal.sugarG ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, sodiumMg: 0, sugarG: 0 }
  );

  const safeTarget = Math.max(targetCalories, 1);
  const percent = Math.round((totals.calories / safeTarget) * 100);
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const diff = targetCalories - totals.calories;

  const slotOrder: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];
  const presentSlots = new Set(meals.map((m) => m.slot));
  const slotsLogged = slotOrder.filter((s) => presentSlots.has(s));

  return {
    ...totals,
    remaining: Math.max(0, diff),
    overage: diff < 0 ? Math.abs(diff) : 0,
    percent,
    clampedPercent,
    slotsLogged,
  };
}

export function calculateStreak(
  mealsByDate: MealsByDate,
  todayKey: string = getLocalDateKey()
): number {
  const hasToday = (mealsByDate[todayKey]?.length ?? 0) > 0;
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const hasYesterday = (mealsByDate[yesterdayKey]?.length ?? 0) > 0;

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  let cursor = hasToday ? todayKey : yesterdayKey;
  let streak = 0;

  while ((mealsByDate[cursor]?.length ?? 0) > 0) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

export function getLast7DaysStats(
  mealsByDate: MealsByDate,
  targetCalories: number,
  today: Date = new Date()
): WeeklyDayStat[] {
  const todayKey = getLocalDateKey(today);
  const stats: WeeklyDayStat[] = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const key = getLocalDateKey(dt);
    const meals = mealsByDate[key] ?? [];
    const calories = meals.reduce((sum, m) => sum + m.calories, 0);
    stats.push({
      dateKey: key,
      day: offset === 0 ? 'Nay' : VI_WEEKDAYS_SHORT[dt.getDay()],
      calories,
      target: targetCalories,
      isToday: key === todayKey,
    });
  }

  return stats;
}

export function getMascotFeedback(
  totals: DailyTotals,
  profile: UserProfile
): { highlight: string; suffix: string } {
  const highlight = `${totals.percent}% nhu cầu`;
  const { targets, goal } = profile;

  if (totals.percent === 0) {
    return {
      highlight: '0% nhu cầu',
      suffix: ` — mục tiêu hôm nay của bạn là ${formatViNumber(
        profile.targetCalories
      )} kcal. Chụp ảnh hoặc ghi bữa đầu tiên nhé!`,
    };
  }

  if (totals.percent >= 92 && totals.percent <= 108) {
    return {
      highlight,
      suffix: ' — hôm nay ăn quá cân đối với mục tiêu của bạn luôn!',
    };
  }

  if (totals.percent > 108) {
    return {
      highlight,
      suffix:
        ' — đã vượt nhẹ mức mục tiêu, ưu tiên thêm rau xanh và nước lọc phần còn lại trong ngày nhen!',
    };
  }

  const lowProtein = totals.protein < targets.protein * 0.65;
  const lowFiber = totals.fiber < targets.fiber * 0.55;

  if (goal === 'build_muscle' && lowProtein) {
    return {
      highlight,
      suffix: ` — mục tiêu tăng cơ cần thêm đạm (còn ${Math.max(
        0,
        targets.protein - totals.protein
      )}g đạm nữa nhé)!`,
    };
  }

  if (lowProtein && lowFiber) {
    return {
      highlight,
      suffix: ' — còn thiếu chút đạm & rau xanh nhen!',
    };
  }
  if (lowProtein) {
    return {
      highlight,
      suffix: ' — bổ sung thêm thịt nạc, trứng, cá hoặc đậu phụ nhen!',
    };
  }
  if (lowFiber) {
    return {
      highlight,
      suffix: ' — thêm một phần rau xanh hoặc trái cây nữa là chuẩn!',
    };
  }

  return {
    highlight,
    suffix: ' — tiến độ các nhóm chất đang đi rất đúng hướng!',
  };
}

export function buildDynamicReminders(
  profile: UserProfile,
  totals: DailyTotals,
  waterCups: number
): NotificationItem[] {
  const reminders: NotificationItem[] = [];
  const waterLiters = formatWaterLiters(waterCups);
  const targetWaterLiters = formatWaterLiters(profile.waterTargetCups);

  if (waterCups < profile.waterTargetCups) {
    const remainingMl = (profile.waterTargetCups - waterCups) * 200;
    reminders.push({
      id: 'water-rem',
      title: `Bạn đã uống ${waterLiters}L / ${targetWaterLiters}L nước`,
      detail: `Còn thiếu ${remainingMl}ml để đạt chuẩn theo cân nặng ${profile.weightKg}kg.`,
    });
  } else {
    reminders.push({
      id: 'water-ok',
      title: `Đã đạt mục tiêu ${targetWaterLiters}L nước hôm nay`,
      detail: 'Duy trì uống rải đều giúp trao đổi chất tốt hơn.',
    });
  }

  if (totals.slotsLogged.length === 0) {
    reminders.push({
      id: 'meal-empty',
      title: 'Chưa ghi nhận bữa ăn nào hôm nay',
      detail: 'Chạm nút camera ở giữa để AI nhận diện món ăn và tính calo cho bạn.',
    });
  } else {
    if (totals.protein < profile.targets.protein * 0.7) {
      reminders.push({
        id: 'protein-low',
        title: `Còn thiếu ${profile.targets.protein - totals.protein}g đạm hôm nay`,
        detail: 'Xem phần Gợi ý thực đơn để chọn món giàu đạm phù hợp.',
      });
    }
    if (totals.sodiumMg > 2000) {
      reminders.push({
        id: 'sodium-high',
        title: `Lượng muối (Natri) hôm nay khoảng ${formatViNumber(totals.sodiumMg)}mg`,
        detail: 'Hơi vượt ngưỡng 2.000mg/ngày của WHO — uống thêm nước và chọn món thanh nhạt vào bữa tới nhé.',
      });
    }
    if (totals.sugarG > 30) {
      reminders.push({
        id: 'sugar-high',
        title: `Đường tự do ước tính hôm nay ~${totals.sugarG}g`,
        detail: 'Nên hạn chế đồ ngọt/trà sữa phần còn lại trong ngày để ổn định đường huyết.',
      });
    }
  }

  return reminders;
}

export function normalizeAnalysisPayload(
  raw: Partial<AnalyzedMealResult>,
  contexts: ContextOption[]
): AnalyzedMealResult {
  const nonNeg = (val: unknown) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  return {
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : 'Món ăn đã nhận diện',
    portionEstimate:
      typeof raw.portionEstimate === 'string' && raw.portionEstimate.trim()
        ? raw.portionEstimate.trim()
        : 'Khẩu phần tiêu chuẩn',
    itemsDetected: Array.isArray(raw.itemsDetected)
      ? raw.itemsDetected.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
      : [],
    calories: nonNeg(raw.calories),
    protein: nonNeg(raw.protein),
    carbs: nonNeg(raw.carbs),
    fiber: nonNeg(raw.fiber),
    fat: nonNeg(raw.fat),
    sodiumMg: raw.sodiumMg !== undefined ? nonNeg(raw.sodiumMg) : undefined,
    sugarG: raw.sugarG !== undefined ? nonNeg(raw.sugarG) : undefined,
    contexts: [...contexts],
    isHealthy: Boolean(raw.isHealthy),
    summaryNote:
      typeof raw.summaryNote === 'string' && raw.summaryNote.trim()
        ? raw.summaryNote.trim()
        : 'Đã ước tính dinh dưỡng từ AI.',
  };
}

export function scaleAnalyzedMeal(
  result: AnalyzedMealResult,
  multiplier: number
): AnalyzedMealResult {
  const safeMult = Math.max(0.25, Math.min(3, multiplier));
  return {
    ...result,
    calories: Math.round(result.calories * safeMult),
    protein: Math.round(result.protein * safeMult),
    carbs: Math.round(result.carbs * safeMult),
    fiber: Math.round(result.fiber * safeMult),
    fat: Math.round(result.fat * safeMult),
    sodiumMg:
      result.sodiumMg !== undefined
        ? Math.round(result.sodiumMg * safeMult)
        : undefined,
    sugarG:
      result.sugarG !== undefined
        ? Math.round(result.sugarG * safeMult)
        : undefined,
  };
}

export function getNextDefaultSlot(
  meals: MealEntry[],
  date: Date = new Date()
): MealSlot {
  const existing = new Set(meals.map((m) => m.slot));
  const hour = date.getHours();
  const preferred: MealSlot =
    hour < 10 ? 'Sáng' : hour < 14 ? 'Trưa' : hour < 17 ? 'Xế' : 'Tối';
  if (!existing.has(preferred)) return preferred;
  const order: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];
  return order.find((s) => !existing.has(s)) ?? 'Tối';
}

export function getRecentDateKeys(
  daysCount: number,
  today: Date = new Date()
): Array<{ dateKey: string; shortDay: string; dateNum: string; isToday: boolean }> {
  const list: Array<{ dateKey: string; shortDay: string; dateNum: string; isToday: boolean }> = [];
  for (let offset = -(daysCount - 1); offset <= 0; offset += 1) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const key = getLocalDateKey(dt);
    list.push({
      dateKey: key,
      shortDay: offset === 0 ? 'Nay' : VI_WEEKDAYS_SHORT[dt.getDay()],
      dateNum: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`,
      isToday: offset === 0,
    });
  }
  return list;
}

export function formatReadableViDate(
  dateKey: string,
  todayKey: string = getLocalDateKey()
): string {
  if (dateKey === todayKey) return 'Hôm nay';
  if (dateKey === shiftDateKey(todayKey, -1)) return 'Hôm qua';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  const wd = VI_WEEKDAYS[dt.getDay()] ?? '';
  const wdFormatted = wd.charAt(0) + wd.slice(1).toLowerCase();
  return `${wdFormatted}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function getPeriodReportStats(
  mealsByDate: MealsByDate,
  profile: UserProfile,
  period: 'week' | 'month',
  today: Date = new Date()
): PeriodReportStats {
  const totalDaysWindow = period === 'week' ? 7 : 30;
  const todayKey = getLocalDateKey(today);

  const daySummaries: Array<{
    dateKey: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
    isToday: boolean;
  }> = [];

  const slotCounts: Record<MealSlot, number> = { Sáng: 0, Trưa: 0, Xế: 0, Tối: 0 };
  const slotCalories: Record<MealSlot, number> = { Sáng: 0, Trưa: 0, Xế: 0, Tối: 0 };
  const uniqueDishes = new Set<string>();
  let totalMealsCount = 0;

  for (let offset = -(totalDaysWindow - 1); offset <= 0; offset += 1) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const key = getLocalDateKey(dt);
    const meals = mealsByDate[key] ?? [];
    let cal = 0;
    let pro = 0;
    let carb = 0;
    let fib = 0;
    let fat = 0;

    for (const m of meals) {
      cal += m.calories;
      pro += m.protein;
      carb += m.carbs;
      fib += m.fiber;
      fat += m.fat;
      totalMealsCount += 1;
      slotCounts[m.slot] = (slotCounts[m.slot] ?? 0) + 1;
      slotCalories[m.slot] = (slotCalories[m.slot] ?? 0) + m.calories;
      const cleanName = m.name.trim().toLowerCase();
      if (cleanName) uniqueDishes.add(cleanName);
    }

    daySummaries.push({
      dateKey: key,
      label: offset === 0 ? 'Nay' : VI_WEEKDAYS_SHORT[dt.getDay()],
      calories: cal,
      protein: pro,
      carbs: carb,
      fiber: fib,
      fat: fat,
      isToday: key === todayKey,
    });
  }

  const loggedDays = daySummaries.filter((d) => d.calories > 0);
  const loggedDaysCount = loggedDays.length;

  const avg = (picker: (d: (typeof daySummaries)[number]) => number) =>
    loggedDaysCount > 0
      ? Math.round(loggedDays.reduce((s, d) => s + picker(d), 0) / loggedDaysCount)
      : 0;

  const avgCalories = avg((d) => d.calories);
  const avgMacros = {
    protein: avg((d) => d.protein),
    carbs: avg((d) => d.carbs),
    fiber: avg((d) => d.fiber),
    fat: avg((d) => d.fat),
  };

  const totalSlotCals =
    slotCalories.Sáng + slotCalories.Trưa + slotCalories.Xế + slotCalories.Tối;
  const slotCalorieShare: Record<MealSlot, number> = {
    Sáng: totalSlotCals > 0 ? Math.round((slotCalories.Sáng / totalSlotCals) * 100) : 0,
    Trưa: totalSlotCals > 0 ? Math.round((slotCalories.Trưa / totalSlotCals) * 100) : 0,
    Xế: totalSlotCals > 0 ? Math.round((slotCalories.Xế / totalSlotCals) * 100) : 0,
    Tối: totalSlotCals > 0 ? Math.round((slotCalories.Tối / totalSlotCals) * 100) : 0,
  };

  const deficientNutrients: string[] = [];
  if (loggedDaysCount > 0) {
    if (avgMacros.protein < profile.targets.protein * 0.8) {
      deficientNutrients.push('Đạm');
    }
    if (avgMacros.fiber < profile.targets.fiber * 0.75) {
      deficientNutrients.push('Chất xơ');
    }
    if (avgMacros.carbs < profile.targets.carbs * 0.65) {
      deficientNutrients.push('Tinh bột');
    }
    if (avgMacros.fat > profile.targets.fat * 1.25) {
      deficientNutrients.push('Chất béo (đang vượt mức)');
    }
  }

  let buckets: PeriodBucketStat[] = [];
  if (period === 'week') {
    buckets = daySummaries.map((d) => ({
      label: d.label,
      avgCalories: d.calories,
      loggedDays: d.calories > 0 ? 1 : 0,
      target: profile.targetCalories,
      isCurrent: d.isToday,
    }));
  } else {
    // 4 chronological buckets covering the 30-day window (7 + 7 + 8 + 8 days)
    const ranges: Array<{ label: string; slice: typeof daySummaries; isCurrent: boolean }> = [
      { label: 'Tuần 1', slice: daySummaries.slice(0, 7), isCurrent: false },
      { label: 'Tuần 2', slice: daySummaries.slice(7, 14), isCurrent: false },
      { label: 'Tuần 3', slice: daySummaries.slice(14, 22), isCurrent: false },
      { label: 'Tuần nay', slice: daySummaries.slice(22, 30), isCurrent: true },
    ];
    buckets = ranges.map((r) => {
      const active = r.slice.filter((d) => d.calories > 0);
      const mean =
        active.length > 0
          ? Math.round(active.reduce((s, d) => s + d.calories, 0) / active.length)
          : 0;
      return {
        label: r.label,
        avgCalories: mean,
        loggedDays: active.length,
        target: profile.targetCalories,
        isCurrent: r.isCurrent,
      };
    });
  }

  return {
    period,
    totalDaysWindow,
    loggedDaysCount,
    totalMealsCount,
    uniqueDishesCount: uniqueDishes.size,
    avgCalories,
    avgMacros,
    slotCounts,
    slotCalorieShare,
    deficientNutrients,
    buckets,
  };
}

export function getLocalPeriodRuleInsight(
  stats: PeriodReportStats,
  profile: UserProfile
): ReportInsightResult {
  const periodLabel = stats.period === 'week' ? 'tuần này' : '30 ngày qua';

  if (stats.loggedDaysCount === 0) {
    return {
      headline: `Chưa có dữ liệu ghi nhận trong ${periodLabel}`,
      strengths: 'BữaNay luôn giữ số liệu thật 100%, không tạo số liệu ảo.',
      watchOut: 'Bạn chưa ghi bữa ăn nào trong khoảng thời gian này.',
      actionTip:
        'Chỉ cần chụp hoặc nhập 1–2 bữa đầu tiên, Mầm sẽ phân tích thói quen và các chất còn thiếu cho bạn ngay!',
    };
  }

  const calDiff = stats.avgCalories - profile.targetCalories;
  const calNote =
    Math.abs(calDiff) <= 150
      ? `Mức nạp trung bình ${formatViNumber(stats.avgCalories)} kcal/ngày đang bám rất sát mục tiêu ${formatViNumber(profile.targetCalories)} kcal.`
      : calDiff < 0
      ? `Trung bình ${formatViNumber(stats.avgCalories)} kcal/ngày (thấp hơn mục tiêu khoảng ${formatViNumber(Math.abs(calDiff))} kcal).`
      : `Trung bình ${formatViNumber(stats.avgCalories)} kcal/ngày (nhỉnh hơn mục tiêu khoảng ${formatViNumber(calDiff)} kcal).`;

  const topSlot = (['Sáng', 'Trưa', 'Xế', 'Tối'] as MealSlot[]).reduce(
    (best, slot) =>
      stats.slotCalorieShare[slot] > stats.slotCalorieShare[best] ? slot : best,
    'Trưa' as MealSlot
  );

  const varietyText =
    stats.uniqueDishesCount >= 5
      ? `Thực đơn đa dạng với ${stats.uniqueDishesCount} món khác nhau trong ${stats.loggedDaysCount} ngày đã ghi.`
      : `Bạn đã ghi ${stats.totalMealsCount} bữa (${stats.uniqueDishesCount} món khác nhau) trong ${stats.loggedDaysCount} ngày.`;

  const watchOut =
    stats.deficientNutrients.length > 0
      ? `Nhóm chất hay thiếu nhất: ${stats.deficientNutrients.join(', ')}. Bữa ${topSlot} đang chiếm ${stats.slotCalorieShare[topSlot]}% tổng calo.`
      : `Các nhóm chất khá cân đối; bữa ${topSlot} hiện chiếm tỷ trọng cao nhất (${stats.slotCalorieShare[topSlot]}%).`;

  const actionTip = stats.deficientNutrients.includes('Chất xơ')
    ? 'Thử thêm 1 đĩa rau luộc/salad hoặc 1 trái ổi, thanh long vào bữa trưa/tối để nâng chất xơ nhẹ nhàng.'
    : stats.deficientNutrients.includes('Đạm')
    ? 'Ưu tiên thêm 1 quả trứng, hộp sữa chua Hy Lạp hoặc 100g ức gà/cá vào các bữa chính nhé.'
    : stats.slotCounts.Sáng === 0
    ? 'Bạn đang hay bỏ bữa sáng — thử một bữa sáng nhanh 5 phút (trứng + bánh mì hoặc yến mạch) để giữ năng lượng đều hơn.'
    : 'Duy trì nhịp ghi bữa đều đặn như hiện tại và thử thêm 1–2 món mới trong Cẩm nang để đổi vị nhé!';

  return {
    headline: `Tổng kết ${periodLabel} cùng Mầm`,
    strengths: `${calNote} ${varietyText}`,
    watchOut,
    actionTip,
  };
}

export function getMascotMoodState(
  totals: DailyTotals,
  profile: UserProfile,
  streakDays: number
): { mood: MascotMood; label: string } {
  if (totals.percent === 0) {
    return { mood: 'fresh', label: 'Sẵn sàng' };
  }
  if ((totals.percent >= 88 && totals.percent <= 110) || streakDays >= 3) {
    return { mood: 'celebrate', label: 'Tuyệt vời!' };
  }
  if (totals.overage > 150) {
    return { mood: 'gentle_nudge', label: 'Nhắc nhẹ' };
  }
  if (
    totals.protein < profile.targets.protein * 0.5 ||
    totals.fiber < profile.targets.fiber * 0.45
  ) {
    return { mood: 'encourage', label: 'Cố lên' };
  }
  return { mood: 'encourage', label: 'Đúng nhịp' };
}

export function recordSuggestionFeedback(
  current: SuggestionFeedback | undefined,
  dishName: string,
  action: 'liked' | 'disliked' | 'tried'
): SuggestionFeedback {
  const base: SuggestionFeedback = {
    liked: [...(current?.liked ?? [])],
    disliked: [...(current?.disliked ?? [])],
    tried: [...(current?.tried ?? [])],
  };
  const clean = dishName.trim();
  if (!clean) return base;

  const dedupeAdd = (arr: string[], item: string) =>
    [item, ...arr.filter((x) => x.toLowerCase() !== item.toLowerCase())].slice(0, 20);
  const removeItem = (arr: string[], item: string) =>
    arr.filter((x) => x.toLowerCase() !== item.toLowerCase());

  if (action === 'liked') {
    base.liked = dedupeAdd(base.liked, clean);
    base.disliked = removeItem(base.disliked, clean);
  } else if (action === 'disliked') {
    base.disliked = dedupeAdd(base.disliked, clean);
    base.liked = removeItem(base.liked, clean);
  } else if (action === 'tried') {
    base.tried = dedupeAdd(base.tried, clean);
  }

  return base;
}

export interface MissingProfileField {
  key: 'name' | 'body' | 'budget' | 'cooking' | 'tools' | 'dietary';
  label: string;
}

export function getMissingProfileFields(input: {
  name?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  budgetLevel?: BudgetLevel;
  cookingTime?: CookingTime;
  cookingSkill?: CookingSkill;
  kitchenTools?: string[];
  dietaryTags?: string[];
}): MissingProfileField[] {
  const missing: MissingProfileField[] = [];
  if (!input.name || !input.name.trim()) {
    missing.push({ key: 'name', label: 'Tên gọi' });
  }
  const ageOk = Number.isFinite(input.age) && Number(input.age) >= 14 && Number(input.age) <= 90;
  const hOk =
    Number.isFinite(input.heightCm) && Number(input.heightCm) >= 120 && Number(input.heightCm) <= 220;
  const wOk =
    Number.isFinite(input.weightKg) && Number(input.weightKg) >= 30 && Number(input.weightKg) <= 200;
  if (!ageOk || !hOk || !wOk) {
    missing.push({ key: 'body', label: 'Tuổi / chiều cao / cân nặng' });
  }
  if (!input.budgetLevel) {
    missing.push({ key: 'budget', label: 'Ngân sách' });
  }
  if (!input.cookingTime || !input.cookingSkill) {
    missing.push({ key: 'cooking', label: 'Thời gian & trình độ nấu' });
  }
  if (!Array.isArray(input.kitchenTools) || input.kitchenTools.length === 0) {
    missing.push({ key: 'tools', label: 'Dụng cụ bếp' });
  }
  if (!Array.isArray(input.dietaryTags) || input.dietaryTags.length === 0) {
    missing.push({ key: 'dietary', label: 'Khẩu vị & thói quen' });
  }
  return missing;
}

export function upsertWeightEntry(
  entries: WeightEntry[],
  dateKey: string,
  weightKg: number,
  heightCm: number
): WeightEntry[] {
  const safeWeight = Math.max(30, Math.min(200, Math.round(weightKg * 10) / 10));
  const nextEntry: WeightEntry = {
    dateKey,
    weightKg: safeWeight,
    bmi: calculateBMI(safeWeight, heightCm),
    updatedAt: new Date().toISOString(),
  };
  const filtered = entries.filter((e) => e.dateKey !== dateKey);
  return [...filtered, nextEntry].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function getWeightChangeStats(entries: WeightEntry[]): {
  latest: WeightEntry | null;
  first: WeightEntry | null;
  deltaKg: number;
} {
  if (entries.length === 0) {
    return { latest: null, first: null, deltaKg: 0 };
  }
  const sorted = [...entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const deltaKg = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  return { latest, first, deltaKg };
}

export async function parseApiJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    if (!response.ok) {
      throw new Error('Máy chủ chưa phản hồi kịp lúc này. Bạn thử bấm lại nhé!');
    }
    return {} as T;
  }
  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    if (response.status === 413) {
      throw new Error('Ảnh hơi lớn so với giới hạn truyền tải. Bạn thử chọn ảnh khác nhé!');
    }
    throw new Error(
      'Kết nối máy chủ đang quá tải hoặc phản hồi chậm. Bạn đợi vài giây rồi thử bấm lại nhé!'
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('Dữ liệu trả về chưa đúng định dạng. Bạn thử bấm lại nhé!');
  }
}
