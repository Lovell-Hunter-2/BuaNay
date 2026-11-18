import { useEffect, useState } from 'react';
import {
  detectIsIOSUserAgent,
  resolveInstallState,
  type InstallClickAction,
} from '../utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_STORAGE_KEY = 'buanay_pwa_installed_v1';

function readPersistedInstalled(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedInstalled(): void {
  try {
    window.localStorage.setItem(INSTALLED_STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasRecordedInstall, setHasRecordedInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    setIsStandalone(checkStandalone());
    setHasRecordedInstall(readPersistedInstalled());
    setIsIOS(detectIsIOSUserAgent(window.navigator.userAgent || ''));

    // Also check getInstalledRelatedApps when supported (Android Chrome)
    const navWithApps = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform?: string }>>;
    };
    if (typeof navWithApps.getInstalledRelatedApps === 'function') {
      navWithApps
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            writePersistedInstalled();
            setHasRecordedInstall(true);
          }
        })
        .catch(() => {
          // Ignore unsupported browser errors
        });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      writePersistedInstalled();
      setHasRecordedInstall(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const state = resolveInstallState({
    isStandalone,
    isIOS,
    hasDeferredPrompt: Boolean(deferredPrompt),
    hasRecordedInstall,
  });

  const triggerNativeInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      writePersistedInstalled();
      setHasRecordedInstall(true);
      setDeferredPrompt(null);
      return 'accepted';
    }
    return 'dismissed';
  };

  return {
    isInstalled: state.isInstalled,
    isIOS,
    isInstallable: Boolean(deferredPrompt),
    clickAction: state.clickAction as InstallClickAction,
    triggerNativeInstall,
  };
}
