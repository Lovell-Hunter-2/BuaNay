import { useMemo, useState, type FormEvent } from 'react';
import type {
  ActivityLevel,
  BudgetLevel,
  CookingSkill,
  CookingTime,
  Gender,
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
  calculateBMI,
  formatViNumber,
  formatWaterLiters,
  getBMICategory,
} from '../utils/nutrition';
import { CheckIcon } from './Icons';

interface OnboardingScreenProps {
  initialProfile?: UserProfile | null;
  authEmail?: string | null;
  onOpenAuth?: () => void;
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingScreen({
  initialProfile,
  authEmail,
  onOpenAuth,
  onComplete,
}: OnboardingScreenProps) {
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [gender, setGender] = useState<Gender>(initialProfile?.gender ?? 'female');
  const [ageInput, setAgeInput] = useState(
    initialProfile ? String(initialProfile.age) : '24'
  );
  const [heightInput, setHeightInput] = useState(
    initialProfile ? String(initialProfile.heightCm) : ''
  );
  const [weightInput, setWeightInput] = useState(
    initialProfile ? String(initialProfile.weightKg) : ''
  );
  const [goal, setGoal] = useState<UserGoal>(initialProfile?.goal ?? 'maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    initialProfile?.activityLevel ?? 'light'
  );
  const [dietaryTags, setDietaryTags] = useState<string[]>(
    initialProfile?.dietaryTags ?? []
  );
  const [dietaryNote, setDietaryNote] = useState(
    initialProfile?.dietaryNote ?? ''
  );
  const [dislikedFoods, setDislikedFoods] = useState(
    initialProfile?.dislikedFoods ?? ''
  );
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>(
    initialProfile?.budgetLevel ?? 'balanced'
  );
  const [cookingTime, setCookingTime] = useState<CookingTime>(
    initialProfile?.cookingTime ?? 'under_15'
  );
  const [cookingSkill, setCookingSkill] = useState<CookingSkill>(
    initialProfile?.cookingSkill ?? 'basic'
  );
  const [kitchenTools, setKitchenTools] = useState<string[]>(
    initialProfile?.kitchenTools ?? ['Bếp gas / bếp từ']
  );
  const [healthConditions, setHealthConditions] = useState<string[]>(
    initialProfile?.healthConditions ?? []
  );
  const [formError, setFormError] = useState<string | null>(null);

  const ageNum = Number(ageInput);
  const heightNum = Number(heightInput);
  const weightNum = Number(weightInput);

  const hasValidBodyStats =
    Number.isFinite(ageNum) &&
    ageNum >= 14 &&
    ageNum <= 90 &&
    Number.isFinite(heightNum) &&
    heightNum >= 120 &&
    heightNum <= 220 &&
    Number.isFinite(weightNum) &&
    weightNum >= 30 &&
    weightNum <= 200;

  const liveBMI = useMemo(() => {
    if (!Number.isFinite(heightNum) || !Number.isFinite(weightNum)) return 0;
    if (heightNum < 120 || heightNum > 220 || weightNum < 30 || weightNum > 200) {
      return 0;
    }
    return calculateBMI(weightNum, heightNum);
  }, [heightNum, weightNum]);

  const bmiCategory = useMemo(() => getBMICategory(liveBMI), [liveBMI]);

  const livePreviewProfile = useMemo(() => {
    if (!hasValidBodyStats) return null;
    return buildUserProfile({
      name: name || 'Bạn',
      gender,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      goal,
      activityLevel,
      dietaryTags,
      dietaryNote,
    });
  }, [
    hasValidBodyStats,
    name,
    gender,
    ageNum,
    heightNum,
    weightNum,
    goal,
    activityLevel,
    dietaryTags,
    dietaryNote,
  ]);

  const toggleTag = (tag: string) => {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleKitchenTool = (tool: string) => {
    setKitchenTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleHealth = (cond: string) => {
    if (cond === 'Bình thường') {
      setHealthConditions([]);
      return;
    }
    setHealthConditions((prev) =>
      prev.includes(cond) ? prev.filter((h) => h !== cond) : [...prev, cond]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Vui lòng nhập tên gọi của bạn để BữaNay xưng hô thân thiện nhé.');
      return;
    }
    if (!hasValidBodyStats) {
      setFormError(
        'Vui lòng nhập tuổi (14–90), chiều cao (120–220 cm) và cân nặng (30–200 kg) hợp lệ.'
      );
      return;
    }

    setFormError(null);
    const built = buildUserProfile({
      name,
      gender,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      goal,
      activityLevel,
      dietaryTags,
      dietaryNote,
      dislikedFoods,
      budgetLevel,
      cookingTime,
      cookingSkill,
      kitchenTools,
      healthConditions,
    });
    onComplete(built);
  };

  const bmiToneBadge =
    bmiCategory.tone === 'normal'
      ? 'bg-[#D4F7EE] text-[#037A5B]'
      : bmiCategory.tone === 'under'
      ? 'bg-[#FFF3CC] text-[#9E6B00]'
      : 'bg-[#FFEEDD] text-[#CC5F1A]';

  return (
    <div className="min-h-dvh w-full bg-[#F7F2E3] flex justify-center">
      <div className="w-full max-w-[390px] md:max-w-[1040px] px-[20px] md:px-[28px] pt-[24px] md:pt-[32px] pb-[44px] animate-screen-fade">
        <header className="mb-[18px] md:mb-[22px]">
          <div className="flex items-center justify-between gap-[12px]">
            <p className="text-[11px] font-bold tracking-[0.06em] text-[#9E8E78] m-0">
              CÁ NHÂN HÓA DINH DƯỠNG
            </p>
            {onOpenAuth && !authEmail && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-[10px] md:px-[14px] py-[4px] md:py-[7px] rounded-full md:rounded-[12px] bg-[#FFFDF5] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[11px] md:text-[12px] font-extrabold text-[#CC5F1A] cursor-pointer whitespace-nowrap shrink-0"
              >
                Đăng nhập / Đăng ký
              </button>
            )}
          </div>
          <h1 className="text-[24px] md:text-[28px] font-extrabold text-[#2D2416] m-0 mt-[4px] leading-tight">
            Chào bạn đến với BữaNay
          </h1>
          <p className="text-[13px] md:text-[14px] font-medium text-[#6B5D47] m-0 mt-[6px] leading-relaxed md:max-w-[66ch]">
            Điền chỉ số cơ thể và mục tiêu thật của bạn để app tính BMI, lượng calo, chất dinh dưỡng và gợi ý món ăn phù hợp nhất.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-[14px] md:grid md:grid-cols-12 md:gap-[20px] md:items-start"
        >
          <div className="md:col-span-6 flex flex-col gap-[14px]">
          {/* Basic Identity */}
          <section className="neo-card p-[16px] flex flex-col gap-[12px]">
            <div>
              <label
                htmlFor="ob-name"
                className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[6px]"
              >
                TÊN CỦA BẠN
              </label>
              <input
                id="ob-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                placeholder="Ví dụ: Ánh, Minh, Thảo..."
                className="w-full px-[12px] py-[10px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[14px] font-semibold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
              />
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <span className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[6px]">
                  GIỚI TÍNH
                </span>
                <div className="grid grid-cols-2 gap-[6px]">
                  {[
                    { id: 'female' as const, label: 'Nữ' },
                    { id: 'male' as const, label: 'Nam' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      aria-pressed={gender === g.id}
                      className={`py-[9px] rounded-[12px] text-[13px] border-[1.5px] cursor-pointer transition-colors ${
                        gender === g.id
                          ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                          : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="ob-age"
                  className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[6px]"
                >
                  TUỔI
                </label>
                <input
                  id="ob-age"
                  type="number"
                  min={14}
                  max={90}
                  value={ageInput}
                  onChange={(e) => {
                    setAgeInput(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="24"
                  className="w-full px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[14px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label
                  htmlFor="ob-height"
                  className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[6px]"
                >
                  CHIỀU CAO (CM)
                </label>
                <input
                  id="ob-height"
                  type="number"
                  min={120}
                  max={220}
                  value={heightInput}
                  onChange={(e) => {
                    setHeightInput(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ví dụ: 162"
                  className="w-full px-[12px] py-[10px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[14px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>

              <div>
                <label
                  htmlFor="ob-weight"
                  className="block text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] mb-[6px]"
                >
                  CÂN NẶNG (KG)
                </label>
                <input
                  id="ob-weight"
                  type="number"
                  step="0.5"
                  min={30}
                  max={200}
                  value={weightInput}
                  onChange={(e) => {
                    setWeightInput(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ví dụ: 55"
                  className="w-full px-[12px] py-[10px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[14px] font-bold text-[#2D2416] tabular-nums focus:outline-none focus:border-[#FF8A3D]"
                />
              </div>
            </div>

            {/* Instant Live BMI */}
            {liveBMI > 0 && (
              <div
                data-testid="live-bmi-card"
                className="rounded-[14px] p-[12px] bg-[#FFF9ED] border-[1.5px] border-[#DDD0B0]"
              >
                <div className="flex items-center justify-between gap-[8px]">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.05em] text-[#9E8E78] m-0">
                      CHỈ SỐ BMI CỦA BẠN
                    </p>
                    <p className="text-[24px] font-extrabold text-[#2D2416] m-0 mt-[2px] tabular-nums leading-none">
                      {liveBMI.toFixed(1)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-[11px] py-[4px] text-[11px] font-bold ${bmiToneBadge}`}
                  >
                    {bmiCategory.label}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[6px] leading-snug">
                  {bmiCategory.advice}
                </p>
              </div>
            )}
          </section>

          {/* Goal Selection */}
          <section className="neo-card p-[16px]">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[10px]">
              MỤC TIÊU CỦA BẠN
            </p>
            <div className="flex flex-col gap-[8px]">
              {GOAL_OPTIONS.map((item) => {
                const active = goal === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGoal(item.id)}
                    aria-pressed={active}
                    className={`w-full text-left rounded-[14px] p-[11px] border-[1.5px] cursor-pointer transition-all ${
                      active
                        ? 'bg-[#FFEEDD] border-[#FF8A3D]'
                        : 'bg-[#FFFDF5] border-[#DDD0B0] hover:border-[#C5B890]'
                    }`}
                  >
                    <p
                      className={`text-[13px] font-extrabold m-0 ${
                        active ? 'text-[#CC5F1A]' : 'text-[#2D2416]'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[2px]">
                      {item.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Activity Level */}
          <section className="neo-card p-[16px]">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[10px]">
              MỨC ĐỘ VẬN ĐỘNG HẰNG NGÀY
            </p>
            <div className="grid grid-cols-2 gap-[8px]">
              {ACTIVITY_OPTIONS.map((act) => {
                const active = activityLevel === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityLevel(act.id)}
                    aria-pressed={active}
                    className={`text-left rounded-[12px] p-[10px] border-[1.5px] cursor-pointer transition-all ${
                      active
                        ? 'bg-[#D4F7EE] border-[#06D6A0]'
                        : 'bg-[#FFFDF5] border-[#DDD0B0] hover:border-[#C5B890]'
                    }`}
                  >
                    <p
                      className={`text-[12px] font-extrabold m-0 ${
                        active ? 'text-[#037A5B]' : 'text-[#2D2416]'
                      }`}
                    >
                      {act.label}
                    </p>
                    <p className="text-[10px] font-medium text-[#6B5D47] m-0 mt-[2px] leading-snug">
                      {act.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
          </div>

          <div className="md:col-span-6 flex flex-col gap-[14px]">
          {/* Dietary Preferences for Personalized Menus */}
          <section className="neo-card p-[16px]">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
              THÓI QUEN & KHẨU VỊ (ĐỂ GỢI Ý MÓN CHUẨN NHẤT)
            </p>
            <div className="flex flex-wrap gap-[6px]">
              {DIETARY_TAG_OPTIONS.map((tag) => {
                const selected = dietaryTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={selected}
                    className={`px-[11px] py-[6px] rounded-full text-[11px] border-[1.5px] cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                        : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <label htmlFor="ob-diet-note" className="sr-only">
              Ghi chú dị ứng thực phẩm
            </label>
            <input
              id="ob-diet-note"
              type="text"
              value={dietaryNote}
              onChange={(e) => setDietaryNote(e.target.value)}
              placeholder="Dị ứng cần tránh (vd: đậu phộng, sữa bò, hải sản...)"
              className="w-full mt-[10px] px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416] placeholder:text-[#9E8E78] focus:outline-none focus:border-[#FF8A3D]"
            />

            <label htmlFor="ob-disliked" className="sr-only">
              Thực phẩm không thích
            </label>
            <input
              id="ob-disliked"
              type="text"
              value={dislikedFoods}
              onChange={(e) => setDislikedFoods(e.target.value)}
              placeholder="Món không thích ăn (vd: hành lá, mướp đắng, nội tạng...)"
              className="w-full mt-[8px] px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416] placeholder:text-[#9E8E78] focus:outline-none focus:border-[#FF8A3D]"
            />
          </section>

          {/* Practical Budget, Cooking & Health Conditions */}
          <section className="neo-card p-[16px] flex flex-col gap-[12px]">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0">
              ĐIỀU KIỆN NẤU NƯỚNG, NGÂN SÁCH & SỨC KHỎE
            </p>

            <div>
              <span className="block text-[11px] font-bold text-[#6B5D47] mb-[6px]">
                Ngân sách mỗi bữa
              </span>
              <div className="grid grid-cols-3 gap-[6px]">
                {BUDGET_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetLevel(b.id)}
                    aria-pressed={budgetLevel === b.id}
                    className={`px-[6px] py-[8px] rounded-[10px] text-[11px] border-[1.5px] cursor-pointer text-center leading-tight ${
                      budgetLevel === b.id
                        ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                        : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label
                  htmlFor="ob-cook-time"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Thời gian nấu
                </label>
                <select
                  id="ob-cook-time"
                  value={cookingTime}
                  onChange={(e) => setCookingTime(e.target.value as CookingTime)}
                  className="w-full px-[10px] py-[8px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
                >
                  {COOKING_TIME_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="ob-cook-skill"
                  className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
                >
                  Kỹ năng nấu
                </label>
                <select
                  id="ob-cook-skill"
                  value={cookingSkill}
                  onChange={(e) => setCookingSkill(e.target.value as CookingSkill)}
                  className="w-full px-[10px] py-[8px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
                >
                  {COOKING_SKILL_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-[#6B5D47] mb-[6px]">
                Dụng cụ có sẵn
              </span>
              <div className="flex flex-wrap gap-[6px]">
                {KITCHEN_TOOL_OPTIONS.map((tool) => {
                  const active = kitchenTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleKitchenTool(tool)}
                      aria-pressed={active}
                      className={`px-[10px] py-[5px] rounded-full text-[11px] border-[1.5px] cursor-pointer ${
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

            <div>
              <span className="block text-[11px] font-bold text-[#6B5D47] mb-[6px]">
                Tình trạng sức khỏe cần lưu ý (tùy chọn)
              </span>
              <div className="flex flex-wrap gap-[6px]">
                {HEALTH_CONDITION_OPTIONS.map((cond) => {
                  const active =
                    cond === 'Bình thường'
                      ? healthConditions.length === 0
                      : healthConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleHealth(cond)}
                      aria-pressed={active}
                      className={`px-[10px] py-[5px] rounded-full text-[11px] border-[1.5px] cursor-pointer ${
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
          </section>

          {/* Live Calculated Targets Preview */}
          {livePreviewProfile && (
            <section
              data-testid="live-kpi-preview"
              className="rounded-[20px] p-[16px] border-[1.5px] border-[#06D6A0] bg-[#D4F7EE]/55"
            >
              <p className="text-[10px] font-bold tracking-[0.05em] text-[#037A5B] m-0">
                MỤC TIÊU ĐƯỢC TÍNH RIÊNG CHO BẠN
              </p>
              <div className="flex items-baseline gap-[6px] mt-[4px] tabular-nums">
                <span className="text-[28px] font-extrabold text-[#2D2416] leading-none">
                  {formatViNumber(livePreviewProfile.targetCalories)}
                </span>
                <span className="text-[13px] font-bold text-[#6B5D47]">
                  kcal / ngày (TDEE {formatViNumber(livePreviewProfile.tdee)})
                </span>
              </div>

              <div className="grid grid-cols-5 gap-[6px] mt-[10px] text-center tabular-nums">
                <div className="rounded-[10px] bg-[#FFFDF5] py-[6px] px-[4px] border border-[#DDD0B0]">
                  <p className="text-[13px] font-extrabold text-[#FF6B6B] m-0">
                    {livePreviewProfile.targets.protein}g
                  </p>
                  <p className="text-[9px] font-semibold text-[#6B5D47] m-0">Đạm</p>
                </div>
                <div className="rounded-[10px] bg-[#FFFDF5] py-[6px] px-[4px] border border-[#DDD0B0]">
                  <p className="text-[13px] font-extrabold text-[#E8A500] m-0">
                    {livePreviewProfile.targets.carbs}g
                  </p>
                  <p className="text-[9px] font-semibold text-[#6B5D47] m-0">Tinh bột</p>
                </div>
                <div className="rounded-[10px] bg-[#FFFDF5] py-[6px] px-[4px] border border-[#DDD0B0]">
                  <p className="text-[13px] font-extrabold text-[#2EC4B6] m-0">
                    {livePreviewProfile.targets.fiber}g
                  </p>
                  <p className="text-[9px] font-semibold text-[#6B5D47] m-0">Chất xơ</p>
                </div>
                <div className="rounded-[10px] bg-[#FFFDF5] py-[6px] px-[4px] border border-[#DDD0B0]">
                  <p className="text-[13px] font-extrabold text-[#9D7BFF] m-0">
                    {livePreviewProfile.targets.fat}g
                  </p>
                  <p className="text-[9px] font-semibold text-[#6B5D47] m-0">Béo</p>
                </div>
                <div className="rounded-[10px] bg-[#FFFDF5] py-[6px] px-[4px] border border-[#DDD0B0]">
                  <p className="text-[13px] font-extrabold text-[#0284C7] m-0">
                    {formatWaterLiters(livePreviewProfile.waterTargetCups)}L
                  </p>
                  <p className="text-[9px] font-semibold text-[#6B5D47] m-0">Nước</p>
                </div>
              </div>
            </section>
          )}

          {formError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[12px] px-[12px] py-[9px] m-0"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-[14px] rounded-[20px] bg-[#FF8A3D] text-white text-[16px] font-bold neo-cta cursor-pointer flex items-center justify-center gap-[8px]"
          >
            <CheckIcon size={20} />
            <span>Bắt đầu sử dụng BữaNay</span>
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}
