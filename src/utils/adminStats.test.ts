import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdminOverviewStats,
  filterAdminUsers,
} from './adminStats';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  buildAdminAuditLogFields,
  buildAdminRoleFields,
  buildAppRuntimeConfigFields,
  buildCatalogDishFields,
  buildKickedUserFields,
  isBootstrappedAdminEmail,
  isValidEmailAddress,
  normalizeEmailKey,
} from './firestorePayload';
import { loadMergedDishBank } from '../data/dishes';
import type { AdminUserSummary, DishBankItem } from '../types/nutrition';

test('Admin overview stats & user search/goal filtering compute accurately from real summaries', () => {
  const users: AdminUserSummary[] = [
    {
      uid: 'u1',
      displayName: 'Minh Anh',
      email: 'minhanh@example.com',
      authProvider: 'google.com',
      hasProfile: true,
      goal: 'lose_fat',
      bmi: 22.4,
      targetCalories: 1550,
      dietaryTags: ['Ít dầu'],
      healthConditions: [],
      kitchenTools: [],
      mealsCount: 4,
      healthyMealsCount: 3,
      recentMeals: [],
      createdAt: '2026-11-10T08:00:00Z',
      updatedAt: '2026-11-18T08:00:00Z',
    },
    {
      uid: 'u2',
      displayName: 'Quốc Bảo',
      email: 'baoquoc@example.com',
      authProvider: 'password',
      hasProfile: true,
      goal: 'build_muscle',
      bmi: 21.8,
      targetCalories: 2350,
      dietaryTags: [],
      healthConditions: [],
      kitchenTools: [],
      mealsCount: 2,
      healthyMealsCount: 2,
      recentMeals: [],
      createdAt: '2026-11-12T08:00:00Z',
      updatedAt: '2026-11-17T08:00:00Z',
    },
    {
      uid: 'u3',
      displayName: 'Khách mới',
      email: 'guest@example.com',
      authProvider: 'google.com',
      hasProfile: false,
      dietaryTags: [],
      healthConditions: [],
      kitchenTools: [],
      mealsCount: 0,
      healthyMealsCount: 0,
      recentMeals: [],
      createdAt: '2026-11-18T08:00:00Z',
      updatedAt: '2026-11-18T08:00:00Z',
    },
  ];

  const stats = computeAdminOverviewStats(users);
  assert.equal(stats.totalUsers, 3);
  assert.equal(stats.completedProfiles, 2);
  assert.equal(stats.totalMealsLogged, 6);
  assert.equal(stats.healthyMealsCount, 5);
  assert.equal(stats.healthyMealRate, 83);
  assert.equal(stats.avgTargetCalories, 1950);
  assert.equal(stats.goalDistribution.lose_fat, 1);
  assert.equal(stats.goalDistribution.build_muscle, 1);

  assert.equal(filterAdminUsers(users, 'minh', 'all').length, 1);
  assert.equal(filterAdminUsers(users, '', 'build_muscle')[0].uid, 'u2');
});

test('Email-keyed staff roles, kicked user payloads, and moderator pending dish enforcement work cleanly', async () => {
  assert.equal(
    isBootstrappedAdminEmail(BOOTSTRAPPED_ADMIN_EMAIL.toUpperCase()),
    true
  );
  assert.equal(isBootstrappedAdminEmail('other@example.com'), false);
  assert.equal(normalizeEmailKey('  Mod@BuaNay.App '), 'mod@buanay.app');
  assert.equal(isValidEmailAddress('mod@buanay.app'), true);
  assert.equal(isValidEmailAddress('not-an-email'), false);

  // Moderator cannot publish directly: forced to pending + isActive: false
  const modPendingDish = buildCatalogDishFields(
    {
      id: 'mod dish 01!',
      name: '  Bún gạo lứt ức gà  ',
      slots: ['Trưa', 'Tối'],
      diningMode: 'eat_out',
      cuisine: 'vietnam',
      portionEstimate: '1 tô',
      calories: 430,
      protein: 32,
      carbs: 48,
      fiber: 6,
      fat: 9,
      budgetLevel: 'balanced',
      estimatedCostVnd: '~55.000đ',
      prepMinutes: 15,
      whyItFits: 'Giàu đạm nạc',
      swapTip: 'Thêm rau luộc',
      isActive: true,
      status: 'approved',
    },
    'mod_uid_1',
    'mod@buanay.app',
    'moderator'
  );
  assert.equal(modPendingDish.status, 'pending');
  assert.equal(modPendingDish.isActive, false);
  assert.equal(modPendingDish.submittedByRole, 'moderator');
  assert.equal(modPendingDish.submittedByEmail, 'mod@buanay.app');

  // Admin can publish approved dish immediately
  const adminDish = buildCatalogDishFields(
    {
      id: 'admin dish 01!',
      name: '  Cơm gạo lứt ức gà  ',
      slots: ['Trưa', 'Tối'],
      diningMode: 'eat_out',
      cuisine: 'vietnam',
      portionEstimate: '1 phần',
      calories: 9999,
      protein: 35,
      carbs: 48,
      fiber: 6,
      fat: 10,
      budgetLevel: 'balanced',
      estimatedCostVnd: '~55.000đ',
      prepMinutes: 15,
      whyItFits: 'Giàu đạm nạc',
      swapTip: 'Thêm rau luộc',
      isActive: true,
    },
    'admin_uid_1',
    BOOTSTRAPPED_ADMIN_EMAIL,
    'admin'
  );
  assert.equal(adminDish.calories, 3000);
  assert.equal(adminDish.status, 'approved');
  assert.equal(adminDish.isActive, true);
  assert.match(adminDish.id, /^[a-zA-Z0-9_-]+$/);

  const cfg = buildAppRuntimeConfigFields(
    {
      bannerEnabled: true,
      bannerTitle: 'Thông báo',
      bannerMessage: 'Cập nhật mới',
      bannerTone: 'info',
      aiMode: 'offline_bank_only',
    },
    'admin_uid_1'
  );
  assert.equal(cfg.id, 'runtime');
  assert.equal(cfg.aiMode, 'offline_bank_only');

  const role = buildAdminRoleFields({
    email: '  Moderator@BuaNay.App ',
    role: 'moderator',
    label: '',
    addedByUid: 'admin_uid_1',
    addedByEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  });
  assert.equal(role.id, 'moderator@buanay.app');
  assert.equal(role.email, 'moderator@buanay.app');
  assert.equal(role.role, 'moderator');
  assert.equal(role.label, 'Kiểm duyệt viên');

  const kicked = buildKickedUserFields({
    uid: 'user_bad_1',
    email: 'spam@example.com',
    displayName: 'Spammer',
    reason: 'Vi phạm nội quy',
    kickedByUid: 'admin_uid_1',
    kickedByEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  });
  assert.equal(kicked.uid, 'user_bad_1');
  assert.equal(kicked.reason, 'Vi phạm nội quy');

  const log = buildAdminAuditLogFields({
    id: 'log_1',
    action: 'APPOINT_STAFF',
    target: 'moderator@buanay.app',
    detail: 'Bổ nhiệm Kiểm duyệt viên',
    actorUid: 'admin_uid_1',
    actorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  });
  assert.equal(log.action, 'APPOINT_STAFF');

  const extraDish: DishBankItem = {
    ...adminDish,
    id: 'admin_extra_1',
    tools: [],
  };
  const merged = await loadMergedDishBank([extraDish]);
  assert.equal(merged[0].id, 'admin_extra_1');
  assert.ok(merged.length > 260);
});
