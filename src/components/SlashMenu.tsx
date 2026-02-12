import { Command } from "cmdk";
import { useEffect, useRef } from "react";
import type { BlockType } from "../lib/noteTypes";

interface Props {
  position: { top: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

const COMMANDS: { type: BlockType; label: string; desc: string; icon: string }[] = [
  { type: "text", label: "Text", desc: "Plain text block", icon: "Aa" },
  { type: "heading", label: "Heading", desc: "Section heading", icon: "H" },
  { type: "bullet", label: "Bullet List", desc: "Unordered list item", icon: "\u2022" },
  { type: "numbered", label: "Numbered List", desc: "Ordered list item", icon: "1." },
  { type: "quote", label: "Quote", desc: "Block quote", icon: "\u201c" },
  { type: "todo", label: "To-do", desc: "Checkbox item", icon: "\u2610" },
  { type: "callout", label: "Callout", desc: "Highlighted callout box", icon: "\u2728" },
  { type: "divider", label: "Divider", desc: "Horizontal line", icon: "\u2014" },
];

export function SlashMenu({ position, onSelect, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure the input gets focused on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }} />
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-64 max-h-72 overflow-y-auto"
        style={{ top: position.top, left: position.left }}
      >
        <Command label="Block type">
          <Command.Input
            ref={inputRef}
            autoFocus
            placeholder="Filter..."
            className="px-3 py-2 text-sm border-b border-gray-100 outline-none w-full"
          />
          <Command.List className="py-1">
            <Command.Empty className="px-3 py-2 text-sm text-gray-400">
              No results
            </Command.Empty>
            {COMMANDS.map((cmd) => (
              <Command.Item
                key={cmd.type}
                value={cmd.label}
                onSelect={() => onSelect(cmd.type)}
                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 data-[selected=true]:bg-blue-50 rounded-md mx-1"
              >
                <span className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 font-medium text-xs shrink-0">
                  {cmd.icon}
                </span>
                <div>
                  <div className="font-medium text-gray-900">{cmd.label}</div>
                  <div className="text-xs text-gray-400">{cmd.desc}</div>
                </div>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </>
  );
}
