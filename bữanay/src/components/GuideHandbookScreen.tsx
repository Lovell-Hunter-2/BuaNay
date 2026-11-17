import { useState } from 'react';
import {
  APP_GUIDE_STEPS,
  DINING_OUT_TIPS,
  HANDBOOK_SWAP_PAIRS,
  HAND_PORTION_RULES,
  getHandbookTipsForGoal,
  getMealGuidesBySlotAndGoal,
} from '../data/handbook';
import type { AppTab, MealSlot, UserProfile } from '../types/nutrition';
import { MEAL_SLOTS, getGoalLabel } from '../utils/nutrition';
import { ArrowLeftIcon, BookOpenIcon, SwapIcon, UtensilsIcon } from './Icons';

interface GuideHandbookScreenProps {
  profile: UserProfile;
  defaultSlot: MealSlot;
  onBack: () => void;
  onNavigate: (tab: AppTab) => void;
  onAskAiSwap: (cravingDish: string) => void;
  onAskAiMenu: (slot: MealSlot) => void;
}

type GuideSectionTab = 'guide' | 'meals' | 'swaps';

export function GuideHandbookScreen({
  profile,
  defaultSlot,
  onBack,
  onNavigate,
  onAskAiSwap,
  onAskAiMenu,
}: GuideHandbookScreenProps) {
  const [section, setSection] = useState<GuideSectionTab>('meals');
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>(defaultSlot);
  const [onlyMatchingGoal, setOnlyMatchingGoal] = useState<boolean>(false);
  const [selectedSwapCategory, setSelectedSwapCategory] = useState<string>('Tất cả');

  const goalStrategy = getHandbookTipsForGoal(profile.goal, profile.bmiCategory);
  const slotMeals = getMealGuidesBySlotAndGoal(
    selectedSlot,
    profile.goal,
    onlyMatchingGoal
  );

  const swapCategories = [
    'Tất cả',
    'Đồ uống & Ăn vặt',
    'Cơm & Món nước',
    'Đồ chiên & Béo',
  ];

  const visibleSwaps =
    selectedSwapCategory === 'Tất cả'
      ? HANDBOOK_SWAP_PAIRS
      : HANDBOOK_SWAP_PAIRS.filter((s) => s.category === selectedSwapCategory);

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[110px] md:pb-[48px]">
      {/* Header */}
      <header className="flex items-center gap-[12px] mb-[14px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại trang chủ"
          className="md:hidden w-[40px] h-[40px] shrink-0 rounded-full bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#2D2416] cursor-pointer hover:border-[#C5B890] transition-colors"
          style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
        >
          <ArrowLeftIcon size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-extrabold text-[#2D2416] m-0">
            Hướng dẫn & Cẩm nang
          </h1>
          <p className="text-[11px] md:text-[12px] font-semibold text-[#9E8E78] m-0 truncate">
            {profile.name} · BMI {profile.bmi} · {getGoalLabel(profile.goal)}
          </p>
        </div>
      </header>

      {/* Personalized Strategy Box */}
      <section
        aria-label="Chiến lược dinh dưỡng theo hồ sơ"
        className="rounded-[16px] p-[14px] mb-[14px] border-[1.5px] border-[#DDD0B0]"
        style={{
          background: 'linear-gradient(135deg, #FFF9ED 0%, #FFF0D6 100%)',
          boxShadow: '0 3px 0 var(--border-dark)',
        }}
      >
        <p className="text-[12px] font-extrabold text-[#CC5F1A] m-0">
          {goalStrategy.headline}
        </p>
        <ul className="m-0 mt-[6px] pl-[16px] flex flex-col gap-[4px] text-[12px] font-medium text-[#2D2416] leading-relaxed">
          {goalStrategy.bulletTips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </section>

      {/* 3-Tab Segmented Switch */}
      <div
        role="tablist"
        aria-label="Danh mục cẩm nang"
        className="grid grid-cols-3 gap-[6px] mb-[14px] bg-[#EDE5CC] p-[4px] rounded-[16px] border border-[#DDD0B0]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={section === 'meals'}
          onClick={() => setSection('meals')}
          className={`py-[9px] px-[4px] rounded-[12px] text-[12px] cursor-pointer transition-all whitespace-nowrap ${
            section === 'meals'
              ? 'bg-[#FFFDF5] text-[#2D2416] font-extrabold shadow-xs'
              : 'text-[#6B5D47] font-semibold hover:text-[#2D2416]'
          }`}
        >
          Món theo bữa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'swaps'}
          onClick={() => setSection('swaps')}
          className={`py-[9px] px-[4px] rounded-[12px] text-[12px] cursor-pointer transition-all whitespace-nowrap ${
            section === 'swaps'
              ? 'bg-[#FFFDF5] text-[#2D2416] font-extrabold shadow-xs'
              : 'text-[#6B5D47] font-semibold hover:text-[#2D2416]'
          }`}
        >
          Đổi món & Mẹo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'guide'}
          onClick={() => setSection('guide')}
          className={`py-[9px] px-[4px] rounded-[12px] text-[12px] cursor-pointer transition-all whitespace-nowrap ${
            section === 'guide'
              ? 'bg-[#FFFDF5] text-[#2D2416] font-extrabold shadow-xs'
              : 'text-[#6B5D47] font-semibold hover:text-[#2D2416]'
          }`}
        >
          Cách dùng app
        </button>
      </div>

      {/* SECTION 1: Meal Handbook by Slot */}
      {section === 'meals' && (
        <div>
          <div className="flex items-center justify-between gap-[8px] mb-[8px]">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0">
              CHỌN BỮA TRONG NGÀY
            </p>
            <button
              type="button"
              onClick={() => setOnlyMatchingGoal((prev) => !prev)}
              aria-pressed={onlyMatchingGoal}
              className={`px-[10px] py-[4px] rounded-full text-[11px] border cursor-pointer transition-colors whitespace-nowrap ${
                onlyMatchingGoal
                  ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                  : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
              }`}
            >
              {onlyMatchingGoal ? 'Đang lọc: Hợp mục tiêu' : 'Lọc hợp mục tiêu'}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-[8px] mb-[14px]">
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                aria-pressed={selectedSlot === slot}
                className={`py-[9px] rounded-[12px] text-[12px] border-[1.5px] cursor-pointer transition-colors ${
                  selectedSlot === slot
                    ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-extrabold'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
            {slotMeals.map((meal) => {
              const matchesGoal = meal.bestForGoals.includes(profile.goal);
              return (
                <article key={meal.id} className="neo-card p-[14px] flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-[8px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-[6px] text-[11px] font-bold">
                        <span className="text-[#9E8E78]">Bữa {meal.slot}</span>
                        {matchesGoal && (
                          <>
                            <span aria-hidden="true" className="text-[#C5B890]">
                              ·
                            </span>
                            <span className="text-[#037A5B]">
                              Hợp mục tiêu của bạn
                            </span>
                          </>
                        )}
                      </div>
                      <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0 mt-[3px] leading-snug">
                        {meal.title}
                      </h2>
                    </div>
                    <span className="shrink-0 text-[13px] font-extrabold text-[#FF8A3D] tabular-nums whitespace-nowrap">
                      {meal.caloriesRange}
                    </span>
                  </div>

                  <p className="text-[11px] font-bold text-[#FF6B6B] m-0 mt-[5px]">
                    {meal.macroFocus}
                  </p>

                  <p className="text-[12px] font-medium text-[#2D2416] m-0 mt-[8px] leading-relaxed">
                    <strong className="text-[#6B5D47]">Khẩu phần chuẩn:</strong>{' '}
                    {meal.portionTip}
                  </p>

                  <p className="text-[11px] font-semibold text-[#037A5B] bg-[#D4F7EE]/70 rounded-[10px] px-[10px] py-[7px] m-0 mt-[8px] leading-snug">
                    Mẹo gọi món/nấu: {meal.diningTip}
                  </p>

                  <button
                    type="button"
                    onClick={() => onAskAiSwap(meal.swapPromptDish)}
                    className="w-full mt-[10px] py-[9px] px-[12px] rounded-[12px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] hover:border-[#06D6A0] text-[12px] font-bold text-[#2D2416] cursor-pointer flex items-center justify-center gap-[6px] transition-colors whitespace-nowrap"
                  >
                    <span className="shrink-0 inline-flex">
                      <SwapIcon size={15} />
                    </span>
                    <span>Tìm món thay thế nhẹ hơn với AI</span>
                  </button>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onAskAiMenu(selectedSlot)}
            className="w-full mt-[14px] py-[13px] rounded-[20px] bg-[#FF8A3D] text-white text-[14px] font-bold neo-cta cursor-pointer flex items-center justify-center gap-[6px]"
          >
            <UtensilsIcon size={17} />
            <span>Để AI thiết kế thực đơn bữa {selectedSlot} theo calo còn lại</span>
          </button>
        </div>
      )}

      {/* SECTION 2: Smart Swaps & Hand Portion Rules */}
      {section === 'swaps' && (
        <div className="flex flex-col gap-[16px]">
          <div>
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
              BẢNG ĐỔI MÓN THÔNG MINH (TIẾT KIỆM CALO)
            </p>
            <div className="flex items-center gap-[6px] overflow-x-auto no-scrollbar pb-[4px] mb-[10px]">
              {swapCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedSwapCategory(cat)}
                  aria-pressed={selectedSwapCategory === cat}
                  className={`shrink-0 px-[12px] py-[6px] rounded-full text-[11px] border-[1.5px] cursor-pointer whitespace-nowrap transition-colors ${
                    selectedSwapCategory === cat
                      ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                      : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px] md:gap-[12px]">
              {visibleSwaps.map((pair) => {
                const saved = pair.fromCalories - pair.toCalories;
                return (
                  <article key={pair.id} className="neo-card p-[14px] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="text-[10px] font-bold tracking-[0.04em] text-[#9E8E78]">
                        {pair.category.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-extrabold text-[#037A5B] bg-[#D4F7EE] rounded-full px-[9px] py-[2px] tabular-nums whitespace-nowrap">
                        Tiết kiệm -{saved} kcal
                      </span>
                    </div>

                    <div className="mt-[8px] flex flex-col gap-[4px]">
                      <p className="text-[12px] font-semibold text-[#C94A4A] m-0">
                        Thay vì: {pair.fromDish} ({pair.fromCalories} kcal)
                      </p>
                      <p className="text-[13px] font-extrabold text-[#037A5B] m-0">
                        Chọn: {pair.toDish} ({pair.toCalories} kcal)
                      </p>
                    </div>

                    <p className="text-[12px] font-medium text-[#2D2416] m-0 mt-[8px] leading-relaxed">
                      {pair.whyBetter}
                    </p>
                    <p className="text-[11px] font-semibold text-[#6B5D47] bg-[#F2EBD8] rounded-[10px] px-[10px] py-[7px] m-0 mt-[7px] leading-snug">
                      Cách gọi/chế biến: {pair.howToApply}
                    </p>

                    <button
                      type="button"
                      onClick={() => onAskAiSwap(pair.fromDish)}
                      className="mt-[9px] text-left text-[12px] font-bold text-[#CC5F1A] hover:underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Hỏi AI gợi ý thêm lựa chọn thay thế →
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Hand Portion Guide */}
          <section aria-label="Quy tắc bàn tay ước lượng khẩu phần">
            <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
              ƯỚC LƯỢNG KHẨU PHẦN BẰNG BÀN TAY (KHÔNG CẦN CÂN)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
              {HAND_PORTION_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-[14px] p-[12px] border-[1.5px] border-[#DDD0B0]"
                  style={{ backgroundColor: rule.softBg }}
                >
                  <p
                    className="text-[12px] font-extrabold m-0"
                    style={{ color: rule.color }}
                  >
                    {rule.group}
                  </p>
                  <p className="text-[13px] font-extrabold text-[#2D2416] m-0 mt-[4px]">
                    {rule.handCue}
                  </p>
                  <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[3px]">
                    {rule.equivalent}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Dining Out Practical Rules */}
          <section
            aria-label="Mẹo ăn ngoài quán không bể kèo calo"
            className="neo-card p-[14px]"
          >
            <h2 className="text-[14px] font-extrabold text-[#2D2416] m-0 mb-[8px]">
              Mẹo ăn ngoài quán vẫn giữ dáng
            </h2>
            <ul className="m-0 pl-[16px] flex flex-col gap-[6px] text-[12px] font-medium text-[#2D2416] leading-relaxed">
              {DINING_OUT_TIPS.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* SECTION 3: App User Guide */}
      {section === 'guide' && (
        <div className="flex flex-col gap-[12px]">
          <div className="neo-card p-[14px] flex items-center gap-[10px]">
            <span className="w-[38px] h-[38px] shrink-0 rounded-[12px] bg-[#D4F7EE] border border-[#06D6A0]/50 flex items-center justify-center text-[#037A5B]">
              <BookOpenIcon size={19} />
            </span>
            <p className="text-[12px] font-semibold text-[#2D2416] m-0 leading-relaxed">
              BữaNay chỉ dùng dữ liệu thật từ ảnh và mô tả của bạn — mọi chỉ số BMI, Calo, Nước và Streak đều tính trực tiếp theo thời gian thực.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[12px]">
          {APP_GUIDE_STEPS.map((step) => (
            <article key={step.stepNumber} className="neo-card p-[15px] flex flex-col justify-between">
              <div className="flex items-start gap-[8px]">
                <span className="shrink-0 whitespace-nowrap text-[12px] font-extrabold text-[#CC5F1A] bg-[#FFEEDD] border border-[#FF8A3D]/40 rounded-[8px] px-[8px] py-[2px] tabular-nums">
                  Bước {step.stepNumber}
                </span>
                <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0 leading-snug">
                  {step.title}
                </h2>
              </div>

              <p className="text-[12px] font-medium text-[#2D2416] m-0 mt-[8px] leading-relaxed">
                {step.summary}
              </p>

              <ul className="m-0 mt-[8px] pl-[16px] flex flex-col gap-[4px] text-[12px] font-medium text-[#6B5D47] leading-relaxed">
                {step.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>

              {step.actionLabel && step.actionTarget && (
                <button
                  type="button"
                  onClick={() => onNavigate(step.actionTarget!)}
                  className="mt-[10px] px-[12px] py-[7px] rounded-[10px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-bold text-[#2D2416] cursor-pointer transition-colors"
                >
                  {step.actionLabel} →
                </button>
              )}
            </article>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
