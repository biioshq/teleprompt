"use client";

/**
 * A device identity that survives reloads but never leaves this browser
 * profile. It is the presence key on the Realtime channel and the addressing
 * key for WebRTC signalling.
 */

const STORAGE_KEY = "teleprompt.device";
const LABEL_KEY = "teleprompt.device.label";

export type StoredDevice = {
  deviceKey: string;
  label: string;
  platform: string;
};

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** A short, honest name for this device, shown in the connected-devices list. */
export function describePlatform(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;

  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Browser";

  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";

  return `${os} · ${browser}`;
}

export function getDevice(): StoredDevice {
  const platform = describePlatform();

  if (typeof window === "undefined") {
    return { deviceKey: "server0000000000", label: platform, platform };
  }

  let deviceKey = window.localStorage.getItem(STORAGE_KEY);
  if (!deviceKey || deviceKey.length < 8) {
    deviceKey = randomKey();
    window.localStorage.setItem(STORAGE_KEY, deviceKey);
  }

  const label = window.localStorage.getItem(LABEL_KEY) ?? platform;
  return { deviceKey, label, platform };
}

export function setDeviceLabel(label: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LABEL_KEY, label.trim().slice(0, 80));
}

/** Standalone means the PWA was installed and launched from the home screen. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari predates the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}
