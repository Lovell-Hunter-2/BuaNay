import { useState } from 'react';
import type { AppTab } from '../types/nutrition';
import {
  CameraIcon,
  ChartBarIcon,
  ClockIcon,
  HomeIcon,
  UserIcon,
} from './Icons';

interface BottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  const [tappedTab, setTappedTab] = useState<AppTab | null>(null);

  const handleTap = (tab: AppTab) => {
    setTappedTab(tab);
    onSelectTab(tab);
    window.setTimeout(() => {
      setTappedTab((prev) => (prev === tab ? null : prev));
    }, 180);
  };

  const navButtonClass = (tab: AppTab) => {
    const isActive = activeTab === tab;
    return [
      'flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A3D]',
      isActive ? 'text-[#2D2416] font-bold' : 'text-[#9E8E78] font-medium hover:text-[#6B5D47]',
    ].join(' ');
  };

  return (
    <nav
      aria-label="Điều hướng chính"
      className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-[100] bg-[#FFFDF5] border-t-[1.5px] border-[#DDD0B0]"
      style={{
        boxShadow: '0 -4px 20px rgba(45, 36, 22, 0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="grid grid-cols-5 items-center h-[64px] px-2">
        <button
          type="button"
          onClick={() => handleTap('dashboard')}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          className={navButtonClass('dashboard')}
        >
          <span className={tappedTab === 'dashboard' ? 'animate-nav-tap inline-flex' : 'inline-flex'}>
            <HomeIcon size={22} />
          </span>
          <span className="text-[10px] leading-none whitespace-nowrap">Trang chủ</span>
        </button>

        <button
          type="button"
          onClick={() => handleTap('reports')}
          aria-current={activeTab === 'reports' ? 'page' : undefined}
          className={navButtonClass('reports')}
        >
          <span className={tappedTab === 'reports' ? 'animate-nav-tap inline-flex' : 'inline-flex'}>
            <ChartBarIcon size={22} />
          </span>
          <span className="text-[10px] leading-none whitespace-nowrap">Báo cáo</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => handleTap('log')}
            aria-label="Chụp ảnh ghi nhận bữa ăn"
            aria-current={activeTab === 'log' ? 'page' : undefined}
            className={[
              'w-[56px] h-[56px] rounded-full bg-[#FF8A3D] text-white flex items-center justify-center border-[3px] border-[#FFFDF5] cursor-pointer transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D2416]',
              activeTab === 'log' ? '' : 'animate-cta-pulse',
            ].join(' ')}
            style={{
              transform: 'translateY(-10px)',
              boxShadow: '0 4px 0 #CC5F1A, 0 6px 16px rgba(255, 138, 61, 0.35)',
            }}
          >
            <span className={tappedTab === 'log' ? 'animate-nav-tap inline-flex' : 'inline-flex'}>
              <CameraIcon size={24} />
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleTap('history')}
          aria-current={activeTab === 'history' ? 'page' : undefined}
          className={navButtonClass('history')}
        >
          <span className={tappedTab === 'history' ? 'animate-nav-tap inline-flex' : 'inline-flex'}>
            <ClockIcon size={22} />
          </span>
          <span className="text-[10px] leading-none whitespace-nowrap">Lịch sử</span>
        </button>

        <button
          type="button"
          onClick={() => handleTap('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={navButtonClass('profile')}
        >
          <span className={tappedTab === 'profile' ? 'animate-nav-tap inline-flex' : 'inline-flex'}>
            <UserIcon size={22} />
          </span>
          <span className="text-[10px] leading-none whitespace-nowrap">Hồ sơ</span>
        </button>
      </div>
    </nav>
  );
}
