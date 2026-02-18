import { useEffect, useState } from "react";
import { useMarkingStore } from "../store/markingStore";

export function UndoToast() {
  const { lastAction, undo, hasCloudBackup, restoreFromBackup, undoStack, saveError } = useMarkingStore();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (lastAction) {
      setMessage(lastAction);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastAction]);

  // Show backup restore option when undo stack is empty but cloud backup exists
  const showRestore = hasCloudBackup && undoStack.length === 0 && !visible;

  if (!visible && !showRestore && !saveError) return null;

  return (
    <>
      {saveError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center text-sm py-2 px-4" role="alert">
          Storage full — changes may not be saved. Try clearing old chapters.
        </div>
      )}
      {(visible || showRestore) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-sm" aria-live="polite">
          {visible && message && (
            <>
              <span>{message}</span>
              <button
                onClick={() => {
                  undo();
                  setVisible(false);
                }}
                className="text-blue-300 hover:text-blue-200 font-medium bg-transparent border-none cursor-pointer"
              >
                Undo
              </button>
            </>
          )}
          {showRestore && (
            <>
              <span>Markings were cleared</span>
              <button
                onClick={async () => {
                  setRestoring(true);
                  await restoreFromBackup();
                  setRestoring(false);
                }}
                disabled={restoring}
                className="text-blue-300 hover:text-blue-200 font-medium bg-transparent border-none cursor-pointer disabled:opacity-50"
              >
                {restoring ? "Restoring..." : "Restore from backup"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
