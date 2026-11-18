import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  computeMascotLookTarget,
  pickNextIdleLookPose,
  type IdleLookZone,
  type MascotGazeTarget,
} from '../utils/floatingMascot';

interface MamMascot3DProps {
  size?: number;
  variant?: 'badge' | 'floating';
  disableTapSpin?: boolean;
}

const MODEL_URL = '/assets/mascot_mam.glb';
const IDLE_DELAY_MS = 3000;
THREE.Cache.enabled = true;

export function MamMascot3D({
  size = 62,
  variant = 'badge',
  disableTapSpin = false,
}: MamMascot3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const spinBoostRef = useRef<number>(0);
  const sizeRef = useRef<number>(size);
  sizeRef.current = size;
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    const maybeEl = mountRef.current;
    if (!maybeEl) return;
    const containerEl: HTMLDivElement = maybeEl;

    let disposed = false;
    let frameId = 0;
    setStatus('loading');

    // Probe software WebGL once and release context immediately
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setStatus('fallback');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(sizeRef.current, sizeRef.current);
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    containerEl.innerHTML = '';
    containerEl.appendChild(canvas);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, variant === 'floating' ? 0.12 : 0.18, variant === 'floating' ? 3.45 : 3.15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Balanced studio lighting so pastel green sprout & apron stay vivid without over-exposure
    const hemiLight = new THREE.HemisphereLight(0xfff9ee, 0x62b49a, 0.62);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.08);
    keyLight.position.set(2.4, 3.4, 3.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc8f2e6, 0.38);
    rimLight.position.set(-2.4, 1.7, -2.0);
    scene.add(rimLight);

    const pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    const loadedObjects: THREE.Object3D[] = [];
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        loadedObjects.push(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const boxSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z) || 1;
        const targetScale = (variant === 'floating' ? 1.58 : 1.65) / maxDim;

        model.scale.setScalar(targetScale);
        model.position.copy(center).multiplyScalar(-targetScale);

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            mats.forEach((m) => {
              if (m && 'envMapIntensity' in m) {
                (m as THREE.MeshStandardMaterial).envMapIntensity = 0.2;
              }
            });
          }
        });

        pivotGroup.add(model);
        renderer.render(scene, camera);
        setStatus('ready');
        startLoop();
      },
      undefined,
      () => {
        if (!disposed) {
          setStatus('fallback');
        }
      }
    );

    const isFloating = variant === 'floating';

    // Pointer / touch gaze tracking (floating only) + random look-around state
    let lastActivityAt = performance.now();
    let isIdleLooking = !isFloating;
    let lastIdleZone: IdleLookZone | null = null;
    let nextIdleSwitchAt = 0;

    const targetGaze: MascotGazeTarget = { yaw: 0.14, pitch: 0, roll: 0 };
    let currentYaw = 0.14;
    let currentPitch = 0;
    let currentRoll = 0;
    let spinAngle = 0;

    let startSec = performance.now() / 1000;
    let lastSec = startSec;

    containerEl.dataset.mascotGaze = isFloating ? 'tracking' : 'random';

    const updateGazeFromPoint = (clientX: number, clientY: number) => {
      if (!isFloating) return;
      const rect = containerEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const next = computeMascotLookTarget({
        pointerX: clientX,
        pointerY: clientY,
        mascotCenterX: rect.left + rect.width / 2,
        mascotCenterY: rect.top + rect.height / 2,
        viewportWidth: window.innerWidth || 390,
        viewportHeight: window.innerHeight || 844,
      });
      targetGaze.yaw = next.yaw;
      targetGaze.pitch = next.pitch;
      targetGaze.roll = next.roll;

      lastActivityAt = performance.now();
      if (isIdleLooking) {
        isIdleLooking = false;
        containerEl.dataset.mascotGaze = 'tracking';
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateGazeFromPoint(e.clientX, e.clientY);
    };

    const handlePointerDown = (e: PointerEvent) => {
      updateGazeFromPoint(e.clientX, e.clientY);
    };

    const handleTouch = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        updateGazeFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    if (isFloating) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
      window.addEventListener('touchstart', handleTouch, { passive: true });
      window.addEventListener('touchmove', handleTouch, { passive: true });
    }

    function afterDraw(cb: () => void) {
      if (disposed) return;
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // Fallback below if WebGL1 context lacks fenceSync
      }
      frameId = window.setTimeout(cb, 90);
    }

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const nowSec = nowMs / 1000;
      const dt = Math.min(Math.max(nowSec - lastSec, 0.001), 0.1);
      lastSec = nowSec;
      const elapsed = nowSec - startSec;

      if (spinBoostRef.current > 0.01) {
        spinAngle += dt * spinBoostRef.current;
        spinBoostRef.current *= Math.exp(-3.2 * dt);
      } else {
        spinBoostRef.current = 0;
      }

      // Badge mascot always turns/looks around randomly on its own; floating mascot switches after 3s idle
      if (!isFloating || nowMs - lastActivityAt >= IDLE_DELAY_MS) {
        if (!isIdleLooking || nowMs >= nextIdleSwitchAt) {
          const pose = pickNextIdleLookPose(lastIdleZone);
          targetGaze.yaw = pose.yaw;
          targetGaze.pitch = pose.pitch;
          targetGaze.roll = pose.roll;
          lastIdleZone = pose.zone;
          nextIdleSwitchAt = nowMs + pose.durationMs;
          if (!isIdleLooking) {
            isIdleLooking = true;
            containerEl.dataset.mascotGaze = isFloating ? 'idle' : 'random';
          }
        }
      }

      // Slightly gentle follow-through delay (4.8) for gesture tracking, slower (2.2) for idle/random
      const dampSpeed = isIdleLooking ? 2.2 : 4.8;
      currentYaw = THREE.MathUtils.damp(currentYaw, targetGaze.yaw, dampSpeed, dt);
      currentPitch = THREE.MathUtils.damp(currentPitch, targetGaze.pitch, dampSpeed, dt);
      currentRoll = THREE.MathUtils.damp(currentRoll, targetGaze.roll, dampSpeed, dt);

      pivotGroup.rotation.y = currentYaw + spinAngle;
      pivotGroup.rotation.x = currentPitch;
      pivotGroup.rotation.z = currentRoll;
      pivotGroup.position.y = Math.sin(elapsed * 2.1) * 0.035;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    function startLoop() {
      if (disposed) return;
      startSec = performance.now() / 1000;
      lastSec = startSec;
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      if (isFloating) {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('touchstart', handleTouch);
        window.removeEventListener('touchmove', handleTouch);
      }

      loadedObjects.forEach((obj) => {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            mats.forEach((mat) => {
              if (!mat) return;
              const std = mat as THREE.MeshStandardMaterial;
              std.map?.dispose();
              std.normalMap?.dispose();
              std.roughnessMap?.dispose();
              std.metalnessMap?.dispose();
              mat.dispose();
            });
          }
        });
      });

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      envTexture.dispose();
      renderer.dispose();
      if (canvas.parentNode === containerEl) {
        containerEl.removeChild(canvas);
      }
    };
  }, [variant]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.setSize(size, size);
    renderer.render(scene, camera);
  }, [size]);

  if (variant === 'floating') {
    return (
      <div
        className="relative w-full h-full flex items-center justify-center pointer-events-none"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter:
            'saturate(1.26) contrast(1.06) brightness(0.97) drop-shadow(0 6px 12px rgba(45, 36, 22, 0.24))',
        }}
      >
        <div
          ref={mountRef}
          className="w-full h-full pointer-events-none"
          data-mascot-status={status}
        />
        {status !== 'ready' && (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-[28px] pointer-events-none"
          >
            🌱
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!disableTapSpin) {
          spinBoostRef.current = Math.min(spinBoostRef.current + 9, 18);
        }
      }}
      aria-label="Linh vật Mầm 3D của BữaNay"
      title="Chạm để xoay Mầm"
      className="relative shrink-0 rounded-full border-[2.5px] border-[#FFFDF5] overflow-hidden cursor-pointer p-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#037A5B]"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background:
          'radial-gradient(circle at 35% 30%, #FFD89B 0%, #FFAD60 65%, #F28B3C 100%)',
        boxShadow: '0 2px 10px rgba(230, 126, 34, 0.28)',
      }}
    >
      <div
        ref={mountRef}
        className="w-full h-full pointer-events-none"
        data-mascot-status={status}
        style={{ filter: 'saturate(1.24) contrast(1.05) brightness(0.97)' }}
      />
      {status !== 'ready' && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-[24px] pointer-events-none"
        >
          🌱
        </span>
      )}
    </button>
  );
}
