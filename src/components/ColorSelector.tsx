import { useRef } from "react";
import { useToolStore, PRESET_COLORS } from "../store/toolStore";

interface Props {
  onSelect?: (color: string) => void;
}

export function ColorSelector({ onSelect }: Props) {
  const { activeColor, customColors, setActiveColor, addCustomColor, removeCustomColor } =
    useToolStore();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick(hex: string) {
    setActiveColor(hex);
    onSelect?.(hex);
  }

  const allColors = [
    ...PRESET_COLORS.map((c) => ({ hex: c.hex, name: c.name, custom: false })),
    ...customColors.map((hex) => ({ hex, name: hex, custom: true })),
  ];

  return (
    <div className="flex items-center gap-1.5 justify-center py-1">
      {allColors.map((c) => (
        <button
          key={c.hex}
          onClick={() => handleClick(c.hex)}
          onContextMenu={(e) => {
            if (c.custom) {
              e.preventDefault();
              removeCustomColor(c.hex);
            }
          }}
          className={`w-7 h-7 rounded-full border-none cursor-pointer shrink-0 transition-all ${
            activeColor === c.hex ? "ring-2 ring-offset-1 ring-blue-400 scale-110" : ""
          }`}
          style={{ backgroundColor: c.hex }}
          title={c.custom ? `${c.hex} (right-click to remove)` : c.name}
        />
      ))}
      {customColors.length < 4 && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            className="w-7 h-7 rounded-full border border-dashed border-gray-300 cursor-pointer bg-transparent flex items-center justify-center text-gray-400 text-sm hover:border-gray-400 hover:text-gray-500 transition-colors"
            title="Add custom color"
          >
            +
          </button>
          <input
            ref={inputRef}
            type="color"
            value={activeColor}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={(e) => {
              addCustomColor(e.target.value);
              onSelect?.(e.target.value);
            }}
          />
        </>
      )}
    </div>
  );
}
