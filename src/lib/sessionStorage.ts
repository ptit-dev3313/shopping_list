import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

// Native preferences survive WebView cache cleanup and ordinary app restarts.
// On the web Supabase keeps its default localStorage implementation.
export const nativeSessionStorage = Capacitor.isNativePlatform() ? {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
    const previous = window.localStorage.getItem(key);
    if (previous !== null) {
      await Preferences.set({ key, value: previous });
      window.localStorage.removeItem(key);
    }
    return previous;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
    window.localStorage.removeItem(key);
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
    window.localStorage.removeItem(key);
  },
} : undefined;
