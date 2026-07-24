export const HILAAC_GUEST_ID_KEY = "hilaac_guest_id";

function newGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Returns existing guest id or creates + persists one. Safe when storage is blocked. */
export function ensureGuestId(): string {
  if (typeof window === "undefined") return "";

  try {
    let guestId = localStorage.getItem(HILAAC_GUEST_ID_KEY);
    if (!guestId) {
      guestId = newGuestId();
      localStorage.setItem(HILAAC_GUEST_ID_KEY, guestId);
    }
    return guestId;
  } catch {
    // Incognito / blocked storage — still return a stable-enough id for this page load.
    return newGuestId();
  }
}

export function getGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(HILAAC_GUEST_ID_KEY);
  } catch {
    return null;
  }
}
