import { useEffect, useState } from "react";

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["\u2190", "\u2192"], desc: "Move to previous / next word" },
      { keys: ["\u2191", "\u2193"], desc: "Move to word above / below" },
      { keys: ["Shift", "+", "\u2190\u2192\u2191\u2193"], desc: "Extend selection" },
      { keys: ["\u2190", "\u2192"], desc: "Previous / next chapter (no selection)" },
      { keys: ["Esc"], desc: "Deselect" },
    ],
  },
  {
    title: "Marking",
    shortcuts: [
      { keys: ["H"], desc: "Toggle highlight panel" },
      { keys: ["S"], desc: "Toggle icon picker" },
      { keys: ["U"], desc: "Toggle underline panel" },
      { keys: ["\u2318", "U"], desc: "Cycle underline style" },
      { keys: ["C"], desc: "Clear all marks from selection" },
      { keys: ["\u232B"], desc: "Remove marks from selection" },
      { keys: ["G"], desc: "Open dictionary" },
    ],
  },
  {
    title: "In pickers",
    shortcuts: [
      { keys: ["\u2190", "\u2192"], desc: "Navigate options" },
      { keys: ["Enter"], desc: "Apply focused option" },
      { keys: ["Esc"], desc: "Close picker" },
      { keys: ["a\u2013z"], desc: "Search symbols (in symbol picker)" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["\u2318", "K"], desc: "Command palette" },
      { keys: ["\u2318", "Z"], desc: "Undo" },
      { keys: ["\u2318", "\u21E7", "Z"], desc: "Redo" },
      { keys: ["N"], desc: "Open notes" },
      { keys: ["?"], desc: "Show this help" },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-lg"
          >
            &times;
          </button>
        </div>
        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{s.desc}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {s.keys.map((k, ki) => (
                        <span key={ki}>
                          {k === "+" ? (
                            <span className="text-xs text-gray-400 mx-0.5">+</span>
                          ) : (
                            <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded">
                              {k}
                            </kbd>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-3 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-400">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-200">?</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-200">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
