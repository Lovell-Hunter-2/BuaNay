import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMealEntryFields,
  buildNutritionProfileFields,
  buildWaterLogFields,
  buildWeightLogFields,
  mapFirebaseAuthError,
  normalizeSafeDocId,
  sanitizeStringList,
} from './firestorePayload';
import { buildUserProfile } from './nutrition';

test('Defensive payload builders strictly enforce Firestore blueprint boundaries', () => {
  const profile = buildUserProfile({
    name: 'A'.repeat(120),
    gender: 'female',
    age: 150,
    heightCm: 290,
    weightKg: 25,
    goal: 'maintain',
    activityLevel: 'light',
    dietaryTags: Array.from({ length: 25 }, (_, i) => `Tag ${i}`),
    dietaryNote: 'N'.repeat(400),
    kitchenTools: ['Nồi chiên', 'Bếp từ'],
    healthConditions: [],
  });

  const profilePayload = buildNutritionProfileFields('user_123', profile, {
    browserEnabled: false,
    remindMeals: true,
    remindWater: false,
  });

  assert.equal(profilePayload.uid, 'user_123');
  assert.ok(profilePayload.name.length <= 60);
  assert.ok(profilePayload.age >= 14 && profilePayload.age <= 90);
  assert.ok(profilePayload.dietaryTags.length <= 15);
  assert.ok(profilePayload.dietaryNote.length <= 240);
  assert.equal(profilePayload.remindMeals, true);
  assert.equal(profilePayload.remindWater, false);

  const mealPayload = buildMealEntryFields('user_123', '2026-11-17', {
    id: 'meal 123/bad$id',
    slot: 'Trưa',
    name: 'M'.repeat(200),
    time: '12:30',
    calories: 999999,
    protein: -5,
    carbs: 60,
    fiber: 5,
    fat: 14,
    sodiumMg: 500,
    sugarG: 8,
    contexts: ['Ăn ngoài quán'],
    imageUrl: 'data:image/png;base64,HUGE_STRING',
    isHealthy: true,
    portionEstimate: '1 tô',
    summaryNote: 'S'.repeat(400),
  });

  assert.match(mealPayload.id, /^[a-zA-Z0-9_-]+$/);
  assert.equal(mealPayload.calories, 10000);
  assert.equal(mealPayload.protein, 0);
  assert.ok(mealPayload.name.length <= 120);
  assert.ok(mealPayload.summaryNote.length <= 280);
  assert.equal('imageUrl' in mealPayload, false);

  const water = buildWaterLogFields('user_123', '2026-11-17', 50);
  assert.equal(water.cups, 30);

  const weight = buildWeightLogFields('user_123', 'bad-date', 55.4, 21.1);
  assert.equal(weight.dateKey, '2026-01-01');
  assert.equal(weight.weightKg, 55.4);
});

test('String list sanitizer, doc ID normalizer, and auth error mapper handle edge cases', () => {
  assert.deepEqual(sanitizeStringList(['  Phở  ', '', 'Bún'], 2), ['Phở', 'Bún']);
  assert.match(normalizeSafeDocId('a.b/c$d'), /^[a-zA-Z0-9_-]+$/);

  assert.ok(
    mapFirebaseAuthError({ code: 'auth/operation-not-allowed' }).includes('Firebase Console')
  );
  assert.ok(
    mapFirebaseAuthError({ code: 'auth/email-already-in-use' }).includes('đăng ký')
  );
});
