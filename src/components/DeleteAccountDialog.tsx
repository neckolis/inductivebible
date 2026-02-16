import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { Warning, X } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DeleteAccountDialog({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  if (!open) return null;

  const confirmed = input === "DELETE";

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const ok = await deleteAccount();
    if (!ok) {
      setError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
    // If ok, the user is signed out and state is cleared — dialog unmounts
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-red-600">
            <Warning size={20} weight="fill" />
            <h2 className="text-lg font-semibold">Delete Account</h2>
          </div>
          <button
            onClick={() => { setInput(""); setError(null); onClose(); }}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          This will permanently delete your account and all associated data, including:
        </p>
        <ul className="text-sm text-gray-600 mb-4 list-disc pl-5 space-y-1">
          <li>All markings and highlights</li>
          <li>Custom symbols</li>
          <li>Memory associations</li>
          <li>Notes</li>
          <li>Preferences</li>
        </ul>

        <p className="text-sm text-gray-700 font-medium mb-2">
          Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm:
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
        />

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setInput(""); setError(null); onClose(); }}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border-none cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-lg border-none cursor-pointer transition-colors"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
