import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDynamicReminders,
  buildUserProfile,
  calculateBMI,
  calculateStreak,
  computeDailyTotals,
  formatReadableViDate,
  formatViNumber,
  formatWaterLiters,
  getBMICategory,
  getLast7DaysStats,
  getLocalPeriodRuleInsight,
  getMascotFeedback,
  getMascotMoodState,
  getMissingProfileFields,
  getPeriodReportStats,
  getRecentDateKeys,
  getWeightChangeStats,
  normalizeAnalysisPayload,
  recordSuggestionFeedback,
  scaleAnalyzedMeal,
  upsertWeightEntry,
} from './nutrition';
import {
  APP_GUIDE_STEPS,
  HANDBOOK_SWAP_PAIRS,
  HAND_PORTION_RULES,
  getHandbookTipsForGoal,
  getMealGuidesBySlotAndGoal,
} from '../data/handbook';
import { detectIsIOSUserAgent, resolveInstallState } from './pwa';
import type {
  MealSlot,
  MealsByDate,
  UserGoal,
  WeightEntry,
} from '../types/nutrition';

test('BMI and Asian WHO categories calculate accurately', () => {
  assert.equal(calculateBMI(55, 162), 21);
  assert.equal(getBMICategory(17.8).label, 'Thiếu cân');
  assert.equal(getBMICategory(21.0).label, 'Cân đối');
  assert.equal(getBMICategory(23.8).label, 'Thừa cân nhẹ');
  assert.equal(getBMICategory(26.2).label, 'Thừa cân');
});

test('buildUserProfile computes Mifflin-St Jeor TDEE, goal calories, macros, and water', () => {
  const loseFatProfile = buildUserProfile({
    name: 'Ánh',
    gender: 'female',
    age: 24,
    heightCm: 162,
    weightKg: 58,
    goal: 'lose_fat',
    activityLevel: 'light',
    dietaryTags: ['Ưu tiên cơm nhà'],
    dietaryNote: '',
  });

  // BMR = 10*58 + 6.25*162 - 5*24 - 161 = 580 + 1012.5 - 120 - 161 = 1311.5 -> 1312
  assert.equal(loseFatProfile.bmr, 1312);
  // TDEE = 1312 * 1.375 = 1804 -> lose_fat = 1804 - 400 = 1404 -> rounded to 1400
  assert.equal(loseFatProfile.tdee, 1804);
  assert.equal(loseFatProfile.targetCalories, 1400);
  // Protein = 58 * 1.6 = 93g
  assert.equal(loseFatProfile.targets.protein, 93);
  // Water = 58 * 35 / 200 = 10.15 -> 10 cups (2L)
  assert.equal(loseFatProfile.waterTargetCups, 10);

  const gymMaleProfile = buildUserProfile({
    name: 'Minh',
    gender: 'male',
    age: 26,
    heightCm: 175,
    weightKg: 72,
    goal: 'build_muscle',
    activityLevel: 'moderate',
    dietaryTags: [],
    dietaryNote: '',
  });
  assert.ok(gymMaleProfile.targetCalories > gymMaleProfile.tdee);
  assert.equal(gymMaleProfile.targets.protein, Math.round(72 * 1.9));
  assert.equal(gymMaleProfile.waterTargetCups, 13); // 72*35/200 = 12.6 -> 13 cups
});

test('Empty meals produce zero totals and zero streak until real meals are logged', () => {
  const profile = buildUserProfile({
    name: 'Lan',
    gender: 'female',
    age: 23,
    heightCm: 160,
    weightKg: 52,
    goal: 'maintain',
    activityLevel: 'light',
    dietaryTags: [],
    dietaryNote: '',
  });

  const totals = computeDailyTotals([], profile.targetCalories);
  assert.equal(totals.calories, 0);
  assert.equal(totals.remaining, profile.targetCalories);
  assert.equal(totals.percent, 0);
  assert.equal(totals.slotsLogged.length, 0);

  const mascot = getMascotFeedback(totals, profile);
  assert.equal(mascot.highlight, '0% nhu cầu');

  assert.equal(calculateStreak({}, '2026-11-16'), 0);
});

test('calculateStreak and getLast7DaysStats reflect only real logged dates', () => {
  const mealStub = {
    id: 'm1',
    slot: 'Trưa' as const,
    name: 'Cơm cá kho',
    time: '12:00',
    calories: 520,
    protein: 28,
    carbs: 65,
    fiber: 5,
    fat: 14,
    contexts: [],
  };

  const mealsByDate: MealsByDate = {
    '2026-11-16': [mealStub],
    '2026-11-15': [mealStub],
    '2026-11-14': [mealStub],
    // gap on 2026-11-13
    '2026-11-12': [mealStub],
  };

  assert.equal(calculateStreak(mealsByDate, '2026-11-16'), 3);

  const stats = getLast7DaysStats(mealsByDate, 1800, new Date(2026, 10, 16));
  assert.equal(stats.length, 7);
  assert.equal(stats[6].calories, 520);
  assert.equal(stats[6].day, 'Nay');
  assert.equal(stats[3].calories, 0); // 2026-11-13 has 0
});

test('formatViNumber, formatWaterLiters, normalizeAnalysisPayload, scaleAnalyzedMeal work cleanly', () => {
  assert.equal(formatViNumber(1850), '1.850');
  assert.equal(formatWaterLiters(0), '0');
  assert.equal(formatWaterLiters(12), '2.4');

  const normalized = normalizeAnalysisPayload(
    {
      name: 'Trứng vịt lộn (2 quả)',
      portionEstimate: '2 quả luộc',
      itemsDetected: ['Trứng vịt lộn', 'Rau răm'],
      calories: 240,
      protein: 18,
      carbs: 2,
      fiber: 1,
      fat: 17,
      isHealthy: true,
      summaryNote: 'Hợp lý khi ăn 2 quả.',
    },
    []
  );
  const scaled = scaleAnalyzedMeal(normalized, 1.5);
  assert.equal(scaled.calories, 360);
  assert.equal(scaled.protein, 27);
});

test('Handbook meal guides, swap pairs, hand portion rules, and goal tips cover all slots and goals', () => {
  const slots: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];
  const goals: UserGoal[] = ['lose_fat', 'maintain', 'build_muscle', 'gain_weight'];

  for (const slot of slots) {
    for (const goal of goals) {
      const sorted = getMealGuidesBySlotAndGoal(slot, goal, false);
      assert.ok(sorted.length >= 3, `Expected >=3 guides for ${slot}`);
      const filtered = getMealGuidesBySlotAndGoal(slot, goal, true);
      assert.ok(filtered.length >= 1, `Expected >=1 filtered guide for ${slot}/${goal}`);
    }
  }

  for (const goal of goals) {
    const tips = getHandbookTipsForGoal(goal, 'Cân đối');
    assert.ok(tips.headline.length > 0);
    assert.equal(tips.bulletTips.length, 2);
  }

  assert.equal(APP_GUIDE_STEPS.length, 4);
  assert.equal(HAND_PORTION_RULES.length, 4);
  assert.ok(HANDBOOK_SWAP_PAIRS.every((p) => p.fromCalories > p.toCalories));
  assert.ok(
    HANDBOOK_SWAP_PAIRS.every(
      (p) => p.nutritionBadge.trim().length > 0 && p.whyBetter.length <= 85
    )
  );
});

test('PWA install state detection handles iOS Safari, Android native prompt, fallback, and installed states', () => {
  assert.equal(
    detectIsIOSUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15'
    ),
    true
  );
  assert.equal(
    detectIsIOSUserAgent(
      'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36'
    ),
    false
  );

  assert.deepEqual(
    resolveInstallState({
      isStandalone: true,
      isIOS: false,
      hasDeferredPrompt: false,
      hasRecordedInstall: false,
    }),
    { isInstalled: true, clickAction: 'installed_card' }
  );

  assert.deepEqual(
    resolveInstallState({
      isStandalone: false,
      isIOS: false,
      hasDeferredPrompt: false,
      hasRecordedInstall: true,
    }),
    { isInstalled: true, clickAction: 'installed_card' }
  );

  assert.deepEqual(
    resolveInstallState({
      isStandalone: false,
      isIOS: false,
      hasDeferredPrompt: true,
      hasRecordedInstall: false,
    }),
    { isInstalled: false, clickAction: 'native_prompt' }
  );

  assert.deepEqual(
    resolveInstallState({
      isStandalone: false,
      isIOS: true,
      hasDeferredPrompt: false,
      hasRecordedInstall: false,
    }),
    { isInstalled: false, clickAction: 'ios_guide' }
  );

  assert.deepEqual(
    resolveInstallState({
      isStandalone: false,
      isIOS: false,
      hasDeferredPrompt: false,
      hasRecordedInstall: false,
    }),
    { isInstalled: false, clickAction: 'android_guide' }
  );
});

test('Period reports (week & month), insights, feedback, and mascot mood calculate accurately from real logs', () => {
  const profile = buildUserProfile({
    name: 'Ánh',
    gender: 'female',
    age: 24,
    heightCm: 162,
    weightKg: 55,
    goal: 'maintain',
    activityLevel: 'light',
    dietaryTags: ['Ưu tiên cơm nhà'],
    dietaryNote: '',
    budgetLevel: 'economy',
    cookingTime: 'under_15',
    cookingSkill: 'basic',
    kitchenTools: ['Bếp gas / bếp từ'],
    healthConditions: ['Đau dạ dày'],
    dislikedFoods: 'Mướp đắng',
  });

  assert.equal(profile.budgetLevel, 'economy');
  assert.equal(profile.dislikedFoods, 'Mướp đắng');

  const today = new Date(2026, 10, 16);
  const mealsByDate: MealsByDate = {
    '2026-11-16': [
      {
        id: '1',
        slot: 'Sáng',
        name: 'Phở gà',
        time: '08:00',
        calories: 420,
        protein: 24,
        carbs: 55,
        fiber: 3,
        fat: 10,
        contexts: [],
      },
      {
        id: '2',
        slot: 'Trưa',
        name: 'Cơm ức gà luộc',
        time: '12:15',
        calories: 560,
        protein: 42,
        carbs: 68,
        fiber: 6,
        fat: 11,
        contexts: [],
      },
    ],
    '2026-11-10': [
      {
        id: '3',
        slot: 'Tối',
        name: 'Bún chả',
        time: '19:00',
        calories: 620,
        protein: 28,
        carbs: 72,
        fiber: 4,
        fat: 22,
        contexts: [],
      },
    ],
    '2026-10-25': [
      {
        id: '4',
        slot: 'Trưa',
        name: 'Cơm cá kho',
        time: '12:00',
        calories: 580,
        protein: 30,
        carbs: 65,
        fiber: 4,
        fat: 18,
        contexts: [],
      },
    ],
  };

  const weekReport = getPeriodReportStats(mealsByDate, profile, 'week', today);
  assert.equal(weekReport.loggedDaysCount, 2);
  assert.equal(weekReport.totalMealsCount, 3);
  assert.equal(weekReport.uniqueDishesCount, 3);
  assert.equal(weekReport.buckets.length, 7);
  assert.equal(weekReport.avgCalories, Math.round((980 + 620) / 2));

  const monthReport = getPeriodReportStats(mealsByDate, profile, 'month', today);
  assert.equal(monthReport.loggedDaysCount, 3);
  assert.equal(monthReport.buckets.length, 4);
  assert.equal(monthReport.uniqueDishesCount, 4);
  assert.ok(monthReport.deficientNutrients.includes('Chất xơ'));

  const insight = getLocalPeriodRuleInsight(monthReport, profile);
  assert.ok(insight.headline.includes('30 ngày'));
  assert.ok(insight.actionTip.length > 10);

  const emptyInsight = getLocalPeriodRuleInsight(
    getPeriodReportStats({}, profile, 'week', today),
    profile
  );
  assert.ok(emptyInsight.headline.includes('Chưa có dữ liệu'));

  let fb = recordSuggestionFeedback(undefined, 'Cơm ức gà', 'liked');
  fb = recordSuggestionFeedback(fb, 'Trà sữa kem cheese', 'disliked');
  fb = recordSuggestionFeedback(fb, 'Bún gạo lứt', 'tried');
  assert.deepEqual(fb.liked, ['Cơm ức gà']);
  assert.deepEqual(fb.disliked, ['Trà sữa kem cheese']);
  assert.deepEqual(fb.tried, ['Bún gạo lứt']);

  // Switching to disliked removes from liked
  fb = recordSuggestionFeedback(fb, 'Cơm ức gà', 'disliked');
  assert.equal(fb.liked.length, 0);
  assert.equal(fb.disliked[0], 'Cơm ức gà');

  const recentKeys = getRecentDateKeys(14, today);
  assert.equal(recentKeys.length, 14);
  assert.equal(recentKeys[13].isToday, true);
  assert.equal(formatReadableViDate('2026-11-16', '2026-11-16'), 'Hôm nay');
  assert.equal(formatReadableViDate('2026-11-15', '2026-11-16'), 'Hôm qua');

  assert.equal(
    getMascotMoodState(computeDailyTotals([], profile.targetCalories), profile, 0).mood,
    'fresh'
  );
  assert.equal(
    getMascotMoodState(computeDailyTotals(mealsByDate['2026-11-16'], 1000), profile, 3).mood,
    'celebrate'
  );

  // Complete profile has 0 missing fields
  assert.equal(getMissingProfileFields(profile).length, 0);

  // Legacy/incomplete profile surfaces exact missing fields
  const incomplete = getMissingProfileFields({
    name: '',
    age: 24,
    heightCm: 162,
    weightKg: 55,
    dietaryTags: [],
    kitchenTools: [],
  });
  assert.deepEqual(
    incomplete.map((m) => m.key),
    ['name', 'budget', 'cooking', 'tools', 'dietary']
  );
});

test('Weight history trend and micronutrients (sodiumMg, sugarG) calculate and trigger reminders accurately', () => {
  const profile = buildUserProfile({
    name: 'Thảo',
    gender: 'female',
    age: 25,
    heightCm: 160,
    weightKg: 58,
    goal: 'lose_fat',
    activityLevel: 'light',
    dietaryTags: [],
    dietaryNote: '',
  });

  // Weight upsert + chronological sorting + delta calculation
  let weights: WeightEntry[] = [];
  weights = upsertWeightEntry(weights, '2026-11-10', 58.6, 160);
  weights = upsertWeightEntry(weights, '2026-11-16', 57.4, 160);
  // Updating same date overwrites cleanly instead of duplicating
  weights = upsertWeightEntry(weights, '2026-11-16', 57.2, 160);

  assert.equal(weights.length, 2);
  const weightStats = getWeightChangeStats(weights);
  assert.equal(weightStats.first?.weightKg, 58.6);
  assert.equal(weightStats.latest?.weightKg, 57.2);
  assert.equal(weightStats.deltaKg, -1.4);

  // Micronutrients aggregation & scaling
  const analyzed = normalizeAnalysisPayload(
    {
      name: 'Bún bò Huế + Trà sữa',
      calories: 780,
      protein: 32,
      carbs: 85,
      fiber: 3,
      fat: 28,
      sodiumMg: 1600,
      sugarG: 24,
      isHealthy: false,
    },
    ['Ăn ngoài quán']
  );
  const scaled = scaleAnalyzedMeal(analyzed, 1.5);
  assert.equal(scaled.sodiumMg, 2400);
  assert.equal(scaled.sugarG, 36);

  const totals = computeDailyTotals(
    [
      {
        id: 'm-micro',
        slot: 'Trưa',
        name: scaled.name,
        time: '12:30',
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fiber: scaled.fiber,
        fat: scaled.fat,
        sodiumMg: scaled.sodiumMg,
        sugarG: scaled.sugarG,
        contexts: scaled.contexts,
      },
    ],
    profile.targetCalories
  );

  assert.equal(totals.sodiumMg, 2400);
  assert.equal(totals.sugarG, 36);

  const reminders = buildDynamicReminders(profile, totals, 4);
  assert.ok(reminders.some((r) => r.id === 'sodium-high'));
  assert.ok(reminders.some((r) => r.id === 'sugar-high'));
});


