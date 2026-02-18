import { useState, useMemo, useRef } from "react";
import { useSymbolStore, type SymbolDef } from "../store/symbolStore";
import { useToolStore, PRESET_COLORS } from "../store/toolStore";
import { useSelectionStore } from "../store/selectionStore";
import { useMemoryStore } from "../store/memoryStore";
import { formatSymbolValue, parseSymbolValue } from "../lib/storage";
import { getIconComponent } from "../lib/icons";
import { allIconNames, allIcons } from "../lib/allIcons";
import { searchIcons } from "../lib/icon-tags";

const BookOpen = getIconComponent("BookOpen")!;

const WEIGHTS = ["regular", "fill", "duotone"] as const;
type Weight = (typeof WEIGHTS)[number];

const MAX_RECENT = 16;

/** Button for search results — uses current palette color/weight */
function IconButton({ name, Icon, activeColor, weight, onPick }: {
  name: string;
  Icon: ReturnType<typeof getIconComponent>;
  activeColor: string;
  weight: Weight;
  onPick: (name: string) => void;
}) {
  if (!Icon) return null;
  return (
    <button
      onClick={() => onPick(name)}
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
      title={name.replace(/([A-Z])/g, " $1").trim()}
    >
      <Icon size={18} color={activeColor} weight="regular" />
    </button>
  );
}

/** Button for Recent — renders with the stored color and weight */
function StoredSymbolButton({ sym, Icon, onApply, onRemove }: {
  sym: SymbolDef;
  Icon: ReturnType<typeof getIconComponent>;
  onApply: (value: string) => void;
  onRemove: (sym: SymbolDef) => void;
}) {
  if (!Icon) return null;
  const value = formatSymbolValue(sym.icon, sym.color, sym.weight);
  const label = sym.label || sym.icon.replace(/([A-Z])/g, " $1").trim();
  return (
    <button
      onClick={() => onApply(value)}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove(sym);
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/marking",
          JSON.stringify({ type: "symbol", value })
        );
      }}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors border-none cursor-pointer bg-transparent"
      title={`${label} (right-click to remove)`}
    >
      <Icon size={18} color={sym.color} weight={sym.weight as Weight} />
    </button>
  );
}

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
  const removeSymbol = useSymbolStore((s) => s.removeSymbol);
  const selectedWordTexts = useSelectionStore((s) => s.selectedWordTexts);
  const getAllSuggestions = useMemoryStore((s) => s.getAllSuggestions);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Smart suggestions from memory store
  const suggestions = useMemo(() => {
    if (selectedWordTexts.length === 0) return [];
    return getAllSuggestions(selectedWordTexts);
  }, [selectedWordTexts, getAllSuggestions]);

  // Recent: show used symbols first, fall back to defaults for new users
  const recentSymbols = useMemo(() => {
    const used = [...symbols]
      .filter((s) => s.lastUsed > 0)
      .sort((a, b) => b.lastUsed - a.lastUsed || b.usageCount - a.usageCount)
      .slice(0, MAX_RECENT);
    // Show defaults if nothing has been used yet
    if (used.length === 0) return symbols.slice(0, MAX_RECENT);
    return used;
  }, [symbols]);

  // Search results using tag-aware search
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return searchIcons(search, allIconNames).map((r) => r.name);
  }, [search]);

  function getIcon(name: string) {
    return allIcons[name] ?? getIconComponent(name);
  }

  function handlePick(iconName: string) {
    onSelect(formatSymbolValue(iconName, activeColor, weight));
  }

  // Suggestion label
  const suggestionLabel = useMemo(() => {
    if (selectedWordTexts.length === 0) return "";
    if (selectedWordTexts.length === 1) return `"${selectedWordTexts[0]}"`;
    if (selectedWordTexts.length <= 3) return selectedWordTexts.map((w) => `"${w}"`).join(", ");
    return `"${selectedWordTexts[0]}" + ${selectedWordTexts.length - 1} more`;
  }, [selectedWordTexts]);

  const allColors = [
    ...PRESET_COLORS.map((c) => ({ hex: c.hex, name: c.name, custom: false })),
    ...customColors.map((hex) => ({ hex, name: hex, custom: true })),
  ];

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {/* Suggestion bar */}
      {suggestions.length > 0 && !search.trim() && (
        <div>
          <div className="text-[9px] font-medium text-blue-500 uppercase tracking-wider px-0.5 py-0.5">
            Suggested for {suggestionLabel} <span className="normal-case text-gray-400">(Enter to apply)</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {suggestions.map((assoc) => {
              const parsed = parseSymbolValue(assoc.symbol);
              if (!parsed) return null;
              const Icon = getIcon(parsed.icon);
              if (!Icon) return null;
              return (
                <button
                  key={assoc.symbol}
                  onClick={() => onSelect(assoc.symbol)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shrink-0 text-xs"
                  title={`${parsed.icon} (used ${assoc.count}x)`}
                >
                  <Icon size={14} color={parsed.color} weight={parsed.weight as Weight} />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: parsed.color }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search icons..."
        className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white outline-none focus:border-blue-400"
      />

      {/* Icon grid */}
      <div className="max-h-28 overflow-y-auto">
        {search.trim() ? (
          /* Search results — use current palette color/weight */
          searchResults.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {searchResults.map((name) => {
                const Icon = getIcon(name);
                if (!Icon) return null;
                return (
                  <IconButton key={name} name={name} Icon={Icon} activeColor={activeColor} weight={weight} onPick={handlePick} />
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-3">No icons found</div>
          )
        ) : (
          /* Default: only recent (with stored colors) */
          recentSymbols.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {recentSymbols.map((sym) => {
                const Icon = getIcon(sym.icon);
                return (
                  <StoredSymbolButton
                    key={`r-${sym.icon}-${sym.color}-${sym.weight}`}
                    sym={sym}
                    Icon={Icon}
                    onApply={onSelect}
                    onRemove={(s) => removeSymbol(s.icon, s.color, s.weight)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-3">Search to find icons</div>
          )
        )}
      </div>

      {/* Style + Color on one row */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {/* Style - BookOpen in 3 weights */}
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
              className="absolute -left-[9999px] w-px h-px pointer-events-none opacity-0"
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
