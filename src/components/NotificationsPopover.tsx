import { useState } from 'react';
import type { NotificationItem, ReminderSettings } from '../types/nutrition';
import { formatWaterLiters, type DailyTotals } from '../utils/nutrition';

interface NotificationsPopoverProps {
  profileName: string;
  waterTargetCups: number;
  totals: DailyTotals;
  waterCups: number;
  notifications: NotificationItem[];
  reminderSettings: ReminderSettings;
  onUpdateReminderSettings: (next: ReminderSettings) => void;
  onClose: () => void;
  className?: string;
}

export async function sendSafeBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  try {
    const reg =
      'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
        : undefined;
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, { body, icon: '/pwa-192x192.png' });
      return;
    }
    new Notification(title, { body });
  } catch {
    // Ignore browser notification restrictions inside iframes/headless environments
  }
}

export function NotificationsPopover({
  notifications,
  reminderSettings,
  onUpdateReminderSettings,
  onClose,
  className = 'absolute right-[20px] top-[58px] w-[300px] z-30 neo-card p-[14px]',
}: NotificationsPopoverProps) {
  const [notifDeniedHint, setNotifDeniedHint] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && typeof Notification !== 'undefined'
      ? Notification.permission
      : 'unsupported'
  );

  const handleToggleBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotifPermission('unsupported');
      return;
    }
    if (reminderSettings.browserEnabled && Notification.permission === 'granted') {
      onUpdateReminderSettings({ ...reminderSettings, browserEnabled: false });
      setNotifDeniedHint(false);
      return;
    }
    try {
      const perm =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setNotifDeniedHint(false);
        onUpdateReminderSettings({ ...reminderSettings, browserEnabled: true });
        void sendSafeBrowserNotification(
          'BữaNay · Đã bật nhắc nhở!',
          'Mầm sẽ nhắc nhẹ bữa chính và uống nước khi bạn cần.'
        );
      } else {
        setNotifDeniedHint(true);
        onUpdateReminderSettings({ ...reminderSettings, browserEnabled: false });
      }
    } catch {
      setNotifDeniedHint(true);
    }
  };

  return (
    <div role="dialog" aria-label="Nhắc nhở hôm nay" className={className}>
      <div className="flex items-center justify-between mb-[10px]">
        <span className="text-[13px] font-extrabold text-[#2D2416]">
          Nhắc nhở theo chỉ số hôm nay
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold text-[#6B5D47] cursor-pointer hover:text-[#2D2416]"
        >
          Đóng
        </button>
      </div>

      <div className="flex flex-col gap-[8px]">
        {notifications.map((item) => (
          <div
            key={item.id}
            className="rounded-[12px] p-[10px] border-[1.5px] bg-[#FFF9ED] border-[#DDD0B0]"
          >
            <p className="text-[12px] font-bold text-[#2D2416] m-0 leading-snug">
              {item.title}
            </p>
            <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[3px]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-[10px] pt-[10px] border-t border-[#EDE5CC]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="text-[11px] font-extrabold text-[#2D2416]">
            Thông báo trình duyệt
          </span>
          <button
            type="button"
            onClick={handleToggleBrowserNotifications}
            disabled={notifPermission === 'unsupported'}
            className={`px-[9px] py-[4px] rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
              reminderSettings.browserEnabled && notifPermission === 'granted'
                ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B]'
                : 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
            }`}
          >
            {notifPermission === 'unsupported'
              ? 'Không hỗ trợ'
              : reminderSettings.browserEnabled && notifPermission === 'granted'
              ? 'Đã bật ✓'
              : 'Bật thông báo'}
          </button>
        </div>

        {(notifDeniedHint || notifPermission === 'denied') && (
          <p className="text-[10px] font-semibold text-[#D64545] m-0 mt-[5px] leading-snug">
            Trình duyệt đang chặn thông báo — bạn có thể cấp quyền trong phần Cài đặt trang web.
          </p>
        )}

        <div className="flex items-center gap-[6px] mt-[8px]">
          <button
            type="button"
            onClick={() =>
              onUpdateReminderSettings({
                ...reminderSettings,
                remindMeals: !reminderSettings.remindMeals,
              })
            }
            className={`flex-1 py-[5px] px-[8px] rounded-[9px] text-[10px] font-bold border cursor-pointer transition-colors whitespace-nowrap ${
              reminderSettings.remindMeals
                ? 'bg-[#FFF9ED] border-[#FF8A3D] text-[#CC5F1A]'
                : 'bg-[#F7F2E3] border-[#DDD0B0] text-[#9E8E78]'
            }`}
          >
            {reminderSettings.remindMeals ? '✓ ' : ''}Nhắc bữa chính
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateReminderSettings({
                ...reminderSettings,
                remindWater: !reminderSettings.remindWater,
              })
            }
            className={`flex-1 py-[5px] px-[8px] rounded-[9px] text-[10px] font-bold border cursor-pointer transition-colors whitespace-nowrap ${
              reminderSettings.remindWater
                ? 'bg-[#E6F7FF] border-[#4FC3F7] text-[#0284C7]'
                : 'bg-[#F7F2E3] border-[#DDD0B0] text-[#9E8E78]'
            }`}
          >
            {reminderSettings.remindWater ? '✓ ' : ''}Nhắc uống nước
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatReminderMessage(
  name: string,
  slotsLoggedCount: number,
  waterCups: number,
  waterTargetCups: number
): string {
  if (slotsLoggedCount === 0) {
    return `Hôm nay ${name} chưa ghi bữa nào — chạm Camera để Mầm tính calo nhé!`;
  }
  return `Đừng quên uống thêm nước hôm nay (${formatWaterLiters(waterCups)}/${formatWaterLiters(waterTargetCups)}L).`;
}

export type { DailyTotals };
