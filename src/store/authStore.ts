import { create } from "zustand";
import { authClient } from "../lib/auth-client";
import { deleteAccountOnServer } from "../lib/sync";
import { usePreferenceStore } from "./preferenceStore";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  init: () => void;
  signOut: () => Promise<void>;
  claimDevice: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  init: () => {
    // Subscribe to Better Auth session
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        set({ user: data.user as AuthUser, loading: false });
        // Attempt to claim device data on session init
        get().claimDevice();
        // Load user preferences
        usePreferenceStore.getState().load();
      } else {
        set({ user: null, loading: false });
      }
    }).catch(() => {
      set({ user: null, loading: false });
    });
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null });
  },

  deleteAccount: async () => {
    const ok = await deleteAccountOnServer();
    if (ok) {
      await authClient.signOut();
      localStorage.clear();
      set({ user: null });
    }
    return ok;
  },

  claimDevice: async () => {
    const deviceId = localStorage.getItem("device-id");
    if (!deviceId) return;

    try {
      const res = await fetch("/api/data/claim-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
        credentials: "include",
      });
      if (res.ok) {
        // Mark as claimed so we don't retry
        localStorage.setItem("device-claimed", "true");
      }
    } catch {
      // offline — will try again next time
    }
  },
}));
