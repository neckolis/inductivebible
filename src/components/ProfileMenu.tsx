import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { usePreferenceStore } from "../store/preferenceStore";
import { TRANSLATIONS } from "../lib/translations";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { User, X, SignOut, Trash, CaretDown } from "@phosphor-icons/react";

interface Props {
  onSignIn: () => void;
}

export function ProfileMenu({ onSignIn }: Props) {
  const { user, loading, signOut } = useAuthStore();
  const { preferences, setDefaultTranslation } = usePreferenceStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  // Close panel on Escape
  useEffect(() => {
    if (!panelOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [panelOpen]);

  if (loading) {
    return (
      <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="text-xs text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer font-medium"
      >
        Sign in
      </button>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentTranslation = preferences.defaultTranslation ?? "NASB";

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setPanelOpen(true); }}
        className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-medium flex items-center justify-center border-none cursor-pointer overflow-hidden"
      >
        {user.image ? (
          <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          initials || <User size={14} />
        )}
      </button>

      {/* Profile Panel Modal */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/30">
          <div
            ref={panelRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold text-gray-900">Profile</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* User info */}
            <div className="px-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-medium flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    initials || <User size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Default translation */}
            <div className="px-5 py-4 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Default Translation
              </label>
              <div className="relative">
                <select
                  value={currentTranslation}
                  onChange={(e) => setDefaultTranslation(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer pr-8"
                >
                  {TRANSLATIONS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 space-y-1">
              <button
                onClick={() => { setPanelOpen(false); signOut(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer rounded-lg transition-colors text-left"
              >
                <SignOut size={16} className="text-gray-400" />
                Sign out
              </button>
              <button
                onClick={() => { setPanelOpen(false); setDeleteOpen(true); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer rounded-lg transition-colors text-left"
              >
                <Trash size={16} />
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}
