import type { AdminUserSummary, UserGoal } from '../types/nutrition';

export interface AdminOverviewStats {
  totalUsers: number;
  completedProfiles: number;
  totalMealsLogged: number;
  healthyMealsCount: number;
  healthyMealRate: number;
  avgTargetCalories: number;
  goalDistribution: Record<UserGoal, number>;
}

export function computeAdminOverviewStats(
  users: AdminUserSummary[]
): AdminOverviewStats {
  const goalDistribution: Record<UserGoal, number> = {
    lose_fat: 0,
    maintain: 0,
    gain_weight: 0,
    build_muscle: 0,
  };

  let completedProfiles = 0;
  let totalMealsLogged = 0;
  let healthyMealsCount = 0;
  let sumTargetCal = 0;

  for (const u of users) {
    if (u.hasProfile) {
      completedProfiles += 1;
      if (u.goal && goalDistribution[u.goal] !== undefined) {
        goalDistribution[u.goal] += 1;
      }
      if (typeof u.targetCalories === 'number' && u.targetCalories > 0) {
        sumTargetCal += u.targetCalories;
      }
    }
    totalMealsLogged += u.mealsCount;
    healthyMealsCount += u.healthyMealsCount;
  }

  return {
    totalUsers: users.length,
    completedProfiles,
    totalMealsLogged,
    healthyMealsCount,
    healthyMealRate:
      totalMealsLogged > 0
        ? Math.round((healthyMealsCount / totalMealsLogged) * 100)
        : 0,
    avgTargetCalories:
      completedProfiles > 0 ? Math.round(sumTargetCal / completedProfiles) : 0,
    goalDistribution,
  };
}

export function filterAdminUsers(
  users: AdminUserSummary[],
  search: string,
  goalFilter: 'all' | UserGoal
): AdminUserSummary[] {
  const q = search.trim().toLowerCase();
  return users.filter((u) => {
    if (goalFilter !== 'all' && u.goal !== goalFilter) {
      return false;
    }
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });
}

export const GOAL_DISPLAY_LABELS: Record<UserGoal, string> = {
  lose_fat: 'Giảm mỡ',
  maintain: 'Giữ dáng',
  gain_weight: 'Tăng cân',
  build_muscle: 'Tăng cơ',
};
