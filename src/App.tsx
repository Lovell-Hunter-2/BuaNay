import { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
  type User,
} from 'firebase/auth';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AuthModal } from './components/AuthModal';
import { AuthPromptModal } from './components/AuthPromptModal';
import { BottomNav } from './components/BottomNav';
import { DashboardScreen } from './components/DashboardScreen';
import { DesktopTopNav } from './components/DesktopTopNav';
import { FloatingMamWidget } from './components/FloatingMamWidget';
import { GuideHandbookScreen } from './components/GuideHandbookScreen';
import { HistoryScreen } from './components/HistoryScreen';
import {
  InstallAppModal,
  type InstallModalMode,
} from './components/InstallAppModal';
import {
  LegalStandalonePage,
  type LegalDocType,
} from './components/LegalDocumentView';
import { LogMealScreen } from './components/LogMealScreen';
import { MascotCompanionModal } from './components/MascotCompanionModal';
import { MealSuggestionsScreen } from './components/MealSuggestionsScreen';
import {
  formatReminderMessage,
  sendSafeBrowserNotification,
} from './components/NotificationsPopover';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { auth } from './firebase';
import { useOpenMeteoWeather } from './hooks/useOpenMeteoWeather';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  DEFAULT_RUNTIME_CONFIG,
  checkIsUserKicked,
  fetchActiveCatalogDishesPublic,
  fetchUserStaffRole,
  subscribeAppRuntimeConfig,
} from './services/adminFirestore';
import {
  bootstrapCloudProfileIfEmpty,
  deleteMealFromFirestore,
  ensureUserAccountDocs,
  saveMealToFirestore,
  saveProfileToFirestore,
  saveWaterToFirestore,
  saveWeightToFirestore,
  subscribeUserCloudData,
} from './services/firestoreSync';
import type {
  AppRuntimeConfig,
  AppTab,
  DishBankItem,
  KickedUserRecord,
  MealEntry,
  MealSlot,
  MealsByDate,
  ReminderSettings,
  StaffRole,
  UserProfile,
  WaterByDate,
  WeightEntry,
} from './types/nutrition';
import {
  buildDynamicReminders,
  buildUserProfile,
  calculateStreak,
  computeDailyTotals,
  formatViNumber,
  formatWaterLiters,
  getLast7DaysStats,
  getLocalDateKey,
  getNextDefaultSlot,
  recordSuggestionFeedback,
  upsertWeightEntry,
} from './utils/nutrition';

const STORAGE_KEYS = {
  profile: 'buanay_profile_v2',
  meals: 'buanay_meals_v2',
  water: 'buanay_water_v2',
  weights: 'buanay_weights_v1',
  reminders: 'buanay_reminders_v1',
  floatingMamHidden: 'buanay_floating_mam_hidden_v1',
  tourDismissed: 'buanay_welcome_tour_dismissed_v1',
};

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  browserEnabled: false,
  remindMeals: true,
  remindWater: true,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function resolveLegalPath(pathname: string): LegalDocType | null {
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/terms') return 'terms';
  return null;
}

function resolveAdminPath(pathname: string, search: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  try {
    return new URLSearchParams(search).get('admin') === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [legalRoute, setLegalRoute] = useState<LegalDocType | null>(() =>
    typeof window !== 'undefined' ? resolveLegalPath(window.location.pathname) : null
  );
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? resolveAdminPath(window.location.pathname, window.location.search)
      : false
  );
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = readStorage<UserProfile | null>(STORAGE_KEYS.profile, null);
    if (saved) return saved;
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
    ) {
      return buildUserProfile({
        name: 'Ánh',
        gender: 'female',
        age: 24,
        heightCm: 162,
        weightKg: 55,
        goal: 'maintain',
        activityLevel: 'light',
        dietaryTags: ['Ưu tiên cơm nhà'],
        dietaryNote: '',
      });
    }
    return null;
  });

  const [mealsByDate, setMealsByDate] = useState<MealsByDate>(() =>
    readStorage<MealsByDate>(STORAGE_KEYS.meals, {})
  );
  const [waterByDate, setWaterByDate] = useState<WaterByDate>(() =>
    readStorage<WaterByDate>(STORAGE_KEYS.water, {})
  );
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(() => {
    const saved = readStorage<WeightEntry[]>(STORAGE_KEYS.weights, []);
    if (saved.length > 0) return saved;
    const savedProfile = readStorage<UserProfile | null>(STORAGE_KEYS.profile, null);
    if (savedProfile) {
      const initialDate =
        typeof savedProfile.createdAt === 'string' && savedProfile.createdAt.length >= 10
          ? savedProfile.createdAt.slice(0, 10)
          : getLocalDateKey();
      return [
        {
          dateKey: initialDate,
          weightKg: savedProfile.weightKg,
          bmi: savedProfile.bmi,
          updatedAt: savedProfile.createdAt,
        },
      ];
    }
    return [];
  });
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() =>
    readStorage<ReminderSettings>(STORAGE_KEYS.reminders, DEFAULT_REMINDER_SETTINGS)
  );
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [isFloatingMamHidden, setIsFloatingMamHidden] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.floatingMamHidden) === '1';
    } catch {
      return false;
    }
  });
  const [tourDismissed, setTourDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.tourDismissed) === '1';
    } catch {
      return false;
    }
  });
  const [suggestionPrefill, setSuggestionPrefill] = useState<{
    key: number;
    mode: 'menu' | 'swap';
    cravingDish?: string;
    slot?: MealSlot;
  }>({ key: 0, mode: 'menu' });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [kickedNotice, setKickedNotice] = useState<KickedUserRecord | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<AppRuntimeConfig>(
    DEFAULT_RUNTIME_CONFIG
  );
  const [dismissedBannerMsg, setDismissedBannerMsg] = useState<string | null>(null);
  const [extraCatalogDishes, setExtraCatalogDishes] = useState<DishBankItem[]>([]);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'guest' | 'unverified' | 'syncing' | 'synced'
  >('guest');
  const [syncNonce, setSyncNonce] = useState(0);
  const [authPromptAction, setAuthPromptAction] = useState<string | null>(null);
  const [authModalState, setAuthModalState] = useState<{
    open: boolean;
    mode: 'login' | 'register';
  }>({ open: false, mode: 'login' });
  const [installModalMode, setInstallModalMode] =
    useState<InstallModalMode | null>(null);
  const { isInstalled, isInstallable, clickAction, triggerNativeInstall } =
    usePWAInstall();
  const weather = useOpenMeteoWeather();

  const latestLocalRef = useRef({
    profile,
    mealsByDate,
    waterByDate,
    weightHistory,
    reminderSettings,
  });
  latestLocalRef.current = {
    profile,
    mealsByDate,
    waterByDate,
    weightHistory,
    reminderSettings,
  };

  const todayKey = getLocalDateKey();
  const todayMeals = mealsByDate[todayKey] ?? [];
  const waterCups = waterByDate[todayKey] ?? 0;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    const onPopState = () => {
      setLegalRoute(resolveLegalPath(window.location.pathname));
      setIsAdminRoute(
        resolveAdminPath(window.location.pathname, window.location.search)
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchUserStaffRole(authUser).then((role) => {
      if (active) setStaffRole(role);
    });
    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    const unsub = subscribeAppRuntimeConfig((cfg) => {
      setRuntimeConfig(cfg);
    });
    void fetchActiveCatalogDishesPublic().then((dishes) => {
      setExtraCatalogDishes(dishes);
    });
    return () => unsub();
  }, [isAdminRoute]);

  useEffect(() => {
    if (!authUser) {
      setKickedNotice(null);
      setCloudSyncStatus('guest');
      return;
    }
    if (!authUser.emailVerified) {
      setKickedNotice(null);
      setCloudSyncStatus('unverified');
      return;
    }

    let active = true;
    let unsubCloud: (() => void) | null = null;
    setCloudSyncStatus('syncing');

    const initCloudSync = async () => {
      const providerId = authUser.providerData[0]?.providerId;
      const authProvider =
        providerId === 'google.com'
          ? 'google.com'
          : providerId === 'password'
          ? 'password'
          : 'unknown';

      const snapshotLocal = latestLocalRef.current;

      try {
        const kicked = await checkIsUserKicked(authUser.uid);
        if (!active) return;
        if (kicked) {
          setKickedNotice(kicked);
          setCloudSyncStatus('guest');
          return;
        }
        setKickedNotice(null);

        await ensureUserAccountDocs({
          uid: authUser.uid,
          displayName:
            authUser.displayName ||
            snapshotLocal.profile?.name ||
            'Thành viên BữaNay',
          email: authUser.email || '',
          authProvider,
        });
        if (!active) return;

        await bootstrapCloudProfileIfEmpty({
          uid: authUser.uid,
          localProfile: snapshotLocal.profile,
          localMeals: snapshotLocal.mealsByDate,
          localWater: snapshotLocal.waterByDate,
          localWeights: snapshotLocal.weightHistory,
          reminders: snapshotLocal.reminderSettings,
        });
        if (!active) return;

        unsubCloud = subscribeUserCloudData(authUser.uid, {
          onProfileSnapshot: (cloudProfile, cloudReminders) => {
            if (!active) return;
            if (cloudProfile) {
              setProfile(cloudProfile);
            }
            if (cloudReminders) {
              setReminderSettings((prev) => ({ ...prev, ...cloudReminders }));
            }
            setCloudSyncStatus('synced');
          },
          onMealsSnapshot: (cloudMeals) => {
            if (!active) return;
            setMealsByDate(cloudMeals);
          },
          onWaterSnapshot: (cloudWater) => {
            if (!active) return;
            setWaterByDate(cloudWater);
          },
          onWeightsSnapshot: (cloudWeights) => {
            if (!active) return;
            setWeightHistory(cloudWeights);
          },
        });
        setCloudSyncStatus('synced');
      } catch (err) {
        console.error('Cloud sync initialization error:', err);
      }
    };

    void initCloudSync();

    return () => {
      active = false;
      if (unsubCloud) unsubCloud();
    };
  }, [authUser, syncNonce]);

  useEffect(() => {
    try {
      if (profile) {
        window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.profile);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(mealsByDate));
    } catch {
      // Ignore storage quota errors
    }
  }, [mealsByDate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.water, JSON.stringify(waterByDate));
    } catch {
      // Ignore storage quota errors
    }
  }, [waterByDate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.weights, JSON.stringify(weightHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [weightHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.reminders,
        JSON.stringify(reminderSettings)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [reminderSettings]);

  useEffect(() => {
    try {
      if (isFloatingMamHidden) {
        window.localStorage.setItem(STORAGE_KEYS.floatingMamHidden, '1');
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.floatingMamHidden);
      }
    } catch {
      // Ignore storage error
    }
  }, [isFloatingMamHidden]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const requireAuth = (actionLabel: string, action: () => void) => {
    if (authUser) {
      action();
      return;
    }
    setAuthPromptAction(actionLabel);
  };

  const handleOpenAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthPromptAction(null);
    setAuthModalState({ open: true, mode });
  };

  const handleAuthSuccess = (info: {
    isNewSignup: boolean;
    needsEmailVerification: boolean;
    email: string;
  }) => {
    setAuthModalState((prev) => ({ ...prev, open: false }));
    setSyncNonce((n) => n + 1);
    if (info.isNewSignup && info.needsEmailVerification) {
      showToast(
        `Đã tạo tài khoản! Kiểm tra hộp thư ${info.email} để xác minh và bật đồng bộ Firestore.`
      );
    } else if (info.needsEmailVerification) {
      showToast('Đã đăng nhập! Xác minh email trong Hồ sơ để bật đồng bộ Firestore.');
    } else {
      showToast(`Chào mừng trở lại${info.email ? `, ${info.email}` : ''}!`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
      setCloudSyncStatus('guest');
      showToast('Đã đăng xuất tài khoản');
    } catch {
      showToast('Không thể đăng xuất lúc này, thử lại sau nhé.');
    }
  };

  const handleResendVerification = async () => {
    if (!authUser) return;
    try {
      await sendEmailVerification(authUser);
      showToast('Đã gửi lại email xác minh. Kiểm tra hộp thư đến hoặc Spam nhé!');
    } catch {
      showToast('Vui lòng đợi một lát trước khi gửi lại email xác minh.');
    }
  };

  const handleCheckVerification = async () => {
    if (!authUser) return;
    try {
      await reload(authUser);
      if (auth.currentUser?.emailVerified) {
        setAuthUser(auth.currentUser);
        setSyncNonce((n) => n + 1);
        showToast('Email đã xác minh! Đang đồng bộ Cloud Firestore...');
      } else {
        showToast('Chưa thấy xác minh — hãy nhấn liên kết trong email rồi thử lại nhé.');
      }
    } catch {
      showToast('Không thể kiểm tra trạng thái xác minh lúc này.');
    }
  };

  const handleDismissTour = () => {
    setTourDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEYS.tourDismissed, '1');
    } catch {
      // Ignore storage error
    }
  };

  const handleReplayTour = () => {
    setTourDismissed(false);
    setActiveTab('dashboard');
    try {
      window.localStorage.removeItem(STORAGE_KEYS.tourDismissed);
    } catch {
      // Ignore storage error
    }
  };

  const handleOpenCompanion = () => {
    requireAuth('trò chuyện nhanh cùng Mầm', () => {
      setIsFloatingMamHidden(false);
      setIsCompanionOpen(true);
    });
  };

  const handleNavigate = (tab: AppTab) => {
    if (tab === 'dashboard' || tab === 'guide' || tab === 'profile') {
      setActiveTab(tab);
      return;
    }

    const actionLabels: Record<Exclude<AppTab, 'dashboard' | 'guide' | 'profile'>, string> = {
      log: 'chụp ảnh hoặc ghi nhận bữa ăn',
      suggestions: 'nhận gợi ý thực đơn & đổi món từ AI',
      reports: 'xem báo cáo xu hướng & cân nặng',
      history: 'xem và chỉnh sửa lịch sử bữa ăn',
    };

    requireAuth(actionLabels[tab], () => {
      if (tab === 'suggestions') {
        setSuggestionPrefill({ key: Date.now(), mode: 'menu' });
      }
      setActiveTab(tab);
    });
  };

  const hasCustomProfile = profile !== null;
  const activeProfile = useMemo<UserProfile>(
    () =>
      profile ??
      buildUserProfile({
        name: 'bạn',
        gender: 'female',
        age: 24,
        heightCm: 162,
        weightKg: 55,
        goal: 'maintain',
        activityLevel: 'light',
        dietaryTags: ['Ưu tiên cơm nhà'],
        dietaryNote: '',
      }),
    [profile]
  );

  const totals = useMemo(
    () => computeDailyTotals(todayMeals, activeProfile.targetCalories),
    [todayMeals, activeProfile.targetCalories]
  );

  const streakDays = useMemo(
    () => calculateStreak(mealsByDate, todayKey),
    [mealsByDate, todayKey]
  );

  const weeklyStats = useMemo(
    () => getLast7DaysStats(mealsByDate, activeProfile.targetCalories),
    [mealsByDate, activeProfile.targetCalories]
  );

  const notifications = useMemo(
    () => buildDynamicReminders(activeProfile, totals, waterCups),
    [activeProfile, totals, waterCups]
  );

  useEffect(() => {
    if (
      !profile ||
      !reminderSettings.browserEnabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      const lastSent = window.localStorage.getItem('buanay_last_notif_date_v1');
      if (lastSent === todayIso) return;
      const shouldRemindMeal =
        reminderSettings.remindMeals && totals.slotsLogged.length === 0;
      const shouldRemindWater =
        reminderSettings.remindWater &&
        waterCups < Math.ceil(profile.waterTargetCups / 2);

      if (shouldRemindMeal || shouldRemindWater) {
        window.localStorage.setItem('buanay_last_notif_date_v1', todayIso);
        const message = formatReminderMessage(
          profile.name,
          totals.slotsLogged.length,
          waterCups,
          profile.waterTargetCups
        );
        void sendSafeBrowserNotification('BữaNay · Nhắc nhở nhẹ', message);
      }
    } catch {
      // Ignore storage error
    }
  }, [
    profile,
    reminderSettings.browserEnabled,
    reminderSettings.remindMeals,
    reminderSettings.remindWater,
    totals.slotsLogged.length,
    waterCups,
  ]);

  const handleInstallButtonClick = async () => {
    if (clickAction === 'installed_card') {
      setInstallModalMode('installed');
      return;
    }
    if (clickAction === 'native_prompt') {
      const outcome = await triggerNativeInstall();
      if (outcome === 'accepted') {
        setInstallModalMode('installed');
      } else if (outcome === 'unavailable') {
        setInstallModalMode('android_guide');
      }
      return;
    }
    setInstallModalMode(clickAction);
  };

  if (isAdminRoute) {
    return (
      <AdminDashboardPage
        authUser={authUser}
        weather={weather}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setIsAdminRoute(false);
        }}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (legalRoute) {
    return (
      <LegalStandalonePage
        docType={legalRoute}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setLegalRoute(null);
        }}
      />
    );
  }

  const authModals = (
    <>
      {authPromptAction !== null && (
        <AuthPromptModal
          actionLabel={authPromptAction || undefined}
          onOpenAuth={() => handleOpenAuthModal('login')}
          onClose={() => setAuthPromptAction(null)}
        />
      )}
      {authModalState.open && (
        <AuthModal
          initialMode={authModalState.mode}
          defaultDisplayName={profile?.name ?? ''}
          onSuccess={handleAuthSuccess}
          onClose={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </>
  );

  const handleAddWaterCup = () => {
    requireAuth('ghi nhận lượng nước uống hôm nay', () => {
      const current = waterByDate[todayKey] ?? 0;
      const next = Math.min(activeProfile.waterTargetCups, current + 1);
      if (next === current) {
        showToast(
          `Bạn đã uống đủ ${formatWaterLiters(activeProfile.waterTargetCups)}L nước hôm nay rồi!`
        );
        return;
      }
      setWaterByDate((prev) => ({ ...prev, [todayKey]: next }));
      if (authUser?.emailVerified) {
        void saveWaterToFirestore(authUser.uid, todayKey, next);
      }
    });
  };

  const handleSetWaterCups = (cups: number) => {
    requireAuth('cập nhật lượng nước uống hôm nay', () => {
      const next = Math.max(0, Math.min(activeProfile.waterTargetCups, cups));
      setWaterByDate((prev) => ({ ...prev, [todayKey]: next }));
      if (authUser?.emailVerified) {
        void saveWaterToFirestore(authUser.uid, todayKey, next);
      }
    });
  };

  const handleUpdateReminderSettings = (next: ReminderSettings) => {
    requireAuth('lưu cài đặt nhắc nhở dinh dưỡng', () => {
      setReminderSettings(next);
      if (authUser?.emailVerified && profile) {
        void saveProfileToFirestore(authUser.uid, profile, next);
      }
    });
  };

  const handleSaveMeal = (newMeal: Omit<MealEntry, 'id'>) => {
    const entry: MealEntry = {
      ...newMeal,
      id: `meal-${Date.now()}`,
    };
    setMealsByDate((prev) => ({
      ...prev,
      [todayKey]: [...(prev[todayKey] ?? []), entry],
    }));
    setActiveTab('dashboard');
    showToast(`Đã lưu "${entry.name}" (${entry.calories} kcal)`);
    if (authUser?.emailVerified) {
      void saveMealToFirestore(authUser.uid, todayKey, entry);
    }
  };

  const handleDeleteMeal = (id: string, dateKey: string = todayKey) => {
    setMealsByDate((prev) => {
      const filtered = (prev[dateKey] ?? []).filter((m) => m.id !== id);
      const next = { ...prev };
      if (filtered.length === 0) {
        delete next[dateKey];
      } else {
        next[dateKey] = filtered;
      }
      return next;
    });
    showToast('Đã xóa bữa ăn khỏi nhật ký');
    if (authUser?.emailVerified) {
      void deleteMealFromFirestore(authUser.uid, id);
    }
  };

  const handleUpdateMeal = (dateKey: string, updatedMeal: MealEntry) => {
    setMealsByDate((prev) => {
      const list = prev[dateKey] ?? [];
      return {
        ...prev,
        [dateKey]: list.map((m) => (m.id === updatedMeal.id ? updatedMeal : m)),
      };
    });
    showToast(`Đã cập nhật "${updatedMeal.name}" (${updatedMeal.calories} kcal)`);
    if (authUser?.emailVerified) {
      void saveMealToFirestore(authUser.uid, dateKey, updatedMeal);
    }
  };

  const handleLogWeight = (weightKg: number) => {
    const safeWeight = Math.max(30, Math.min(200, Math.round(weightKg * 10) / 10));
    const nextWeights = upsertWeightEntry(
      weightHistory,
      todayKey,
      safeWeight,
      activeProfile.heightCm
    );
    const updatedProfile = buildUserProfile(
      { ...activeProfile, weightKg: safeWeight },
      activeProfile.createdAt
    );
    setWeightHistory(nextWeights);
    setProfile(updatedProfile);
    showToast(`Đã cập nhật cân nặng hôm nay: ${safeWeight} kg`);
    if (authUser?.emailVerified) {
      void saveWeightToFirestore(
        authUser.uid,
        todayKey,
        safeWeight,
        updatedProfile.bmi
      );
      void saveProfileToFirestore(authUser.uid, updatedProfile, reminderSettings);
    }
  };

  const handleSuggestionFeedback = (
    dishName: string,
    action: 'liked' | 'disliked' | 'tried'
  ) => {
    const updatedProfile: UserProfile = {
      ...activeProfile,
      suggestionFeedback: recordSuggestionFeedback(
        activeProfile.suggestionFeedback,
        dishName,
        action
      ),
    };
    setProfile(updatedProfile);
    if (authUser?.emailVerified) {
      void saveProfileToFirestore(authUser.uid, updatedProfile, reminderSettings);
    }
  };

  const handleResetAllData = () => {
    setProfile(null);
    setMealsByDate({});
    setWaterByDate({});
    setWeightHistory([]);
    setActiveTab('dashboard');
    showToast('Đã đặt lại dữ liệu về trạng thái ban đầu');
  };

  return (
    <div className="min-h-dvh w-full bg-[#F7F2E3] flex justify-center">
      <div className="relative w-full max-w-[390px] md:max-w-[1140px] min-h-dvh bg-[#F7F2E3] md:px-[28px] lg:px-[36px]">
        <DesktopTopNav
          profile={activeProfile}
          hasCustomProfile={hasCustomProfile}
          totals={totals}
          waterCups={waterCups}
          activeTab={activeTab}
          authUser={authUser}
          isInstalled={isInstalled}
          notifications={notifications}
          reminderSettings={reminderSettings}
          weather={weather}
          onSelectTab={handleNavigate}
          onUpdateReminderSettings={handleUpdateReminderSettings}
          onInstallClick={() => void handleInstallButtonClick()}
          onOpenAuth={() => handleOpenAuthModal('login')}
        />
        <main>
          {kickedNotice && (
            <div
              role="alert"
              className="mx-[20px] md:mx-0 mb-[14px] rounded-[16px] border-[1.5px] border-[#F25F5C]/60 bg-[#FFE8E8] px-[16px] py-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-[10px]"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-[#B91C1C] m-0">
                  Tài khoản đã bị Quản trị viên gỡ quyền truy cập đồng bộ
                </p>
                <p className="text-[12px] font-medium text-[#7F1D1D] m-0 mt-[2px]">
                  Lý do: {kickedNotice.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-[12px] py-[7px] rounded-[10px] bg-[#D64545] text-white text-[12px] font-extrabold cursor-pointer shrink-0 whitespace-nowrap"
              >
                Đăng xuất
              </button>
            </div>
          )}

          {runtimeConfig.bannerEnabled &&
            runtimeConfig.bannerMessage.trim().length > 0 &&
            dismissedBannerMsg !== runtimeConfig.bannerMessage && (
              <div
                role="status"
                className={`mb-[14px] rounded-[14px] border px-[14px] py-[10px] flex items-start justify-between gap-[10px] text-[12px] ${
                  runtimeConfig.bannerTone === 'warning'
                    ? 'bg-[#FFF3CC] border-[#E8A500]/50 text-[#7A5200]'
                    : runtimeConfig.bannerTone === 'success'
                    ? 'bg-[#DDF7EF] border-[#037A5B]/35 text-[#035C44]'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#2D2416]'
                }`}
              >
                <div className="min-w-0">
                  {runtimeConfig.bannerTitle && (
                    <strong className="mr-[6px]">
                      {runtimeConfig.bannerTitle}:
                    </strong>
                  )}
                  <span>{runtimeConfig.bannerMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedBannerMsg(runtimeConfig.bannerMessage)
                  }
                  className="text-[11px] font-bold opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>
            )}

          {activeTab === 'dashboard' && (
            <DashboardScreen
              profile={activeProfile}
              hasCustomProfile={hasCustomProfile}
              totals={totals}
              todayMeals={todayMeals}
              waterCups={waterCups}
              streakDays={streakDays}
              weeklyStats={weeklyStats}
              notifications={notifications}
              reminderSettings={reminderSettings}
              weather={weather}
              tourDismissed={tourDismissed}
              isInstalled={isInstalled}
              onInstallClick={() => void handleInstallButtonClick()}
              onDismissTour={handleDismissTour}
              onOpenCompanion={handleOpenCompanion}
              onUpdateReminderSettings={handleUpdateReminderSettings}
              onAddWaterCup={handleAddWaterCup}
              onSetWaterCups={handleSetWaterCups}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'log' && (
            <LogMealScreen
              defaultSlot={getNextDefaultSlot(todayMeals)}
              onBack={() => setActiveTab('dashboard')}
              onOpenSuggestions={() => handleNavigate('suggestions')}
              onSaveMeal={handleSaveMeal}
            />
          )}

          {activeTab === 'suggestions' && (
            <MealSuggestionsScreen
              key={suggestionPrefill.key}
              profile={activeProfile}
              totals={totals}
              defaultSlot={getNextDefaultSlot(todayMeals)}
              initialMode={suggestionPrefill.mode}
              initialCraving={suggestionPrefill.cravingDish}
              initialSlot={suggestionPrefill.slot}
              onBack={() => setActiveTab('dashboard')}
              onOpenGuide={() => setActiveTab('guide')}
              onLogSuggestedMeal={handleSaveMeal}
              onFeedbackSuggestion={handleSuggestionFeedback}
              extraCatalogDishes={extraCatalogDishes}
              runtimeAiMode={runtimeConfig.aiMode}
            />
          )}

          {activeTab === 'guide' && (
            <GuideHandbookScreen
              profile={activeProfile}
              defaultSlot={getNextDefaultSlot(todayMeals)}
              onBack={() => setActiveTab('dashboard')}
              onNavigate={handleNavigate}
              onAskAiSwap={(cravingDish) => {
                requireAuth('đổi món thông minh cùng AI', () => {
                  setSuggestionPrefill({
                    key: Date.now(),
                    mode: 'swap',
                    cravingDish,
                  });
                  setActiveTab('suggestions');
                });
              }}
              onAskAiMenu={(slot) => {
                requireAuth('nhờ AI gợi ý thực đơn theo bữa', () => {
                  setSuggestionPrefill({
                    key: Date.now(),
                    mode: 'menu',
                    slot,
                  });
                  setActiveTab('suggestions');
                });
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsScreen
              profile={activeProfile}
              totals={totals}
              mealsByDate={mealsByDate}
              weightHistory={weightHistory}
              onLogWeight={handleLogWeight}
            />
          )}

          {activeTab === 'history' && (
            <HistoryScreen
              mealsByDate={mealsByDate}
              targetCalories={activeProfile.targetCalories}
              todayKey={todayKey}
              onDeleteMeal={handleDeleteMeal}
              onUpdateMeal={handleUpdateMeal}
              onAddMealClick={() => handleNavigate('log')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              profile={activeProfile}
              hasCustomProfile={hasCustomProfile}
              streakDays={streakDays}
              authUser={authUser}
              cloudSyncStatus={cloudSyncStatus}
              onOpenAuth={() => handleOpenAuthModal('login')}
              onSignOut={() => void handleSignOut()}
              onResendVerification={() => void handleResendVerification()}
              onCheckVerification={() => void handleCheckVerification()}
              onUpdateProfile={(next) => {
                setProfile(next);
                const changedBody =
                  !profile ||
                  next.weightKg !== profile.weightKg ||
                  next.heightCm !== profile.heightCm ||
                  weightHistory.length === 0;
                if (changedBody) {
                  setWeightHistory((prev) =>
                    upsertWeightEntry(prev, todayKey, next.weightKg, next.heightCm)
                  );
                }
                showToast(
                  `Đã lưu hồ sơ của ${next.name} (${formatViNumber(next.targetCalories)} kcal/ngày)`
                );
                if (authUser?.emailVerified) {
                  void saveProfileToFirestore(authUser.uid, next, reminderSettings);
                  if (changedBody) {
                    void saveWeightToFirestore(
                      authUser.uid,
                      todayKey,
                      next.weightKg,
                      next.bmi
                    );
                  }
                }
              }}
              onOpenGuide={() => setActiveTab('guide')}
              onResetAllData={handleResetAllData}
              isAdmin={staffRole !== null}
              staffRole={staffRole}
              onOpenAdmin={() => {
                window.history.pushState({}, '', '/admin');
                setIsAdminRoute(true);
              }}
            />
          )}
        </main>

        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-[82px] md:bottom-[24px] left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[350px] md:max-w-[440px] z-[110] rounded-[14px] bg-[#2D2416] text-[#FFFDF5] px-[14px] py-[10px] text-[12px] font-bold text-center shadow-lg"
          >
            {toastMessage}
          </div>
        )}

        <BottomNav
          activeTab={
            activeTab === 'suggestions' || activeTab === 'guide'
              ? 'dashboard'
              : activeTab
          }
          onSelectTab={handleNavigate}
        />

        {!isFloatingMamHidden && !isCompanionOpen && activeTab !== 'log' && (
          <FloatingMamWidget
            activeTab={activeTab}
            onOpenChat={handleOpenCompanion}
            onHide={() => setIsFloatingMamHidden(true)}
          />
        )}

        {isCompanionOpen && (
          <MascotCompanionModal
            profile={activeProfile}
            totals={totals}
            waterCups={waterCups}
            streakDays={streakDays}
            onClose={() => setIsCompanionOpen(false)}
            onNavigate={handleNavigate}
            onReplayTour={handleReplayTour}
          />
        )}

        {installModalMode && (
          <InstallAppModal
            mode={installModalMode}
            canTriggerNative={isInstallable}
            onRetryNativeInstall={async () => {
              const outcome = await triggerNativeInstall();
              if (outcome === 'accepted') {
                setInstallModalMode('installed');
              }
            }}
            onClose={() => setInstallModalMode(null)}
          />
        )}

        {authModals}
      </div>
    </div>
  );
}
