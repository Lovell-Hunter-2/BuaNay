import { useEffect, useMemo, useState } from 'react';
import type {
  ActivityLevel,
  BudgetLevel,
  CookingSkill,
  CookingTime,
  Gender,
  StaffRole,
  UserGoal,
  UserProfile,
} from '../types/nutrition';
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  COOKING_SKILL_OPTIONS,
  COOKING_TIME_OPTIONS,
  DIETARY_TAG_OPTIONS,
  GOAL_OPTIONS,
  HEALTH_CONDITION_OPTIONS,
  KITCHEN_TOOL_OPTIONS,
  buildUserProfile,
  formatViNumber,
  formatWaterLiters,
  getActivityLabel,
  getGoalLabel,
  getMissingProfileFields,
} from '../utils/nutrition';
import { MamMascot3D } from './MamMascot3D';
import { BookOpenIcon, CheckIcon } from './Icons';
import { LegalModal, type LegalDocType } from './LegalDocumentView';

import type { User } from 'firebase/auth';

interface ProfileScreenProps {
  profile: UserProfile;
  hasCustomProfile?: boolean;
  streakDays: number;
  authUser: User | null;
  cloudSyncStatus: 'guest' | 'unverified' | 'syncing' | 'synced';
  onOpenAuth: () => void;
  onSignOut: () => void;
  onResendVerification: () => void;
  onCheckVerification: () => void;
  onUpdateProfile: (next: UserProfile) => void;
  onOpenGuide: () => void;
  onResetAllData: () => void;
  isAdmin?: boolean;
  staffRole?: StaffRole | null;
  onOpenAdmin?: () => void;
}

export function ProfileScreen({
  profile,
  hasCustomProfile = true,
  streakDays,
  authUser,
  cloudSyncStatus,
  onOpenAuth,
  onSignOut,
  onResendVerification,
  onCheckVerification,
  onUpdateProfile,
  onOpenGuide,
  onResetAllData,
  isAdmin = false,
  staffRole = null,
  onOpenAdmin,
}: ProfileScreenProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(!hasCustomProfile);

  const [name, setName] = useState(hasCustomProfile ? profile.name : '');
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [ageInput, setAgeInput] = useState(String(profile.age));
  const [heightInput, setHeightInput] = useState(
    hasCustomProfile ? String(profile.heightCm) : ''
  );
  const [weightInput, setWeightInput] = useState(
    hasCustomProfile ? String(profile.weightKg) : ''
  );
  const [goal, setGoal] = useState<UserGoal>(profile.goal);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile.activityLevel
  );
  const [dietaryTags, setDietaryTags] = useState<string[]>(profile.dietaryTags);
  const [dietaryNote, setDietaryNote] = useState(profile.dietaryNote);
  const [dislikedFoods, setDislikedFoods] = useState(profile.dislikedFoods ?? '');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | undefined>(
    profile.budgetLevel
  );
  const [cookingTime, setCookingTime] = useState<CookingTime | undefined>(
    profile.cookingTime
  );
  const [cookingSkill, setCookingSkill] = useState<CookingSkill | undefined>(
    profile.cookingSkill
  );
  const [kitchenTools, setKitchenTools] = useState<string[]>(
    profile.kitchenTools ?? []
  );
  const [healthConditions, setHealthConditions] = useState<string[]>(
    profile.healthConditions ?? []
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    setName(hasCustomProfile ? profile.name : '');
    setGender(profile.gender);
    setAgeInput(String(profile.age));
    setHeightInput(hasCustomProfile ? String(profile.heightCm) : '');
    setWeightInput(hasCustomProfile ? String(profile.weightKg) : '');
    setGoal(profile.goal);
    setActivityLevel(profile.activityLevel);
    setDietaryTags(profile.dietaryTags);
    setDietaryNote(profile.dietaryNote);
    setDislikedFoods(profile.dislikedFoods ?? '');
    setBudgetLevel(profile.budgetLevel);
    setCookingTime(profile.cookingTime);
    setCookingSkill(profile.cookingSkill);
    setKitchenTools(profile.kitchenTools ?? []);
    setHealthConditions(profile.healthConditions ?? []);
    if (hasCustomProfile) {
      setIsEditorOpen(false);
    }
  }, [hasCustomProfile, profile]);

  const missingFields = useMemo(
    () =>
      getMissingProfileFields({
        name: isEditorOpen ? name : hasCustomProfile ? profile.name : '',
        age: isEditorOpen ? Number(ageInput) : profile.age,
        heightCm: isEditorOpen ? Number(heightInput) : hasCustomProfile ? profile.heightCm : 0,
        weightKg: isEditorOpen ? Number(weightInput) : hasCustomProfile ? profile.weightKg : 0,
        budgetLevel: isEditorOpen ? budgetLevel : profile.budgetLevel,
        cookingTime: isEditorOpen ? cookingTime : profile.cookingTime,
        cookingSkill: isEditorOpen ? cookingSkill : profile.cookingSkill,
        kitchenTools: isEditorOpen ? kitchenTools : profile.kitchenTools,
        dietaryTags: isEditorOpen ? dietaryTags : profile.dietaryTags,
      }),
    [
      isEditorOpen,
      hasCustomProfile,
      name,
      ageInput,
      heightInput,
      weightInput,
      budgetLevel,
      cookingTime,
      cookingSkill,
      kitchenTools,
      dietaryTags,
      profile,
    ]
  );

  const missingKeys = new Set(missingFields.map((m) => m.key));

  const toggleItem = (
    list: string[],
    setList: (next: string[]) => void,
    item: string
  ) => {
    setList(
      list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    );
  };

  const handleRecalculate = () => {
    const cleanName = name.trim();
    const a = Number(ageInput);
    const h = Number(heightInput);
    const w = Number(weightInput);
    if (!cleanName) {
      setEditorError('Vui lòng nhập tên gọi của bạn nhé.');
      return;
    }
    if (!Number.isFinite(a) || a < 14 || a > 90) {
      setEditorError('Vui lòng nhập tuổi hợp lệ từ 14 đến 90.');
      return;
    }
    if (!Number.isFinite(h) || h < 120 || h > 220) {
      setEditorError('Vui lòng nhập chiều cao hợp lệ từ 120 đến 220 cm.');
      return;
    }
    if (!Number.isFinite(w) || w < 30 || w > 200) {
      setEditorError('Vui lòng nhập cân nặng hợp lệ từ 30 đến 200 kg.');
      return;
    }

    setEditorError(null);
    const updated = buildUserProfile(
      {
        name: cleanName,
        gender,
        age: a,
        heightCm: h,
        weightKg: w,
        goal,
        activityLevel,
        dietaryTags,
        dietaryNote,
        dislikedFoods,
        budgetLevel: budgetLevel ?? 'balanced',
        cookingTime: cookingTime ?? 'under_15',
        cookingSkill: cookingSkill ?? 'basic',
        kitchenTools,
        healthConditions,
        suggestionFeedback: profile.suggestionFeedback,
      },
      profile.createdAt
    );

    onUpdateProfile(updated);
    setBudgetLevel(updated.budgetLevel);
    setCookingTime(updated.cookingTime);
    setCookingSkill(updated.cookingSkill);
    setIsEditorOpen(false);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2600);
  };

  const feedback = profile.suggestionFeedback ?? {
    liked: [],
    disliked: [],
    tried: [],
  };
  const hasFeedback =
    feedback.liked.length > 0 ||
    feedback.disliked.length > 0 ||
    feedback.tried.length > 0;

  const collapsedPreviewText = useMemo(() => {
    const genderLabel = profile.gender === 'female' ? 'Nữ' : 'Nam';
    const base = `${genderLabel} · ${profile.heightCm}cm · ${profile.weightKg}kg`;
    const conditions = profile.healthConditions ?? [];
    const healthLabel =
      conditions.length === 0
        ? 'Bình thường'
        : conditions.length === 1
        ? conditions[0]
        : '';
    if (healthLabel && healthLabel.length <= 13) {
      return `${base} · ${healthLabel}`;
    }
    return base;
  }, [profile.gender, profile.heightCm, profile.weightKg, profile.healthConditions]);

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[105px] md:pb-[48px]">
      <header className="mb-[14px] md:mb-[18px]">
        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#9E8E78] m-0">
          CÁ NHÂN HÓA TOÀN DIỆN
        </p>
        <h1 className="text-[22px] md:text-[24px] font-extrabold text-[#2D2416] m-0 mt-[2px]">
          Hồ sơ của {profile.name}
        </h1>
      </header>

      <div className="md:grid md:grid-cols-12 md:gap-[20px] md:items-start">
        <div className="md:col-span-5 flex flex-col gap-[12px]">
      {/* Account & Cloud Firestore Sync Card */}
      <section
        data-testid="profile-auth-card"
        className="neo-card p-[15px]"
      >
        {!authUser ? (
          <div className="flex items-center gap-[12px]">
            <img
              src="/assets/mascot.png"
              alt="Linh vật Mầm 2D"
              className="w-[54px] h-[54px] object-contain shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-[6px]">
                <span className="text-[13px] font-extrabold text-[#2D2416]">
                  Tài khoản & Đồng bộ
                </span>
                <span className="rounded-full px-[8px] py-[2px] text-[10px] font-extrabold bg-[#FFEEDD] text-[#CC5F1A]">
                  Chưa đăng nhập
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[4px] leading-snug">
                Đăng nhập hoặc tự đăng ký để sao lưu hồ sơ, bữa ăn lên Cloud Firestore.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full mt-[10px] py-[10px] rounded-[12px] bg-[#FF8A3D] text-white text-[13px] font-extrabold neo-cta cursor-pointer"
              >
                Đăng nhập / Đăng ký ngay
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-[8px]">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.05em] text-[#9E8E78] m-0 uppercase">
                  TÀI KHOẢN ĐÃ KẾT NỐI
                </p>
                <p className="text-[14px] font-extrabold text-[#2D2416] m-0 mt-[2px] truncate">
                  {authUser.email || authUser.displayName || 'Thành viên BữaNay'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-[9px] py-[3px] text-[10px] font-extrabold ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-[#D4F7EE] text-[#037A5B]'
                    : cloudSyncStatus === 'unverified'
                    ? 'bg-[#FFF3CC] text-[#9E6B00]'
                    : 'bg-[#E6F7FF] text-[#0284C7]'
                }`}
              >
                {cloudSyncStatus === 'synced'
                  ? 'Đã đồng bộ Firestore ✓'
                  : cloudSyncStatus === 'unverified'
                  ? 'Chờ xác minh email'
                  : 'Đang đồng bộ...'}
              </span>
            </div>

            {cloudSyncStatus === 'unverified' && (
              <div className="mt-[10px] rounded-[12px] bg-[#FFF9ED] border border-[#FF8A3D]/40 p-[10px]">
                <p className="text-[11px] font-semibold text-[#6B5D47] m-0 leading-snug">
                  Vui lòng mở email xác minh vừa gửi tới <strong>{authUser.email}</strong> để kích hoạt đồng bộ Cloud Firestore.
                </p>
                <div className="flex items-center gap-[6px] mt-[8px]">
                  <button
                    type="button"
                    onClick={onCheckVerification}
                    className="flex-1 py-[7px] rounded-[10px] bg-[#06D6A0] text-[#024E3B] text-[11px] font-extrabold cursor-pointer"
                  >
                    Tôi đã xác minh
                  </button>
                  <button
                    type="button"
                    onClick={onResendVerification}
                    className="flex-1 py-[7px] rounded-[10px] bg-[#FFFDF5] border border-[#DDD0B0] text-[#6B5D47] text-[11px] font-bold cursor-pointer"
                  >
                    Gửi lại email
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="w-full mt-[10px] py-[9px] rounded-[12px] bg-[#F2EBD8] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-extrabold text-[#6B5D47] hover:text-[#CC5F1A] cursor-pointer transition-colors"
            >
              Đăng xuất tài khoản
            </button>
          </div>
        )}
      </section>

      {/* Profile Identity & BMI Card */}
      <section className="neo-card p-[15px] flex items-center gap-[14px]">
        <MamMascot3D size={56} />
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold text-[#2D2416] m-0">
            {hasCustomProfile ? profile.name : 'Chưa thiết lập chỉ số'}
          </h2>
          {hasCustomProfile ? (
            <>
              <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[2px]">
                {profile.gender === 'female' ? 'Nữ' : 'Nam'} · {profile.age} tuổi · BMI{' '}
                <strong className="text-[#2D2416]">{profile.bmi}</strong> ({profile.bmiCategory})
              </p>
              <p className="text-[11px] font-semibold text-[#9E8E78] m-0 mt-[2px]">
                {getGoalLabel(profile.goal)} · {getActivityLabel(profile.activityLevel)} · {streakDays} ngày streak
              </p>
            </>
          ) : (
            <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[3px] leading-snug">
              Đang dùng mức tham khảo 1.760 kcal/ngày. Điền chiều cao, cân nặng và mục tiêu bên cạnh để cá nhân hóa cho riêng bạn.
            </p>
          )}
        </div>
      </section>

        </div>

        <div className="md:col-span-7 flex flex-col gap-[12px] mt-[12px] md:mt-0">
      {/* Collapsible Compact Profile Editor */}
      <section className="neo-card p-[14px]">
        <button
          type="button"
          onClick={() => setIsEditorOpen((prev) => !prev)}
          aria-expanded={isEditorOpen}
          className="w-full flex items-center justify-between gap-[10px] text-left cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-[#2D2416] m-0">
              {hasCustomProfile ? 'Chỉnh sửa hồ sơ & chỉ số' : 'Điền hồ sơ & chỉ số cá nhân'}
            </p>
            <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[2px] whitespace-nowrap">
              {hasCustomProfile
                ? collapsedPreviewText
                : 'Chưa nhập tên, chiều cao & cân nặng'}
            </p>
          </div>

          <div className="flex items-center gap-[6px] shrink-0">
            {missingFields.length > 0 && (
              <span
                title={`Còn thiếu ${missingFields.length} mục: ${missingFields
                  .map((f) => f.label)
                  .join(', ')}`}
                aria-label={`Còn thiếu ${missingFields.length} mục`}
                className="min-w-[20px] h-[20px] px-[6px] rounded-full bg-[#E53935] text-white text-[11px] font-extrabold inline-flex items-center justify-center tabular-nums shadow-sm"
              >
                {missingFields.length}
              </span>
            )}
            <span className="px-[10px] py-[5px] rounded-full bg-[#FFF9ED] border border-[#DDD0B0] text-[11px] font-bold text-[#CC5F1A]">
              {isEditorOpen ? 'Thu gọn ▴' : 'Chỉnh sửa ▾'}
            </span>
          </div>
        </button>

        {savedNotice && !isEditorOpen && (
          <p className="text-[12px] font-bold text-[#037A5B] m-0 mt-[8px] flex items-center gap-[5px]">
            <CheckIcon size={15} />
            <span>
              Đã lưu hồ sơ: {formatViNumber(profile.targetCalories)} kcal · BMI{' '}
              {profile.bmi}
            </span>
          </p>
        )}

        {isEditorOpen && (
          <div className="mt-[12px] pt-[12px] border-t border-[#EDE5CC] flex flex-col gap-[10px]">
            {missingFields.length > 0 && (
              <div className="rounded-[10px] bg-[#FFE8E8] border border-[#E53935]/40 px-[10px] py-[7px] text-[11px] font-semibold text-[#B91C1C]">
                Còn thiếu {missingFields.length} mục:{' '}
                {missingFields.map((m) => m.label).join(', ')}
              </div>
            )}

            <div className="grid grid-cols-3 gap-[8px]">
              <div className="col-span-2">
                <label
                  htmlFor="profile-name"
                  className="flex items-center gap-[4px] text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  <span>Tên gọi</span>
                  {missingKeys.has('name') && (
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                  )}
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-age"
                  className="flex items-center gap-[4px] text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  <span>Tuổi</span>
                  {missingKeys.has('body') && (
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                  )}
                </label>
                <input
                  id="profile-age"
                  type="number"
                  min={14}
                  max={90}
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-[8px]">
              <div>
                <label
                  htmlFor="profile-gender"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Giới tính
                </label>
                <select
                  id="profile-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full px-[8px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
                >
                  <option value="female">Nữ</option>
                  <option value="male">Nam</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="profile-height"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Cao (cm)
                </label>
                <input
                  id="profile-height"
                  type="number"
                  min={120}
                  max={220}
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-weight"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Nặng (kg)
                </label>
                <input
                  id="profile-weight"
                  type="number"
                  step="0.5"
                  min={30}
                  max={200}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[8px]">
              <div>
                <label
                  htmlFor="profile-goal"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Mục tiêu
                </label>
                <select
                  id="profile-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as UserGoal)}
                  className="w-full px-[9px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416]"
                >
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="profile-activity"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Vận động
                </label>
                <select
                  id="profile-activity"
                  value={activityLevel}
                  onChange={(e) =>
                    setActivityLevel(e.target.value as ActivityLevel)
                  }
                  className="w-full px-[9px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416]"
                >
                  {ACTIVITY_OPTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget & Cooking Conditions */}
            <div className="grid grid-cols-3 gap-[6px]">
              <div>
                <label
                  htmlFor="profile-budget"
                  className="flex items-center gap-[4px] text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  <span>Ngân sách</span>
                  {missingKeys.has('budget') && (
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                  )}
                </label>
                <select
                  id="profile-budget"
                  value={budgetLevel ?? ''}
                  onChange={(e) =>
                    setBudgetLevel(
                      e.target.value ? (e.target.value as BudgetLevel) : undefined
                    )
                  }
                  className="w-full px-[7px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[11px] font-bold text-[#2D2416]"
                >
                  {!budgetLevel && <option value="">Chọn...</option>}
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="profile-cook-time"
                  className="flex items-center gap-[4px] text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  <span>Thời gian nấu</span>
                  {missingKeys.has('cooking') && (
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                  )}
                </label>
                <select
                  id="profile-cook-time"
                  value={cookingTime ?? ''}
                  onChange={(e) =>
                    setCookingTime(
                      e.target.value ? (e.target.value as CookingTime) : undefined
                    )
                  }
                  className="w-full px-[7px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[11px] font-bold text-[#2D2416]"
                >
                  {!cookingTime && <option value="">Chọn...</option>}
                  {COOKING_TIME_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="profile-cook-skill"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Trình độ nấu
                </label>
                <select
                  id="profile-cook-skill"
                  value={cookingSkill ?? ''}
                  onChange={(e) =>
                    setCookingSkill(
                      e.target.value ? (e.target.value as CookingSkill) : undefined
                    )
                  }
                  className="w-full px-[7px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[11px] font-bold text-[#2D2416]"
                >
                  {!cookingSkill && <option value="">Chọn...</option>}
                  {COOKING_SKILL_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kitchen tools */}
            <div>
              <span className="flex items-center gap-[5px] text-[11px] font-bold text-[#6B5D47] mb-[4px]">
                <span>Dụng cụ bếp sẵn có</span>
                {missingKeys.has('tools') && (
                  <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                )}
              </span>
              <div className="flex flex-wrap gap-[4px]">
                {KITCHEN_TOOL_OPTIONS.map((tool) => {
                  const active = kitchenTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() =>
                        toggleItem(kitchenTools, setKitchenTools, tool)
                      }
                      className={`px-[8px] py-[3.5px] rounded-full text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                          : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                      }`}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dietary preferences & Health */}
            <div>
              <span className="flex items-center gap-[5px] text-[11px] font-bold text-[#6B5D47] mb-[4px]">
                <span>Khẩu vị & thói quen</span>
                {missingKeys.has('dietary') && (
                  <span className="w-[6px] h-[6px] rounded-full bg-[#E53935]" />
                )}
              </span>
              <div className="flex flex-wrap gap-[4px]">
                {DIETARY_TAG_OPTIONS.map((tag) => {
                  const active = dietaryTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleItem(dietaryTags, setDietaryTags, tag)}
                      className={`px-[8px] py-[3.5px] rounded-full text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                          : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]">
                Tình trạng sức khỏe
              </span>
              <div className="flex flex-wrap gap-[4px]">
                {HEALTH_CONDITION_OPTIONS.map((cond) => {
                  const active =
                    cond === 'Bình thường'
                      ? healthConditions.length === 0
                      : healthConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => {
                        if (cond === 'Bình thường') {
                          setHealthConditions([]);
                        } else {
                          toggleItem(
                            healthConditions,
                            setHealthConditions,
                            cond
                          );
                        }
                      }}
                      className={`px-[8px] py-[3.5px] rounded-full text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                          : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[6px]">
              <input
                type="text"
                aria-label="Dị ứng cần tránh"
                value={dietaryNote}
                onChange={(e) => setDietaryNote(e.target.value)}
                placeholder="Dị ứng (nếu có)..."
                className="w-full px-[9px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416]"
              />
              <input
                type="text"
                aria-label="Món không thích ăn"
                value={dislikedFoods}
                onChange={(e) => setDislikedFoods(e.target.value)}
                placeholder="Món không thích..."
                className="w-full px-[9px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416]"
              />
            </div>

            {editorError && (
              <p
                role="alert"
                className="text-[12px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[10px] px-[10px] py-[7px] m-0"
              >
                {editorError}
              </p>
            )}

            <button
              type="button"
              onClick={handleRecalculate}
              className="w-full py-[11px] rounded-[14px] bg-[#FF8A3D] text-white text-[13px] font-bold neo-cta cursor-pointer"
            >
              Lưu hồ sơ & tính lại KPI
            </button>
          </div>
        )}
      </section>

      {/* Daily Nutrition Targets */}
      <section className="neo-card p-[16px]">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0">
            Chỉ tiêu cá nhân mỗi ngày
          </h2>
          <span className="text-[11px] font-bold text-[#9E8E78] tabular-nums">
            TDEE {formatViNumber(profile.tdee)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-[8px] text-[13px]">
          <div className="rounded-[12px] p-[10px] bg-[#FFE8E8] border border-[#FF6B6B]/25">
            <span className="font-semibold text-[#6B5D47]">Đạm:</span>{' '}
            <strong className="text-[#FF6B6B] tabular-nums">
              {profile.targets.protein}g
            </strong>
          </div>
          <div className="rounded-[12px] p-[10px] bg-[#FFF3CC] border border-[#E8A500]/25">
            <span className="font-semibold text-[#6B5D47]">Tinh bột:</span>{' '}
            <strong className="text-[#E8A500] tabular-nums">
              {profile.targets.carbs}g
            </strong>
          </div>
          <div className="rounded-[12px] p-[10px] bg-[#D4F4F2] border border-[#2EC4B6]/25">
            <span className="font-semibold text-[#6B5D47]">Chất xơ:</span>{' '}
            <strong className="text-[#2EC4B6] tabular-nums">
              {profile.targets.fiber}g
            </strong>
          </div>
          <div className="rounded-[12px] p-[10px] bg-[#EDE6FF] border border-[#9D7BFF]/25">
            <span className="font-semibold text-[#6B5D47]">Chất béo:</span>{' '}
            <strong className="text-[#9D7BFF] tabular-nums">
              {profile.targets.fat}g
            </strong>
          </div>
        </div>
        <p className="text-[12px] font-semibold text-[#0284C7] m-0 mt-[10px]">
          Nước uống khuyến nghị: {formatWaterLiters(profile.waterTargetCups)}L /
          ngày
        </p>
      </section>

      {/* AI Personalization Memory (Suggestion Feedback) */}
      {hasFeedback && (
        <section className="neo-card p-[16px]">
          <div className="flex items-center justify-between mb-[8px]">
            <h2 className="text-[14px] font-extrabold text-[#2D2416] m-0">
              AI đã ghi nhớ gu ăn uống của bạn
            </h2>
            <button
              type="button"
              onClick={() =>
                onUpdateProfile({
                  ...profile,
                  suggestionFeedback: { liked: [], disliked: [], tried: [] },
                })
              }
              className="text-[11px] font-bold text-[#CC5F1A] cursor-pointer"
            >
              Đặt lại
            </button>
          </div>
          {feedback.liked.length > 0 && (
            <p className="text-[11px] font-medium text-[#037A5B] m-0">
              <strong>Thích:</strong> {feedback.liked.slice(0, 5).join(', ')}
            </p>
          )}
          {feedback.disliked.length > 0 && (
            <p className="text-[11px] font-medium text-[#C94A4A] m-0 mt-[4px]">
              <strong>Tránh gợi ý:</strong>{' '}
              {feedback.disliked.slice(0, 5).join(', ')}
            </p>
          )}
          {feedback.tried.length > 0 && (
            <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[4px]">
              <strong>Đã thử:</strong> {feedback.tried.slice(0, 5).join(', ')}
            </p>
          )}
        </section>
      )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px] md:gap-[14px] mt-[12px] md:mt-[18px]">
        <button
          type="button"
          onClick={onOpenGuide}
          className="w-full py-[12px] px-[14px] rounded-[14px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] text-[13px] font-extrabold text-[#2D2416] hover:border-[#FF8A3D] cursor-pointer flex items-center justify-between transition-colors"
          style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
        >
          <span className="flex items-center gap-[8px]">
            <span className="text-[#CC5F1A] inline-flex">
              <BookOpenIcon size={17} />
            </span>
            <span>Hướng dẫn sử dụng & Cẩm nang các bữa</span>
          </span>
          <span className="text-[#CC5F1A] shrink-0 whitespace-nowrap">Mở →</span>
        </button>

        <button
          type="button"
          onClick={onResetAllData}
          className="w-full py-[12px] px-[14px] rounded-[14px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] text-[13px] font-bold text-[#6B5D47] hover:border-[#FF6B6B] hover:text-[#C94A4A] cursor-pointer transition-colors"
        >
          Xóa toàn bộ dữ liệu & thiết lập lại từ đầu
        </button>
      </div>

      {isAdmin && onOpenAdmin && (
        <div className="mt-[10px]">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="w-full py-[12px] px-[16px] rounded-[14px] bg-[#FFEEDD] border-[1.5px] border-[#FF8A3D] text-[#CC5F1A] text-[13px] font-extrabold cursor-pointer flex items-center justify-between hover:bg-[#FFE3C7] transition-colors"
            style={{ boxShadow: '0 2px 0 #CC5F1A' }}
          >
            <span>
              Mở Bảng điều khiển {staffRole === 'moderator' ? 'Kiểm duyệt viên' : 'Quản trị viên'} (/admin)
            </span>
            <span className="shrink-0 whitespace-nowrap">Truy cập →</span>
          </button>
        </div>
      )}

      {/* Compact 2-side, 2-line Legal Footer */}
      <footer className="mt-[14px] pt-[12px] border-t border-[#E5DEC9] text-center">
        <div className="flex items-center justify-between md:justify-center md:gap-[24px] gap-[12px] px-[6px]">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              setLegalDoc('privacy');
            }}
            className="text-[11px] font-bold text-[#6B5D47] hover:text-[#CC5F1A] underline underline-offset-2"
          >
            Chính sách bảo mật
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              setLegalDoc('terms');
            }}
            className="text-[11px] font-bold text-[#6B5D47] hover:text-[#CC5F1A] underline underline-offset-2"
          >
            Điều khoản sử dụng
          </a>
        </div>
        <p className="text-[10px] font-semibold text-[#9E8E78] m-0 mt-[4px]">
          BữaNay · Minh bạch & bảo vệ dữ liệu dinh dưỡng cá nhân
        </p>
      </footer>

      {legalDoc && (
        <LegalModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
      )}
    </div>
  );
}
