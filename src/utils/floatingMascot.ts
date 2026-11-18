export type DockSide = 'left' | 'right';
export type IdleLookZone = 'left' | 'right' | 'up' | 'down' | 'center';

export interface FloatingLayoutBounds {
  viewportWidth: number;
  viewportHeight: number;
  size: number;
  edgeMargin?: number;
  safeTop?: number;
  safeBottom?: number;
}

export interface FloatingPosition {
  x: number;
  y: number;
}

export interface SnappedFloatingState extends FloatingPosition {
  side: DockSide;
  yRatio: number;
}

export interface MascotGazeTarget {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface IdleLookPose extends MascotGazeTarget {
  zone: IdleLookZone;
  durationMs: number;
}

const DEFAULT_EDGE_MARGIN = 10;
const DEFAULT_SAFE_TOP = 14;
const DEFAULT_SAFE_BOTTOM = 94;

export function clamp(val: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, val));
}

export function getFloatingMamSize(
  viewportWidth: number,
  viewportHeight: number
): number {
  const safeW = Math.max(280, viewportWidth);
  const safeH = Math.max(420, viewportHeight);
  const base = Math.min(safeW, safeH);
  return clamp(Math.round(base * 0.19), 64, 88);
}

export function clampFloatingPosition(
  pos: FloatingPosition,
  bounds: FloatingLayoutBounds
): FloatingPosition {
  const edgeMargin = bounds.edgeMargin ?? DEFAULT_EDGE_MARGIN;
  const safeTop = bounds.safeTop ?? DEFAULT_SAFE_TOP;
  const safeBottom = bounds.safeBottom ?? DEFAULT_SAFE_BOTTOM;

  const maxX = Math.max(edgeMargin, bounds.viewportWidth - bounds.size - edgeMargin);
  const maxY = Math.max(safeTop, bounds.viewportHeight - bounds.size - safeBottom);

  return {
    x: Math.round(clamp(pos.x, edgeMargin, maxX)),
    y: Math.round(clamp(pos.y, safeTop, maxY)),
  };
}

export function snapToNearestScreenEdge(
  pos: FloatingPosition,
  bounds: FloatingLayoutBounds
): SnappedFloatingState {
  const edgeMargin = bounds.edgeMargin ?? DEFAULT_EDGE_MARGIN;
  const safeTop = bounds.safeTop ?? DEFAULT_SAFE_TOP;
  const safeBottom = bounds.safeBottom ?? DEFAULT_SAFE_BOTTOM;

  const clamped = clampFloatingPosition(pos, bounds);
  const centerX = clamped.x + bounds.size / 2;
  const side: DockSide = centerX < bounds.viewportWidth / 2 ? 'left' : 'right';

  const maxX = Math.max(edgeMargin, bounds.viewportWidth - bounds.size - edgeMargin);
  const x = side === 'left' ? edgeMargin : maxX;

  const maxY = Math.max(safeTop, bounds.viewportHeight - bounds.size - safeBottom);
  const spanY = maxY - safeTop;
  const yRatio = spanY > 0 ? clamp((clamped.y - safeTop) / spanY, 0, 1) : 0.25;

  return {
    side,
    x: Math.round(x),
    y: clamped.y,
    yRatio: Math.round(yRatio * 1000) / 1000,
  };
}

export function resolveSnappedPositionFromRatio(
  side: DockSide,
  yRatio: number,
  bounds: FloatingLayoutBounds
): FloatingPosition {
  const edgeMargin = bounds.edgeMargin ?? DEFAULT_EDGE_MARGIN;
  const safeTop = bounds.safeTop ?? DEFAULT_SAFE_TOP;
  const safeBottom = bounds.safeBottom ?? DEFAULT_SAFE_BOTTOM;

  const maxX = Math.max(edgeMargin, bounds.viewportWidth - bounds.size - edgeMargin);
  const maxY = Math.max(safeTop, bounds.viewportHeight - bounds.size - safeBottom);
  const spanY = Math.max(0, maxY - safeTop);

  const x = side === 'left' ? edgeMargin : maxX;
  const y = safeTop + spanY * clamp(yRatio, 0, 1);

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

export function getDefaultFloatingPosition(
  bounds: FloatingLayoutBounds,
  calorieCardRect?: { top: number; right: number; bottom: number } | null
): FloatingPosition {
  const edgeMargin = bounds.edgeMargin ?? DEFAULT_EDGE_MARGIN;

  if (calorieCardRect && calorieCardRect.right > 0) {
    const preferredX =
      bounds.viewportWidth <= 500
        ? bounds.viewportWidth - bounds.size - edgeMargin
        : calorieCardRect.right - bounds.size - 4;
    const preferredY = calorieCardRect.top + 6;

    return clampFloatingPosition(
      { x: preferredX, y: preferredY },
      bounds
    );
  }

  if (bounds.viewportWidth >= 768) {
    return resolveSnappedPositionFromRatio('right', 1, {
      ...bounds,
      edgeMargin: 22,
      safeBottom: 24,
    });
  }

  return resolveSnappedPositionFromRatio('right', 0.26, bounds);
}

export function computeMascotLookTarget(input: {
  pointerX: number;
  pointerY: number;
  mascotCenterX: number;
  mascotCenterY: number;
  viewportWidth: number;
  viewportHeight: number;
}): MascotGazeTarget {
  const normSpanX = clamp(input.viewportWidth * 0.32, 110, 360);
  const normSpanY = clamp(input.viewportHeight * 0.32, 110, 300);

  const dx = clamp((input.pointerX - input.mascotCenterX) / normSpanX, -1, 1);
  const dy = clamp((input.pointerY - input.mascotCenterY) / normSpanY, -1, 1);

  return {
    yaw: dx * 0.66,
    pitch: dy * 0.44,
    roll: -dx * 0.14,
  };
}

const IDLE_ZONES: IdleLookZone[] = ['left', 'right', 'up', 'down', 'center'];

function lerpRange(min: number, max: number, t: number): number {
  return min + (max - min) * clamp(t, 0, 1);
}

export function pickNextIdleLookPose(
  lastZone?: IdleLookZone | null,
  rng: () => number = Math.random
): IdleLookPose {
  const candidates = lastZone
    ? IDLE_ZONES.filter((z) => z !== lastZone)
    : IDLE_ZONES;
  const idx = Math.min(
    candidates.length - 1,
    Math.floor(clamp(rng(), 0, 0.9999) * candidates.length)
  );
  const zone = candidates[idx];
  const a = rng();
  const b = rng();
  const durationMs = Math.round(lerpRange(2100, 3300, rng()));

  if (zone === 'left') {
    return {
      zone,
      yaw: lerpRange(-0.56, -0.34, a),
      pitch: lerpRange(-0.1, 0.1, b),
      roll: lerpRange(0.07, 0.12, a),
      durationMs,
    };
  }
  if (zone === 'right') {
    return {
      zone,
      yaw: lerpRange(0.34, 0.56, a),
      pitch: lerpRange(-0.1, 0.1, b),
      roll: -lerpRange(0.07, 0.12, a),
      durationMs,
    };
  }
  if (zone === 'up') {
    return {
      zone,
      yaw: lerpRange(-0.18, 0.18, a),
      pitch: lerpRange(-0.38, -0.24, b),
      roll: lerpRange(-0.05, 0.05, a),
      durationMs,
    };
  }
  if (zone === 'down') {
    return {
      zone,
      yaw: lerpRange(-0.18, 0.18, a),
      pitch: lerpRange(0.24, 0.38, b),
      roll: lerpRange(-0.05, 0.05, a),
      durationMs,
    };
  }
  return {
    zone: 'center',
    yaw: lerpRange(-0.1, 0.1, a),
    pitch: lerpRange(-0.06, 0.06, b),
    roll: lerpRange(-0.03, 0.03, a),
    durationMs,
  };
}
