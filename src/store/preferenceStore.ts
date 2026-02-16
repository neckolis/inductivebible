import { create } from "zustand";
import {
  fetchPreferences,
  syncPreferencesToCloud,
  type Preferences,
} from "../lib/sync";

interface PreferenceState {
  preferences: Preferences;
  loaded: boolean;
  load: () => Promise<void>;
  setDefaultTranslation: (translation: string) => void;
}

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  preferences: {},
  loaded: false,

  load: async () => {
    const { data } = await fetchPreferences();
    if (data) {
      set({ preferences: data, loaded: true });
    } else {
      set({ loaded: true });
    }
  },

  setDefaultTranslation: (translation) => {
    const prefs = { ...get().preferences, defaultTranslation: translation };
    set({ preferences: prefs });
    syncPreferencesToCloud(prefs);
  },
}));
