import { useState } from 'react';
import type {
  AppTab,
  MealEntry,
  NotificationItem,
  ReminderSettings,
  UserProfile,
  WeeklyDayStat,
} from '../types/nutrition';
import {
  formatViDateHeader,
  formatViNumber,
  formatWaterLiters,
  getGoalLabel,
  getMascotFeedback,
  getMascotMoodState,
  getTimeGreeting,
  type DailyTotals,
} from '../utils/nutrition';
import { MamMascot3D } from './MamMascot3D';
import {
  BellIcon,
  BookOpenIcon,
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  UtensilsIcon,
  WaterDropIcon,
} from './Icons';
import { NotificationsPopover } from './NotificationsPopover';

interface DashboardScreenProps {
  profile: UserProfile;
  hasCustomProfile?: boolean;
  totals: DailyTotals;
  todayMeals?: MealEntry[];
  waterCups: number;
  streakDays: number;
  weeklyStats: WeeklyDayStat[];
  notifications: NotificationItem[];
  reminderSettings: ReminderSettings;
  tourDismissed: boolean;
  isInstalled: boolean;
  onInstallClick: () => void;
  onDismissTour: () => void;
  onOpenCompanion: () => void;
  onUpdateReminderSettings: (next: ReminderSettings) => void;
  onAddWaterCup: () => void;
  onSetWaterCups: (cups: number) => void;
  onNavigate: (tab: AppTab) => void;
}

export function DashboardScreen({
  profile,
  hasCustomProfile = true,
  totals,
  todayMeals = [],
  waterCups,
  streakDays,
  weeklyStats,
  notifications,
  reminderSettings,
  tourDismissed,
  isInstalled,
  onInstallClick,
  onDismissTour,
  onOpenCompanion,
  onUpdateReminderSettings,
  onAddWaterCup,
  onSetWaterCups,
  onNavigate,
}: DashboardScreenProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const handleDismissTour = onDismissTour;

  const handleInstallButtonClick = () => {
    setShowNotifications(false);
    onInstallClick();
  };

  const mascot = getMascotFeedback(totals, profile);
  const mascotMood = getMascotMoodState(totals, profile, streakDays);
  const waterLiters = formatWaterLiters(waterCups);
  const targetLiters = formatWaterLiters(profile.waterTargetCups);

  const macros = [
    {
      key: 'protein',
      label: 'Đạm',
      value: totals.protein,
      target: profile.targets.protein,
      circleBg: '#F25F5C',
      shadowColor: 'rgba(242, 95, 92, 0.28)',
    },
    {
      key: 'carbs',
      label: 'Tinh bột',
      value: totals.carbs,
      target: profile.targets.carbs,
      circleBg: '#E59A00',
      shadowColor: 'rgba(229, 154, 0, 0.28)',
    },
    {
      key: 'fiber',
      label: 'Chất xơ',
      value: totals.fiber,
      target: profile.targets.fiber,
      circleBg: '#14B8A6',
      shadowColor: 'rgba(20, 184, 166, 0.28)',
    },
    {
      key: 'fat',
      label: 'Chất béo',
      value: totals.fat,
      target: profile.targets.fat,
      circleBg: '#8B6BFF',
      shadowColor: 'rgba(139, 107, 255, 0.28)',
    },
  ];

  const renderMascotCard = (extraClassName: string) => (
    <section
      aria-label="Nhận xét từ BữaNay"
      className={`${extraClassName} px-[14px] py-[13px] rounded-[20px] border-[1.5px] border-[#DDD0B0] animate-card-enter flex items-center gap-[12px]`}
      style={{
        background: 'linear-gradient(135deg, #FFF9ED 0%, #FFF0D6 100%)',
        boxShadow: '0 3px 0 var(--border-dark)',
        animationDelay: '0ms',
      }}
    >
      <MamMascot3D size={62} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[6px]">
          <p className="text-[10px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 leading-tight">
            {hasCustomProfile
              ? `BMI ${profile.bmi} · ${getGoalLabel(profile.goal).toUpperCase()}`
              : 'MỨC THAM KHẢO BAN ĐẦU'}
          </p>
          <span
            className={`shrink-0 rounded-full px-[7px] py-[1.5px] text-[9px] font-extrabold whitespace-nowrap ${
              hasCustomProfile
                ? 'bg-[#D4F7EE] text-[#037A5B]'
                : 'bg-[#FFEEDD] text-[#CC5F1A]'
            }`}
          >
            {hasCustomProfile ? mascotMood.label : 'Chưa lập hồ sơ'}
          </span>
        </div>
        {hasCustomProfile ? (
          <p className="text-[13px] font-medium text-[#2D2416] leading-[1.45] m-0 mt-[3px]">
            Bạn đã đủ{' '}
            <span className="font-extrabold text-[#FF8A3D]">
              {mascot.highlight}
            </span>
            {mascot.suffix}
          </p>
        ) : (
          <p className="text-[13px] font-medium text-[#2D2416] leading-[1.45] m-0 mt-[3px]">
            Đang hiển thị mức tham khảo{' '}
            <span className="font-extrabold text-[#FF8A3D]">
              {formatViNumber(profile.targetCalories)} kcal
            </span>
            . Bạn có thể đăng nhập hoặc điền chỉ số riêng trong Hồ sơ bất cứ lúc nào!
          </p>
        )}
        <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
          {!hasCustomProfile && (
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="inline-flex items-center gap-[4px] px-[9px] py-[3px] rounded-full bg-[#FF8A3D] text-white text-[10px] font-extrabold cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
            >
              Điền chỉ số của bạn →
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCompanion}
            className="inline-flex items-center gap-[4px] px-[9px] py-[3px] rounded-full bg-[#FFFDF5] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[10px] font-extrabold text-[#CC5F1A] cursor-pointer transition-colors whitespace-nowrap"
          >
            Trò chuyện nhanh với Mầm →
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="animate-screen-fade pb-[105px] md:pb-[48px]">
      {/* Mobile Header (hidden on md+ where DesktopTopNav renders) */}
      <header className="md:hidden relative px-[20px] pt-[18px]">
        <div className="flex items-center justify-between gap-[10px]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#9E8E78] m-0 whitespace-nowrap">
            {formatViDateHeader()}
          </p>

          <div className="flex items-center gap-[8px] shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('guide')}
              aria-label="Mở hướng dẫn sử dụng và cẩm nang món ăn"
              className="w-[34px] h-[34px] rounded-full bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#2D2416] cursor-pointer hover:border-[#C5B890] transition-colors"
            >
              <BookOpenIcon size={16} />
            </button>

            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Nhắc nhở dinh dưỡng"
              aria-expanded={showNotifications}
              className="relative w-[34px] h-[34px] rounded-full bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#2D2416] cursor-pointer hover:border-[#C5B890] transition-colors"
            >
              <BellIcon size={16} />
            </button>

            <button
              type="button"
              onClick={handleInstallButtonClick}
              aria-label={
                isInstalled
                  ? 'Ứng dụng đã tải về máy'
                  : 'Tải ứng dụng về điện thoại'
              }
              title={isInstalled ? 'Đã tải về máy' : 'Tải ứng dụng BữaNay'}
              className="relative w-[34px] h-[34px] rounded-full bg-[#FF8A3D] border-[1.5px] border-[#CC5F1A] flex items-center justify-center text-white cursor-pointer active:translate-y-[1px] transition-all"
              style={{ boxShadow: '0 2px 0 #CC5F1A' }}
            >
              {isInstalled ? (
                <CheckIcon size={16} strokeWidth={2.5} />
              ) : (
                <DownloadIcon size={16} strokeWidth={2.2} />
              )}
            </button>
          </div>
        </div>

        <h1 className="text-[22px] font-extrabold text-[#2D2416] leading-snug mt-[4px] m-0">
          {getTimeGreeting(profile.name)}
        </h1>

        {showNotifications && (
          <NotificationsPopover
            profileName={profile.name}
            waterTargetCups={profile.waterTargetCups}
            totals={totals}
            waterCups={waterCups}
            notifications={notifications}
            reminderSettings={reminderSettings}
            onUpdateReminderSettings={onUpdateReminderSettings}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </header>

      <div className="md:grid md:grid-cols-12 md:gap-[18px] md:items-start">
        {/* Left Main Column (65% width on desktop) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col">
          {/* Mobile-only Mascot placement (above Hero) */}
          <div className="md:hidden">
            {renderMascotCard('mx-[20px] my-[14px]')}
          </div>

          {/* Unified Calories & 4 Macros Hero Card */}
          <section
            data-calorie-hero="true"
            aria-label="Calories và dinh dưỡng hôm nay"
            className="relative overflow-hidden mx-[20px] md:mx-0 neo-card px-[18px] md:px-[22px] pt-[18px] md:pt-[22px] pb-[16px] md:pb-[20px] animate-card-enter"
            style={{ animationDelay: '60ms' }}
          >
        {/* Subtle top-right mint orb accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[34px] -right-[28px] w-[112px] h-[112px] rounded-full bg-[#D4F7EE]/65"
        />

        <div className="relative z-10">
          <div className="flex items-baseline gap-[6px] whitespace-nowrap">
            <span
              data-testid="calories-consumed"
              className={`text-[40px] font-extrabold leading-none tracking-[-0.02em] tabular-nums ${
                totals.overage > 0 ? 'text-[#D64545]' : 'text-[#CC5F1A]'
              }`}
            >
              {formatViNumber(totals.calories)}
            </span>
            <span className="text-[15px] font-semibold text-[#9E8E78] tabular-nums">
              / {formatViNumber(profile.targetCalories)} kcal
            </span>
          </div>

          <p
            data-testid="calories-remaining-pill"
            className={`text-[13px] font-bold m-0 mt-[8px] tabular-nums ${
              totals.overage > 0 ? 'text-[#D64545]' : 'text-[#037A5B]'
            }`}
          >
            {totals.overage > 0
              ? `Vượt ${formatViNumber(totals.overage)} kcal so với mục tiêu`
              : `Còn ${formatViNumber(totals.remaining)} kcal cần nạp thêm`}
          </p>

          {/* Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={totals.clampedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ calories hôm nay"
            className="mt-[10px] h-[9px] w-full rounded-full bg-[#EDE5CC] overflow-hidden"
          >
            <div
              className="h-full rounded-full animate-fill-bar"
              style={{
                width: `${totals.clampedPercent}%`,
                background:
                  totals.overage > 0
                    ? 'linear-gradient(90deg, #FF8A3D 0%, #FF6B6B 100%)'
                    : 'linear-gradient(90deg, var(--primary) 0%, #04B589 100%)',
              }}
            />
          </div>

          {/* 4 Macro Circles Row */}
          <div
            aria-label="Chỉ số dinh dưỡng đa lượng"
            className="grid grid-cols-4 gap-[6px] mt-[16px] pt-[14px] border-t border-[#EDE5CC]/80"
          >
            {macros.map((item) => (
              <div
                key={item.key}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white text-[13px] font-extrabold tabular-nums transition-transform duration-150 hover:scale-105"
                  style={{
                    backgroundColor: item.circleBg,
                    boxShadow: `0 3px 8px ${item.shadowColor}`,
                  }}
                >
                  {item.value}g
                </div>
                <span className="text-[11px] font-bold text-[#2D2416] mt-[6px] leading-tight whitespace-nowrap">
                  {item.label}
                </span>
                <span className="text-[10px] font-semibold text-[#9E8E78] mt-[1px] tabular-nums whitespace-nowrap">
                  / {item.target}g
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dismissible 3-Step First-Time Welcome Guide */}
      {!tourDismissed && (
        <section
          aria-label="Làm quen nhanh 3 bước"
          className="mx-[20px] md:mx-0 mt-[12px] md:mt-[14px] rounded-[18px] bg-[#FFF9ED] border-[1.5px] border-[#DDD0B0] p-[12px] md:p-[14px] animate-card-enter"
          style={{ animationDelay: '120ms' }}
        >
          <div className="flex items-center justify-between gap-[8px] mb-[8px]">
            <p className="text-[11px] font-extrabold tracking-[0.04em] text-[#CC5F1A] m-0">
              LÀM QUEN NHANH TRONG 3 BƯỚC
            </p>
            <button
              type="button"
              onClick={handleDismissTour}
              className="px-[9px] py-[3px] rounded-full bg-[#FFFDF5] border border-[#DDD0B0] text-[10px] font-bold text-[#6B5D47] cursor-pointer hover:text-[#2D2416]"
            >
              Đã hiểu
            </button>
          </div>
          <div className="grid grid-cols-3 gap-[6px] md:gap-[10px]">
            <button
              type="button"
              onClick={() => onNavigate('log')}
              className="rounded-[12px] bg-[#FFFDF5] border border-[#DDD0B0] p-[8px] md:p-[11px] text-left cursor-pointer hover:border-[#FF8A3D]"
            >
              <span className="text-[10px] md:text-[11px] font-extrabold text-[#FF8A3D] block">
                1. Chụp / Nhập
              </span>
              <span className="text-[11px] md:text-[12px] font-semibold text-[#2D2416] block mt-[2px] leading-tight">
                AI tính calo & sửa tay
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('suggestions')}
              className="rounded-[12px] bg-[#FFFDF5] border border-[#DDD0B0] p-[8px] md:p-[11px] text-left cursor-pointer hover:border-[#06D6A0]"
            >
              <span className="text-[10px] md:text-[11px] font-extrabold text-[#037A5B] block">
                2. Gợi ý món
              </span>
              <span className="text-[11px] md:text-[12px] font-semibold text-[#2D2416] block mt-[2px] leading-tight">
                Ăn ngoài & Tự nấu
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="rounded-[12px] bg-[#FFFDF5] border border-[#DDD0B0] p-[8px] md:p-[11px] text-left cursor-pointer hover:border-[#FF8A3D]"
            >
              <span className="text-[10px] md:text-[11px] font-extrabold text-[#CC5F1A] block">
                3. Báo cáo
              </span>
              <span className="text-[11px] md:text-[12px] font-semibold text-[#2D2416] block mt-[2px] leading-tight">
                Theo dõi Tuần & Tháng
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Bento Row — Nước + Bữa ăn */}
      <section
        aria-label="Nước uống và bữa ăn"
        className="grid grid-cols-2 gap-[10px] md:gap-[14px] mx-[20px] md:mx-0 mt-[12px] md:mt-[14px] animate-card-enter"
        style={{ animationDelay: '180ms' }}
      >
        {/* Nước uống card */}
        <div className="neo-card p-[14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[#4FC3F7] inline-flex">
                <WaterDropIcon size={24} />
              </span>
              <button
                type="button"
                onClick={onAddWaterCup}
                aria-label="Uống thêm 200ml nước"
                className="px-[8px] py-[4px] rounded-full bg-[#E6F7FF] border border-[#4FC3F7]/50 text-[#0284C7] text-[11px] font-bold cursor-pointer hover:bg-[#D2F0FF] active:scale-95 transition-all"
              >
                +200ml
              </button>
            </div>

            <div className="mt-[8px] flex items-baseline tabular-nums">
              <span
                data-testid="water-liters"
                className="text-[28px] font-extrabold leading-none text-[#0284C7]"
              >
                {waterLiters}
              </span>
              <span className="text-[16px] font-bold text-[#0284C7]/85 ml-[2px]">
                L
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#9E8E78] m-0 mt-[3px]">
              Nước uống / {targetLiters}L
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-[3px] mt-[10px]"
            role="group"
            aria-label="Số cốc nước đã uống"
          >
            {Array.from({ length: profile.waterTargetCups }).map((_, index) => {
              const filled = index < waterCups;
              const targetCup = index + 1;
              return (
                <button
                  key={targetCup}
                  type="button"
                  onClick={() =>
                    onSetWaterCups(
                      waterCups === targetCup ? targetCup - 1 : targetCup
                    )
                  }
                  aria-label={`Đặt lượng nước ${formatWaterLiters(targetCup)} lít`}
                  className="p-[1.5px] cursor-pointer flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#4FC3F7]"
                >
                  <span
                    className="block w-[7px] h-[7px] rounded-full transition-colors duration-150"
                    style={{
                      backgroundColor: filled ? '#4FC3F7' : 'var(--bg2)',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Bữa đã ghi card */}
        <button
          type="button"
          onClick={() => onNavigate('history')}
          aria-label="Xem các bữa đã ghi nhận hôm nay"
          className="neo-card p-[14px] text-left flex flex-col justify-between cursor-pointer hover:border-[#C5B890] transition-colors"
        >
          <div>
            <div className="flex items-baseline gap-[5px] tabular-nums">
              <span
                data-testid="meals-count"
                className="text-[28px] font-extrabold leading-none text-[#037A5B]"
              >
                {totals.slotsLogged.length}
              </span>
              <span className="text-[15px] font-bold text-[#037A5B]/85">bữa</span>
            </div>
            <p className="text-[11px] font-medium text-[#9E8E78] m-0 mt-[4px]">
              Đã ghi nhận hôm nay
            </p>
          </div>

          {totals.slotsLogged.length > 0 ? (
            <div className="flex flex-wrap gap-[5px] mt-[12px]">
              {totals.slotsLogged.map((slot) => (
                <span
                  key={slot}
                  className="rounded-full px-[10px] py-[3px] text-[11px] font-bold bg-[#D4F7EE] text-[#037A5B] whitespace-nowrap"
                >
                  {slot}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-[#FF8A3D] m-0 mt-[12px]">
              Chưa có bữa nào hôm nay
            </p>
          )}
        </button>
      </section>

      {/* Personalized Menu AI + Handbook & Guide Bento Row */}
      <section
        aria-label="Đề xuất thực đơn và cẩm nang dinh dưỡng"
        className="grid grid-cols-2 gap-[10px] md:gap-[14px] mx-[20px] md:mx-0 mt-[12px] md:mt-[14px] animate-card-enter"
        style={{ animationDelay: '220ms' }}
      >
        <button
          type="button"
          onClick={() => onNavigate('suggestions')}
          className="neo-card p-[13px] md:p-[16px] flex flex-col justify-between text-left cursor-pointer hover:border-[#06D6A0] transition-colors"
        >
          <span className="w-[36px] h-[36px] rounded-[11px] bg-[#D4F7EE] border border-[#06D6A0]/50 flex items-center justify-center text-[#037A5B]">
            <UtensilsIcon size={18} />
          </span>
          <div className="mt-[10px]">
            <p className="text-[13px] md:text-[14px] font-extrabold text-[#2D2416] m-0 leading-snug">
              Gợi ý AI & Đổi món
            </p>
            <p className="text-[11px] md:text-[12px] font-medium text-[#6B5D47] m-0 mt-[3px] leading-snug">
              Theo calo còn lại & mục tiêu →
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('guide')}
          className="neo-card p-[13px] md:p-[16px] flex flex-col justify-between text-left cursor-pointer hover:border-[#FF8A3D] transition-colors"
        >
          <span className="w-[36px] h-[36px] rounded-[11px] bg-[#FFEEDD] border border-[#FF8A3D]/45 flex items-center justify-center text-[#CC5F1A]">
            <BookOpenIcon size={18} />
          </span>
          <div className="mt-[10px]">
            <p className="text-[13px] md:text-[14px] font-extrabold text-[#2D2416] m-0 leading-snug">
              Cẩm nang & HDSD
            </p>
            <p className="text-[11px] md:text-[12px] font-medium text-[#6B5D47] m-0 mt-[3px] leading-snug">
              Món theo bữa & cách dùng app →
            </p>
          </div>
        </button>
      </section>
        </div>

        {/* Right Side Column (35% width on desktop) */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-[14px]">
          <div className="hidden md:block">
            {renderMascotCard('mx-0')}
          </div>

          {/* Real Streak Card */}
          <section
            aria-label="Chuỗi ngày duy trì"
            className="mx-[20px] md:mx-0 mt-[12px] md:mt-0 rounded-[20px] p-[18px] text-white border-[1.5px] border-[#CC5F1A] animate-card-enter"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #FF6B00 100%)',
              boxShadow: '0 3px 0 #CC5F1A, 0 4px 14px rgba(255, 138, 61, 0.25)',
              animationDelay: '260ms',
            }}
          >
            <div className="flex items-baseline gap-[10px]">
              <span
                data-testid="streak-days"
                className="text-[48px] font-extrabold leading-none tabular-nums"
              >
                {streakDays}
              </span>
              <span className="text-[18px] font-extrabold tracking-tight">
                ngày streak 🔥
              </span>
            </div>

            <p className="text-[13px] font-medium text-white/95 m-0 mt-[10px] leading-relaxed">
              {streakDays === 0
                ? 'Ghi nhận bữa ăn đầu tiên hôm nay để bắt đầu chuỗi ngày theo dõi thật của bạn!'
                : `Bạn đã duy trì ghi nhận liên tiếp ${streakDays} ngày. Tiếp tục giữ nhịp nhé!`}
            </p>

            <div className="grid grid-cols-7 gap-[6px] mt-[14px]">
              {weeklyStats.map((day) => {
                const hasLogged = day.calories > 0;
                return (
                  <div
                    key={day.dateKey}
                    className={`rounded-[10px] py-[7px] flex flex-col items-center justify-center border ${
                      hasLogged
                        ? 'bg-white/25 border-white/40'
                        : 'bg-white/10 border-white/15 opacity-75'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-white/95">
                      {day.day}
                    </span>
                    <span className="text-[12px] font-extrabold mt-[2px]">
                      {hasLogged ? '✓' : '·'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Desktop Quick Today's Meals Preview */}
          <section
            aria-label="Nhật ký nhanh hôm nay"
            className="hidden md:block neo-card p-[16px] animate-card-enter"
            style={{ animationDelay: '300ms' }}
          >
            <div className="flex items-center justify-between gap-[8px] mb-[10px]">
              <div>
                <h2 className="text-[14px] font-extrabold text-[#2D2416] m-0">
                  Nhật ký hôm nay
                </h2>
                <p className="text-[11px] font-medium text-[#9E8E78] m-0 mt-[1px] tabular-nums">
                  {todayMeals.length > 0
                    ? `${todayMeals.length} món · ${formatViNumber(totals.calories)} kcal`
                    : 'Chưa ghi nhận bữa nào'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('log')}
                className="inline-flex items-center gap-[4px] px-[10px] py-[5px] rounded-[10px] bg-[#FFEEDD] border border-[#FF8A3D]/45 text-[11px] font-extrabold text-[#CC5F1A] cursor-pointer hover:bg-[#FFE3C7] whitespace-nowrap shrink-0"
              >
                <PlusIcon size={13} />
                <span>Ghi bữa</span>
              </button>
            </div>

            {todayMeals.length === 0 ? (
              <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[12px] text-[12px] font-medium text-[#6B5D47] leading-relaxed">
                Chụp ảnh món ăn hoặc mô tả nhanh bằng chữ để Mầm tính calo và cân đối dinh dưỡng hôm nay cho bạn.
              </div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {todayMeals.slice(0, 4).map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] px-[11px] py-[8px] flex items-center justify-between gap-[8px]"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-extrabold text-[#2D2416] m-0 truncate">
                        {meal.name}
                      </p>
                      <p className="text-[10px] font-semibold text-[#9E8E78] m-0 mt-[1px]">
                        {meal.slot} · {meal.time}
                      </p>
                    </div>
                    <span className="text-[12px] font-extrabold text-[#CC5F1A] tabular-nums whitespace-nowrap shrink-0">
                      {meal.calories} kcal
                    </span>
                  </div>
                ))}
                {todayMeals.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('history')}
                    className="text-[11px] font-bold text-[#037A5B] hover:underline text-left cursor-pointer bg-transparent border-0 p-0"
                  >
                    Xem tất cả {todayMeals.length} món hôm nay →
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
