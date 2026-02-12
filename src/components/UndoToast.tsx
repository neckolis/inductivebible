import { useEffect, useState } from "react";
import { useMarkingStore } from "../store/markingStore";

export function UndoToast() {
  const { lastAction, undo } = useMarkingStore();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (lastAction) {
      setMessage(lastAction);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastAction]);

  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-sm">
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
    </div>
  );
}
