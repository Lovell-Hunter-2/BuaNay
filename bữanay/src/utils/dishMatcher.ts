import type {
  AnalyzedMealResult,
  BudgetLevel,
  CompanionChatReply,
  ContextOption,
  DishBankItem,
  DishCuisine,
  FoodSwapItem,
  FoodSwapResponse,
  MealBudgetRange,
  MealDiningMode,
  MealSlot,
  MealSuggestion,
  UserProfile,
} from '../types/nutrition';
import {
  formatMealBudgetSummary,
  parseDishCostVndRange,
} from './nutrition';

export type CuisineFilter = 'all' | DishCuisine;

export interface RemainingBudget {
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
}

export interface Tier1MenuResult {
  suggestions: MealSuggestion[];
  summaryTip: string;
  matchedCount: number;
  usedIngredientFallbackToAi: boolean;
}

const BUDGET_RANK: Record<BudgetLevel, number> = {
  economy: 0,
  balanced: 1,
  flexible: 2,
};

const PLANT_PROTEIN_HINTS = [
  'chay',
  'đậu hũ',
  'đậu nành',
  'nấm',
  'trứng',
  'sữa chua',
  'yến mạch',
  'hạt chia',
  'khoai lang',
  'bắp',
  'chuối',
  'bơ',
  'granola',
  'matcha',
  'cold brew',
  'nước ép',
  'nước dừa',
  'trà',
  'cacao',
  'tàu hũ',
  'edamame',
];

const NON_VEG_HINTS = [
  'gà',
  'bò',
  'heo',
  'thịt',
  'cá ',
  'tôm',
  'mực',
  'sườn',
  'vịt',
  'ếch',
  'cua',
  'giò',
  'chả lụa',
  'chà bông',
  'cá hồi',
  'cá ngừ',
];

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function foldVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasFoldedPhrase(foldedHaystack: string, foldedPhrase: string): boolean {
  if (!foldedPhrase) return false;
  return ` ${foldedHaystack} `.includes(` ${foldedPhrase} `);
}

function hasAnyFoldedPhrase(foldedHaystack: string, phrases: string[]): boolean {
  return phrases.some((p) => hasFoldedPhrase(foldedHaystack, p));
}

function hashSeedOffset(id: string, seed: number): number {
  let h = seed * 2654435761;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  // Small bounded jitter (-8..+8) so nutrition/slot fit leads while rotating ties cleanly
  return ((Math.abs(h) % 17) - 8);
}

function formatKcalNumber(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

function tokenizeList(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;\n/|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
}

function getDishSearchableText(dish: DishBankItem): string {
  const ingText = dish.recipe?.ingredients?.join(' ') ?? '';
  return `${dish.name} ${dish.portionEstimate} ${ingText}`.toLowerCase();
}

function isLikelyVegetarianFriendly(dish: DishBankItem): boolean {
  const text = getDishSearchableText(dish);
  if (NON_VEG_HINTS.some((kw) => text.includes(kw))) {
    return false;
  }
  return (
    dish.cuisine === 'drink' ||
    PLANT_PROTEIN_HINTS.some((kw) => text.includes(kw))
  );
}

function isEverydayVietnameseStaple(dish: DishBankItem): boolean {
  const folded = foldVietnamese(dish.name);
  const coreStaple = hasAnyFoldedPhrase(folded, [
    'pho ga',
    'pho bo',
    'bun moc',
    'bun rieu',
    'bun thang',
    'bun ca',
    'bun bo hue',
    'bun cha',
    'bun thit nuong',
    'hu tieu',
    'mien ga',
    'mi quang',
    'banh mi',
    'banh cuon',
    'banh uot',
    'xoi xeo',
    'xoi ga',
    'chao thit',
    'chao ca',
    'chao ga',
    'com tam',
    'com ga',
    'com thit',
    'thit kho trung',
    'ca kho',
    'canh chua',
    'canh cua',
    'canh bi',
    'canh rau',
    'dau hu nhoi thit',
    'goi cuon',
    'bo xao',
    'trung op la',
    'trung hap',
    'ga luoc',
    'tom rim',
  ]);
  const nicheBuzz = /(nckd|shakshuka|nicoise|pesto|quesadilla|burrito|savory yogurt|kefir|meatballs|tortilla|poke|bulgogi)/.test(
    folded
  );
  return dish.cuisine === 'vietnam' && !nicheBuzz && (coreStaple || /^(vn-eo-0|vn-eo-1|vn-eo-2|vn-hc-0|vn-hc-1|vn-hc-2)/.test(dish.id));
}

function getSlotAppropriatenessScore(
  dish: DishBankItem,
  preferredSlot: MealSlot
): number {
  const folded = foldVietnamese(dish.name);
  const isBreakfastType =
    /(pho |bun |mien |hu tieu|banh mi|banh cuon|banh uot|banh canh|xoi |chao |nui |bo kho|trung op la|trung bac|yen mach|sandwich|kimbap|onigiri)/.test(
      ` ${folded} `
    );
  const isRiceMainDish =
    /(com |thit kho|ca kho|ca hap|canh chua|canh cua|canh bi|canh rau|bo xao|tom xao|ga xao|suon |ca nuc|ca dieu hong)/.test(
      ` ${folded} `
    );

  if (preferredSlot === 'Sáng') {
    if (dish.cuisine === 'drink') return -40;
    if (isBreakfastType) return 26;
    if (isRiceMainDish) return -28;
    return 0;
  }

  if (preferredSlot === 'Trưa' || preferredSlot === 'Tối') {
    if (dish.cuisine === 'drink') return -40;
    if (isRiceMainDish) return 18;
    if (/(bun cha|bun thit nuong|bun bo|pho |com tam|salad|ga nuong|ca hoi)/.test(` ${folded} `)) {
      return 12;
    }
    if (/(xoi |banh cuon|banh mi op la|yen mach)/.test(` ${folded} `)) {
      return -12;
    }
    return 0;
  }

  // preferredSlot === 'Xế'
  if (dish.cuisine === 'drink' || dish.calories <= 260) return 24;
  return -10;
}

function computeIdealSlotCalories(
  profile: UserProfile,
  remaining: RemainingBudget,
  preferredSlot: MealSlot
): number {
  const shareBySlot: Record<MealSlot, number> = {
    Sáng: 0.25,
    Trưa: 0.35,
    Tối: 0.3,
    Xế: 0.13,
  };
  const baseTarget = Math.round(profile.targetCalories * shareBySlot[preferredSlot]);

  if (preferredSlot === 'Xế') {
    const cappedRem = remaining.calories > 0 ? Math.round(remaining.calories * 0.35) : baseTarget;
    return Math.min(270, Math.max(110, Math.min(baseTarget, cappedRem)));
  }

  const slotMin = preferredSlot === 'Sáng' ? 320 : 380;
  const slotMax =
    profile.goal === 'gain_weight'
      ? preferredSlot === 'Sáng'
        ? 560
        : 760
      : preferredSlot === 'Sáng'
      ? 450
      : 580;

  let target = Math.min(slotMax, Math.max(slotMin, baseTarget));
  if (remaining.calories > 0 && remaining.calories < target) {
    target = Math.max(240, remaining.calories);
  }
  return target;
}

function toMealSuggestion(
  dish: DishBankItem,
  preferredSlot: MealSlot
): MealSuggestion {
  const slot = dish.slots.includes(preferredSlot)
    ? preferredSlot
    : dish.slots[0] ?? preferredSlot;
  return {
    name: dish.name,
    slot,
    portionEstimate: dish.portionEstimate,
    calories: dish.calories,
    protein: dish.protein,
    carbs: dish.carbs,
    fiber: dish.fiber,
    fat: dish.fat,
    sodiumMg: dish.sodiumMg,
    sugarG: dish.sugarG,
    whyItFits: dish.whyItFits,
    swapTip: dish.swapTip,
    diningMode: dish.diningMode,
    estimatedCostVnd: dish.estimatedCostVnd,
    prepMinutes: dish.prepMinutes,
    recipe: dish.recipe,
  };
}

export function pickTier1MenuSuggestions(params: {
  dishes: DishBankItem[];
  profile: UserProfile;
  remaining: RemainingBudget;
  diningMode: MealDiningMode;
  preferredSlot: MealSlot;
  budgetOverride: BudgetLevel;
  budgetRange?: MealBudgetRange;
  customBudgetVnd?: number | null;
  availableIngredients?: string;
  excludeNames?: string[];
  cuisineFilter?: CuisineFilter;
  varietySeed?: number;
}): Tier1MenuResult {
  const {
    dishes,
    profile,
    remaining,
    diningMode,
    preferredSlot,
    budgetOverride,
    budgetRange,
    customBudgetVnd = null,
    availableIngredients = '',
    excludeNames = [],
    cuisineFilter = 'all',
    varietySeed = 0,
  } = params;

  const feedback = profile.suggestionFeedback ?? {
    liked: [],
    disliked: [],
    tried: [],
  };

  const dislikedSet = new Set([
    ...feedback.disliked.map(normalizeText),
    ...excludeNames.map(normalizeText),
  ]);
  const likedSet = new Set(feedback.liked.map(normalizeText));
  const triedSet = new Set(feedback.tried.map(normalizeText));

  const dislikedKeywords = tokenizeList(profile.dislikedFoods);
  const noteKeywords = tokenizeList(profile.dietaryNote);
  const healthConditions = profile.healthConditions ?? [];
  const dietaryTags = profile.dietaryTags ?? [];
  const userTools = profile.kitchenTools ?? [];
  const ingredientTokens = tokenizeList(availableIngredients);

  const wantsSeafoodFree =
    dietaryTags.includes('Dị ứng hải sản') ||
    dislikedKeywords.some((k) => k.includes('hải sản')) ||
    noteKeywords.some((k) => k.includes('hải sản'));
  const wantsFlexVeg = dietaryTags.includes('Ăn chay linh hoạt');
  const wantsLowCarb = dietaryTags.includes('Ít tinh bột');
  const wantsBroth = dietaryTags.includes('Thích món nước (phở, bún)');
  const wantsLowSugar =
    dietaryTags.includes('Hạn chế đường & trà sữa') ||
    healthConditions.includes('Đường huyết nhạy cảm');
  const hasHighBP = healthConditions.includes('Huyết áp cao');

  const isHardCompatible = (
    dish: DishBankItem,
    strictBudget: boolean,
    strictSlot: boolean,
    excludeDrinksForMain: boolean
  ): boolean => {
    if (dish.diningMode !== diningMode) return false;
    if (strictSlot && !dish.slots.includes(preferredSlot)) return false;
    if (cuisineFilter !== 'all' && dish.cuisine !== cuisineFilter) return false;
    if (
      excludeDrinksForMain &&
      cuisineFilter === 'all' &&
      preferredSlot !== 'Xế' &&
      dish.cuisine === 'drink'
    ) {
      return false;
    }
    if (dislikedSet.has(normalizeText(dish.name))) return false;

    const dishCost = parseDishCostVndRange(dish.estimatedCostVnd, dish.budgetLevel);

    if (strictBudget) {
      if (typeof customBudgetVnd === 'number' && customBudgetVnd > 0) {
        if (dishCost.max > customBudgetVnd) {
          return false;
        }
      } else if (budgetRange) {
        if (budgetRange === 'under_50k' && dishCost.max >= 50000) return false;
        if (budgetRange === '50_80k' && (dishCost.max < 50000 || dishCost.min > 80000)) {
          return false;
        }
        if (budgetRange === '85_150k' && (dishCost.max < 85000 || dishCost.min > 150000)) {
          return false;
        }
        if (budgetRange === 'over_150k' && dishCost.max <= 150000) {
          return false;
        }
      } else if (BUDGET_RANK[dish.budgetLevel] > BUDGET_RANK[budgetOverride]) {
        return false;
      }
    }

    if (diningMode === 'home_cook' && dish.tools.length > 0 && userTools.length > 0) {
      const hasAnyRequiredTool = dish.tools.some((t) => userTools.includes(t));
      if (!hasAnyRequiredTool) return false;
    }

    if (dish.avoidIf?.some((cond) => healthConditions.includes(cond))) {
      return false;
    }

    if (wantsSeafoodFree && dish.allergens?.includes('hải sản')) {
      return false;
    }

    const searchText = getDishSearchableText(dish);
    if (dislikedKeywords.some((kw) => searchText.includes(kw))) {
      return false;
    }

    if (
      noteKeywords.some(
        (kw) =>
          kw.startsWith('dị ứng ') &&
          searchText.includes(kw.replace(/^dị ứng\s+/, ''))
      )
    ) {
      return false;
    }

    if (hasHighBP && (dish.sodiumMg ?? 0) > 1050) return false;
    if (wantsLowSugar && (dish.sugarG ?? 0) > 16) return false;

    return true;
  };

  let candidates = dishes.filter((d) => isHardCompatible(d, true, true, true));
  if (candidates.length < 3) {
    candidates = dishes.filter((d) => isHardCompatible(d, false, true, true));
  }
  if (candidates.length < 3) {
    candidates = dishes.filter((d) => isHardCompatible(d, false, true, false));
  }
  if (candidates.length < 3) {
    candidates = dishes.filter((d) => isHardCompatible(d, false, false, false));
  }

  const idealSlotCalories = computeIdealSlotCalories(
    profile,
    remaining,
    preferredSlot
  );

  let maxIngredientMatchesFound = 0;

  const scored = candidates.map((dish) => {
    let score = 50;

    // 1. Meal slot appropriateness (critical so breakfast returns real breakfast foods)
    score += getSlotAppropriatenessScore(dish, preferredSlot);

    // 2. Everyday cultural & practical familiarity when viewing "Tất cả"
    if (cuisineFilter === 'all') {
      if (dish.cuisine === 'vietnam') score += 20;
      else if (dish.cuisine === 'healthy_intl') score += 2;
      if (isEverydayVietnameseStaple(dish)) score += 14;
    }

    // 3. Calorie & Goal alignment
    const calDiff = Math.abs(dish.calories - idealSlotCalories);
    score += Math.max(-24, 24 - Math.round(calDiff / 14));

    if (remaining.calories > 0 && dish.calories <= remaining.calories + 80) {
      score += 8;
    }
    if (profile.goal === 'gain_weight' && preferredSlot !== 'Xế' && dish.calories >= 390) {
      score += 10;
    } else if (profile.goal === 'lose_fat' && dish.protein + dish.fiber * 2 >= 30) {
      score += 10;
    }

    // 4. Macro gap boost
    if (remaining.protein >= 25 && dish.protein >= 24) {
      score += 12;
    } else if (remaining.protein < 15 && dish.calories < 380) {
      score += 6;
    }
    if (remaining.fiber >= 8 && dish.fiber >= 5) {
      score += 8;
    }

    // 5. Dietary preferences
    const lowerName = dish.name.toLowerCase();
    if (wantsLowCarb && dish.carbs <= 38) score += 14;
    if (wantsBroth && /(phở|bún|miến|hủ tiếu|canh|cháo|udon|soba)/.test(lowerName)) {
      score += 10;
    }
    if (wantsLowSugar && (dish.sugarG ?? 0) <= 6) score += 8;
    if (wantsFlexVeg && isLikelyVegetarianFriendly(dish)) score += 22;

    // 6. Budget preference (VND range / custom VND target / legacy BudgetLevel)
    const dishCost = parseDishCostVndRange(dish.estimatedCostVnd, dish.budgetLevel);
    if (typeof customBudgetVnd === 'number' && customBudgetVnd > 0) {
      if (dishCost.max <= customBudgetVnd) {
        score += 18;
        if (dishCost.max >= customBudgetVnd * 0.55) {
          score += 10;
        } else if (customBudgetVnd >= 80000 && dishCost.max < customBudgetVnd * 0.35) {
          score -= 8;
        }
      } else {
        score -= Math.min(30, Math.round((dishCost.max - customBudgetVnd) / 3000));
      }
    } else if (budgetRange) {
      const fitsRange =
        (budgetRange === 'under_50k' && dishCost.max < 50000) ||
        (budgetRange === '50_80k' && dishCost.max >= 50000 && dishCost.min <= 80000) ||
        (budgetRange === '85_150k' && dishCost.max >= 85000 && dishCost.min <= 150000) ||
        (budgetRange === 'over_150k' && dishCost.max > 150000);
      if (fitsRange) {
        score += 24;
      } else {
        score -= 14;
      }
    } else if (dish.budgetLevel === budgetOverride) {
      score += 6;
    }

    // 7. Home-cook time match
    if (diningMode === 'home_cook' && profile.cookingTime) {
      if (profile.cookingTime === 'no_cook' && dish.prepMinutes <= 6) score += 18;
      else if (profile.cookingTime === 'under_15' && dish.prepMinutes <= 15) score += 12;
      else if (profile.cookingTime === '15_to_30' && dish.prepMinutes <= 30) score += 8;
    }

    // 8. Ingredient match for home_cook
    let ingHits = 0;
    if (ingredientTokens.length > 0) {
      const searchText = getDishSearchableText(dish);
      for (const token of ingredientTokens) {
        if (searchText.includes(token)) {
          ingHits += 1;
        }
      }
      if (ingHits > maxIngredientMatchesFound) {
        maxIngredientMatchesFound = ingHits;
      }
      score += ingHits * 28;
    }

    // 9. Feedback memory
    const key = normalizeText(dish.name);
    if (likedSet.has(key)) score += 8;
    if (triedSet.has(key)) score -= 18;

    // 10. Gentle tie-breaking rotation across clicks/sessions
    if (varietySeed !== 0) {
      score += hashSeedOffset(dish.id, varietySeed);
    }

    return { dish, score, ingHits };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick 3 diverse dishes (avoid picking 3 very similar dish prefixes & keep main meals varied)
  const picked: DishBankItem[] = [];
  const usedFirstWords = new Set<string>();

  for (const entry of scored) {
    if (picked.length >= 3) break;
    const prefix = entry.dish.name.split(' ').slice(0, 2).join(' ').toLowerCase();
    if (!usedFirstWords.has(prefix) || scored.length <= 5) {
      picked.push(entry.dish);
      usedFirstWords.add(prefix);
    }
  }
  for (const entry of scored) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === entry.dish.id)) {
      picked.push(entry.dish);
    }
  }

  const usedIngredientFallbackToAi =
    diningMode === 'home_cook' &&
    ingredientTokens.length >= 2 &&
    maxIngredientMatchesFound === 0;

  const slotLabel = preferredSlot.toLowerCase();
  const modeLabel = diningMode === 'home_cook' ? 'tự nấu' : 'ăn ngoài';
  const budgetNote =
    diningMode === 'eat_out' && (budgetRange || (customBudgetVnd && customBudgetVnd > 0))
      ? ` Ngân sách ${formatMealBudgetSummary(budgetRange, customBudgetVnd)}.`
      : '';
  const ingNote =
    ingredientTokens.length > 0 && maxIngredientMatchesFound > 0
      ? ` Có ưu tiên món tận dụng "${ingredientTokens.slice(0, 3).join(', ')}".`
      : '';

  const summaryTip = `3 gợi ý ${modeLabel} phù hợp cho bữa ${slotLabel} — cân đối với mục tiêu ${formatKcalNumber(
    profile.targetCalories
  )} kcal/ngày (còn lại ~${formatKcalNumber(remaining.calories)} kcal).${budgetNote}${ingNote}`;

  return {
    suggestions: picked.map((d) => toMealSuggestion(d, preferredSlot)),
    summaryTip,
    matchedCount: candidates.length,
    usedIngredientFallbackToAi,
  };
}

type CravingCategory =
  | 'drink'
  | 'sweet_snack'
  | 'banh_mi'
  | 'xoi_banh'
  | 'noodle'
  | 'rice'
  | 'fried_fast'
  | 'unknown';

function classifyCraving(foldedQuery: string): {
  category: CravingCategory;
  baselineCalories: number;
} {
  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'tra sua',
      'boba',
      'tra dao',
      'tra vai',
      'tra chanh',
      'nuoc ngot',
      'coca',
      'pepsi',
      'sting',
      'cafe sua',
      'ca phe sua',
      'bac xiu',
      'sinh to',
      'matcha da xay',
    ]) ||
    /^(tra |ca phe |cafe |nuoc )/.test(foldedQuery)
  ) {
    const highCalDrink = hasAnyFoldedPhrase(foldedQuery, [
      'tra sua',
      'boba',
      'matcha da xay',
      'sinh to',
    ]);
    return {
      category: 'drink',
      baselineCalories: highCalDrink ? 420 : 220,
    };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'che',
      'banh ngot',
      'banh kem',
      'kem',
      'snack',
      'bim bim',
      'banh quy',
      'banh trang tron',
      'banh trang nuong',
      'an vat',
      'socola',
      'chocolate',
    ])
  ) {
    return { category: 'sweet_snack', baselineCalories: 380 };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'banh mi',
      'hamburger',
      'burger',
      'sandwich',
    ])
  ) {
    return { category: 'banh_mi', baselineCalories: 480 };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'xoi',
      'banh bao',
      'banh gio',
      'banh chung',
      'banh tet',
      'banh cuon',
    ])
  ) {
    return { category: 'xoi_banh', baselineCalories: 510 };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'mi goi',
      'mi tom',
      'mi xao',
      'bun bo',
      'bun cha',
      'bun rieu',
      'bun dau',
      'pho',
      'hu tieu',
      'banh canh',
      'cao lau',
      'mi quang',
      'mien',
      'bun',
    ])
  ) {
    const heavyNoodle = hasAnyFoldedPhrase(foldedQuery, ['bun dau', 'mi xao', 'bun bo']);
    return {
      category: 'noodle',
      baselineCalories: heavyNoodle ? 660 : 580,
    };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'com tam',
      'com suon',
      'com chien',
      'com rang',
      'com ga',
      'com van phong',
      'com',
    ])
  ) {
    const heavyRice = hasAnyFoldedPhrase(foldedQuery, ['com tam', 'com suon', 'com chien', 'com rang']);
    return {
      category: 'rice',
      baselineCalories: heavyRice ? 710 : 610,
    };
  }

  if (
    hasAnyFoldedPhrase(foldedQuery, [
      'ga ran',
      'ga chien',
      'kfc',
      'jollibee',
      'pizza',
      'khoai tay chien',
      'xuc xich',
      'ca vien chien',
      'do chien',
      'thit nuong',
      'ba chi',
    ])
  ) {
    return { category: 'fried_fast', baselineCalories: 720 };
  }

  return { category: 'unknown', baselineCalories: 560 };
}

export function pickTier1FoodSwaps(params: {
  dishes: DishBankItem[];
  cravingDish: string;
  profile: UserProfile;
  excludeNames?: string[];
  varietySeed?: number;
}): FoodSwapResponse | null {
  const {
    dishes,
    cravingDish,
    profile,
    excludeNames = [],
    varietySeed = 0,
  } = params;
  const queryFolded = foldVietnamese(cravingDish);
  if (!queryFolded) return null;

  const { category, baselineCalories } = classifyCraving(queryFolded);
  if (category === 'unknown') return null;

  const healthConds = profile.healthConditions ?? [];
  const excludedSet = new Set(excludeNames.map(normalizeText));

  const safePool = dishes.filter(
    (d) =>
      !excludedSet.has(normalizeText(d.name)) &&
      !(d.avoidIf ?? []).some((c) => healthConds.includes(c))
  );

  const scoreForSwap = (d: DishBankItem): number => {
    const foldedName = foldVietnamese(d.name);
    let score = 40;

    // Prefer everyday Vietnamese items over unusual Western/NCKD meals
    if (d.cuisine === 'vietnam') score += 20;
    else if (d.cuisine === 'drink') score += 10;
    if (isEverydayVietnameseStaple(d)) score += 15;
    if (/(nckd|meatballs|shakshuka|nicoise|quesadilla|savory yogurt)/.test(foldedName)) {
      score -= 18;
    }

    if (category === 'banh_mi') {
      if (hasFoldedPhrase(foldedName, 'banh mi')) score += 45;
      else if (/(sandwich|banh cuon|pho ga|goi cuon)/.test(foldedName)) score += 24;
    } else if (category === 'xoi_banh') {
      if (/(xoi|banh cuon|chao|pho ga|khoai lang)/.test(foldedName)) score += 32;
    } else if (category === 'drink') {
      if (/(tra|matcha|cold brew|bac xiu|americano|latte|sua dau|sua hat)/.test(foldedName)) {
        score += 36;
      }
      if (hasFoldedPhrase(queryFolded, 'tra sua') && /(tra|sua)/.test(foldedName)) {
        score += 12;
      }
    } else if (category === 'sweet_snack') {
      if (/(sua chua|che|banh chuoi|khoai lang|tao|trung|banh gao)/.test(foldedName)) {
        score += 30;
      }
    } else if (category === 'noodle') {
      if (/(pho|bun|mien|hu tieu|goi cuon)/.test(foldedName)) score += 36;
    } else if (category === 'rice') {
      if (/(com|bun thit nuong)/.test(foldedName)) score += 32;
    } else if (category === 'fried_fast') {
      if (hasFoldedPhrase(queryFolded, 'pizza') && foldedName.includes('pizza')) {
        score += 45;
      }
      if (d.protein >= 26) score += 20;
    }

    // Meaningful calorie savings compared to craving baseline
    const savings = baselineCalories - d.calories;
    if (savings >= 80 && savings <= 320) score += 16;
    score += Math.min(18, Math.round(d.protein * 0.6));

    if (varietySeed !== 0) {
      score += hashSeedOffset(d.id, varietySeed);
    }
    return score;
  };

  let pool: DishBankItem[] = [];

  if (category === 'drink') {
    pool = safePool.filter(
      (d) =>
        d.cuisine === 'drink' &&
        d.calories < baselineCalories - 30 &&
        d.calories <= 190 &&
        (d.sugarG ?? 0) <= 14
    );
  } else if (category === 'sweet_snack') {
    pool = safePool.filter(
      (d) => d.cuisine === 'drink' && d.calories <= 235
    );
  } else if (category === 'banh_mi') {
    pool = safePool.filter((d) => {
      const f = foldVietnamese(d.name);
      return (
        d.calories <= 425 &&
        d.cuisine !== 'drink' &&
        (hasFoldedPhrase(f, 'banh mi') ||
          /(sandwich|banh cuon|banh uot|pho ga|goi cuon|chao)/.test(f))
      );
    });
  } else if (category === 'xoi_banh') {
    pool = safePool.filter((d) => {
      const f = foldVietnamese(d.name);
      return (
        d.calories <= 445 &&
        d.slots.includes('Sáng') &&
        d.cuisine !== 'drink' &&
        /(xoi|banh cuon|banh uot|chao|pho|bun moc|bap)/.test(f)
      );
    });
  } else if (category === 'noodle') {
    pool = safePool.filter((d) => {
      const f = foldVietnamese(d.name);
      return (
        d.cuisine !== 'drink' &&
        d.calories <= Math.min(440, baselineCalories - 90) &&
        /(pho|bun|mien|hu tieu|goi cuon|soba|udon)/.test(f) &&
        normalizeText(d.name) !== normalizeText(cravingDish)
      );
    });
  } else if (category === 'rice') {
    pool = safePool.filter((d) => {
      const f = foldVietnamese(d.name);
      return (
        d.cuisine === 'vietnam' &&
        d.calories <= Math.min(490, baselineCalories - 90) &&
        d.protein >= 22 &&
        /(com|bun thit nuong|goi)/.test(f) &&
        !/(com tam|com chien|com rang)/.test(f)
      );
    });
  } else if (category === 'fried_fast') {
    pool = safePool.filter((d) => {
      const f = foldVietnamese(d.name);
      return (
        d.cuisine !== 'drink' &&
        d.protein >= 24 &&
        d.calories <= 480 &&
        !/(chien|ran)/.test(f)
      );
    });
  }

  if (pool.length < 3) {
    return null;
  }

  const sorted = [...pool].sort((a, b) => scoreForSwap(b) - scoreForSwap(a));

  // Ensure diverse names (don't pick 3 slightly different versions of the exact same prefix)
  const chosen: DishBankItem[] = [];
  const usedPrefix = new Set<string>();
  for (const d of sorted) {
    if (chosen.length >= 3) break;
    const prefix = d.name.split(' ').slice(0, 3).join(' ').toLowerCase();
    if (!usedPrefix.has(prefix) || sorted.length <= 4) {
      chosen.push(d);
      usedPrefix.add(prefix);
    }
  }
  for (const d of sorted) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.id === d.id)) {
      chosen.push(d);
    }
  }

  const swaps: FoodSwapItem[] = chosen.map((d) => ({
    alternativeName: d.name,
    calories: d.calories,
    calorieDiff: d.calories - baselineCalories,
    protein: d.protein,
    reason: d.whyItFits,
    howToOrderOrCook: d.swapTip,
  }));

  return {
    originalDish: cravingDish.trim(),
    originalEstimatedCalories: baselineCalories,
    swaps,
  };
}

const STOP_WORDS = new Set([
  '1',
  '2',
  'mot',
  'hai',
  'to',
  'chen',
  'bat',
  'dia',
  'hop',
  'phan',
  'suat',
  'ly',
  'coc',
  'cai',
  'o',
  'an',
  'uong',
  'bua',
  'sang',
  'trua',
  'xe',
  'toi',
  'hom',
  'nay',
  'voi',
  'va',
  'it',
  'nhieu',
  'them',
  'cho',
  'minh',
  'nen',
  'gi',
  'bao',
  'nhieu',
  'calo',
  'kcal',
  'mon',
  'nao',
]);

function extractDishKeywords(text: string): string[] {
  return foldVietnamese(text)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export function matchMealAnalysisFromBank(
  description: string,
  contexts: ContextOption[],
  dishes: DishBankItem[]
): { analysis: AnalyzedMealResult; matchedDishName: string } | null {
  const cleanQuery = foldVietnamese(description);
  const queryTokens = extractDishKeywords(description);
  if (!cleanQuery || queryTokens.length === 0) return null;

  // Skip local match if user describes multiple joined meals
  if (queryTokens.length > 9) return null;

  let bestDish: DishBankItem | null = null;
  let bestScore = 0;

  for (const dish of dishes) {
    const foldedName = foldVietnamese(dish.name);
    const nameTokens = extractDishKeywords(dish.name);

    let score = 0;
    if (foldedName === cleanQuery) {
      score = 100;
    } else if (hasFoldedPhrase(foldedName, cleanQuery) && cleanQuery.length >= 5) {
      score = 88;
    } else if (nameTokens.length > 0) {
      const nameTokenSet = new Set(nameTokens);
      const matchedInName = queryTokens.filter((t) => nameTokenSet.has(t)).length;
      const queryCoverage = matchedInName / queryTokens.length;
      const nameCoverage = matchedInName / nameTokens.length;
      if (matchedInName >= 2 && (queryCoverage >= 0.75 || nameCoverage >= 0.6)) {
        score = Math.round(queryCoverage * 55 + nameCoverage * 35);
      } else if (queryTokens.length === 1 && matchedInName === 1 && cleanQuery.length >= 4) {
        score = 68;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestDish = dish;
    }
  }

  if (!bestDish || bestScore < 68) {
    return null;
  }

  let calories = bestDish.calories;
  let protein = bestDish.protein;
  let carbs = bestDish.carbs;
  let fiber = bestDish.fiber;
  let fat = bestDish.fat;
  let sodiumMg = bestDish.sodiumMg ?? 420;
  let sugarG = bestDish.sugarG ?? 4;

  if (contexts.includes('Ăn một nửa')) {
    calories = Math.round(calories * 0.5);
    protein = Math.round(protein * 0.5);
    carbs = Math.round(carbs * 0.5);
    fiber = Math.round(fiber * 0.5);
    fat = Math.round(fat * 0.5);
    sodiumMg = Math.round(sodiumMg * 0.5);
    sugarG = Math.round(sugarG * 0.5);
  } else {
    if (contexts.includes('Ít cơm')) {
      carbs = Math.max(5, Math.round(carbs * 0.78));
      calories = Math.max(80, calories - 65);
    }
    if (contexts.includes('Nhiều cơm')) {
      carbs = Math.round(carbs * 1.25);
      calories = calories + 110;
    }
    if (contexts.includes('Tự nấu ít dầu')) {
      fat = Math.max(2, Math.round(fat * 0.85));
      calories = Math.max(60, calories - 35);
    }
  }

  const itemsDetected = bestDish.recipe?.ingredients?.length
    ? bestDish.recipe.ingredients.slice(0, 5)
    : [bestDish.portionEstimate];

  return {
    matchedDishName: bestDish.name,
    analysis: {
      name: bestDish.name,
      portionEstimate: bestDish.portionEstimate,
      itemsDetected,
      calories,
      protein,
      carbs,
      fiber,
      fat,
      sodiumMg,
      sugarG,
      contexts: [...contexts],
      isHealthy:
        calories <= 560 && (bestDish.sugarG ?? 0) <= 18 && (bestDish.sodiumMg ?? 0) <= 1300,
      summaryNote: `${bestDish.whyItFits} Mẹo: ${bestDish.swapTip}`,
    },
  };
}

export function pickTier1FoodSwapsSmart(params: {
  dishes: DishBankItem[];
  cravingDish: string;
  profile: UserProfile;
  excludeNames?: string[];
  varietySeed?: number;
}): FoodSwapResponse | null {
  const direct = pickTier1FoodSwaps(params);
  if (direct) return direct;

  const {
    dishes,
    cravingDish,
    profile,
    excludeNames = [],
    varietySeed = 0,
  } = params;
  const tokens = extractDishKeywords(cravingDish);
  if (tokens.length === 0) return null;

  const excludedSet = new Set(excludeNames.map(normalizeText));
  const healthConds = profile.healthConditions ?? [];

  // Whole-word token match (avoid partial substring bugs like 'mi' matching 'mi nguyen cam')
  const scoredPool = dishes
    .filter((d) => {
      if (excludedSet.has(normalizeText(d.name))) return false;
      if ((d.avoidIf ?? []).some((c) => healthConds.includes(c))) {
        return false;
      }
      if (d.calories > 470) return false;
      const nameWords = new Set(foldVietnamese(d.name).split(' '));
      const matchedCount = tokens.filter((t) => nameWords.has(t)).length;
      return matchedCount >= (tokens.length >= 2 ? 2 : 1);
    })
    .map((d) => {
      const everydayBonus = d.cuisine === 'vietnam' ? 20 : 0;
      const stapleBonus = isEverydayVietnameseStaple(d) ? 12 : 0;
      const jitter = varietySeed !== 0 ? hashSeedOffset(d.id, varietySeed) : 0;
      return {
        dish: d,
        score: everydayBonus + stapleBonus + d.protein - d.calories * 0.03 + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.dish);

  if (scoredPool.length < 3) return null;

  const baselineCalories = 540;
  return {
    originalDish: cravingDish.trim(),
    originalEstimatedCalories: baselineCalories,
    swaps: scoredPool.slice(0, 3).map((d) => ({
      alternativeName: d.name,
      calories: d.calories,
      calorieDiff: d.calories - baselineCalories,
      protein: d.protein,
      reason: d.whyItFits,
      howToOrderOrCook: d.swapTip,
    })),
  };
}

export function tryAnswerCompanionFromLocalBank(params: {
  question: string;
  dishes: DishBankItem[];
  profile: UserProfile;
  remaining: RemainingBudget;
  waterCups: number;
  streakDays: number;
  excludeNames?: string[];
  varietySeed?: number;
}): CompanionChatReply | null {
  const {
    question,
    dishes,
    profile,
    remaining,
    waterCups,
    streakDays,
    excludeNames = [],
    varietySeed = 0,
  } = params;
  const qFolded = foldVietnamese(question);
  if (!qFolded) return null;

  const healthConds = profile.healthConditions ?? [];
  const excludedSet = new Set(excludeNames.map(normalizeText));
  const safeDishes = dishes.filter(
    (d) =>
      !(d.avoidIf ?? []).some((c) => healthConds.includes(c)) &&
      !excludedSet.has(normalizeText(d.name))
  );

  // 1. Streak / habit / usage guidance
  if (/(streak|chuoi ngay|duy tri|cach dung|huong dan)/.test(qFolded)) {
    const streakLine =
      streakDays > 0
        ? `${profile.name} đang giữ được chuỗi ${streakDays} ngày rất tốt rồi!`
        : `${profile.name} chỉ cần ghi 1 bữa đầu tiên hôm nay là bắt đầu chuỗi ngày ngay.`;
    return {
      reply: `${streakLine} Mẹo dễ nhất là bật nhắc nhở ở biểu tượng Chuông và tận dụng nút Chọn ăn & lưu trong mục Gợi ý để ghi bữa chỉ trong vài giây.`,
      quickTip: 'Nếu quên chụp ảnh lúc ăn, bạn cứ gõ tên món bằng chữ vào ô Ghi bữa — app nhận diện rất nhanh.',
      suggestedAction: streakDays === 0 ? 'log' : 'suggestions',
    };
  }

  // 2. Nutrient gap / daily progress questions
  if (/(thieu chat|thieu gi|nap bao nhieu|con bao nhieu|hom nay an|chi so hom nay)/.test(qFolded)) {
    const missingItems: string[] = [];
    if (remaining.protein > 15) missingItems.push(`${remaining.protein}g Đạm`);
    if (remaining.fiber > 5) missingItems.push(`${remaining.fiber}g Chất xơ`);
    if (waterCups < profile.waterTargetCups) {
      missingItems.push(`${(profile.waterTargetCups - waterCups) * 200}ml nước`);
    }

    const hour = new Date().getHours();
    const currentSlot: MealSlot =
      hour < 10 ? 'Sáng' : hour < 14 ? 'Trưa' : hour < 17 ? 'Xế' : 'Tối';

    const menuPick = pickTier1MenuSuggestions({
      dishes: safeDishes,
      profile,
      remaining,
      diningMode: 'eat_out',
      preferredSlot: currentSlot,
      budgetOverride: profile.budgetLevel ?? 'balanced',
      excludeNames,
      varietySeed,
    });
    const candidate = menuPick.suggestions[0];

    const summary =
      missingItems.length > 0
        ? `Hôm nay ${profile.name} còn khoảng ${formatKcalNumber(
            remaining.calories
          )} kcal và đang cần bổ sung thêm ${missingItems.join(', ')}.`
        : `Hôm nay các nhóm chất chính của ${profile.name} đã bám rất sát mục tiêu rồi đó!`;

    const dishTip = candidate
      ? `Bữa ${currentSlot.toLowerCase()} hợp lúc này: thử "${candidate.name}" (${candidate.calories} kcal · ${candidate.protein}g đạm).`
      : 'Mở mục Gợi ý thực đơn để chọn 1 món vừa khít lượng calo còn lại.';

    return {
      reply: `${summary} Nhớ uống rải đều nước lọc để trao đổi chất tốt nhất nhé!`,
      quickTip: dishTip,
      suggestedAction: 'suggestions',
    };
  }

  // 3. Direct swap questions asked to Mầm (e.g., "thay thế trà sữa", "đổi món bánh mì")
  if (/(thay the|doi mon|them .* an gi|it beo hon|do beo hon)/.test(qFolded)) {
    const swapQuery = qFolded
      .replace(/(thay the|doi mon|goi y|giup|cho minh|mon nao|an gi|uong gi|it beo hon|do beo hon)/g, ' ')
      .trim();
    if (swapQuery.length >= 2) {
      const swapRes = pickTier1FoodSwapsSmart({
        dishes,
        cravingDish: swapQuery,
        profile,
        excludeNames,
        varietySeed,
      });
      if (swapRes && swapRes.swaps.length > 0) {
        const topTwo = swapRes.swaps
          .slice(0, 2)
          .map((s) => `"${s.alternativeName}" (${s.calories} kcal)`)
          .join(' hoặc ');
        return {
          reply: `Nếu đang thèm ${swapRes.originalDish} (~${swapRes.originalEstimatedCalories} kcal), bạn đổi sang ${topTwo} sẽ nhẹ hơn đáng kể mà vẫn ngon miệng nha!`,
          quickTip: swapRes.swaps[0].howToOrderOrCook,
          suggestedAction: 'suggestions',
        };
      }
    }
  }

  // 4. Direct calorie / nutrition lookup for a specific dish
  if (/(bao nhieu calo|bao nhieu kcal|co beo khong|co map khong|dinh duong cua)/.test(qFolded)) {
    const cleanTarget = qFolded
      .replace(/(bao nhieu calo|bao nhieu kcal|co beo khong|co map khong|dinh duong cua|1 to|1 dia|1 phan|1 ly|1 o)/g, ' ')
      .trim();
    if (cleanTarget.length >= 3) {
      const hit = matchMealAnalysisFromBank(cleanTarget, [], dishes);
      if (hit) {
        const a = hit.analysis;
        return {
          reply: `1 phần "${a.name}" (${a.portionEstimate}) ước tính khoảng ${a.calories} kcal, gồm ${a.protein}g Đạm · ${a.carbs}g Tinh bột · ${a.fiber}g Xơ · ${a.fat}g Béo.`,
          quickTip: a.summaryNote,
          suggestedAction: 'log',
        };
      }
    }
  }

  // 5. Slot-based meal or snack suggestion
  const underMatch = qFolded.match(/(?:duoi|toi da|<)\s*(\d{2,4})\s*(?:kcal|calo)/);
  const maxCal = underMatch ? Number(underMatch[1]) : null;
  const wantsDrinkOnly = /(uong gi|do uong|thuc uong|nuoc gi|tra gi|ca phe)/.test(qFolded);

  let slotHint: MealSlot | null = null;
  if (hasAnyFoldedPhrase(qFolded, ['sang', 'an sang', 'bua sang', 'buoi sang'])) {
    slotHint = 'Sáng';
  } else if (hasAnyFoldedPhrase(qFolded, ['trua', 'an trua', 'bua trua', 'buoi trua'])) {
    slotHint = 'Trưa';
  } else if (hasAnyFoldedPhrase(qFolded, ['toi', 'an toi', 'bua toi', 'buoi toi'])) {
    slotHint = 'Tối';
  } else if (
    wantsDrinkOnly ||
    /(xe|bua phu|an vat|bua nhe|chieu)/.test(qFolded)
  ) {
    slotHint = 'Xế';
  }

  const isAskingSuggestion =
    Boolean(maxCal) ||
    Boolean(slotHint) ||
    /(goi y|an gi|uong gi|mon nao|do uong|chon mon|hom nay an gi)/.test(qFolded);

  if (isAskingSuggestion) {
    // Handle drink / light snack requests cleanly
    if (slotHint === 'Xế' || wantsDrinkOnly || (maxCal !== null && maxCal <= 280)) {
      const cap = maxCal ?? (qFolded.includes('bua nhe') ? 240 : 260);
      let pool = safeDishes.filter((d) => {
        if (d.calories > cap) return false;
        if (wantsDrinkOnly && d.cuisine !== 'drink') return false;
        if (slotHint === 'Xế' && !d.slots.includes('Xế') && d.cuisine !== 'drink') {
          return false;
        }
        return true;
      });
      // Fallback safely if user already cycled through everything in excludeNames
      if (pool.length === 0) {
        pool = dishes.filter(
          (d) =>
            !(d.avoidIf ?? []).some((c) => healthConds.includes(c)) &&
            d.calories <= cap &&
            (d.cuisine === 'drink' || d.slots.includes('Xế'))
        );
      }

      if (pool.length > 0) {
        const scoredSnacks = [...pool].sort((a, b) => {
          const scoreA =
            (a.cuisine === 'vietnam' || a.cuisine === 'drink' ? 12 : 0) +
            a.protein +
            a.fiber * 2 +
            (varietySeed !== 0 ? hashSeedOffset(a.id, varietySeed) : 0);
          const scoreB =
            (b.cuisine === 'vietnam' || b.cuisine === 'drink' ? 12 : 0) +
            b.protein +
            b.fiber * 2 +
            (varietySeed !== 0 ? hashSeedOffset(b.id, varietySeed) : 0);
          return scoreB - scoreA;
        });

        const picks = scoredSnacks.slice(0, 2);
        const listText = picks
          .map((p) => `"${p.name}" (${p.calories} kcal, ${p.protein}g đạm)`)
          .join(' hoặc ');

        return {
          reply: `Chào ${profile.name}! Để nhẹ bụng mà vẫn đủ chất (mục tiêu ${formatKcalNumber(
            profile.targetCalories
          )} kcal/ngày), bạn có thể chọn ngay ${listText} nhé!`,
          quickTip: picks[0].swapTip,
          suggestedAction: 'suggestions',
        };
      }
    }

    // Handle real main meal slot suggestions (Sáng / Trưa / Tối) using our smart slot picker!
    const targetSlot: MealSlot = slotHint ?? 'Trưa';
    const wantsLightMain = /(nhe bung|it calo|it beo|thanh dam)/.test(qFolded);
    const adjustedRemaining: RemainingBudget = wantsLightMain
      ? { ...remaining, calories: Math.min(remaining.calories || 420, 420) }
      : remaining;

    let menuRes = pickTier1MenuSuggestions({
      dishes: safeDishes,
      profile,
      remaining: adjustedRemaining,
      diningMode: 'eat_out',
      preferredSlot: targetSlot,
      budgetOverride: profile.budgetLevel ?? 'balanced',
      excludeNames,
      cuisineFilter: 'all',
      varietySeed,
    });

    if (menuRes.suggestions.length === 0) {
      menuRes = pickTier1MenuSuggestions({
        dishes,
        profile,
        remaining: adjustedRemaining,
        diningMode: 'eat_out',
        preferredSlot: targetSlot,
        budgetOverride: profile.budgetLevel ?? 'balanced',
        excludeNames: [],
        cuisineFilter: 'all',
        varietySeed: varietySeed + 1,
      });
    }

    if (menuRes.suggestions.length > 0) {
      const picks = menuRes.suggestions.slice(0, 2);
      const listText = picks
        .map((p) => `"${p.name}" (${p.calories} kcal, ${p.protein}g đạm)`)
        .join(' hoặc ');

      return {
        reply: `Chào ${profile.name}! Với bữa ${targetSlot.toLowerCase()} hôm nay, Mầm gợi ý ${listText} — rất hợp mục tiêu ${formatKcalNumber(
          profile.targetCalories
        )} kcal/ngày của bạn!`,
        quickTip: picks[0].swapTip,
        suggestedAction: 'suggestions',
      };
    }
  }

  return null;
}
