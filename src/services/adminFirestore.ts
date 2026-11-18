import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AdminAuditLog,
  AdminRoleRecord,
  AdminUserSummary,
  AppRuntimeConfig,
  CatalogDishRecord,
  CatalogDishStatus,
  DishBankItem,
  KickedUserRecord,
  MealEntry,
  StaffRole,
  UserGoal,
} from '../types/nutrition';
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
  normalizeSafeDocId,
} from '../utils/firestorePayload';
import { OperationType, handleFirestoreError } from './firestoreSync';

export const DEFAULT_RUNTIME_CONFIG: AppRuntimeConfig = {
  id: 'runtime',
  bannerEnabled: false,
  bannerTitle: '',
  bannerMessage: '',
  bannerTone: 'info',
  aiMode: 'full_ai',
  updatedByUid: 'system',
};

function toIsoString(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'toDate' in raw) {
    try {
      return ((raw as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return new Date().toISOString();
}

export async function fetchUserStaffRole(
  user: User | null
): Promise<StaffRole | null> {
  if (!user || !user.emailVerified) return null;
  if (isBootstrappedAdminEmail(user.email)) return 'admin';

  const emailKey = normalizeEmailKey(user.email);
  if (!emailKey || !isValidEmailAddress(emailKey)) return null;

  const path = `admins/${emailKey}`;
  try {
    const snap = await getDoc(doc(db, 'admins', emailKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.role === 'admin' ? 'admin' : 'moderator';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('permission-denied') ||
      msg.includes('Missing or insufficient permissions')
    ) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function checkUserIsAdmin(user: User | null): Promise<boolean> {
  const role = await fetchUserStaffRole(user);
  return role !== null;
}

export async function checkIsUserKicked(
  uid: string
): Promise<KickedUserRecord | null> {
  const safeUid = normalizeSafeDocId(uid, 'user');
  try {
    const snap = await getDoc(doc(db, 'kickedUsers', safeUid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid ?? safeUid),
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      reason: String(
        data.reason ?? 'Tài khoản đã bị quản trị viên gỡ quyền truy cập.'
      ),
      kickedByUid: String(data.kickedByUid ?? ''),
      kickedByEmail: String(data.kickedByEmail ?? ''),
      createdAt: toIsoString(data.createdAt),
      updatedAt: toIsoString(data.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function writeAdminAuditLog(params: {
  action: string;
  target: string;
  detail: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const fields = buildAdminAuditLogFields({
    id,
    ...params,
  });
  const path = `adminLogs/${fields.id}`;
  try {
    await setDoc(doc(db, 'adminLogs', fields.id), {
      ...fields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchAdminUsersOverview(
  maxUsers = 100
): Promise<AdminUserSummary[]> {
  const usersPath = 'users';
  try {
    const usersSnap = await getDocs(
      query(collection(db, 'users'), limit(maxUsers))
    );

    const summaries = await Promise.all(
      usersSnap.docs.map(async (userDoc) => {
        const root = userDoc.data();
        const uid = String(root.uid ?? userDoc.id);

        const [privateRes, profileRes, mealsRes, weightsRes] =
          await Promise.allSettled([
            getDoc(doc(db, 'users', uid, 'private', 'account')),
            getDoc(doc(db, 'users', uid, 'profile', 'nutrition')),
            getDocs(collection(db, 'users', uid, 'meals')),
            getDocs(collection(db, 'users', uid, 'weightLogs')),
          ]);

        const priv =
          privateRes.status === 'fulfilled' && privateRes.value.exists()
            ? privateRes.value.data()
            : null;
        const prof =
          profileRes.status === 'fulfilled' && profileRes.value.exists()
            ? profileRes.value.data()
            : null;
        const mealDocs =
          mealsRes.status === 'fulfilled' ? mealsRes.value.docs : [];
        const weightDocs =
          weightsRes.status === 'fulfilled' ? weightsRes.value.docs : [];

        const meals: MealEntry[] = mealDocs.map((m) => {
          const md = m.data();
          return {
            id: String(md.id ?? m.id),
            slot: (md.slot as MealEntry['slot']) ?? 'Trưa',
            name: String(md.name ?? 'Bữa ăn'),
            time: String(md.time ?? '12:00'),
            calories: Number(md.calories ?? 0),
            protein: Number(md.protein ?? 0),
            carbs: Number(md.carbs ?? 0),
            fiber: Number(md.fiber ?? 0),
            fat: Number(md.fat ?? 0),
            sodiumMg: Number(md.sodiumMg ?? 0),
            sugarG: Number(md.sugarG ?? 0),
            contexts: Array.isArray(md.contexts) ? md.contexts : [],
            isHealthy: Boolean(md.isHealthy),
            portionEstimate: String(md.portionEstimate ?? ''),
            summaryNote: String(md.summaryNote ?? ''),
          };
        });

        const sortedWeights = weightDocs
          .map((w) => w.data())
          .sort((a, b) =>
            String(b.dateKey ?? '').localeCompare(String(a.dateKey ?? ''))
          );

        const summary: AdminUserSummary = {
          uid,
          displayName: String(prof?.name ?? root.displayName ?? 'Thành viên'),
          email: String(priv?.email ?? ''),
          authProvider: String(priv?.authProvider ?? 'unknown'),
          hasProfile: Boolean(prof),
          goal: prof?.goal as UserGoal | undefined,
          bmi: typeof prof?.bmi === 'number' ? prof.bmi : undefined,
          bmiCategory:
            typeof prof?.bmiCategory === 'string' ? prof.bmiCategory : undefined,
          targetCalories:
            typeof prof?.targetCalories === 'number'
              ? prof.targetCalories
              : undefined,
          dietaryTags: Array.isArray(prof?.dietaryTags)
            ? prof.dietaryTags
            : [],
          healthConditions: Array.isArray(prof?.healthConditions)
            ? prof.healthConditions
            : [],
          kitchenTools: Array.isArray(prof?.kitchenTools)
            ? prof.kitchenTools
            : [],
          mealsCount: meals.length,
          healthyMealsCount: meals.filter((m) => m.isHealthy).length,
          latestWeightKg:
            typeof sortedWeights[0]?.weightKg === 'number'
              ? sortedWeights[0].weightKg
              : typeof prof?.weightKg === 'number'
              ? prof.weightKg
              : undefined,
          recentMeals: meals.slice(-6).reverse(),
          createdAt: toIsoString(root.createdAt),
          updatedAt: toIsoString(root.updatedAt),
        };

        return summary;
      })
    );

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, usersPath);
  }
}

export async function fetchKickedUsers(): Promise<KickedUserRecord[]> {
  const path = 'kickedUsers';
  try {
    const snap = await getDocs(collection(db, 'kickedUsers'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          email: String(data.email ?? ''),
          displayName: String(data.displayName ?? 'Thành viên'),
          reason: String(data.reason ?? ''),
          kickedByUid: String(data.kickedByUid ?? ''),
          kickedByEmail: String(data.kickedByEmail ?? ''),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        } satisfies KickedUserRecord;
      })
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function kickAppUserAdmin(params: {
  user: AdminUserSummary;
  reason?: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  if (isBootstrappedAdminEmail(params.user.email)) {
    throw new Error('Không thể kick tài khoản Quản trị viên gốc.');
  }
  const fields = buildKickedUserFields({
    uid: params.user.uid,
    email: params.user.email,
    displayName: params.user.displayName,
    reason: params.reason,
    kickedByUid: params.actorUid,
    kickedByEmail: params.actorEmail,
  });

  const path = `kickedUsers/${fields.uid}`;
  try {
    await setDoc(doc(db, 'kickedUsers', fields.uid), {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Clean up user subcollections and root profile on Firestore
    const [mealsSnap, waterSnap, weightSnap] = await Promise.all([
      getDocs(collection(db, 'users', fields.uid, 'meals')),
      getDocs(collection(db, 'users', fields.uid, 'waterLogs')),
      getDocs(collection(db, 'users', fields.uid, 'weightLogs')),
    ]);

    await Promise.allSettled([
      ...mealsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...waterSnap.docs.map((d) => deleteDoc(d.ref)),
      ...weightSnap.docs.map((d) => deleteDoc(d.ref)),
      deleteDoc(doc(db, 'users', fields.uid, 'private', 'account')),
      deleteDoc(doc(db, 'users', fields.uid, 'profile', 'nutrition')),
    ]);
    await deleteDoc(doc(db, 'users', fields.uid)).catch(() => undefined);

    await writeAdminAuditLog({
      action: 'KICK_USER',
      target: fields.email || fields.uid,
      detail: `Đã kick ${fields.displayName} (${fields.uid}) khỏi hệ thống`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function unkickAppUserAdmin(params: {
  uid: string;
  email: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const safeUid = normalizeSafeDocId(params.uid, 'user');
  const path = `kickedUsers/${safeUid}`;
  try {
    await deleteDoc(doc(db, 'kickedUsers', safeUid));
    await writeAdminAuditLog({
      action: 'RESTORE_USER',
      target: params.email || safeUid,
      detail: `Đã gỡ chặn tài khoản ${params.email || safeUid}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllCatalogDishesForAdmin(): Promise<
  CatalogDishRecord[]
> {
  const path = 'catalogDishes';
  try {
    const snap = await getDocs(collection(db, 'catalogDishes'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        const status: CatalogDishStatus =
          data.status === 'pending' || data.status === 'rejected'
            ? data.status
            : 'approved';
        const submittedByRole: StaffRole =
          data.submittedByRole === 'moderator' ? 'moderator' : 'admin';
        return {
          id: String(data.id ?? d.id),
          name: String(data.name ?? ''),
          slots: Array.isArray(data.slots) ? data.slots : ['Trưa'],
          diningMode:
            data.diningMode === 'home_cook' ? 'home_cook' : 'eat_out',
          cuisine:
            data.cuisine === 'healthy_intl' || data.cuisine === 'drink'
              ? data.cuisine
              : 'vietnam',
          portionEstimate: String(data.portionEstimate ?? ''),
          calories: Number(data.calories ?? 0),
          protein: Number(data.protein ?? 0),
          carbs: Number(data.carbs ?? 0),
          fiber: Number(data.fiber ?? 0),
          fat: Number(data.fat ?? 0),
          budgetLevel:
            data.budgetLevel === 'economy' || data.budgetLevel === 'flexible'
              ? data.budgetLevel
              : 'balanced',
          estimatedCostVnd: String(data.estimatedCostVnd ?? ''),
          prepMinutes: Number(data.prepMinutes ?? 15),
          tools: [],
          whyItFits: String(data.whyItFits ?? ''),
          swapTip: String(data.swapTip ?? ''),
          isActive: status === 'approved' ? data.isActive !== false : false,
          status,
          updatedByUid: String(data.updatedByUid ?? ''),
          submittedByEmail: String(data.submittedByEmail ?? ''),
          submittedByRole,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        } satisfies CatalogDishRecord;
      })
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchActiveCatalogDishesPublic(): Promise<
  DishBankItem[]
> {
  try {
    const snap = await getDocs(
      query(collection(db, 'catalogDishes'), where('isActive', '==', true))
    );
    return snap.docs
      .filter((d) => {
        const status = d.data().status;
        return status !== 'pending' && status !== 'rejected';
      })
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          name: String(data.name ?? ''),
          slots: Array.isArray(data.slots) ? data.slots : ['Trưa'],
          diningMode: data.diningMode === 'home_cook' ? 'home_cook' : 'eat_out',
          cuisine:
            data.cuisine === 'healthy_intl' || data.cuisine === 'drink'
              ? data.cuisine
              : 'vietnam',
          portionEstimate: String(data.portionEstimate ?? ''),
          calories: Number(data.calories ?? 0),
          protein: Number(data.protein ?? 0),
          carbs: Number(data.carbs ?? 0),
          fiber: Number(data.fiber ?? 0),
          fat: Number(data.fat ?? 0),
          budgetLevel:
            data.budgetLevel === 'economy' || data.budgetLevel === 'flexible'
              ? data.budgetLevel
              : 'balanced',
          estimatedCostVnd: String(data.estimatedCostVnd ?? ''),
          prepMinutes: Number(data.prepMinutes ?? 15),
          tools: [],
          whyItFits: String(data.whyItFits ?? ''),
          swapTip: String(data.swapTip ?? ''),
        };
      });
  } catch {
    return [];
  }
}

export async function saveCatalogDishStaff(params: {
  dish: Omit<
    CatalogDishRecord,
    | 'updatedByUid'
    | 'submittedByEmail'
    | 'submittedByRole'
    | 'createdAt'
    | 'updatedAt'
    | 'tools'
  > & {
    submittedByEmail?: string;
    submittedByRole?: StaffRole;
  };
  actorUid: string;
  actorEmail: string;
  actorRole: StaffRole;
}): Promise<CatalogDishRecord> {
  const fields = buildCatalogDishFields(
    params.dish,
    params.actorUid,
    params.actorEmail,
    params.actorRole
  );
  const path = `catalogDishes/${fields.id}`;
  try {
    const ref = doc(db, 'catalogDishes', fields.id);
    const snap = await getDoc(ref);
    const isNew = !snap.exists();
    if (isNew) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const {
        id: _id,
        submittedByEmail: _sEmail,
        submittedByRole: _sRole,
        ...updatable
      } = fields;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }

    const action =
      params.actorRole === 'moderator'
        ? isNew
          ? 'SUBMIT_DISH_PENDING'
          : 'UPDATE_DISH_PENDING'
        : isNew
        ? 'CREATE_DISH'
        : 'UPDATE_DISH';

    const statusLabel =
      fields.status === 'pending'
        ? 'Chờ quản trị viên duyệt'
        : fields.status === 'rejected'
        ? 'Đã từ chối'
        : fields.isActive
        ? 'Đã duyệt & Đang bật'
        : 'Đang ẩn';

    await writeAdminAuditLog({
      action,
      target: fields.name,
      detail: `${fields.calories} kcal · ${fields.protein}g đạm · ${statusLabel}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });

    return {
      ...fields,
      tools: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function approveCatalogDishAdmin(params: {
  dishId: string;
  dishName: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const safeId = normalizeSafeDocId(params.dishId, 'dish');
  const path = `catalogDishes/${safeId}`;
  try {
    await updateDoc(doc(db, 'catalogDishes', safeId), {
      status: 'approved',
      isActive: true,
      updatedByUid: params.actorUid,
      updatedAt: serverTimestamp(),
    });
    await writeAdminAuditLog({
      action: 'APPROVE_DISH',
      target: params.dishName || safeId,
      detail: `Quản trị viên đã duyệt và đưa món "${params.dishName}" lên kho công khai`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rejectCatalogDishAdmin(params: {
  dishId: string;
  dishName: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const safeId = normalizeSafeDocId(params.dishId, 'dish');
  const path = `catalogDishes/${safeId}`;
  try {
    await updateDoc(doc(db, 'catalogDishes', safeId), {
      status: 'rejected',
      isActive: false,
      updatedByUid: params.actorUid,
      updatedAt: serverTimestamp(),
    });
    await writeAdminAuditLog({
      action: 'REJECT_DISH',
      target: params.dishName || safeId,
      detail: `Đã từ chối đề xuất món "${params.dishName}"`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCatalogDishAdmin(params: {
  dishId: string;
  dishName: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const safeId = normalizeSafeDocId(params.dishId, 'dish');
  const path = `catalogDishes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'catalogDishes', safeId));
    await writeAdminAuditLog({
      action: 'DELETE_DISH',
      target: params.dishName || safeId,
      detail: `Đã xóa món (${safeId}) khỏi kho cộng đồng`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAppRuntimeConfig(
  callback: (config: AppRuntimeConfig) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'appConfig', 'runtime'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_RUNTIME_CONFIG);
        return;
      }
      const d = snap.data();
      callback({
        id: 'runtime',
        bannerEnabled: Boolean(d.bannerEnabled),
        bannerTitle: String(d.bannerTitle ?? ''),
        bannerMessage: String(d.bannerMessage ?? ''),
        bannerTone:
          d.bannerTone === 'warning' || d.bannerTone === 'success'
            ? d.bannerTone
            : 'info',
        aiMode:
          d.aiMode === 'offline_bank_only' ? 'offline_bank_only' : 'full_ai',
        updatedByUid: String(d.updatedByUid ?? ''),
        updatedAt: toIsoString(d.updatedAt),
      });
    },
    () => {
      callback(DEFAULT_RUNTIME_CONFIG);
    }
  );
}

export async function saveAppRuntimeConfigAdmin(params: {
  config: Omit<AppRuntimeConfig, 'id' | 'updatedByUid' | 'updatedAt'>;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const fields = buildAppRuntimeConfigFields(params.config, params.actorUid);
  const path = 'appConfig/runtime';
  try {
    const ref = doc(db, 'appConfig', 'runtime');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { id: _id, ...updatable } = fields;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }

    await writeAdminAuditLog({
      action: 'UPDATE_CONFIG',
      target: 'appConfig/runtime',
      detail: `Banner: ${fields.bannerEnabled ? 'Bật' : 'Tắt'} · Chế độ AI: ${fields.aiMode}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAdminRoles(): Promise<AdminRoleRecord[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        const role: StaffRole =
          data.role === 'admin' ? 'admin' : 'moderator';
        return {
          id: String(data.id ?? d.id),
          uid: String(data.uid ?? ''),
          email: String(data.email ?? d.id),
          role,
          label: String(
            data.label ??
              (role === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt viên')
          ),
          addedByUid: String(data.addedByUid ?? ''),
          addedByEmail: String(data.addedByEmail ?? BOOTSTRAPPED_ADMIN_EMAIL),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        } satisfies AdminRoleRecord;
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function appointStaffByEmail(params: {
  targetEmail: string;
  role: StaffRole;
  label: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const emailKey = normalizeEmailKey(params.targetEmail);
  if (!isValidEmailAddress(emailKey)) {
    throw new Error('Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.');
  }
  if (isBootstrappedAdminEmail(emailKey)) {
    throw new Error(
      `${BOOTSTRAPPED_ADMIN_EMAIL} là Quản trị viên gốc mặc định của hệ thống.`
    );
  }

  const fields = buildAdminRoleFields({
    email: emailKey,
    role: params.role,
    label: params.label,
    addedByUid: params.actorUid,
    addedByEmail: params.actorEmail,
  });

  const path = `admins/${fields.id}`;
  try {
    const ref = doc(db, 'admins', fields.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        role: fields.role,
        label: fields.label,
        updatedAt: serverTimestamp(),
      });
    }

    const roleName =
      fields.role === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt viên';
    await writeAdminAuditLog({
      action: 'APPOINT_STAFF',
      target: fields.email,
      detail: `Bổ nhiệm ${fields.email} làm ${roleName} (${fields.label})`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function kickStaffMember(params: {
  targetEmail: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const emailKey = normalizeEmailKey(params.targetEmail);
  if (!isValidEmailAddress(emailKey)) {
    throw new Error('Email không hợp lệ.');
  }
  if (isBootstrappedAdminEmail(emailKey)) {
    throw new Error('Không thể gỡ quyền Quản trị viên gốc.');
  }
  const path = `admins/${emailKey}`;
  try {
    await deleteDoc(doc(db, 'admins', emailKey));
    await writeAdminAuditLog({
      action: 'KICK_STAFF',
      target: emailKey,
      detail: `Đã kick / thu hồi quyền điều hành của ${emailKey}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAdminAuditLogs(
  maxItems = 30
): Promise<AdminAuditLog[]> {
  const path = 'adminLogs';
  try {
    const snap = await getDocs(
      query(
        collection(db, 'adminLogs'),
        orderBy('createdAt', 'desc'),
        limit(maxItems)
      )
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id ?? d.id),
        action: String(data.action ?? ''),
        target: String(data.target ?? ''),
        detail: String(data.detail ?? ''),
        actorUid: String(data.actorUid ?? ''),
        actorEmail: String(data.actorEmail ?? ''),
        createdAt: toIsoString(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
