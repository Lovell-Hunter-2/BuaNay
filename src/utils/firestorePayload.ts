import type {
  AppRuntimeConfig,
  CatalogDishRecord,
  CatalogDishStatus,
  MealEntry,
  MealSlot,
  ReminderSettings,
  StaffRole,
  UserProfile,
} from '../types/nutrition';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DATE_KEY_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const EMAIL_KEY_REGEX = /^[^\s/]+@[^\s/]+\.[^\s/]+$/;
export const BOOTSTRAPPED_ADMIN_EMAIL = 'taikhoanphubg4@gmail.com';
const VALID_SLOTS: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];

export function normalizeEmailKey(email?: string | null): string {
  return (email ?? '').trim().toLowerCase().slice(0, 160);
}

export function isValidEmailAddress(email?: string | null): boolean {
  const normalized = normalizeEmailKey(email);
  return normalized.length >= 5 && normalized.length <= 160 && EMAIL_KEY_REGEX.test(normalized);
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return normalizeEmailKey(email) === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function clampNum(
  val: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val * 10) / 10));
}

export function truncateStr(val: string | undefined, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function sanitizeStringList(
  arr: string[] | undefined,
  maxItems: number,
  maxItemLen = 120
): string[] {
  if (!Array.isArray(arr)) return [];
  const clean: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, maxItemLen);
    if (trimmed.length > 0) clean.push(trimmed);
    if (clean.length >= maxItems) break;
  }
  return clean;
}

export function normalizeSafeDocId(rawId: string, fallbackPrefix = 'item'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (cleaned.length > 0 && SAFE_ID_REGEX.test(cleaned)) return cleaned;
  return `${fallbackPrefix}_${Date.now()}`;
}

export function isValidDateKey(dateKey: string): boolean {
  return DATE_KEY_REGEX.test(dateKey);
}

export function buildUserRootFields(uid: string, displayName: string) {
  return {
    uid,
    displayName: truncateStr(displayName, 80) || 'Bạn',
  };
}

export function buildPrivateAccountFields(
  uid: string,
  email: string,
  authProvider: 'google.com' | 'password' | 'unknown'
) {
  return {
    uid,
    email: truncateStr(email, 160) || 'user@buanay.local',
    authProvider,
  };
}

export function buildNutritionProfileFields(
  uid: string,
  profile: UserProfile,
  reminders: ReminderSettings
) {
  const feedback = profile.suggestionFeedback ?? {
    liked: [],
    disliked: [],
    tried: [],
  };

  return {
    uid,
    name: truncateStr(profile.name, 60) || 'Bạn',
    gender: profile.gender === 'male' ? ('male' as const) : ('female' as const),
    age: Math.round(clampNum(profile.age, 14, 90, 24)),
    heightCm: clampNum(profile.heightCm, 120, 220, 162),
    weightKg: clampNum(profile.weightKg, 30, 200, 55),
    goal: profile.goal,
    activityLevel: profile.activityLevel,
    dietaryTags: sanitizeStringList(profile.dietaryTags, 15, 120),
    dietaryNote: truncateStr(profile.dietaryNote, 240),
    dislikedFoods: truncateStr(profile.dislikedFoods, 240),
    budgetLevel: profile.budgetLevel ?? 'balanced',
    cookingTime: profile.cookingTime ?? 'under_15',
    cookingSkill: profile.cookingSkill ?? 'basic',
    kitchenTools: sanitizeStringList(profile.kitchenTools, 15, 120),
    healthConditions: sanitizeStringList(profile.healthConditions, 15, 120),
    likedDishes: sanitizeStringList(feedback.liked, 30, 120),
    dislikedDishes: sanitizeStringList(feedback.disliked, 30, 120),
    triedDishes: sanitizeStringList(feedback.tried, 30, 120),
    bmi: clampNum(profile.bmi, 10, 80, 21),
    bmiCategory: truncateStr(profile.bmiCategory, 40) || 'Bình thường',
    bmr: Math.round(clampNum(profile.bmr, 500, 6000, 1400)),
    tdee: Math.round(clampNum(profile.tdee, 700, 8000, 1800)),
    targetCalories: Math.round(clampNum(profile.targetCalories, 900, 7000, 1800)),
    targetProtein: Math.round(clampNum(profile.targets?.protein, 10, 600, 75)),
    targetCarbs: Math.round(clampNum(profile.targets?.carbs, 10, 1000, 220)),
    targetFiber: Math.round(clampNum(profile.targets?.fiber, 5, 150, 25)),
    targetFat: Math.round(clampNum(profile.targets?.fat, 10, 400, 55)),
    waterTargetCups: Math.round(clampNum(profile.waterTargetCups, 4, 25, 10)),
    remindMeals: Boolean(reminders.remindMeals),
    remindWater: Boolean(reminders.remindWater),
    profileCreatedAt: truncateStr(profile.createdAt, 40) || new Date().toISOString(),
  };
}

export function buildMealEntryFields(
  uid: string,
  dateKey: string,
  meal: MealEntry
) {
  const safeId = normalizeSafeDocId(meal.id, 'meal');
  const safeDateKey = isValidDateKey(dateKey) ? dateKey : '2026-01-01';

  return {
    uid,
    id: safeId,
    dateKey: safeDateKey,
    slot: meal.slot,
    name: truncateStr(meal.name, 120) || 'Bữa ăn',
    time: truncateStr(meal.time, 16) || '12:00',
    calories: Math.round(clampNum(meal.calories, 0, 10000, 0)),
    protein: Math.round(clampNum(meal.protein, 0, 500, 0)),
    carbs: Math.round(clampNum(meal.carbs, 0, 1000, 0)),
    fiber: Math.round(clampNum(meal.fiber, 0, 300, 0)),
    fat: Math.round(clampNum(meal.fat, 0, 500, 0)),
    sodiumMg: Math.round(clampNum(meal.sodiumMg, 0, 20000, 0)),
    sugarG: Math.round(clampNum(meal.sugarG, 0, 500, 0)),
    contexts: sanitizeStringList(meal.contexts, 10, 120),
    isHealthy: Boolean(meal.isHealthy),
    portionEstimate: truncateStr(meal.portionEstimate, 120),
    summaryNote: truncateStr(meal.summaryNote, 280),
  };
}

export function buildWaterLogFields(
  uid: string,
  dateKey: string,
  cups: number
) {
  return {
    uid,
    dateKey: isValidDateKey(dateKey) ? dateKey : '2026-01-01',
    cups: Math.round(clampNum(cups, 0, 30, 0)),
  };
}

export function buildWeightLogFields(
  uid: string,
  dateKey: string,
  weightKg: number,
  bmi: number
) {
  return {
    uid,
    dateKey: isValidDateKey(dateKey) ? dateKey : '2026-01-01',
    weightKg: clampNum(weightKg, 30, 200, 55),
    bmi: clampNum(bmi, 10, 80, 21),
  };
}

export function buildAdminRoleFields(params: {
  uid?: string;
  email: string;
  role: StaffRole;
  label: string;
  addedByUid: string;
  addedByEmail: string;
}) {
  const normalizedEmail = normalizeEmailKey(params.email);
  const role: StaffRole = params.role === 'admin' ? 'admin' : 'moderator';
  const defaultLabel = role === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt viên';
  const rawUid = (params.uid ?? '').trim();
  const safeUid =
    rawUid && SAFE_ID_REGEX.test(rawUid) ? rawUid.slice(0, 128) : '';

  return {
    id: normalizedEmail,
    uid: safeUid,
    email: normalizedEmail,
    role,
    label: truncateStr(params.label, 80) || defaultLabel,
    addedByUid: normalizeSafeDocId(params.addedByUid, 'admin'),
    addedByEmail: normalizeEmailKey(params.addedByEmail) || BOOTSTRAPPED_ADMIN_EMAIL,
  };
}

export function buildKickedUserFields(params: {
  uid: string;
  email: string;
  displayName: string;
  reason?: string;
  kickedByUid: string;
  kickedByEmail: string;
}) {
  return {
    uid: normalizeSafeDocId(params.uid, 'user'),
    email: truncateStr(params.email, 160),
    displayName: truncateStr(params.displayName, 80) || 'Thành viên',
    reason:
      truncateStr(params.reason, 240) ||
      'Tài khoản đã bị quản trị viên gỡ quyền truy cập.',
    kickedByUid: normalizeSafeDocId(params.kickedByUid, 'admin'),
    kickedByEmail:
      normalizeEmailKey(params.kickedByEmail) || BOOTSTRAPPED_ADMIN_EMAIL,
  };
}

export function buildCatalogDishFields(
  dish: Omit<
    CatalogDishRecord,
    | 'updatedByUid'
    | 'submittedByEmail'
    | 'submittedByRole'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'tools'
  > & {
    status?: CatalogDishStatus;
    submittedByEmail?: string;
    submittedByRole?: StaffRole;
  },
  updatedByUid: string,
  actorEmail = '',
  actorRole: StaffRole = 'admin'
) {
  const safeId = normalizeSafeDocId(dish.id, 'dish');
  const filteredSlots = Array.isArray(dish.slots)
    ? dish.slots.filter((s): s is MealSlot => VALID_SLOTS.includes(s)).slice(0, 4)
    : [];
  const slots: MealSlot[] = filteredSlots.length > 0 ? filteredSlots : ['Trưa'];

  const resolvedRole: StaffRole =
    actorRole === 'moderator' ? 'moderator' : 'admin';
  const resolvedStatus: CatalogDishStatus =
    resolvedRole === 'moderator'
      ? 'pending'
      : dish.status === 'pending' || dish.status === 'rejected'
      ? dish.status
      : 'approved';
  const resolvedActive =
    resolvedStatus === 'approved' ? Boolean(dish.isActive) : false;

  return {
    id: safeId,
    name: truncateStr(dish.name, 120) || 'Món mới',
    slots,
    diningMode:
      dish.diningMode === 'home_cook'
        ? ('home_cook' as const)
        : ('eat_out' as const),
    cuisine:
      dish.cuisine === 'healthy_intl' || dish.cuisine === 'drink'
        ? dish.cuisine
        : ('vietnam' as const),
    portionEstimate: truncateStr(dish.portionEstimate, 120) || '1 phần chuẩn',
    calories: Math.round(clampNum(dish.calories, 0, 3000, 400)),
    protein: Math.round(clampNum(dish.protein, 0, 250, 20)),
    carbs: Math.round(clampNum(dish.carbs, 0, 400, 45)),
    fiber: Math.round(clampNum(dish.fiber, 0, 100, 4)),
    fat: Math.round(clampNum(dish.fat, 0, 200, 12)),
    budgetLevel:
      dish.budgetLevel === 'economy' || dish.budgetLevel === 'flexible'
        ? dish.budgetLevel
        : ('balanced' as const),
    estimatedCostVnd:
      truncateStr(dish.estimatedCostVnd, 60) || '~45.000đ - 60.000đ',
    prepMinutes: Math.round(clampNum(dish.prepMinutes, 0, 180, 15)),
    whyItFits:
      truncateStr(dish.whyItFits, 200) ||
      'Cân đối đạm và xơ cho bữa ăn hằng ngày.',
    swapTip:
      truncateStr(dish.swapTip, 200) ||
      'Có thể giảm nhẹ tinh bột hoặc xin thêm rau xanh.',
    isActive: resolvedActive,
    status: resolvedStatus,
    updatedByUid: normalizeSafeDocId(updatedByUid, 'admin'),
    submittedByEmail:
      normalizeEmailKey(dish.submittedByEmail ?? actorEmail) ||
      BOOTSTRAPPED_ADMIN_EMAIL,
    submittedByRole:
      dish.submittedByRole === 'moderator' ? ('moderator' as const) : resolvedRole,
  };
}

export function buildAppRuntimeConfigFields(
  config: Omit<AppRuntimeConfig, 'id' | 'updatedByUid' | 'updatedAt'>,
  updatedByUid: string
) {
  return {
    id: 'runtime' as const,
    bannerEnabled: Boolean(config.bannerEnabled),
    bannerTitle: truncateStr(config.bannerTitle, 80),
    bannerMessage: truncateStr(config.bannerMessage, 240),
    bannerTone:
      config.bannerTone === 'warning' || config.bannerTone === 'success'
        ? config.bannerTone
        : ('info' as const),
    aiMode:
      config.aiMode === 'offline_bank_only'
        ? ('offline_bank_only' as const)
        : ('full_ai' as const),
    updatedByUid: normalizeSafeDocId(updatedByUid, 'admin'),
  };
}

export function buildAdminAuditLogFields(params: {
  id: string;
  action: string;
  target: string;
  detail: string;
  actorUid: string;
  actorEmail: string;
}) {
  return {
    id: normalizeSafeDocId(params.id, 'log'),
    action: truncateStr(params.action, 60) || 'ADMIN_ACTION',
    target: truncateStr(params.target, 120) || 'system',
    detail: truncateStr(params.detail, 280),
    actorUid: normalizeSafeDocId(params.actorUid, 'admin'),
    actorEmail: truncateStr(params.actorEmail, 160),
  };
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký. Hãy chuyển sang đăng nhập hoặc dùng Google nhé.';
    case 'auth/invalid-email':
      return 'Địa chỉ email chưa đúng định dạng. Bạn kiểm tra lại nhé.';
    case 'auth/weak-password':
      return 'Mật khẩu quá ngắn — cần ít nhất 6 ký tự.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu chưa chính xác. Bạn thử kiểm tra lại nhé.';
    case 'auth/too-many-requests':
      return 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập này chưa được bật trong Firebase Console (Authentication → Sign-in method).';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Cửa sổ đăng nhập Google đã đóng. Bạn có thể bấm lại khi sẵn sàng.';
    case 'auth/popup-blocked':
      return 'Trình duyệt đang chặn cửa sổ bật lên — vui lòng cho phép popup để đăng nhập Google.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Kiểm tra Wi-Fi/4G rồi thử lại nhé.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Không thể hoàn tất xác thực. Vui lòng thử lại.';
  }
}
