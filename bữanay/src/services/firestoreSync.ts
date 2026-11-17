import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  MealEntry,
  MealsByDate,
  ReminderSettings,
  UserProfile,
  WaterByDate,
  WeightEntry,
} from '../types/nutrition';
import {
  buildMealEntryFields,
  buildNutritionProfileFields,
  buildPrivateAccountFields,
  buildUserRootFields,
  buildWaterLogFields,
  buildWeightLogFields,
} from '../utils/firestorePayload';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function ensureUserAccountDocs(params: {
  uid: string;
  displayName: string;
  email: string;
  authProvider: 'google.com' | 'password' | 'unknown';
}): Promise<void> {
  const { uid, displayName, email, authProvider } = params;
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/account`;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const rootFields = buildUserRootFields(uid, displayName);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...rootFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: rootFields.displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const privateRef = doc(db, 'users', uid, 'private', 'account');
    const privateSnap = await getDoc(privateRef);
    const privateFields = buildPrivateAccountFields(uid, email, authProvider);
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        ...privateFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: privateFields.email,
        authProvider: privateFields.authProvider,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function saveProfileToFirestore(
  uid: string,
  profile: UserProfile,
  reminders: ReminderSettings
): Promise<void> {
  const path = `users/${uid}/profile/nutrition`;
  try {
    const ref = doc(db, 'users', uid, 'profile', 'nutrition');
    const snap = await getDoc(ref);
    const fields = buildNutritionProfileFields(uid, profile, reminders);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { uid: _uid, profileCreatedAt: _created, ...updatable } = fields;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMealToFirestore(
  uid: string,
  dateKey: string,
  meal: MealEntry
): Promise<void> {
  const fields = buildMealEntryFields(uid, dateKey, meal);
  const path = `users/${uid}/meals/${fields.id}`;
  try {
    const ref = doc(db, 'users', uid, 'meals', fields.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { uid: _uid, id: _id, ...updatable } = fields;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMealFromFirestore(
  uid: string,
  mealId: string
): Promise<void> {
  const path = `users/${uid}/meals/${mealId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'meals', mealId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveWaterToFirestore(
  uid: string,
  dateKey: string,
  cups: number
): Promise<void> {
  const fields = buildWaterLogFields(uid, dateKey, cups);
  const path = `users/${uid}/waterLogs/${fields.dateKey}`;
  try {
    const ref = doc(db, 'users', uid, 'waterLogs', fields.dateKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        cups: fields.cups,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveWeightToFirestore(
  uid: string,
  dateKey: string,
  weightKg: number,
  bmi: number
): Promise<void> {
  const fields = buildWeightLogFields(uid, dateKey, weightKg, bmi);
  const path = `users/${uid}/weightLogs/${fields.dateKey}`;
  try {
    const ref = doc(db, 'users', uid, 'weightLogs', fields.dateKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        weightKg: fields.weightKg,
        bmi: fields.bmi,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function bootstrapCloudProfileIfEmpty(params: {
  uid: string;
  localProfile: UserProfile | null;
  localMeals: MealsByDate;
  localWater: WaterByDate;
  localWeights: WeightEntry[];
  reminders: ReminderSettings;
}): Promise<boolean> {
  const {
    uid,
    localProfile,
    localMeals,
    localWater,
    localWeights,
    reminders,
  } = params;
  const profilePath = `users/${uid}/profile/nutrition`;

  try {
    const profileRef = doc(db, 'users', uid, 'profile', 'nutrition');
    const existingSnap = await getDoc(profileRef);
    if (existingSnap.exists()) {
      return false;
    }
    if (!localProfile) {
      return false;
    }

    const batch = writeBatch(db);
    const profileFields = buildNutritionProfileFields(uid, localProfile, reminders);
    batch.set(profileRef, {
      ...profileFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    let opCount = 1;
    for (const [dateKey, entries] of Object.entries(localMeals)) {
      for (const meal of entries) {
        if (opCount >= 420) break;
        const mf = buildMealEntryFields(uid, dateKey, meal);
        batch.set(doc(db, 'users', uid, 'meals', mf.id), {
          ...mf,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        opCount += 1;
      }
    }

    for (const [dateKey, cups] of Object.entries(localWater)) {
      if (opCount >= 460) break;
      const wf = buildWaterLogFields(uid, dateKey, cups);
      batch.set(doc(db, 'users', uid, 'waterLogs', wf.dateKey), {
        ...wf,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      opCount += 1;
    }

    for (const entry of localWeights) {
      if (opCount >= 490) break;
      const wlf = buildWeightLogFields(uid, entry.dateKey, entry.weightKg, entry.bmi);
      batch.set(doc(db, 'users', uid, 'weightLogs', wlf.dateKey), {
        ...wlf,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      opCount += 1;
    }

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export interface CloudSyncCallbacks {
  onProfileSnapshot: (
    profile: UserProfile | null,
    reminders?: Pick<ReminderSettings, 'remindMeals' | 'remindWater'>
  ) => void;
  onMealsSnapshot: (mealsByDate: MealsByDate) => void;
  onWaterSnapshot: (waterByDate: WaterByDate) => void;
  onWeightsSnapshot: (weights: WeightEntry[]) => void;
}

export function subscribeUserCloudData(
  uid: string,
  callbacks: CloudSyncCallbacks
): Unsubscribe {
  const profilePath = `users/${uid}/profile/nutrition`;
  const mealsPath = `users/${uid}/meals`;
  const waterPath = `users/${uid}/waterLogs`;
  const weightsPath = `users/${uid}/weightLogs`;

  const unsubProfile = onSnapshot(
    doc(db, 'users', uid, 'profile', 'nutrition'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onProfileSnapshot(null);
        return;
      }
      const d = snap.data();
      const loadedProfile: UserProfile = {
        name: String(d.name ?? 'Bạn'),
        gender: d.gender === 'male' ? 'male' : 'female',
        age: Number(d.age ?? 24),
        heightCm: Number(d.heightCm ?? 162),
        weightKg: Number(d.weightKg ?? 55),
        goal: d.goal ?? 'maintain',
        activityLevel: d.activityLevel ?? 'light',
        dietaryTags: Array.isArray(d.dietaryTags) ? d.dietaryTags : [],
        dietaryNote: String(d.dietaryNote ?? ''),
        dislikedFoods: String(d.dislikedFoods ?? ''),
        budgetLevel: d.budgetLevel ?? 'balanced',
        cookingTime: d.cookingTime ?? 'under_15',
        cookingSkill: d.cookingSkill ?? 'basic',
        kitchenTools: Array.isArray(d.kitchenTools) ? d.kitchenTools : [],
        healthConditions: Array.isArray(d.healthConditions) ? d.healthConditions : [],
        suggestionFeedback: {
          liked: Array.isArray(d.likedDishes) ? d.likedDishes : [],
          disliked: Array.isArray(d.dislikedDishes) ? d.dislikedDishes : [],
          tried: Array.isArray(d.triedDishes) ? d.triedDishes : [],
        },
        bmi: Number(d.bmi ?? 21),
        bmiCategory: String(d.bmiCategory ?? 'Bình thường'),
        bmr: Number(d.bmr ?? 1400),
        tdee: Number(d.tdee ?? 1800),
        targetCalories: Number(d.targetCalories ?? 1800),
        targets: {
          protein: Number(d.targetProtein ?? 75),
          carbs: Number(d.targetCarbs ?? 220),
          fiber: Number(d.targetFiber ?? 25),
          fat: Number(d.targetFat ?? 55),
        },
        waterTargetCups: Number(d.waterTargetCups ?? 10),
        createdAt: String(d.profileCreatedAt ?? new Date().toISOString()),
      };
      callbacks.onProfileSnapshot(loadedProfile, {
        remindMeals: d.remindMeals !== false,
        remindWater: d.remindWater !== false,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, profilePath);
    }
  );

  const unsubMeals = onSnapshot(
    query(collection(db, 'users', uid, 'meals'), where('uid', '==', uid)),
    (snap) => {
      const grouped: MealsByDate = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const dateKey = String(d.dateKey ?? '');
        if (!dateKey) return;
        const entry: MealEntry = {
          id: String(d.id ?? docSnap.id),
          slot: d.slot ?? 'Trưa',
          name: String(d.name ?? 'Bữa ăn'),
          time: String(d.time ?? '12:00'),
          calories: Number(d.calories ?? 0),
          protein: Number(d.protein ?? 0),
          carbs: Number(d.carbs ?? 0),
          fiber: Number(d.fiber ?? 0),
          fat: Number(d.fat ?? 0),
          sodiumMg: Number(d.sodiumMg ?? 0),
          sugarG: Number(d.sugarG ?? 0),
          contexts: Array.isArray(d.contexts) ? d.contexts : [],
          isHealthy: Boolean(d.isHealthy),
          portionEstimate: String(d.portionEstimate ?? ''),
          summaryNote: String(d.summaryNote ?? ''),
        };
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
      });
      callbacks.onMealsSnapshot(grouped);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, mealsPath);
    }
  );

  const unsubWater = onSnapshot(
    query(collection(db, 'users', uid, 'waterLogs'), where('uid', '==', uid)),
    (snap) => {
      const nextWater: WaterByDate = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const dateKey = String(d.dateKey ?? docSnap.id);
        nextWater[dateKey] = Number(d.cups ?? 0);
      });
      callbacks.onWaterSnapshot(nextWater);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, waterPath);
    }
  );

  const unsubWeights = onSnapshot(
    query(collection(db, 'users', uid, 'weightLogs'), where('uid', '==', uid)),
    (snap) => {
      const list: WeightEntry[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          dateKey: String(d.dateKey ?? docSnap.id),
          weightKg: Number(d.weightKg ?? 55),
          bmi: Number(d.bmi ?? 21),
          updatedAt: new Date().toISOString(),
        });
      });
      list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      callbacks.onWeightsSnapshot(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, weightsPath);
    }
  );

  return () => {
    unsubProfile();
    unsubMeals();
    unsubWater();
    unsubWeights();
  };
}
