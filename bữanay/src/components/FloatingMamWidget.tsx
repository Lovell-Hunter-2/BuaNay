import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampFloatingPosition,
  getDefaultFloatingPosition,
  getFloatingMamSize,
  resolveSnappedPositionFromRatio,
  snapToNearestScreenEdge,
  type DockSide,
  type FloatingPosition,
} from '../utils/floatingMascot';
import { MamMascot3D } from './MamMascot3D';

interface FloatingMamWidgetProps {
  activeTab?: string;
  onOpenChat: () => void;
  onHide: () => void;
}

const STORAGE_POS_KEY = 'buanay_floating_mam_pos_v1';
const DRAG_THRESHOLD_PX = 6;

interface StoredDockState {
  side: DockSide;
  yRatio: number;
}

function readStoredDockState(): StoredDockState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDockState>;
    if (
      (parsed.side === 'left' || parsed.side === 'right') &&
      typeof parsed.yRatio === 'number' &&
      Number.isFinite(parsed.yRatio)
    ) {
      return { side: parsed.side, yRatio: parsed.yRatio };
    }
    return null;
  } catch {
    return null;
  }
}

export function FloatingMamWidget({
  activeTab,
  onOpenChat,
  onHide,
}: FloatingMamWidgetProps) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number>(() =>
    typeof window !== 'undefined'
      ? getFloatingMamSize(window.innerWidth, window.innerHeight)
      : 74
  );
  const [dockSide, setDockSide] = useState<DockSide>(() => {
    const saved = typeof window !== 'undefined' ? readStoredDockState() : null;
    return saved?.side ?? 'right';
  });
  const [isDragging, setIsDragging] = useState(false);

  const posRef = useRef<FloatingPosition>({ x: 300, y: 210 });
  const storedDockRef = useRef<StoredDockState | null>(
    typeof window !== 'undefined' ? readStoredDockState() : null
  );
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    hasDragged: boolean;
    rafId: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    hasDragged: false,
    rafId: 0,
  });
  const suppressClickRef = useRef(false);

  const applyTransform = (pos: FloatingPosition, animate: boolean) => {
    const el = widgetRef.current;
    if (!el) return;
    el.style.transition = animate
      ? 'transform 360ms cubic-bezier(0.22, 1.24, 0.36, 1)'
      : 'none';
    el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  };

  // Compute position on mount and tab switch (hero card on dashboard, clean corner dock on other desktop tabs)
  useLayoutEffect(() => {
    const syncPosition = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextSize = getFloatingMamSize(vw, vh);
      setSize(nextSize);

      const bounds = { viewportWidth: vw, viewportHeight: vh, size: nextSize };
      const saved = storedDockRef.current;

      let nextPos: FloatingPosition;
      if (saved) {
        nextPos = resolveSnappedPositionFromRatio(saved.side, saved.yRatio, bounds);
        setDockSide(saved.side);
      } else {
        const heroEl = document.querySelector('[data-calorie-hero="true"]');
        const rect = heroEl ? heroEl.getBoundingClientRect() : null;
        nextPos = getDefaultFloatingPosition(bounds, rect);
        setDockSide('right');
      }

      posRef.current = nextPos;
      applyTransform(nextPos, Boolean(activeTab));
    };

    syncPosition();
    const rafId = window.requestAnimationFrame(syncPosition);

    const handleResize = () => syncPosition();
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeTab]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag.active || e.pointerId !== drag.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.hasDragged && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        drag.hasDragged = true;
        setIsDragging(true);
      }

      if (!drag.hasDragged) return;

      const bounds = {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        size,
      };
      const clamped = clampFloatingPosition(
        { x: drag.originX + dx, y: drag.originY + dy },
        bounds
      );
      posRef.current = clamped;

      if (drag.rafId) window.cancelAnimationFrame(drag.rafId);
      drag.rafId = window.requestAnimationFrame(() => {
        applyTransform(posRef.current, false);
      });
    };

    const finishDrag = (e: PointerEvent, isCancel: boolean) => {
      const drag = dragStateRef.current;
      if (!drag.active || e.pointerId !== drag.pointerId) return;

      drag.active = false;
      if (drag.rafId) {
        window.cancelAnimationFrame(drag.rafId);
        drag.rafId = 0;
      }

      if (drag.hasDragged) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);

        const bounds = {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          size,
        };
        const snapped = snapToNearestScreenEdge(posRef.current, bounds);
        posRef.current = { x: snapped.x, y: snapped.y };
        storedDockRef.current = { side: snapped.side, yRatio: snapped.yRatio };
        setDockSide(snapped.side);

        try {
          window.localStorage.setItem(
            STORAGE_POS_KEY,
            JSON.stringify(storedDockRef.current)
          );
        } catch {
          // Ignore storage quota error
        }

        applyTransform(posRef.current, true);
      } else if (!isCancel) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 80);
        onOpenChat();
      }

      setIsDragging(false);
    };

    const handlePointerUp = (e: PointerEvent) => finishDrag(e, false);
    const handlePointerCancel = (e: PointerEvent) => finishDrag(e, true);

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      if (dragStateRef.current.rafId) {
        window.cancelAnimationFrame(dragStateRef.current.rafId);
      }
    };
  }, [size, onOpenChat]);

  const handleMascotPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
      hasDragged: false,
      rafId: 0,
    };

    const el = widgetRef.current;
    if (el) el.style.transition = 'none';
  };

  return (
    <div
      ref={widgetRef}
      data-testid="floating-mam-widget"
      data-floating-side={dockSide}
      className="fixed left-0 top-0 z-[120] select-none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        touchAction: 'none',
        willChange: 'transform',
        transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
      }}
    >
      <button
        type="button"
        onPointerDown={handleMascotPointerDown}
        onClick={() => {
          if (suppressClickRef.current) return;
          onOpenChat();
        }}
        aria-label="Mở trò chuyện nhanh với Mầm"
        title="Chạm để trò chuyện với Mầm · Kéo để di chuyển"
        className={`w-full h-full p-0 border-0 bg-transparent flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#FF8A3D] rounded-full ${
          isDragging ? 'cursor-grabbing scale-[1.06]' : 'cursor-grab hover:scale-[1.03]'
        } transition-transform duration-150`}
        style={{ touchAction: 'none' }}
      >
        <MamMascot3D size={size} variant="floating" disableTapSpin />
      </button>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onHide();
        }}
        aria-label="Ẩn linh vật Mầm"
        title="Ẩn Mầm"
        className={`absolute -top-[4px] ${
          dockSide === 'right' ? '-right-[4px]' : '-left-[4px]'
        } w-[20px] h-[20px] rounded-full bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] text-[#6B5D47] hover:border-[#FF8A3D] hover:text-[#CC5F1A] flex items-center justify-center p-0 cursor-pointer shadow-sm`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.5 6H9.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
