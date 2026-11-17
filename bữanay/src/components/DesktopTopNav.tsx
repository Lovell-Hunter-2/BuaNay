import { useState } from 'react';
import type { User } from 'firebase/auth';
import type {
  AppTab,
  NotificationItem,
  ReminderSettings,
  UserProfile,
} from '../types/nutrition';
import {
  formatViDateHeader,
  formatViNumber,
  getTimeGreeting,
  type DailyTotals,
} from '../utils/nutrition';
import {
  BellIcon,
  BookOpenIcon,
  CameraIcon,
  ChartBarIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  HomeIcon,
  UserIcon,
} from './Icons';
import { NotificationsPopover } from './NotificationsPopover';

interface DesktopTopNavProps {
  profile: UserProfile;
  hasCustomProfile?: boolean;
  totals: DailyTotals;
  waterCups: number;
  activeTab: AppTab;
  authUser: User | null;
  isInstalled: boolean;
  notifications: NotificationItem[];
  reminderSettings: ReminderSettings;
  onSelectTab: (tab: AppTab) => void;
  onUpdateReminderSettings: (next: ReminderSettings) => void;
  onInstallClick: () => void;
  onOpenAuth: () => void;
}

export function DesktopTopNav({
  profile,
  hasCustomProfile = true,
  totals,
  waterCups,
  activeTab,
  authUser,
  isInstalled,
  notifications,
  reminderSettings,
  onSelectTab,
  onUpdateReminderSettings,
  onInstallClick,
  onOpenAuth,
}: DesktopTopNavProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const normalizedMainTab: AppTab =
    activeTab === 'suggestions' || activeTab === 'guide'
      ? 'dashboard'
      : activeTab;

  const accountLabel = authUser
    ? authUser.displayName ||
      authUser.email?.split('@')[0] ||
      'Tài khoản'
    : 'Đăng nhập';

  const navTabClass = (tab: AppTab) => {
    const isActive = normalizedMainTab === tab;
    return [
      'inline-flex items-center gap-[7px] px-[16px] py-[8px] rounded-[13px] text-[13px] cursor-pointer transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A3D]',
      isActive
        ? 'bg-[#FFEEDD] text-[#CC5F1A] font-extrabold border border-[#FF8A3D]/50 shadow-xs'
        : 'text-[#6B5D47] font-semibold hover:text-[#2D2416] hover:bg-[#FFF9ED] border border-transparent',
    ].join(' ');
  };

  return (
    <header className="hidden md:block pt-[22px] pb-[18px] relative z-40">
      {/* Row 1: Identity & Greeting Left — Clean Utilities Right */}
      <div className="flex items-center justify-between gap-[20px]">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold text-[#2D2416] leading-tight tracking-[-0.015em] m-0">
            {getTimeGreeting(profile.name)}
          </h1>
          <p className="text-[12px] font-semibold text-[#6B5D47] m-0 mt-[3px] flex items-center gap-[6px] tabular-nums flex-wrap">
            <span>{formatViDateHeader()}</span>
            <span aria-hidden="true" className="text-[#C5B890]">·</span>
            {hasCustomProfile ? (
              <>
                <span>BMI {profile.bmi}</span>
                <span aria-hidden="true" className="text-[#C5B890]">·</span>
                <span>Mục tiêu {formatViNumber(profile.targetCalories)} kcal/ngày</span>
              </>
            ) : (
              <>
                <span>Chưa thiết lập hồ sơ</span>
                <span aria-hidden="true" className="text-[#C5B890]">·</span>
                <span>Mức tham khảo {formatViNumber(profile.targetCalories)} kcal/ngày</span>
              </>
            )}
          </p>
        </div>

        <div className="relative flex items-center gap-[8px] shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(false);
              onSelectTab('guide');
            }}
            aria-label="Mở hướng dẫn sử dụng và cẩm nang món ăn"
            className={`inline-flex items-center gap-[6px] h-[38px] px-[12px] rounded-[12px] border-[1.5px] text-[12px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#2D2416] hover:border-[#C5B890]'
            }`}
          >
            <BookOpenIcon size={15} />
            <span>Cẩm nang</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label="Nhắc nhở dinh dưỡng"
            aria-expanded={showNotifications}
            className={`w-[38px] h-[38px] rounded-[12px] border-[1.5px] flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
              showNotifications
                ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
                : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#2D2416] hover:border-[#C5B890]'
            }`}
          >
            <BellIcon size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNotifications(false);
              onInstallClick();
            }}
            className="inline-flex items-center gap-[6px] h-[38px] px-[14px] rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-extrabold neo-cta cursor-pointer whitespace-nowrap shrink-0"
          >
            {isInstalled ? (
              <CheckIcon size={15} strokeWidth={2.5} />
            ) : (
              <DownloadIcon size={15} strokeWidth={2.2} />
            )}
            <span>{isInstalled ? 'Đã cài app' : 'Cài đặt app'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNotifications(false);
              if (authUser) {
                onSelectTab('profile');
              } else {
                onOpenAuth();
              }
            }}
            className="inline-flex items-center gap-[6px] h-[38px] px-[12px] rounded-[12px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-bold text-[#2D2416] cursor-pointer transition-colors whitespace-nowrap shrink-0 max-w-[160px]"
          >
            <UserIcon size={14} />
            <span className="truncate">{accountLabel}</span>
          </button>

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
              className="absolute right-0 top-[46px] w-[320px] z-50 neo-card p-[14px]"
            />
          )}
        </div>
      </div>

      {/* Row 2: Upper-Centered Segmented Navigation Bar */}
      <nav
        aria-label="Điều hướng chính trên máy tính"
        className="flex justify-center mt-[16px]"
      >
        <div
          className="inline-flex items-center gap-[5px] p-[5px] rounded-[18px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0]"
          style={{
            boxShadow: '0 3px 0 var(--border-dark), var(--shadow-sm)',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            aria-current={normalizedMainTab === 'dashboard' ? 'page' : undefined}
            className={navTabClass('dashboard')}
          >
            <HomeIcon size={17} />
            <span>Trang chủ</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('reports')}
            aria-current={normalizedMainTab === 'reports' ? 'page' : undefined}
            className={navTabClass('reports')}
          >
            <ChartBarIcon size={17} />
            <span>Báo cáo</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('log')}
            aria-current={normalizedMainTab === 'log' ? 'page' : undefined}
            className={[
              'inline-flex items-center gap-[7px] px-[18px] py-[8px] rounded-[13px] text-[13px] font-extrabold cursor-pointer transition-all duration-150 whitespace-nowrap shrink-0 border-[1.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D2416]',
              normalizedMainTab === 'log'
                ? 'bg-[#CC5F1A] text-white border-[#9E4610] shadow-inner'
                : 'bg-[#FF8A3D] text-white border-[#CC5F1A] hover:brightness-105',
            ].join(' ')}
            style={
              normalizedMainTab === 'log'
                ? undefined
                : { boxShadow: '0 2px 0 #CC5F1A' }
            }
          >
            <CameraIcon size={17} />
            <span>Chụp / Ghi bữa</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('history')}
            aria-current={normalizedMainTab === 'history' ? 'page' : undefined}
            className={navTabClass('history')}
          >
            <ClockIcon size={17} />
            <span>Lịch sử</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            aria-current={normalizedMainTab === 'profile' ? 'page' : undefined}
            className={navTabClass('profile')}
          >
            <UserIcon size={17} />
            <span>Hồ sơ</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
