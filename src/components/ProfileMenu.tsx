import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { User } from "@phosphor-icons/react";

interface Props {
  onSignIn: () => void;
}

export function ProfileMenu({ onSignIn }: Props) {
  const { user, loading, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [open]);

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

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-medium flex items-center justify-center border-none cursor-pointer overflow-hidden"
      >
        {user.image ? (
          <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          initials || <User size={14} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
