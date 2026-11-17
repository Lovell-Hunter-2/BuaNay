export type InstallClickAction =
  | 'installed_card'
  | 'native_prompt'
  | 'ios_guide'
  | 'android_guide';

export interface InstallDetectionInput {
  isStandalone: boolean;
  isIOS: boolean;
  hasDeferredPrompt: boolean;
  hasRecordedInstall: boolean;
}

export function detectIsIOSUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

export function resolveInstallState(input: InstallDetectionInput): {
  isInstalled: boolean;
  clickAction: InstallClickAction;
} {
  const isInstalled = input.isStandalone || input.hasRecordedInstall;

  if (isInstalled) {
    return {
      isInstalled: true,
      clickAction: 'installed_card',
    };
  }

  if (input.hasDeferredPrompt) {
    return {
      isInstalled: false,
      clickAction: 'native_prompt',
    };
  }

  if (input.isIOS) {
    return {
      isInstalled: false,
      clickAction: 'ios_guide',
    };
  }

  return {
    isInstalled: false,
    clickAction: 'android_guide',
  };
}
