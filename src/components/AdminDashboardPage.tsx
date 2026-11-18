import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { signInWithPopup, type User } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserX,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { loadDishBank } from '../data/dishes';
import { auth, googleProvider } from '../firebase';
import {
  DEFAULT_RUNTIME_CONFIG,
  appointStaffByEmail,
  approveCatalogDishAdmin,
  deleteCatalogDishAdmin,
  fetchAdminAuditLogs,
  fetchAdminRoles,
  fetchAdminUsersOverview,
  fetchAllCatalogDishesForAdmin,
  fetchKickedUsers,
  fetchUserStaffRole,
  kickAppUserAdmin,
  kickStaffMember,
  rejectCatalogDishAdmin,
  saveAppRuntimeConfigAdmin,
  saveCatalogDishStaff,
  subscribeAppRuntimeConfig,
  unkickAppUserAdmin,
} from '../services/adminFirestore';
import type {
  AdminAuditLog,
  AdminRoleRecord,
  AdminUserSummary,
  AppAiMode,
  AppBannerTone,
  AppRuntimeConfig,
  BudgetLevel,
  CatalogDishRecord,
  DishBankItem,
  DishCuisine,
  KickedUserRecord,
  MealDiningMode,
  MealSlot,
  StaffRole,
  UserGoal,
} from '../types/nutrition';
import {
  GOAL_DISPLAY_LABELS,
  computeAdminOverviewStats,
  filterAdminUsers,
} from '../utils/adminStats';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  isBootstrappedAdminEmail,
  isValidEmailAddress,
  mapFirebaseAuthError,
  normalizeEmailKey,
} from '../utils/firestorePayload';
import { formatViNumber } from '../utils/nutrition';
import type { OpenMeteoWeatherInfo } from '../utils/weather';
import { AuthModal } from './AuthModal';

type AdminSection = 'overview' | 'users' | 'catalog' | 'config' | 'admins';
type CatalogSubTab = 'pending' | 'community' | 'static';

interface AdminTelemetryResponse {
  ok: boolean;
  model: string;
  providers: Record<'gemini' | 'groq' | 'openrouter' | 'cloudflare' | 'openMeteo', boolean>;
  telemetry: {
    startedAt: string;
    analyzeCalls: number;
    analyzeSuccess: number;
    analyzeFallbackSuccess: number;
    analyzeErrors: number;
    suggestCalls: number;
    suggestSuccess: number;
    suggestFallbackSuccess: number;
    suggestErrors: number;
    providerUsage: Record<string, number>;
    lastModelUsed: string | null;
    lastCallAt: string | null;
    recentErrors: Array<{ at: string; route: string; message: string }>;
  };
}

interface AdminDashboardPageProps {
  authUser: User | null;
  weather: OpenMeteoWeatherInfo;
  onBackToApp: () => void;
  onSignOut: () => void;
}

class AdminErrorBoundary extends Component<
  { children: ReactNode; onBackToApp: () => void },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode; onBackToApp: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Không thể tải bảng điều hành BữaNay.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#F7F2E3] flex items-center justify-center p-6">
          <div className="max-w-md w-full neo-card p-6 space-y-4">
            <h1 className="text-lg font-extrabold text-[#2D2416] m-0">
              Không thể tải trang điều hành
            </h1>
            <p className="text-sm text-[#6B5D47] m-0 break-words">
              {this.state.message}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-[12px] bg-[#FF8A3D] text-white text-xs font-extrabold neo-cta cursor-pointer"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={this.props.onBackToApp}
                className="px-4 py-2 rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[#2D2416] text-xs font-bold cursor-pointer"
              >
                Về BữaNay
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SECTION_META: Array<{
  id: AdminSection;
  label: string;
  title: string;
}> = [
  { id: 'overview', label: 'Tổng quan', title: 'Tổng quan vận hành' },
  { id: 'users', label: 'Thành viên', title: 'Thành viên & Hồ sơ dinh dưỡng' },
  { id: 'catalog', label: 'Kho món ăn', title: 'Kho món ăn & Hàng chờ duyệt' },
  { id: 'config', label: 'Cấu hình', title: 'Thông báo & Chế độ AI' },
  { id: 'admins', label: 'Ban quản trị', title: 'Bổ nhiệm & Nhật ký hệ thống' },
];

const ALL_SLOTS: MealSlot[] = ['Sáng', 'Trưa', 'Xế', 'Tối'];

type EditableDishDraft = Omit<
  CatalogDishRecord,
  | 'updatedByUid'
  | 'submittedByEmail'
  | 'submittedByRole'
  | 'createdAt'
  | 'updatedAt'
  | 'tools'
>;

const EMPTY_DISH_DRAFT: EditableDishDraft = {
  id: '',
  name: '',
  slots: ['Trưa'],
  diningMode: 'eat_out',
  cuisine: 'vietnam',
  portionEstimate: '1 phần chuẩn',
  calories: 450,
  protein: 28,
  carbs: 48,
  fiber: 5,
  fat: 14,
  budgetLevel: 'balanced',
  estimatedCostVnd: '~45.000đ - 65.000đ',
  prepMinutes: 15,
  whyItFits: '',
  swapTip: '',
  isActive: true,
  status: 'approved',
};

function formatDateTimeVi(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function getRoleBadgeMeta(role: StaffRole) {
  if (role === 'admin') {
    return {
      label: 'Quản trị viên',
      cls: 'bg-[#FFEEDD] text-[#CC5F1A] border-[#FF8A3D]/50',
    };
  }
  return {
    label: 'Kiểm duyệt viên',
    cls: 'bg-[#D4F7EE] text-[#037A5B] border-[#06D6A0]/50',
  };
}

function AdminConsoleInner({
  authUser,
  weather,
  onBackToApp,
  onSignOut,
}: AdminDashboardPageProps) {
  const [checkingRole, setCheckingRole] = useState(true);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [section, setSection] = useState<AdminSection>('overview');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Domain state
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [kickedUsers, setKickedUsers] = useState<KickedUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userGoalFilter, setUserGoalFilter] = useState<'all' | UserGoal>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(
    null
  );
  const [kickCandidate, setKickCandidate] = useState<AdminUserSummary | null>(
    null
  );
  const [kickReason, setKickReason] = useState('');
  const [kickingBusy, setKickingBusy] = useState(false);

  const [catalogDishes, setCatalogDishes] = useState<CatalogDishRecord[]>([]);
  const [staticDishBank, setStaticDishBank] = useState<DishBankItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogTab, setCatalogTab] = useState<CatalogSubTab>('pending');
  const [editingDish, setEditingDish] = useState<EditableDishDraft | null>(null);
  const [savingDish, setSavingDish] = useState(false);

  const [runtimeConfig, setRuntimeConfig] = useState<AppRuntimeConfig>(
    DEFAULT_RUNTIME_CONFIG
  );
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerTone, setBannerTone] = useState<AppBannerTone>('info');
  const [aiMode, setAiMode] = useState<AppAiMode>('full_ai');
  const [savingConfig, setSavingConfig] = useState(false);

  const [adminRoles, setAdminRoles] = useState<AdminRoleRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('moderator');
  const [newStaffLabel, setNewStaffLabel] = useState('');
  const [savingStaffRole, setSavingStaffRole] = useState(false);
  const [confirmKickStaffEmail, setConfirmKickStaffEmail] = useState<
    string | null
  >(null);

  const [telemetryData, setTelemetryData] =
    useState<AdminTelemetryResponse | null>(null);

  const isStaff = staffRole !== null;
  const isAdmin = staffRole === 'admin';

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  useEffect(() => {
    let active = true;
    const verify = async () => {
      setCheckingRole(true);
      try {
        const role = await fetchUserStaffRole(authUser);
        if (active) setStaffRole(role);
      } catch {
        if (active) setStaffRole(null);
      } finally {
        if (active) setCheckingRole(false);
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    const unsub = subscribeAppRuntimeConfig((cfg) => {
      setRuntimeConfig(cfg);
      setBannerEnabled(cfg.bannerEnabled);
      setBannerTitle(cfg.bannerTitle);
      setBannerMessage(cfg.bannerMessage);
      setBannerTone(cfg.bannerTone);
      setAiMode(cfg.aiMode);
    });
    return () => unsub();
  }, []);

  const loadAllAdminData = useCallback(async () => {
    if (!isStaff) return;
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [
        usersRes,
        kickedRes,
        catalogRes,
        staticRes,
        rolesRes,
        logsRes,
        telemetryRes,
      ] = await Promise.all([
        fetchAdminUsersOverview(100),
        fetchKickedUsers().catch(() => []),
        fetchAllCatalogDishesForAdmin(),
        loadDishBank(),
        fetchAdminRoles(),
        fetchAdminAuditLogs(40),
        fetch('/api/admin/telemetry')
          .then((r) =>
            r.ok ? (r.json() as Promise<AdminTelemetryResponse>) : null
          )
          .catch(() => null),
      ]);

      setUsers(usersRes);
      setKickedUsers(kickedRes);
      setCatalogDishes(catalogRes);
      setStaticDishBank(staticRes);
      setAdminRoles(rolesRes);
      setAuditLogs(logsRes);
      if (telemetryRes) setTelemetryData(telemetryRes);
      setSelectedUser((prev) =>
        prev
          ? usersRes.find((u) => u.uid === prev.uid) ?? usersRes[0] ?? null
          : usersRes[0] ?? null
      );
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu điều hành từ Firestore.'
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [isStaff]);

  useEffect(() => {
    if (isStaff) {
      void loadAllAdminData();
    }
  }, [isStaff, loadAllAdminData]);

  const overviewStats = useMemo(() => computeAdminOverviewStats(users), [users]);
  const filteredUsers = useMemo(
    () => filterAdminUsers(users, userSearch, userGoalFilter),
    [users, userSearch, userGoalFilter]
  );

  const pendingDishes = useMemo(
    () => catalogDishes.filter((d) => d.status === 'pending'),
    [catalogDishes]
  );
  const communityDishes = useMemo(
    () => catalogDishes.filter((d) => d.status !== 'pending'),
    [catalogDishes]
  );

  const filteredPendingDishes = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return pendingDishes;
    return pendingDishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.whyItFits.toLowerCase().includes(q) ||
        d.submittedByEmail.toLowerCase().includes(q)
    );
  }, [pendingDishes, catalogSearch]);

  const filteredCommunityDishes = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return communityDishes;
    return communityDishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.whyItFits.toLowerCase().includes(q)
    );
  }, [communityDishes, catalogSearch]);

  const filteredStaticDishes = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = !q
      ? staticDishBank
      : staticDishBank.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.whyItFits.toLowerCase().includes(q)
        );
    return list.slice(0, 60);
  }, [staticDishBank, catalogSearch]);

  const handleGoogleAdminLogin = async () => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSaveDish = async () => {
    if (!authUser || !editingDish || !staffRole) return;
    if (!editingDish.name.trim()) {
      showToast('Vui lòng nhập tên món ăn.');
      return;
    }
    setSavingDish(true);
    try {
      const id =
        editingDish.id.trim() || `admin_dish_${Date.now().toString(36)}`;
      await saveCatalogDishStaff({
        dish: {
          ...editingDish,
          id,
          status: isAdmin ? editingDish.status : 'pending',
          isActive: isAdmin ? editingDish.isActive : false,
        },
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
        actorRole: staffRole,
      });
      setEditingDish(null);
      if (staffRole === 'moderator') {
        setCatalogTab('pending');
        showToast(
          `Đã gửi đề xuất "${editingDish.name.trim()}" vào hàng chờ Quản trị viên duyệt`
        );
      } else {
        showToast(`Đã lưu món "${editingDish.name.trim()}"`);
      }
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể lưu món ăn.');
    } finally {
      setSavingDish(false);
    }
  };

  const handleApproveDish = async (dish: CatalogDishRecord) => {
    if (!authUser || !isAdmin) return;
    try {
      await approveCatalogDishAdmin({
        dishId: dish.id,
        dishName: dish.name,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast(`Đã duyệt & đưa món "${dish.name}" lên kho công khai`);
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể duyệt món.');
    }
  };

  const handleRejectDish = async (dish: CatalogDishRecord) => {
    if (!authUser || !isAdmin) return;
    try {
      await rejectCatalogDishAdmin({
        dishId: dish.id,
        dishName: dish.name,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast(`Đã từ chối đề xuất "${dish.name}"`);
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể từ chối món.');
    }
  };

  const handleToggleDishStatus = async (dish: CatalogDishRecord) => {
    if (!authUser || !isAdmin) return;
    try {
      await saveCatalogDishStaff({
        dish: { ...dish, status: 'approved', isActive: !dish.isActive },
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
        actorRole: 'admin',
      });
      showToast(
        !dish.isActive
          ? `Đã bật hiển thị "${dish.name}"`
          : `Đã ẩn món "${dish.name}"`
      );
      await loadAllAdminData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể đổi trạng thái món.'
      );
    }
  };

  const handleDeleteDish = async (dish: CatalogDishRecord) => {
    if (!authUser || !isAdmin) return;
    try {
      await deleteCatalogDishAdmin({
        dishId: dish.id,
        dishName: dish.name,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast(`Đã xóa "${dish.name}"`);
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa món.');
    }
  };

  const handleConfirmKickUser = async () => {
    if (!authUser || !isAdmin || !kickCandidate) return;
    setKickingBusy(true);
    try {
      await kickAppUserAdmin({
        user: kickCandidate,
        reason: kickReason,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast(
        `Đã kick thành viên ${kickCandidate.email || kickCandidate.displayName}`
      );
      setKickCandidate(null);
      setKickReason('');
      await loadAllAdminData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể kick thành viên.'
      );
    } finally {
      setKickingBusy(false);
    }
  };

  const handleUnkickUser = async (kicked: KickedUserRecord) => {
    if (!authUser || !isAdmin) return;
    try {
      await unkickAppUserAdmin({
        uid: kicked.uid,
        email: kicked.email,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast(`Đã gỡ chặn ${kicked.email || kicked.displayName}`);
      await loadAllAdminData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể gỡ chặn thành viên.'
      );
    }
  };

  const handleSaveRuntimeConfig = async () => {
    if (!authUser || !isAdmin) return;
    setSavingConfig(true);
    try {
      await saveAppRuntimeConfigAdmin({
        config: {
          bannerEnabled,
          bannerTitle,
          bannerMessage,
          bannerTone,
          aiMode,
        },
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      showToast('Đã lưu cấu hình hệ thống & thông báo');
      await loadAllAdminData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể lưu cấu hình.'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAppointStaff = async () => {
    if (!authUser || !isAdmin) return;
    const cleanEmail = normalizeEmailKey(newStaffEmail);
    if (!isValidEmailAddress(cleanEmail)) {
      showToast('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setSavingStaffRole(true);
    try {
      const defaultLabel =
        newStaffRole === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt viên';
      await appointStaffByEmail({
        targetEmail: cleanEmail,
        role: newStaffRole,
        label: newStaffLabel.trim() || defaultLabel,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      setNewStaffEmail('');
      setNewStaffLabel('');
      showToast(
        `Đã bổ nhiệm ${cleanEmail} làm ${
          newStaffRole === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt viên'
        }`
      );
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể bổ nhiệm.');
    } finally {
      setSavingStaffRole(false);
    }
  };

  const handleKickStaff = async (role: AdminRoleRecord) => {
    if (!authUser || !isAdmin) return;
    if (normalizeEmailKey(role.email) === normalizeEmailKey(authUser.email)) {
      showToast('Không thể tự kick tài khoản đang đăng nhập.');
      return;
    }
    try {
      await kickStaffMember({
        targetEmail: role.email,
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
      });
      setConfirmKickStaffEmail(null);
      showToast(`Đã kick ${role.email} khỏi Ban quản trị`);
      await loadAllAdminData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể kick nhân sự.'
      );
    }
  };

  if (checkingRole) {
    return (
      <div className="min-h-dvh bg-[#F7F2E3] flex items-center justify-center p-6">
        <div className="neo-card px-6 py-5 flex items-center gap-3">
          <img
            src="/assets/mascot.png"
            alt="Mầm"
            className="w-[42px] h-[42px] object-contain"
          />
          <span className="text-[13px] font-extrabold text-[#2D2416]">
            Đang xác thực quyền điều hành BữaNay...
          </span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-dvh bg-[#F7F2E3] flex items-center justify-center p-5">
        <div className="max-w-[440px] w-full neo-card p-6 md:p-7 space-y-5">
          <div className="flex items-start gap-3.5">
            <img
              src="/assets/mascot.png"
              alt="Linh vật Mầm BữaNay"
              className="w-[60px] h-[60px] object-contain shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFEEDD] border border-[#FF8A3D]/45 text-[11px] font-extrabold text-[#CC5F1A]">
                <Shield size={12} />
                <span>BữaNay Điều Hành</span>
              </div>
              <h1 className="text-[20px] font-extrabold text-[#2D2416] m-0 leading-snug">
                Đăng nhập Quản trị viên
              </h1>
              <p className="text-[12px] font-medium text-[#6B5D47] m-0 leading-relaxed">
                Chỉ Quản trị viên & Kiểm duyệt viên được bổ nhiệm qua email mới có quyền truy cập khu vực này.
              </p>
            </div>
          </div>

          {loginError && (
            <div className="rounded-[12px] border border-[#F25F5C]/45 bg-[#FFE8E8] px-3.5 py-2.5 text-[12px] font-bold text-[#B91C1C]">
              {loginError}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => void handleGoogleAdminLogin()}
              disabled={loginBusy}
              className="w-full py-3 px-4 rounded-[14px] bg-[#FF8A3D] text-white text-[13px] font-extrabold neo-cta cursor-pointer disabled:opacity-60"
            >
              {loginBusy ? 'Đang mở Google...' : 'Đăng nhập nhanh với Google'}
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-[14px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] hover:border-[#FF8A3D] text-[#2D2416] text-[13px] font-bold cursor-pointer transition-colors"
            >
              Đăng nhập bằng Email / Mật khẩu
            </button>
          </div>

          <div className="pt-3 border-t border-[#EDE5CC] flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#9E8E78]">
            <span className="break-all">
              Quản trị gốc: <strong className="text-[#6B5D47]">{BOOTSTRAPPED_ADMIN_EMAIL}</strong>
            </span>
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1 font-extrabold text-[#CC5F1A] hover:underline cursor-pointer shrink-0"
            >
              <ArrowLeft size={13} />
              <span>Về app</span>
            </button>
          </div>
        </div>

        {authModalOpen && (
          <AuthModal
            initialMode="login"
            onSuccess={() => setAuthModalOpen(false)}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-dvh bg-[#F7F2E3] flex items-center justify-center p-5">
        <div className="max-w-[480px] w-full neo-card p-6 md:p-7 space-y-5">
          <div className="flex items-start gap-3.5">
            <img
              src="/assets/mascot.png"
              alt="Linh vật Mầm"
              className="w-[56px] h-[56px] object-contain shrink-0"
            />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3CC] border border-[#E8A500]/45 text-[11px] font-extrabold text-[#9E6B00]">
                <AlertTriangle size={12} />
                <span>403 · Chưa có quyền điều hành</span>
              </div>
              <h1 className="text-[19px] font-extrabold text-[#2D2416] m-0">
                Email này chưa được cấp quyền truy cập
              </h1>
              <p className="text-[12px] font-medium text-[#6B5D47] m-0 leading-relaxed">
                {!authUser.emailVerified
                  ? 'Email của bạn chưa được xác minh. Vui lòng xác minh email rồi thử lại nhé.'
                  : `Liên hệ Quản trị viên (${BOOTSTRAPPED_ADMIN_EMAIL}) thêm email của bạn vào danh sách Quản trị viên hoặc Kiểm duyệt viên.`}
              </p>
            </div>
          </div>

          <div className="rounded-[14px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] p-3.5 space-y-2 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#6B5D47]">Email hiện tại</span>
              <button
                type="button"
                onClick={() => {
                  if (authUser.email) {
                    void navigator.clipboard?.writeText(authUser.email);
                    showToast('Đã sao chép email');
                  }
                }}
                className="inline-flex items-center gap-1.5 font-bold text-[#2D2416] hover:text-[#CC5F1A] cursor-pointer"
              >
                <span>{authUser.email || '—'}</span>
                <Copy size={12} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#6B5D47]">Trạng thái xác minh</span>
              <span className="font-extrabold text-[#037A5B]">
                {authUser.emailVerified ? 'Đã xác minh ✓' : 'Chưa xác minh'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToApp}
              className="flex-1 py-2.5 px-4 rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer"
            >
              Quay lại BữaNay
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="py-2.5 px-4 rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#F2EBD8] text-[#6B5D47] hover:text-[#CC5F1A] text-[12px] font-extrabold cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentMeta =
    SECTION_META.find((s) => s.id === section) ?? SECTION_META[0];
  const roleBadge = getRoleBadgeMeta(staffRole);

  const totalAiCalls =
    (telemetryData?.telemetry.analyzeCalls ?? 0) +
    (telemetryData?.telemetry.suggestCalls ?? 0);
  const totalFallbacks =
    (telemetryData?.telemetry.analyzeFallbackSuccess ?? 0) +
    (telemetryData?.telemetry.suggestFallbackSuccess ?? 0);
  const activeApprovedCount = catalogDishes.filter(
    (d) => d.status === 'approved' && d.isActive
  ).length;

  const sectionIcon = (id: AdminSection) => {
    switch (id) {
      case 'overview':
        return <Activity size={16} />;
      case 'users':
        return <Users size={16} />;
      case 'catalog':
        return <UtensilsCrossed size={16} />;
      case 'config':
        return <SlidersHorizontal size={16} />;
      case 'admins':
        return <Shield size={16} />;
    }
  };

  const navTabClass = (id: AdminSection) => {
    const active = section === id;
    return [
      'inline-flex items-center gap-[7px] px-[14px] md:px-[16px] py-[8px] rounded-[13px] text-[12.5px] md:text-[13px] cursor-pointer transition-all duration-150 whitespace-nowrap shrink-0',
      active
        ? 'bg-[#FFEEDD] text-[#CC5F1A] font-extrabold border border-[#FF8A3D]/55 shadow-xs'
        : 'text-[#6B5D47] font-semibold hover:text-[#2D2416] hover:bg-[#FFF9ED] border border-transparent',
    ].join(' ');
  };

  return (
    <div className="min-h-dvh w-full bg-[#F7F2E3] text-[#2D2416]">
      <div className="w-full max-w-[460px] md:max-w-[1140px] mx-auto px-[16px] md:px-[28px] lg:px-[36px] pt-[18px] md:pt-[22px] pb-[56px]">
        {/* Header Matching Consumer DesktopTopNav */}
        <header className="pb-[18px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-[8px]">
                <h1 className="text-[22px] md:text-[24px] font-extrabold text-[#2D2416] leading-tight m-0">
                  BữaNay Điều Hành
                </h1>
                <span
                  className={`inline-flex items-center gap-[4px] px-[9px] py-[2.5px] rounded-full border text-[11px] font-extrabold ${roleBadge.cls}`}
                >
                  <Shield size={11} />
                  <span>{roleBadge.label}</span>
                </span>
              </div>

              <div className="mt-[5px] flex flex-wrap items-center gap-[6px] text-[12px] font-semibold text-[#6B5D47] tabular-nums">
                <span className="inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-full bg-[#FFFDF5] border border-[#DDD0B0] text-[#2D2416] font-bold text-[11px]">
                  <span aria-hidden="true">{weather.weatherEmoji}</span>
                  <span>{weather.hanoiDateHeader}</span>
                  <span className="text-[#C5B890]" aria-hidden="true">·</span>
                  <span className="text-[#CC5F1A]">{weather.periodLabel}</span>
                  {weather.temperatureC !== null && (
                    <>
                      <span className="text-[#C5B890]" aria-hidden="true">·</span>
                      <span className="text-[#037A5B]">
                        {Math.round(weather.temperatureC)}°C
                      </span>
                    </>
                  )}
                </span>
                <span aria-hidden="true" className="text-[#C5B890]">·</span>
                <span className="truncate max-w-[260px]">
                  {authUser.email}
                </span>
                <span aria-hidden="true" className="text-[#C5B890]">·</span>
                <span className="text-[#9E8E78]">{currentMeta.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-[8px] shrink-0 flex-wrap">
              <button
                type="button"
                onClick={onBackToApp}
                className="inline-flex items-center gap-[6px] h-[38px] px-[12px] rounded-[12px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] hover:border-[#C5B890] text-[12px] font-bold text-[#2D2416] cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft size={14} />
                <span>Về app</span>
              </button>

              <button
                type="button"
                onClick={() => void loadAllAdminData()}
                disabled={isLoadingData}
                className="inline-flex items-center gap-[6px] h-[38px] px-[14px] rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw
                  size={14}
                  className={isLoadingData ? 'animate-spin' : ''}
                />
                <span>{isLoadingData ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
              </button>

              <button
                type="button"
                onClick={onSignOut}
                aria-label="Đăng xuất"
                className="inline-flex items-center gap-[5px] h-[38px] px-[11px] rounded-[12px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-bold text-[#6B5D47] hover:text-[#CC5F1A] cursor-pointer whitespace-nowrap"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Upper-Centered Segmented Navigation Island */}
          <nav
            aria-label="Điều hướng bảng quản trị"
            className="flex md:justify-center mt-[16px] overflow-x-auto no-scrollbar pb-[2px]"
          >
            <div
              className="inline-flex items-center gap-[5px] p-[5px] rounded-[18px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0]"
              style={{
                boxShadow: '0 3px 0 var(--border-dark), var(--shadow-sm)',
              }}
            >
              {SECTION_META.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  className={navTabClass(item.id)}
                >
                  {sectionIcon(item.id)}
                  <span>{item.label}</span>
                  {item.id === 'catalog' && pendingDishes.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#FF8A3D] text-white text-[10px] font-extrabold inline-flex items-center justify-center tabular-nums">
                      {pendingDishes.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <main className="space-y-[16px]">
          {dataError && (
            <div className="neo-card border-[#F25F5C]/50 bg-[#FFE8E8] px-4 py-3 text-[12px] font-bold text-[#B91C1C] flex items-center justify-between gap-3">
              <span>{dataError}</span>
              <button
                type="button"
                onClick={() => void loadAllAdminData()}
                className="underline font-extrabold cursor-pointer shrink-0"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* SECTION 1: OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-[16px] animate-screen-fade">
              {/* Warm Mascot Admin Strip */}
              <section
                className="rounded-[20px] border-[1.5px] border-[#DDD0B0] px-[16px] md:px-[20px] py-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-[12px]"
                style={{
                  background:
                    'linear-gradient(135deg, #FFF9ED 0%, #FFF0D6 100%)',
                  boxShadow: '0 3px 0 var(--border-dark)',
                }}
              >
                <div className="flex items-center gap-[12px] min-w-0">
                  <img
                    src="/assets/mascot.png"
                    alt="Linh vật Mầm"
                    className="w-[54px] h-[54px] object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold tracking-[0.04em] text-[#CC5F1A] m-0 uppercase">
                      {isAdmin
                        ? 'Toàn quyền Quản trị viên hệ thống'
                        : 'Chế độ Kiểm duyệt viên cộng đồng'}
                    </p>
                    <p className="text-[13px] font-semibold text-[#2D2416] m-0 mt-[3px] leading-snug">
                      {isAdmin
                        ? 'Bạn có thể duyệt món chờ, kick tài khoản vi phạm, bổ nhiệm nhân sự qua email và chỉnh cấu hình AI.'
                        : 'Bạn có thể theo dõi số liệu hệ thống và đề xuất món mới — mọi đề xuất sẽ vào hàng chờ Quản trị viên duyệt.'}
                    </p>
                  </div>
                </div>

                {pendingDishes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogTab('pending');
                      setSection('catalog');
                    }}
                    className="px-[13px] py-[8px] rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Xem {pendingDishes.length} món chờ duyệt →
                  </button>
                )}
              </section>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[14px]">
                <div className="neo-card p-[16px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                    Thành viên đăng ký
                  </p>
                  <p className="text-[30px] font-extrabold text-[#CC5F1A] mt-[6px] mb-[4px] leading-none tabular-nums">
                    {formatViNumber(overviewStats.totalUsers)}
                  </p>
                  <p className="text-[11.5px] font-semibold text-[#6B5D47] m-0 tabular-nums">
                    {overviewStats.completedProfiles} hồ sơ hoàn chỉnh ·{' '}
                    {kickedUsers.length} đang chặn
                  </p>
                </div>

                <div className="neo-card p-[16px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                    Bữa ăn đã ghi nhận
                  </p>
                  <p className="text-[30px] font-extrabold text-[#037A5B] mt-[6px] mb-[4px] leading-none tabular-nums">
                    {formatViNumber(overviewStats.totalMealsLogged)}
                  </p>
                  <p className="text-[11.5px] font-semibold text-[#037A5B] m-0 tabular-nums">
                    {overviewStats.healthyMealRate}% đánh giá cân đối
                  </p>
                </div>

                <div className="neo-card p-[16px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                    Kho món ăn hệ thống
                  </p>
                  <p className="text-[30px] font-extrabold text-[#2D2416] mt-[6px] mb-[4px] leading-none tabular-nums">
                    {formatViNumber(staticDishBank.length + activeApprovedCount)}
                  </p>
                  <p className="text-[11.5px] font-semibold text-[#6B5D47] m-0 tabular-nums">
                    {staticDishBank.length} gốc · {activeApprovedCount} duyệt ·{' '}
                    <span className="text-[#CC5F1A]">
                      {pendingDishes.length} chờ duyệt
                    </span>
                  </p>
                </div>

                <div className="neo-card p-[16px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                    Lượt AI phiên server
                  </p>
                  <p className="text-[30px] font-extrabold text-[#0284C7] mt-[6px] mb-[4px] leading-none tabular-nums">
                    {formatViNumber(totalAiCalls)}
                  </p>
                  <p className="text-[11.5px] font-semibold text-[#6B5D47] m-0 tabular-nums">
                    {totalFallbacks} lượt chuyển provider dự phòng
                  </p>
                </div>
              </div>

              {/* 2-Column Analytics & Providers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] items-stretch">
                <section className="neo-card p-[18px] flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                        Phân bố mục tiêu người dùng
                      </h2>
                      <p className="text-[11.5px] font-medium text-[#9E8E78] m-0 mt-[2px]">
                        Tổng hợp trực tiếp từ Firestore
                      </p>
                    </div>
                    <span className="px-[9px] py-[3px] rounded-full bg-[#FFF9ED] border border-[#DDD0B0] text-[11px] font-extrabold text-[#CC5F1A] tabular-nums">
                      TB {formatViNumber(overviewStats.avgTargetCalories)} kcal
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(Object.keys(GOAL_DISPLAY_LABELS) as UserGoal[]).map(
                      (goalKey) => {
                        const count = overviewStats.goalDistribution[goalKey];
                        const pct =
                          overviewStats.completedProfiles > 0
                            ? Math.round(
                                (count / overviewStats.completedProfiles) * 100
                              )
                            : 0;
                        return (
                          <div key={goalKey} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="font-bold text-[#2D2416]">
                                {GOAL_DISPLAY_LABELS[goalKey]}
                              </span>
                              <span className="font-bold text-[#6B5D47] tabular-nums">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-[9px] w-full bg-[#EDE5CC] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background:
                                    'linear-gradient(90deg, #06D6A0 0%, #037A5B 100%)',
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#EDE5CC] flex items-center justify-between text-[12px] text-[#6B5D47]">
                    <span>
                      Chế độ AI:{' '}
                      <strong className="text-[#2D2416]">
                        {runtimeConfig.aiMode === 'offline_bank_only'
                          ? 'Chỉ dùng kho offline'
                          : 'Đầy đủ AI + Kho offline'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSection('config')}
                      className="text-[#CC5F1A] font-extrabold hover:underline cursor-pointer"
                    >
                      {isAdmin ? 'Điều chỉnh →' : 'Xem cấu hình →'}
                    </button>
                  </div>
                </section>

                <section className="neo-card p-[18px] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                        Trạng thái AI Providers & Thời tiết
                      </h2>
                      <p className="text-[11.5px] font-medium text-[#9E8E78] m-0 mt-[2px]">
                        Model chính: {telemetryData?.model ?? 'gemini-4-hydrogen'}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#9E8E78] tabular-nums">
                      Từ {formatDateTimeVi(telemetryData?.telemetry.startedAt)}
                    </span>
                  </div>

                  <div className="rounded-[14px] border border-[#DDD0B0] bg-[#FFFDF5] divide-y divide-[#EDE5CC]">
                    {(
                      [
                        ['gemini', 'Google Gemini (Chính)'],
                        ['groq', 'Groq Cloud'],
                        ['openrouter', 'OpenRouter'],
                        ['cloudflare', 'Cloudflare Workers AI'],
                      ] as const
                    ).map(([key, label]) => {
                      const ready = telemetryData?.providers?.[key] ?? false;
                      const usage =
                        telemetryData?.telemetry.providerUsage?.[key] ?? 0;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between px-3.5 py-2.5 text-[12px]"
                        >
                          <span className="font-bold text-[#2D2416]">
                            {label}
                          </span>
                          <div className="flex items-center gap-3 tabular-nums">
                            <span className="text-[#9E8E78] font-semibold">
                              {usage} lượt
                            </span>
                            <span
                              className={`px-[8px] py-[2px] rounded-full text-[10.5px] font-extrabold ${
                                ready
                                  ? 'bg-[#D4F7EE] text-[#037A5B]'
                                  : 'bg-[#F2EBD8] text-[#9E8E78]'
                              }`}
                            >
                              {ready ? 'Đã cấu hình' : 'Chưa có key'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Open-Meteo Live Row */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-[12px] bg-[#FFF9ED]/70">
                      <span className="font-bold text-[#2D2416]">
                        Open-Meteo Thời tiết (Hà Nội)
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-[#6B5D47] font-semibold">
                          {weather.weatherEmoji} {weather.periodLabel}
                        </span>
                        <span className="px-[8px] py-[2px] rounded-full text-[10.5px] font-extrabold bg-[#D4F7EE] text-[#037A5B]">
                          {weather.temperatureC !== null
                            ? `${Math.round(weather.temperatureC)}°C · Live`
                            : 'Đang kết nối'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {telemetryData &&
                    telemetryData.telemetry.recentErrors.length > 0 && (
                      <div className="rounded-[12px] border border-[#E8A500]/45 bg-[#FFF3CC] p-3 space-y-1">
                        <p className="text-[11.5px] font-extrabold text-[#9E6B00] m-0">
                          Lỗi API gần nhất (
                          {telemetryData.telemetry.recentErrors.length})
                        </p>
                        <p className="text-[11px] text-[#7A5200] m-0 font-mono truncate">
                          {telemetryData.telemetry.recentErrors[0].route}:{' '}
                          {telemetryData.telemetry.recentErrors[0].message}
                        </p>
                      </div>
                    )}
                </section>
              </div>
            </div>
          )}

          {/* SECTION 2: USERS */}
          {section === 'users' && (
            <div className="space-y-[14px] animate-screen-fade">
              {!isAdmin && (
                <div className="rounded-[14px] border border-[#06D6A0]/45 bg-[#D4F7EE] px-4 py-2.5 text-[12px] font-bold text-[#037A5B]">
                  Chế độ Kiểm duyệt viên: bạn có thể tra cứu thành viên và hồ sơ dinh dưỡng, chỉ Quản trị viên mới có quyền kick tài khoản.
                </div>
              )}

              <div className="neo-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E8E78]"
                  />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo tên, email hoặc UID..."
                    className="w-full pl-9 pr-3 py-2 text-[12.5px] font-semibold rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#F2EBD8] border border-[#DDD0B0] rounded-[12px] overflow-x-auto">
                  {(
                    [
                      ['all', 'Tất cả'],
                      ['lose_fat', 'Giảm mỡ'],
                      ['maintain', 'Giữ dáng'],
                      ['gain_weight', 'Tăng cân'],
                      ['build_muscle', 'Tăng cơ'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setUserGoalFilter(val)}
                      className={`px-3 py-1.5 text-[12px] font-bold rounded-[9px] cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                        userGoalFilter === val
                          ? 'bg-[#FFFDF5] text-[#CC5F1A] shadow-xs'
                          : 'text-[#6B5D47] hover:text-[#2D2416]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-[14px] items-start">
                <div className="xl:col-span-2 neo-card overflow-hidden">
                  {isLoadingData ? (
                    <div className="p-6 space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-10 bg-[#EDE5CC] rounded-[10px] animate-pulse"
                        />
                      ))}
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-[14px] font-extrabold text-[#2D2416] m-0">
                        Chưa có thành viên khớp bộ lọc
                      </p>
                      <p className="text-[12px] text-[#6B5D47] m-0">
                        Khi có tài khoản đăng nhập và đồng bộ Firestore, dữ liệu sẽ hiển thị tại đây.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#EDE5CC] bg-[#FFF9ED] text-[11px] font-extrabold text-[#9E8E78] uppercase">
                            <th className="py-3 px-4">Thành viên</th>
                            <th className="py-3 px-3">Mục tiêu</th>
                            <th className="py-3 px-3 text-right">BMI</th>
                            <th className="py-3 px-3 text-right">Kcal/ngày</th>
                            <th className="py-3 px-3 text-right">Số bữa</th>
                            <th className="py-3 px-4 text-right">Cập nhật</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EDE5CC] text-[12px]">
                          {filteredUsers.map((u) => {
                            const active = selectedUser?.uid === u.uid;
                            return (
                              <tr
                                key={u.uid}
                                onClick={() => setSelectedUser(u)}
                                className={`cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-[#FFEEDD]/60'
                                    : 'hover:bg-[#FFF9ED]'
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <p className="font-extrabold text-[#2D2416] m-0">
                                    {u.displayName}
                                  </p>
                                  <p className="text-[11px] font-medium text-[#6B5D47] m-0 truncate max-w-[210px]">
                                    {u.email || u.uid}
                                  </p>
                                </td>
                                <td className="py-3 px-3 font-semibold text-[#2D2416] whitespace-nowrap">
                                  {u.goal
                                    ? GOAL_DISPLAY_LABELS[u.goal]
                                    : 'Chưa lập hồ sơ'}
                                </td>
                                <td className="py-3 px-3 text-right font-bold tabular-nums text-[#6B5D47]">
                                  {u.bmi ?? '—'}
                                </td>
                                <td className="py-3 px-3 text-right font-bold tabular-nums text-[#CC5F1A]">
                                  {u.targetCalories
                                    ? formatViNumber(u.targetCalories)
                                    : '—'}
                                </td>
                                <td className="py-3 px-3 text-right font-extrabold tabular-nums text-[#037A5B]">
                                  {u.mealsCount}
                                </td>
                                <td className="py-3 px-4 text-right text-[11px] font-semibold tabular-nums text-[#9E8E78] whitespace-nowrap">
                                  {formatDateTimeVi(u.updatedAt)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* User Inspector Drawer Card */}
                <aside className="neo-card p-[16px] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[14px] font-extrabold text-[#2D2416] m-0">
                      Chi tiết thành viên
                    </h2>
                    {selectedUser && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F2EBD8] text-[10.5px] font-bold text-[#6B5D47]">
                        {selectedUser.authProvider}
                      </span>
                    )}
                  </div>

                  {!selectedUser ? (
                    <p className="text-[12px] text-[#9E8E78] m-0">
                      Chọn một thành viên từ bảng bên trái để xem hồ sơ chi tiết.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[15px] font-extrabold text-[#2D2416] m-0">
                          {selectedUser.displayName}
                        </p>
                        <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-0.5 break-all">
                          {selectedUser.email || 'Chưa có email'}
                        </p>
                        <p className="text-[11px] font-mono text-[#9E8E78] m-0 mt-1 break-all">
                          UID: {selectedUser.uid}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                        <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-2.5">
                          <span className="text-[#9E8E78] font-semibold block">
                            Mục tiêu
                          </span>
                          <span className="font-extrabold text-[#2D2416]">
                            {selectedUser.goal
                              ? GOAL_DISPLAY_LABELS[selectedUser.goal]
                              : 'Chưa thiết lập'}
                          </span>
                        </div>
                        <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-2.5">
                          <span className="text-[#9E8E78] font-semibold block">
                            Cân nặng / BMI
                          </span>
                          <span className="font-extrabold text-[#2D2416] tabular-nums">
                            {selectedUser.latestWeightKg
                              ? `${selectedUser.latestWeightKg} kg`
                              : '—'}{' '}
                            · {selectedUser.bmi ?? '—'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                          Khẩu vị & Sức khỏe
                        </p>
                        {selectedUser.dietaryTags.length === 0 &&
                        selectedUser.healthConditions.length === 0 ? (
                          <p className="text-[12px] text-[#6B5D47] m-0">
                            Không có ghi chú đặc biệt.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedUser.dietaryTags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-full bg-[#D4F7EE] text-[#037A5B] text-[11px] font-bold"
                              >
                                {t}
                              </span>
                            ))}
                            {selectedUser.healthConditions.map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 rounded-full bg-[#FFEEDD] text-[#CC5F1A] text-[11px] font-bold"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#9E8E78] m-0">
                          Bữa ăn gần nhất ({selectedUser.recentMeals.length})
                        </p>
                        {selectedUser.recentMeals.length === 0 ? (
                          <p className="text-[12px] text-[#6B5D47] m-0">
                            Thành viên chưa ghi nhận bữa ăn nào.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedUser.recentMeals.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between text-[12px] rounded-[10px] border border-[#EDE5CC] bg-[#FFFDF5] px-2.5 py-2 gap-2"
                              >
                                <span className="font-bold text-[#2D2416] truncate">
                                  {m.slot} · {m.name}
                                </span>
                                <span className="font-extrabold text-[#CC5F1A] tabular-nums shrink-0">
                                  {m.calories} kcal
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {isAdmin &&
                        !isBootstrappedAdminEmail(selectedUser.email) &&
                        selectedUser.uid !== authUser.uid && (
                          <div className="pt-3 border-t border-[#EDE5CC]">
                            {kickCandidate?.uid === selectedUser.uid ? (
                              <div className="rounded-[12px] border border-[#F25F5C]/45 bg-[#FFE8E8] p-3 space-y-2">
                                <p className="text-[12px] font-extrabold text-[#B91C1C] m-0">
                                  Xác nhận kick tài khoản này?
                                </p>
                                <p className="text-[11px] font-medium text-[#7F1D1D] m-0">
                                  Dữ liệu Firestore của thành viên sẽ bị xóa và bị chặn đồng bộ lại.
                                </p>
                                <input
                                  type="text"
                                  value={kickReason}
                                  onChange={(e) => setKickReason(e.target.value)}
                                  placeholder="Lý do (tùy chọn)..."
                                  className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#F25F5C]/40 bg-white text-[12px] font-medium text-[#2D2416]"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={kickingBusy}
                                    onClick={() => void handleConfirmKickUser()}
                                    className="flex-1 py-1.5 px-3 rounded-[9px] bg-[#D64545] text-white text-[11.5px] font-extrabold cursor-pointer disabled:opacity-60"
                                  >
                                    {kickingBusy ? 'Đang kick...' : 'Xác nhận Kick'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setKickCandidate(null);
                                      setKickReason('');
                                    }}
                                    className="py-1.5 px-3 rounded-[9px] border border-[#DDD0B0] bg-white text-[#6B5D47] text-[11.5px] font-bold cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setKickCandidate(selectedUser)}
                                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-[12px] border-[1.5px] border-[#F25F5C]/45 bg-[#FFE8E8] hover:bg-[#FFD6D6] text-[#B91C1C] text-[12px] font-extrabold cursor-pointer transition-colors"
                              >
                                <UserX size={14} />
                                <span>Kick thành viên khỏi hệ thống</span>
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </aside>
              </div>

              {/* Kicked Users List (Admin can restore) */}
              {kickedUsers.length > 0 && (
                <section className="neo-card p-[16px] space-y-3">
                  <h3 className="text-[14px] font-extrabold text-[#2D2416] m-0">
                    Danh sách tài khoản đã bị Kick ({kickedUsers.length})
                  </h3>
                  <div className="divide-y divide-[#EDE5CC] border border-[#DDD0B0] rounded-[12px] bg-[#FFFDF5]">
                    {kickedUsers.map((k) => (
                      <div
                        key={k.uid}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]"
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold text-[#2D2416] m-0">
                            {k.displayName} ·{' '}
                            <span className="font-semibold text-[#6B5D47]">
                              {k.email || k.uid}
                            </span>
                          </p>
                          <p className="text-[11px] text-[#9E8E78] m-0 mt-0.5">
                            Lý do: {k.reason} · Kick bởi {k.kickedByEmail}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleUnkickUser(k)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-[#D4F7EE] text-[#037A5B] text-[11.5px] font-extrabold cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            <UserCheck size={13} />
                            <span>Gỡ chặn</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* SECTION 3: CATALOG */}
          {section === 'catalog' && (
            <div className="space-y-[14px] animate-screen-fade">
              {!isAdmin && (
                <div className="rounded-[14px] border border-[#FF8A3D]/45 bg-[#FFEEDD] px-4 py-2.5 text-[12px] font-bold text-[#CC5F1A]">
                  Bạn đang ở quyền Kiểm duyệt viên: món bạn thêm mới sẽ tự động lưu ở trạng thái <strong>Pending (Chờ Quản trị viên duyệt)</strong> trước khi xuất hiện trên app.
                </div>
              )}

              <div className="neo-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 bg-[#F2EBD8] border border-[#DDD0B0] rounded-[12px]">
                    <button
                      type="button"
                      onClick={() => setCatalogTab('pending')}
                      className={`px-3 py-1.5 text-[12px] font-bold rounded-[9px] cursor-pointer whitespace-nowrap ${
                        catalogTab === 'pending'
                          ? 'bg-[#FFFDF5] text-[#CC5F1A] shadow-xs'
                          : 'text-[#6B5D47]'
                      }`}
                    >
                      Chờ duyệt ({pendingDishes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogTab('community')}
                      className={`px-3 py-1.5 text-[12px] font-bold rounded-[9px] cursor-pointer whitespace-nowrap ${
                        catalogTab === 'community'
                          ? 'bg-[#FFFDF5] text-[#037A5B] shadow-xs'
                          : 'text-[#6B5D47]'
                      }`}
                    >
                      Món cộng đồng ({communityDishes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogTab('static')}
                      className={`px-3 py-1.5 text-[12px] font-bold rounded-[9px] cursor-pointer whitespace-nowrap ${
                        catalogTab === 'static'
                          ? 'bg-[#FFFDF5] text-[#2D2416] shadow-xs'
                          : 'text-[#6B5D47]'
                      }`}
                    >
                      Kho chuẩn ({staticDishBank.length})
                    </button>
                  </div>

                  <div className="relative min-w-[210px]">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E8E78]"
                    />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Tìm tên món ăn..."
                      className="w-full pl-8 pr-3 py-1.5 text-[12px] font-semibold rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[#2D2416]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingDish({
                      ...EMPTY_DISH_DRAFT,
                      status: isAdmin ? 'approved' : 'pending',
                      isActive: isAdmin,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus size={14} />
                  <span>
                    {isAdmin
                      ? 'Thêm món vào kho cộng đồng'
                      : 'Đề xuất món mới (Chờ duyệt)'}
                  </span>
                </button>
              </div>

              {editingDish && (
                <section className="neo-card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                        {editingDish.id
                          ? 'Chỉnh sửa món ăn'
                          : isAdmin
                          ? 'Thêm món ăn mới'
                          : 'Đề xuất món mới (Pending)'}
                      </h2>
                      {!isAdmin && (
                        <p className="text-[11.5px] font-semibold text-[#CC5F1A] m-0 mt-0.5">
                          Trạng thái sau khi lưu: Chờ Quản trị viên duyệt
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDish(null)}
                      className="text-[12px] font-bold text-[#6B5D47] hover:text-[#2D2416] cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Tên món ăn *
                      </label>
                      <input
                        type="text"
                        value={editingDish.name}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            name: e.target.value,
                          })
                        }
                        placeholder="Ví dụ: Cơm gạo lứt ức gà áp chảo"
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Khẩu phần gợi ý
                      </label>
                      <input
                        type="text"
                        value={editingDish.portionEstimate}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            portionEstimate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-semibold text-[#2D2416]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Giá ước tính
                      </label>
                      <input
                        type="text"
                        value={editingDish.estimatedCostVnd}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            estimatedCostVnd: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-semibold text-[#2D2416]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {(
                      [
                        ['calories', 'Calories'],
                        ['protein', 'Đạm (g)'],
                        ['carbs', 'Tinh bột (g)'],
                        ['fiber', 'Chất xơ (g)'],
                        ['fat', 'Chất béo (g)'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                          {label}
                        </label>
                        <input
                          type="number"
                          value={editingDish[field]}
                          onChange={(e) =>
                            setEditingDish({
                              ...editingDish,
                              [field]: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold tabular-nums text-[#2D2416]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Hình thức
                      </label>
                      <select
                        value={editingDish.diningMode}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            diningMode: e.target.value as MealDiningMode,
                          })
                        }
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416]"
                      >
                        <option value="eat_out">Ăn ngoài quán</option>
                        <option value="home_cook">Tự nấu tại nhà</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Phân loại
                      </label>
                      <select
                        value={editingDish.cuisine}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            cuisine: e.target.value as DishCuisine,
                          })
                        }
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416]"
                      >
                        <option value="vietnam">Món Việt</option>
                        <option value="healthy_intl">Eat clean / Á-Âu</option>
                        <option value="drink">Đồ uống</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Mức ngân sách
                      </label>
                      <select
                        value={editingDish.budgetLevel}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            budgetLevel: e.target.value as BudgetLevel,
                          })
                        }
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416]"
                      >
                        <option value="economy">Tiết kiệm</option>
                        <option value="balanced">Vừa phải</option>
                        <option value="flexible">Thoải mái</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Khung bữa
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_SLOTS.map((slot) => {
                          const selected = editingDish.slots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? editingDish.slots.filter((s) => s !== slot)
                                  : [...editingDish.slots, slot];
                                setEditingDish({
                                  ...editingDish,
                                  slots: next.length > 0 ? next : ['Trưa'],
                                });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer border ${
                                selected
                                  ? 'bg-[#FFEEDD] text-[#CC5F1A] border-[#FF8A3D]'
                                  : 'bg-[#FFFDF5] text-[#6B5D47] border-[#DDD0B0]'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Lý do dinh dưỡng (ngắn gọn)
                      </label>
                      <input
                        type="text"
                        value={editingDish.whyItFits}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            whyItFits: e.target.value,
                          })
                        }
                        placeholder="Giàu đạm nạc, đủ chất xơ, no lâu..."
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-semibold text-[#2D2416]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                        Mẹo điều chỉnh dinh dưỡng
                      </label>
                      <input
                        type="text"
                        value={editingDish.swapTip}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            swapTip: e.target.value,
                          })
                        }
                        placeholder="Thêm 1 đĩa rau luộc để bổ sung xơ..."
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-semibold text-[#2D2416]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingDish(null)}
                      className="px-4 py-2 rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[#6B5D47] text-[12px] font-bold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={savingDish}
                      onClick={() => void handleSaveDish()}
                      className="px-4 py-2 rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer disabled:opacity-60"
                    >
                      {savingDish
                        ? 'Đang lưu...'
                        : isAdmin
                        ? 'Lưu & xuất bản lên app'
                        : 'Gửi đề xuất (Chờ duyệt)'}
                    </button>
                  </div>
                </section>
              )}

              {/* PENDING QUEUE TAB */}
              {catalogTab === 'pending' && (
                <div className="neo-card overflow-hidden">
                  {filteredPendingDishes.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <CheckCircle2
                        size={28}
                        className="mx-auto text-[#037A5B]"
                      />
                      <p className="text-[14px] font-extrabold text-[#2D2416] m-0">
                        Không có món nào đang chờ duyệt
                      </p>
                      <p className="text-[12px] text-[#6B5D47] m-0">
                        Mọi món do Kiểm duyệt viên đề xuất sẽ hiển thị tại đây để Quản trị viên xem xét phê duyệt.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EDE5CC]">
                      {filteredPendingDishes.map((dish) => {
                        const canModEditOwn =
                          !isAdmin && dish.updatedByUid === authUser.uid;
                        return (
                          <div
                            key={dish.id}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FFFDF5]"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[14px] font-extrabold text-[#2D2416]">
                                  {dish.name}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF3CC] border border-[#E8A500]/45 text-[10.5px] font-extrabold text-[#9E6B00]">
                                  <Clock3 size={11} />
                                  <span>Pending chờ duyệt</span>
                                </span>
                              </div>
                              <p className="text-[12px] font-semibold text-[#6B5D47] m-0">
                                {dish.calories} kcal · {dish.protein}g đạm ·{' '}
                                {dish.fiber}g xơ · {dish.slots.join(', ')} ·{' '}
                                {dish.estimatedCostVnd}
                              </p>
                              <p className="text-[11px] font-medium text-[#9E8E78] m-0">
                                Đề xuất bởi:{' '}
                                <strong className="text-[#6B5D47]">
                                  {dish.submittedByEmail || dish.updatedByUid}
                                </strong>{' '}
                                · {formatDateTimeVi(dish.updatedAt)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {isAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleApproveDish(dish)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-[#06D6A0] text-[#024E3B] text-[11.5px] font-extrabold cursor-pointer hover:brightness-95"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Duyệt lên app</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleRejectDish(dish)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] border border-[#F25F5C]/45 bg-[#FFE8E8] text-[#B91C1C] text-[11.5px] font-bold cursor-pointer"
                                  >
                                    <XCircle size={13} />
                                    <span>Từ chối</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDish({ ...dish })}
                                    aria-label={`Sửa ${dish.name}`}
                                    className="p-2 rounded-[10px] border border-[#DDD0B0] bg-[#FFF9ED] text-[#6B5D47] hover:text-[#2D2416] cursor-pointer"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteDish(dish)}
                                    aria-label={`Xóa ${dish.name}`}
                                    className="p-2 rounded-[10px] border border-[#DDD0B0] bg-[#FFF9ED] text-[#6B5D47] hover:text-[#B91C1C] cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              ) : canModEditOwn ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingDish({ ...dish })}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] border border-[#DDD0B0] bg-[#FFF9ED] text-[#2D2416] text-[11.5px] font-bold cursor-pointer"
                                >
                                  <Pencil size={13} />
                                  <span>Sửa đề xuất</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-[#9E8E78]">
                                  Đang chờ Admin duyệt
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* COMMUNITY DISHES TAB */}
              {catalogTab === 'community' && (
                <div className="neo-card overflow-hidden">
                  {filteredCommunityDishes.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Database size={28} className="mx-auto text-[#9E8E78]" />
                      <p className="text-[14px] font-extrabold text-[#2D2416] m-0">
                        Chưa có món cộng đồng nào
                      </p>
                      <p className="text-[12px] text-[#6B5D47] m-0">
                        Bấm nút phía trên để thêm món mới cho người dùng BữaNay.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#EDE5CC] bg-[#FFF9ED] text-[11px] font-extrabold text-[#9E8E78] uppercase">
                            <th className="py-3 px-4">Tên món</th>
                            <th className="py-3 px-3">Bữa</th>
                            <th className="py-3 px-3 text-right">Calo</th>
                            <th className="py-3 px-3 text-right">Đạm</th>
                            <th className="py-3 px-3">Trạng thái</th>
                            <th className="py-3 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EDE5CC] text-[12px]">
                          {filteredCommunityDishes.map((dish) => (
                            <tr key={dish.id} className="hover:bg-[#FFF9ED]">
                              <td className="py-3 px-4">
                                <p className="font-extrabold text-[#2D2416] m-0">
                                  {dish.name}
                                </p>
                                <p className="text-[11px] text-[#6B5D47] m-0 truncate max-w-[260px]">
                                  {dish.whyItFits}
                                </p>
                              </td>
                              <td className="py-3 px-3 text-[#6B5D47] font-semibold">
                                {dish.slots.join(', ')}
                              </td>
                              <td className="py-3 px-3 text-right font-extrabold text-[#CC5F1A] tabular-nums">
                                {dish.calories}
                              </td>
                              <td className="py-3 px-3 text-right font-bold tabular-nums text-[#037A5B]">
                                {dish.protein}g
                              </td>
                              <td className="py-3 px-3">
                                {dish.status === 'rejected' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FFE8E8] text-[#B91C1C]">
                                    Đã từ chối
                                  </span>
                                ) : isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleToggleDishStatus(dish)
                                    }
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold cursor-pointer ${
                                      dish.isActive
                                        ? 'bg-[#D4F7EE] text-[#037A5B]'
                                        : 'bg-[#F2EBD8] text-[#6B5D47]'
                                    }`}
                                  >
                                    {dish.isActive ? 'Đang bật' : 'Đang ẩn'}
                                  </button>
                                ) : (
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                      dish.isActive
                                        ? 'bg-[#D4F7EE] text-[#037A5B]'
                                        : 'bg-[#F2EBD8] text-[#6B5D47]'
                                    }`}
                                  >
                                    {dish.isActive ? 'Đang bật' : 'Đang ẩn'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {isAdmin ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDish({ ...dish })}
                                      aria-label={`Sửa ${dish.name}`}
                                      className="p-1.5 rounded-[9px] border border-[#DDD0B0] bg-[#FFFDF5] text-[#6B5D47] hover:text-[#2D2416] cursor-pointer"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteDish(dish)}
                                      aria-label={`Xóa ${dish.name}`}
                                      className="p-1.5 rounded-[9px] border border-[#DDD0B0] bg-[#FFFDF5] text-[#6B5D47] hover:text-[#B91C1C] cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-semibold text-[#9E8E78]">
                                    Chỉ xem
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* STATIC DISH BANK TAB */}
              {catalogTab === 'static' && (
                <div className="neo-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#EDE5CC] bg-[#FFF9ED] text-[11px] font-extrabold text-[#9E8E78] uppercase">
                          <th className="py-3 px-4">
                            Món gốc ({staticDishBank.length})
                          </th>
                          <th className="py-3 px-3">Bữa</th>
                          <th className="py-3 px-3 text-right">Calo</th>
                          <th className="py-3 px-3 text-right">Đạm</th>
                          <th className="py-3 px-4 text-right">Giá tham khảo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDE5CC] text-[12px]">
                        {filteredStaticDishes.map((dish) => (
                          <tr key={dish.id} className="hover:bg-[#FFF9ED]">
                            <td className="py-2.5 px-4 font-bold text-[#2D2416]">
                              {dish.name}
                            </td>
                            <td className="py-2.5 px-3 text-[#6B5D47]">
                              {dish.slots.join(', ')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#CC5F1A]">
                              {dish.calories}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#037A5B]">
                              {dish.protein}g
                            </td>
                            <td className="py-2.5 px-4 text-right text-[#6B5D47]">
                              {dish.estimatedCostVnd}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: CONFIG */}
          {section === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] animate-screen-fade">
              <section className="neo-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                      Banner thông báo toàn hệ thống
                    </h2>
                    <p className="text-[12px] text-[#6B5D47] m-0 mt-0.5">
                      Hiển thị trực tiếp ở đầu màn hình ứng dụng BữaNay.
                    </p>
                  </div>
                  {!isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F2EBD8] text-[10.5px] font-extrabold text-[#6B5D47]">
                      Chỉ xem
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2.5 text-[12.5px] font-extrabold text-[#2D2416] cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={bannerEnabled}
                    onChange={(e) => setBannerEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#FF8A3D]"
                  />
                  <span>Bật hiển thị banner cho người dùng</span>
                </label>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                      Tiêu đề ngắn
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      placeholder="Ví dụ: Cập nhật thực đơn mới"
                      className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416] disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                      Nội dung thông báo
                    </label>
                    <textarea
                      rows={3}
                      disabled={!isAdmin}
                      value={bannerMessage}
                      onChange={(e) => setBannerMessage(e.target.value)}
                      placeholder="Nhập nội dung thông báo gửi tới người dùng..."
                      className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-medium text-[#2D2416] disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5D47] mb-1">
                      Mức độ thông báo
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={bannerTone}
                      onChange={(e) =>
                        setBannerTone(e.target.value as AppBannerTone)
                      }
                      className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416] disabled:opacity-70"
                    >
                      <option value="info">Thông tin chung</option>
                      <option value="success">Tin mới / Tích cực</option>
                      <option value="warning">Lưu ý / Bảo trì</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="neo-card p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                      Chế độ AI vận hành
                    </h2>
                    <p className="text-[12px] text-[#6B5D47] m-0 mt-0.5">
                      Kiểm soát nguồn gợi ý khi cần tiết kiệm quota API.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-[14px] border-[1.5px] cursor-pointer ${
                        aiMode === 'full_ai'
                          ? 'border-[#06D6A0] bg-[#D4F7EE]/55'
                          : 'border-[#DDD0B0] bg-[#FFFDF5]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiMode"
                        disabled={!isAdmin}
                        checked={aiMode === 'full_ai'}
                        onChange={() => setAiMode('full_ai')}
                        className="mt-0.5 accent-[#037A5B]"
                      />
                      <div className="text-[12px]">
                        <p className="font-extrabold text-[#2D2416] m-0">
                          Đầy đủ AI + Kho offline (Khuyên dùng)
                        </p>
                        <p className="text-[#6B5D47] m-0 mt-0.5">
                          Ưu tiên kết hợp kho món chuẩn & phân tích thông minh qua Gemini/Groq/OpenRouter/Cloudflare.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-[14px] border-[1.5px] cursor-pointer ${
                        aiMode === 'offline_bank_only'
                          ? 'border-[#FF8A3D] bg-[#FFEEDD]/70'
                          : 'border-[#DDD0B0] bg-[#FFFDF5]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiMode"
                        disabled={!isAdmin}
                        checked={aiMode === 'offline_bank_only'}
                        onChange={() => setAiMode('offline_bank_only')}
                        className="mt-0.5 accent-[#FF8A3D]"
                      />
                      <div className="text-[12px]">
                        <p className="font-extrabold text-[#2D2416] m-0">
                          Chỉ dùng kho món offline (Bảo trì / Tiết kiệm API)
                        </p>
                        <p className="text-[#6B5D47] m-0 mt-0.5">
                          Gợi ý món từ kho dữ liệu 270+ món & kho cộng đồng, không gọi AI bên ngoài.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EDE5CC] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#9E8E78]">
                    Cập nhật lần cuối: {formatDateTimeVi(runtimeConfig.updatedAt)}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={savingConfig}
                      onClick={() => void handleSaveRuntimeConfig()}
                      className="px-4 py-2 rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer disabled:opacity-60"
                    >
                      {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* SECTION 5: STAFF & AUDIT LOGS */}
          {section === 'admins' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] items-start animate-screen-fade">
              <section className="neo-card p-5 space-y-4">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                    Ban quản trị & Kiểm duyệt viên
                  </h2>
                  <p className="text-[12px] text-[#6B5D47] m-0 mt-0.5">
                    Quản trị viên bổ nhiệm trực tiếp bằng email — không cần nhập UID thủ công.
                  </p>
                </div>

                {isAdmin ? (
                  <div className="p-3.5 rounded-[14px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] space-y-3">
                    <p className="text-[12px] font-extrabold text-[#CC5F1A] m-0">
                      Bổ nhiệm nhân sự mới qua Email
                    </p>
                    <div className="space-y-2.5">
                      <input
                        type="email"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        placeholder="Nhập email người được bổ nhiệm (vd: ban@gmail.com)"
                        className="w-full px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12.5px] font-bold text-[#2D2416]"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          aria-label="Chọn vai trò bổ nhiệm"
                          value={newStaffRole}
                          onChange={(e) =>
                            setNewStaffRole(e.target.value as StaffRole)
                          }
                          className="px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416]"
                        >
                          <option value="moderator">
                            Kiểm duyệt viên (Đề xuất món chờ duyệt)
                          </option>
                          <option value="admin">
                            Quản trị viên (Toàn quyền + Kick)
                          </option>
                        </select>
                        <input
                          type="text"
                          value={newStaffLabel}
                          onChange={(e) => setNewStaffLabel(e.target.value)}
                          placeholder="Ghi chú chức danh (tùy chọn)"
                          className="px-3 py-2 rounded-[11px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-semibold text-[#2D2416]"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingStaffRole}
                        onClick={() => void handleAppointStaff()}
                        className="w-full py-2.5 px-4 rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer disabled:opacity-60"
                      >
                        {savingStaffRole
                          ? 'Đang bổ nhiệm...'
                          : `Bổ nhiệm làm ${
                              newStaffRole === 'admin'
                                ? 'Quản trị viên'
                                : 'Kiểm duyệt viên'
                            }`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-[#06D6A0]/45 bg-[#D4F7EE] px-3.5 py-2.5 text-[12px] font-bold text-[#037A5B]">
                    Chỉ Quản trị viên mới có thể bổ nhiệm hoặc kick nhân sự trong Ban quản trị.
                  </div>
                )}

                <div className="divide-y divide-[#EDE5CC] border border-[#DDD0B0] rounded-[14px] bg-[#FFFDF5]">
                  {/* Bootstrapped Root Admin */}
                  <div className="p-3.5 flex items-center justify-between gap-2 text-[12px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-[#2D2416] m-0">
                          Quản trị viên gốc
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-[#FFEEDD] border border-[#FF8A3D]/50 text-[10.5px] font-extrabold text-[#CC5F1A]">
                          Quản trị viên
                        </span>
                      </div>
                      <p className="text-[11.5px] font-semibold text-[#6B5D47] m-0 mt-0.5 truncate">
                        {BOOTSTRAPPED_ADMIN_EMAIL}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#037A5B] shrink-0">
                      <CheckCircle2 size={13} />
                      <span>Mặc định hệ thống</span>
                    </span>
                  </div>

                  {adminRoles.map((r) => {
                    const badge = getRoleBadgeMeta(r.role);
                    const isSelf =
                      normalizeEmailKey(r.email) ===
                      normalizeEmailKey(authUser.email);
                    return (
                      <div
                        key={r.id || r.email}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-[#2D2416] m-0">
                              {r.label}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10.5px] font-extrabold ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-[11.5px] font-semibold text-[#6B5D47] m-0 mt-0.5 truncate">
                            {r.email} · Bổ nhiệm bởi {r.addedByEmail}
                          </p>
                        </div>

                        {isAdmin && !isSelf && (
                          <div className="shrink-0">
                            {confirmKickStaffEmail === r.email ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleKickStaff(r)}
                                  className="px-2.5 py-1 rounded-[8px] bg-[#D64545] text-white text-[11px] font-extrabold cursor-pointer"
                                >
                                  Xác nhận Kick
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmKickStaffEmail(null)}
                                  className="px-2 py-1 rounded-[8px] border border-[#DDD0B0] bg-[#FFF9ED] text-[#6B5D47] text-[11px] font-bold cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmKickStaffEmail(r.email)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[9px] border border-[#F25F5C]/45 bg-[#FFE8E8] text-[#B91C1C] text-[11px] font-extrabold cursor-pointer hover:bg-[#FFD6D6]"
                              >
                                <UserX size={12} />
                                <span>Kick</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="neo-card p-5 space-y-3">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
                    Nhật ký thao tác điều hành
                  </h2>
                  <p className="text-[12px] text-[#6B5D47] m-0 mt-0.5">
                    Lưu vết 40 hành động mới nhất trên Firestore.
                  </p>
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-[12px] text-[#9E8E78] m-0 py-6 text-center">
                    Chưa có nhật ký thao tác nào.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EDE5CC] border border-[#DDD0B0] rounded-[14px] bg-[#FFFDF5] max-h-[460px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 text-[12px] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#F2EBD8] font-extrabold text-[#2D2416] text-[10.5px]">
                            {log.action}
                          </span>
                          <span className="text-[11px] font-semibold text-[#9E8E78] tabular-nums">
                            {formatDateTimeVi(log.createdAt)}
                          </span>
                        </div>
                        <p className="font-bold text-[#2D2416] m-0">
                          {log.target}
                        </p>
                        <p className="text-[11.5px] text-[#6B5D47] m-0">
                          {log.detail}
                        </p>
                        <p className="text-[10.5px] text-[#9E8E78] m-0">
                          Thực hiện: {log.actorEmail || log.actorUid}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-[24px] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] z-[120] rounded-[14px] bg-[#2D2416] text-[#FFFDF5] px-[16px] py-[11px] text-[12.5px] font-bold text-center shadow-lg"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboardPage(props: AdminDashboardPageProps) {
  return (
    <AdminErrorBoundary onBackToApp={props.onBackToApp}>
      <AdminConsoleInner {...props} />
    </AdminErrorBoundary>
  );
}
