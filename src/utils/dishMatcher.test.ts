import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDishBank } from '../data/dishes';
import {
  matchMealAnalysisFromBank,
  pickTier1FoodSwaps,
  pickTier1FoodSwapsSmart,
  pickTier1MenuSuggestions,
  tryAnswerCompanionFromLocalBank,
} from './dishMatcher';
import {
  buildUserProfile,
  normalizeCustomBudgetVnd,
  parseDishCostVndRange,
} from './nutrition';
import type { DishBankItem } from '../types/nutrition';

const VALID_SLOTS = new Set(['Sáng', 'Trưa', 'Xế', 'Tối']);
const VALID_MODES = new Set(['eat_out', 'home_cook']);
const VALID_CUISINES = new Set(['vietnam', 'healthy_intl', 'drink']);
const VALID_BUDGETS = new Set(['economy', 'balanced', 'flexible']);

test('Split-batch dish bank loads cleanly with 260+ unique dishes and valid nutrition math', async () => {
  const bank: DishBankItem[] = await loadDishBank();
  assert.ok(bank.length >= 260, `Expected >=260 dishes, got ${bank.length}`);

  const ids = new Set<string>();
  const names = new Set<string>();

  for (const dish of bank) {
    assert.ok(dish.id && !ids.has(dish.id), `Duplicate or empty id: ${dish.id}`);
    ids.add(dish.id);

    const normName = dish.name.trim().toLowerCase();
    assert.ok(normName && !names.has(normName), `Duplicate dish name: ${dish.name}`);
    names.add(normName);

    assert.ok(dish.slots.length >= 1 && dish.slots.every((s) => VALID_SLOTS.has(s)));
    assert.ok(VALID_MODES.has(dish.diningMode));
    assert.ok(VALID_CUISINES.has(dish.cuisine));
    assert.ok(VALID_BUDGETS.has(dish.budgetLevel));

    // Check nutrition formula: calories ~ 4*P + 4*C + 9*F (allow +/-20% tolerance for fiber/alc/rounding)
    const macroKcal = dish.protein * 4 + dish.carbs * 4 + dish.fat * 9;
    const tolerance = Math.max(25, macroKcal * 0.22);
    assert.ok(
      Math.abs(dish.calories - macroKcal) <= tolerance,
      `Calorie mismatch for "${dish.name}": stated=${dish.calories}, calculated=${macroKcal}`
    );

    if (dish.diningMode === 'home_cook') {
      assert.ok(
        dish.recipe && dish.recipe.ingredients.length >= 1 && dish.recipe.steps.length >= 1,
        `Home-cook dish "${dish.name}" missing recipe`
      );
    }
  }
});

test('pickTier1MenuSuggestions respects allergies, health conditions, kitchen tools, and ingredient matching', async () => {
  const dishes = await loadDishBank();
  const profile = buildUserProfile({
    name: 'Minh',
    gender: 'male',
    age: 26,
    heightCm: 173,
    weightKg: 68,
    goal: 'lose_fat',
    activityLevel: 'light',
    dietaryTags: ['Dị ứng hải sản', 'Ít tinh bột'],
    dietaryNote: '',
    budgetLevel: 'economy',
    cookingTime: 'under_15',
    cookingSkill: 'basic',
    kitchenTools: ['Bếp gas / bếp từ'], // No air fryer!
    healthConditions: ['Huyết áp cao'],
    dislikedFoods: 'Khổ qua',
  });

  // 1. Eat-out respects seafood allergy + high BP sodium cap
  const eatOutRes = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining: { calories: 900, protein: 60, carbs: 80, fiber: 15, fat: 30 },
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'economy',
  });

  assert.equal(eatOutRes.suggestions.length, 3);
  for (const s of eatOutRes.suggestions) {
    assert.ok(!s.name.toLowerCase().includes('tôm'));
    assert.ok(!s.name.toLowerCase().includes('cá'));
    assert.ok((s.sodiumMg ?? 0) <= 1050);
  }

  // 2. Home-cook respects kitchen tools (no NCKD-only dishes) and prioritizes available ingredients
  const homeRes = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining: { calories: 700, protein: 50, carbs: 60, fiber: 12, fat: 25 },
    diningMode: 'home_cook',
    preferredSlot: 'Trưa',
    budgetOverride: 'economy',
    availableIngredients: 'Ức gà, bông cải',
  });

  assert.equal(homeRes.suggestions.length, 3);
  assert.equal(homeRes.usedIngredientFallbackToAi, false);
  assert.ok(
    homeRes.suggestions.some((s) => s.name.toLowerCase().includes('ức gà')),
    'Expected ức gà dish to rank in top 3 when ingredient provided'
  );

  // 3. Unusual ingredients trigger AI Tier 2 fallback signal cleanly
  const oddRes = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining: { calories: 700, protein: 50, carbs: 60, fiber: 12, fat: 25 },
    diningMode: 'home_cook',
    preferredSlot: 'Tối',
    budgetOverride: 'economy',
    availableIngredients: 'Củ dền tím, phô mai dê',
  });
  assert.equal(oddRes.usedIngredientFallbackToAi, true);

  // 4. Tier 1 Food swap matches low-sugar drinks for trà sữa cravings
  const swapRes = pickTier1FoodSwaps({
    dishes,
    cravingDish: 'Trà sữa kem cheese full topping',
    profile,
  });
  assert.ok(swapRes !== null && swapRes.swaps.length === 3);
  assert.ok(swapRes.swaps.every((sw) => sw.calorieDiff < 0));
});

test('Zero-token JSON bank lookup works across meal text analysis, smart swaps, and Mầm companion', async () => {
  const dishes = await loadDishBank();
  const profile = buildUserProfile({
    name: 'Thuận',
    gender: 'male',
    age: 23,
    heightCm: 175,
    weightKg: 62,
    goal: 'gain_weight',
    activityLevel: 'moderate',
    dietaryTags: [],
    dietaryNote: '',
  });

  // 1. Diacritic-free & exact dish match with context scaling
  const exactHit = matchMealAnalysisFromBank('pho ga it banh', [], dishes);
  assert.ok(exactHit !== null);
  assert.equal(exactHit.analysis.name, 'Phở gà ta ít bánh');

  const halfHit = matchMealAnalysisFromBank('Phở gà ta ít bánh', ['Ăn một nửa'], dishes);
  assert.ok(halfHit !== null);
  assert.equal(halfHit.analysis.calories, Math.round(exactHit.analysis.calories * 0.5));

  // Complex essay with many different dishes falls back cleanly to Gemini AI (returns null)
  const complexMiss = matchMealAnalysisFromBank(
    'Sáng nay ăn bánh mì chảo kèm khoai tây nghiền xúc xích nướng phô mai và sinh tố xoài kem tươi',
    [],
    dishes
  );
  assert.equal(complexMiss, null);

  // 2. Bánh mì swap returns everyday bánh mì / light breakfast swaps (NEVER Chicken Meatballs / mì nguyên cám!)
  const banhMiSwap = pickTier1FoodSwapsSmart({
    dishes,
    cravingDish: 'bánh mì',
    profile,
  });
  assert.ok(banhMiSwap !== null && banhMiSwap.swaps.length === 3);
  assert.ok(banhMiSwap.originalEstimatedCalories <= 500);
  for (const sw of banhMiSwap.swaps) {
    const low = sw.alternativeName.toLowerCase();
    assert.ok(
      !low.includes('chicken meatballs') && !low.includes('gà viên'),
      `Irrelevant bánh mì swap returned: ${sw.alternativeName}`
    );
    assert.ok(
      /(bánh mì|sandwich|bánh cuốn|phở|gỏi cuốn|cháo|bánh ướt)/.test(low),
      `Expected relatable bánh mì / morning swap, got: ${sw.alternativeName}`
    );
  }

  // Rotation returns fresh swaps when excludeNames + varietySeed are passed
  const banhMiSwap2 = pickTier1FoodSwapsSmart({
    dishes,
    cravingDish: 'bánh mì',
    profile,
    excludeNames: banhMiSwap.swaps.map((s) => s.alternativeName),
    varietySeed: 42,
  });
  assert.ok(banhMiSwap2 !== null && banhMiSwap2.swaps.length === 3);
  const firstSet = new Set(banhMiSwap.swaps.map((s) => s.alternativeName));
  assert.ok(
    banhMiSwap2.swaps.some((s) => !firstSet.has(s.alternativeName)),
    'Expected rotated swaps on repeat click'
  );

  // 3. Breakfast slot returns everyday Vietnamese breakfast foods & rotates cleanly
  const sang1 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining: { calories: 2800, protein: 90, carbs: 421, fiber: 39, fat: 84 },
    diningMode: 'eat_out',
    preferredSlot: 'Sáng',
    budgetOverride: 'balanced',
    varietySeed: 1,
  });
  assert.equal(sang1.suggestions.length, 3);
  assert.ok(
    !/(kho \d+|api|gemini)/i.test(sang1.summaryTip),
    `Internal jargon leaked in summaryTip: ${sang1.summaryTip}`
  );
  for (const s of sang1.suggestions) {
    assert.ok(
      /(phở|bún|miến|hủ tiếu|bánh mì|bánh cuốn|bánh ướt|xôi|cháo|bánh canh|nui|bò kho|mì quảng)/i.test(
        s.name
      ),
      `Expected everyday breakfast staple for Sáng, got: ${s.name}`
    );
  }
  const sang2 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining: { calories: 2800, protein: 90, carbs: 421, fiber: 39, fat: 84 },
    diningMode: 'eat_out',
    preferredSlot: 'Sáng',
    budgetOverride: 'balanced',
    excludeNames: sang1.suggestions.map((s) => s.name),
    varietySeed: 2,
  });
  assert.equal(sang2.suggestions.length, 3);
  const sang1Names = new Set(sang1.suggestions.map((s) => s.name));
  assert.ok(
    sang2.suggestions.every((s) => !sang1Names.has(s.name)),
    'Expected completely fresh breakfast suggestions on second click'
  );

  // 4. Companion quick prompts & breakfast/swap/calorie Q&A resolve cleanly with no jargon leaks & rotate
  const quickQuestions = [
    'Hôm nay mình thiếu chất gì?',
    'Gợi ý bữa nhẹ dưới 200 kcal',
    'Làm sao duy trì streak dễ hơn?',
    'Gợi ý món sáng',
    'Thay thế trà sữa',
    'Phở bò bao nhiêu calo?',
  ];
  for (const q of quickQuestions) {
    const ans = tryAnswerCompanionFromLocalBank({
      question: q,
      dishes,
      profile,
      remaining: { calories: 950, protein: 45, carbs: 110, fiber: 12, fat: 30 },
      waterCups: 4,
      streakDays: 3,
      varietySeed: 5,
    });
    assert.ok(ans !== null && ans.reply.length > 20, `Expected local reply for "${q}"`);
    assert.ok(
      !/(kho \d+|tốn ai|tốn api|gemini)/i.test(ans.reply + ' ' + ans.quickTip),
      `Internal jargon leaked in Mầm reply for "${q}": ${ans.reply}`
    );
  }

  // Asking Mầm for breakfast twice rotates cleanly
  const mamB1 = tryAnswerCompanionFromLocalBank({
    question: 'Gợi ý món sáng nhẹ',
    dishes,
    profile,
    remaining: { calories: 2800, protein: 90, carbs: 421, fiber: 39, fat: 84 },
    waterCups: 0,
    streakDays: 0,
    varietySeed: 1,
  });
  assert.ok(mamB1 !== null);
  assert.ok(mamB1.reply.includes('Mầm'), `Expected Mầm branding in reply: ${mamB1.reply}`);
  const b1Names = [...mamB1.reply.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(b1Names.length >= 1);
  const mamB2 = tryAnswerCompanionFromLocalBank({
    question: 'Gợi ý món sáng nhẹ',
    dishes,
    profile,
    remaining: { calories: 2800, protein: 90, carbs: 421, fiber: 39, fat: 84 },
    waterCups: 0,
    streakDays: 0,
    excludeNames: b1Names,
    varietySeed: 2,
  });
  assert.ok(mamB2 !== null && mamB2.reply !== mamB1.reply);

  // Open custom medical/philosophy prompt falls back cleanly to AI Tier 2
  const openMiss = tryAnswerCompanionFromLocalBank({
    question: 'Tại sao hôm nay trời mưa làm mình buồn ngủ sau ăn?',
    dishes,
    profile,
    remaining: { calories: 950, protein: 45, carbs: 110, fiber: 12, fat: 30 },
    waterCups: 4,
    streakDays: 3,
  });
  assert.equal(openMiss, null);
});

test('VND price-range presets and custom budget normalization filter eat-out dishes accurately', async () => {
  assert.equal(normalizeCustomBudgetVnd('45'), 45000);
  assert.equal(normalizeCustomBudgetVnd('65k'), 65000);
  assert.equal(normalizeCustomBudgetVnd('120.000'), 120000);
  assert.equal(normalizeCustomBudgetVnd('95.000đ'), 95000);
  assert.equal(normalizeCustomBudgetVnd('150 nghìn'), 150000);
  assert.equal(normalizeCustomBudgetVnd(''), null);
  assert.equal(normalizeCustomBudgetVnd('2000'), null);
  assert.equal(normalizeCustomBudgetVnd('abc'), null);

  assert.deepEqual(parseDishCostVndRange('35.000đ'), { min: 35000, max: 35000 });
  assert.deepEqual(parseDishCostVndRange('~35.000đ - 45.000đ'), {
    min: 35000,
    max: 45000,
  });
  assert.deepEqual(parseDishCostVndRange('185.000đ'), { min: 185000, max: 185000 });

  const dishes = await loadDishBank();
  const profile = buildUserProfile({
    name: 'Thuận',
    gender: 'male',
    age: 23,
    heightCm: 175,
    weightKg: 62,
    goal: 'maintain',
    activityLevel: 'moderate',
    dietaryTags: [],
    dietaryNote: '',
  });
  const remaining = { calories: 1600, protein: 80, carbs: 180, fiber: 20, fat: 50 };

  // 1. Dưới 50k
  const rUnder50 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining,
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'economy',
    budgetRange: 'under_50k',
  });
  assert.equal(rUnder50.suggestions.length, 3);
  assert.ok(rUnder50.summaryTip.includes('Dưới 50k'));
  for (const s of rUnder50.suggestions) {
    const cost = parseDishCostVndRange(s.estimatedCostVnd);
    assert.ok(cost.max < 50000, `Expected <50k dish, got ${s.name} (${s.estimatedCostVnd})`);
  }

  // 2. 50 - 80k
  const r50to80 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining,
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'balanced',
    budgetRange: '50_80k',
  });
  assert.equal(r50to80.suggestions.length, 3);
  for (const s of r50to80.suggestions) {
    const cost = parseDishCostVndRange(s.estimatedCostVnd);
    assert.ok(
      cost.max >= 50000 && cost.min <= 80000,
      `Expected 50-80k dish, got ${s.name} (${s.estimatedCostVnd})`
    );
  }

  // 3. 85 - 150k
  const r85to150 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining,
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'flexible',
    budgetRange: '85_150k',
  });
  assert.equal(r85to150.suggestions.length, 3);
  for (const s of r85to150.suggestions) {
    const cost = parseDishCostVndRange(s.estimatedCostVnd);
    assert.ok(
      cost.max >= 85000 && cost.min <= 150000,
      `Expected 85-150k dish, got ${s.name} (${s.estimatedCostVnd})`
    );
  }

  // 4. Trên 150k
  const rOver150 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining,
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'flexible',
    budgetRange: 'over_150k',
  });
  assert.equal(rOver150.suggestions.length, 3);
  for (const s of rOver150.suggestions) {
    const cost = parseDishCostVndRange(s.estimatedCostVnd);
    assert.ok(
      cost.max > 150000,
      `Expected >150k dish, got ${s.name} (${s.estimatedCostVnd})`
    );
  }

  // 5. Custom budget (e.g. 65.000đ)
  const rCustom65 = pickTier1MenuSuggestions({
    dishes,
    profile,
    remaining,
    diningMode: 'eat_out',
    preferredSlot: 'Trưa',
    budgetOverride: 'balanced',
    customBudgetVnd: 65000,
  });
  assert.equal(rCustom65.suggestions.length, 3);
  assert.ok(rCustom65.summaryTip.includes('65.000đ'));
  for (const s of rCustom65.suggestions) {
    const cost = parseDishCostVndRange(s.estimatedCostVnd);
    assert.ok(
      cost.max <= 65000,
      `Expected dish <= 65k, got ${s.name} (${s.estimatedCostVnd})`
    );
  }
});
