import { useState, useMemo, useRef } from "react";
import { useSymbolStore } from "../store/symbolStore";
import { useToolStore, PRESET_COLORS } from "../store/toolStore";
import { formatSymbolValue } from "../lib/storage";
import { CURATED_ICON_NAMES, getIconComponent } from "../lib/icons";
import { allIconNames, allIcons } from "../lib/allIcons";

const BookOpen = getIconComponent("BookOpen")!;

const WEIGHTS = ["regular", "bold", "fill", "duotone"] as const;
type Weight = (typeof WEIGHTS)[number];

interface Props {
  onSelect: (symbolValue: string) => void;
}

export function IconPicker({ onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [weight, setWeight] = useState<Weight>("fill");
  const activeColor = useToolStore((s) => s.activeColor);
  const customColors = useToolStore((s) => s.customColors);
  const setActiveColor = useToolStore((s) => s.setActiveColor);
  const addCustomColor = useToolStore((s) => s.addCustomColor);
  const removeCustomColor = useToolStore((s) => s.removeCustomColor);
  const symbols = useSymbolStore((s) => s.symbols);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Recent icon names, deduped
  const recentIconNames = useMemo(() => {
    const seen = new Set<string>();
    return [...symbols]
      .sort((a, b) => b.lastUsed - a.lastUsed || b.usageCount - a.usageCount)
      .reduce<string[]>((acc, s) => {
        if (!seen.has(s.icon)) {
          seen.add(s.icon);
          acc.push(s.icon);
        }
        return acc;
      }, []);
  }, [symbols]);

  // Grid: when searching, show filtered results. Otherwise, recent first then curated (deduped)
  const displayIcons = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return allIconNames
        .filter((name) => name.toLowerCase().includes(q))
        .slice(0, 60);
    }
    const recentSet = new Set(recentIconNames);
    const curated = CURATED_ICON_NAMES.filter((n) => !recentSet.has(n));
    return [...recentIconNames, ...curated];
  }, [search, recentIconNames]);

  function getIcon(name: string) {
    return allIcons[name] ?? getIconComponent(name);
  }

  function handlePick(iconName: string) {
    onSelect(formatSymbolValue(iconName, activeColor, weight));
  }

  const allColors = [
    ...PRESET_COLORS.map((c) => ({ hex: c.hex, name: c.name, custom: false })),
    ...customColors.map((hex) => ({ hex, name: hex, custom: true })),
  ];

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search all icons..."
        className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white outline-none focus:border-blue-400"
      />

      {/* Icon grid - recent prepended, always "regular" weight */}
      <div className="grid grid-cols-8 gap-0.5 max-h-20 overflow-y-auto">
        {displayIcons.map((name) => {
          const Icon = getIcon(name);
          if (!Icon) return null;
          return (
            <button
              key={name}
              onClick={() => handlePick(name)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/marking",
                  JSON.stringify({
                    type: "symbol",
                    value: formatSymbolValue(name, activeColor, weight),
                  })
                );
              }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors border-none cursor-pointer bg-transparent"
              title={name}
            >
              <Icon size={18} color={activeColor} weight="regular" />
            </button>
          );
        })}
      </div>

      {/* Style + Color on one row */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {/* Style - BookOpen in 4 weights */}
        {WEIGHTS.map((w) => (
          <button
            key={w}
            onClick={() => setWeight(w)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors border-none cursor-pointer ${
              weight === w
                ? "bg-blue-50 ring-1 ring-blue-300"
                : "bg-transparent hover:bg-gray-100"
            }`}
            title={w}
          >
            <BookOpen size={14} color={activeColor} weight={w} />
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Colors */}
        {allColors.map((c) => (
          <button
            key={c.hex}
            onClick={() => setActiveColor(c.hex)}
            onContextMenu={(e) => {
              if (c.custom) {
                e.preventDefault();
                removeCustomColor(c.hex);
              }
            }}
            className={`w-6 h-6 rounded-full border-none cursor-pointer shrink-0 transition-all ${
              activeColor === c.hex
                ? "ring-2 ring-offset-1 ring-blue-400 scale-110"
                : ""
            }`}
            style={{ backgroundColor: c.hex }}
            title={c.custom ? `${c.hex} (right-click to remove)` : c.name}
          />
        ))}
        {customColors.length < 4 && (
          <>
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-6 h-6 rounded-full border border-dashed border-gray-300 cursor-pointer bg-transparent flex items-center justify-center text-gray-400 text-xs hover:border-gray-400 hover:text-gray-500 transition-colors"
              title="Add custom color"
            >
              +
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={activeColor}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={(e) => {
                addCustomColor(e.target.value);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
