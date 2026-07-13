/**
 * Storage for a user-supplied Gemini API key (BYOK). The key is used only to
 * call Google directly from the browser — it is NEVER sent to our own server.
 *
 * Kept in module memory by default (survives navigation, gone on reload).
 * "Remember for this session" additionally mirrors it to sessionStorage, which
 * clears when the tab closes. We deliberately never touch localStorage.
 */
const STORAGE_KEY = 'shopicat.gemini.key';
let memKey: string | null = null;

export function getUserKey(): string | null {
  if (memKey) return memKey;
  try {
    memKey = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
  return memKey;
}

export function setUserKey(key: string, remember: boolean): void {
  memKey = key.trim() || null;
  try {
    if (remember && memKey) sessionStorage.setItem(STORAGE_KEY, memKey);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearUserKey(): void {
  memKey = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
