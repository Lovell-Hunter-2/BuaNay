import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFloatingPosition,
  computeMascotLookTarget,
  getDefaultFloatingPosition,
  getFloatingMamSize,
  pickNextIdleLookPose,
  resolveSnappedPositionFromRatio,
  snapToNearestScreenEdge,
} from './floatingMascot';

test('Floating mascot size scales cleanly across phone and desktop viewports', () => {
  const smallPhone = getFloatingMamSize(360, 640);
  const iphone = getFloatingMamSize(390, 844);
  const desktop = getFloatingMamSize(1440, 900);

  assert.ok(smallPhone >= 64 && smallPhone <= 72);
  assert.ok(iphone >= 70 && iphone <= 78);
  assert.equal(desktop, 88);
});

test('Floating mascot clamps within safe bounds and snaps to nearest horizontal edge', () => {
  const bounds = { viewportWidth: 390, viewportHeight: 844, size: 74 };

  const clampedTopLeft = clampFloatingPosition({ x: -30, y: -20 }, bounds);
  assert.equal(clampedTopLeft.x, 10);
  assert.equal(clampedTopLeft.y, 14);

  const clampedBottom = clampFloatingPosition({ x: 500, y: 900 }, bounds);
  assert.equal(clampedBottom.x, 390 - 74 - 10);
  assert.equal(clampedBottom.y, 844 - 74 - 94);

  const snapLeft = snapToNearestScreenEdge({ x: 90, y: 300 }, bounds);
  assert.equal(snapLeft.side, 'left');
  assert.equal(snapLeft.x, 10);

  const snapRight = snapToNearestScreenEdge({ x: 240, y: 300 }, bounds);
  assert.equal(snapRight.side, 'right');
  assert.equal(snapRight.x, 390 - 74 - 10);

  const resized = resolveSnappedPositionFromRatio(
    snapRight.side,
    snapRight.yRatio,
    { viewportWidth: 430, viewportHeight: 932, size: 82 }
  );
  assert.equal(resized.x, 430 - 82 - 10);
  assert.ok(resized.y >= 14 && resized.y <= 932 - 82 - 94);
});

test('Default floating position places mascot inside top-right calorie hero zone', () => {
  const bounds = { viewportWidth: 390, viewportHeight: 844, size: 74 };
  const pos = getDefaultFloatingPosition(bounds, {
    top: 204,
    right: 370,
    bottom: 416,
  });
  assert.equal(pos.x, 390 - 74 - 10);
  assert.equal(pos.y, 210);

  const desktopNonHero = getDefaultFloatingPosition(
    { viewportWidth: 1440, viewportHeight: 900, size: 88 },
    null
  );
  assert.equal(desktopNonHero.x, 1440 - 88 - 22);
  assert.ok(desktopNonHero.y >= 760 && desktopNonHero.y <= 900 - 88 - 20);
});

test('Mascot gaze tracks pointer/touch direction with natural tilt and random idle poses rotate cleanly', () => {
  const lookUpRight = computeMascotLookTarget({
    pointerX: 350,
    pointerY: 40,
    mascotCenterX: 150,
    mascotCenterY: 300,
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.ok(lookUpRight.yaw > 0.35 && lookUpRight.yaw <= 0.7, 'Expected balanced positive yaw when pointer is right');
  assert.ok(lookUpRight.pitch < -0.2 && lookUpRight.pitch >= -0.5, 'Expected balanced negative pitch when pointer is above');
  assert.ok(lookUpRight.roll < -0.05 && lookUpRight.roll >= -0.16, 'Expected gentle head tilt roll toward pointer side');

  const lookDownLeft = computeMascotLookTarget({
    pointerX: 20,
    pointerY: 700,
    mascotCenterX: 250,
    mascotCenterY: 300,
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.ok(lookDownLeft.yaw < -0.35 && lookDownLeft.yaw >= -0.7, 'Expected balanced negative yaw when pointer is left');
  assert.ok(lookDownLeft.pitch > 0.2 && lookDownLeft.pitch <= 0.5, 'Expected balanced positive pitch when pointer is below');
  assert.ok(lookDownLeft.roll > 0.05 && lookDownLeft.roll <= 0.16, 'Expected gentle head tilt roll toward pointer side');

  let prevZone: ReturnType<typeof pickNextIdleLookPose>['zone'] | undefined;
  for (let i = 0; i < 10; i++) {
    const pose = pickNextIdleLookPose(prevZone);
    assert.notEqual(pose.zone, prevZone);
    assert.ok(pose.durationMs >= 2100 && pose.durationMs <= 3300);
    prevZone = pose.zone;
  }
});
