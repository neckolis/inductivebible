import { useMarkingStore } from "../store/markingStore";
import { parseSymbolValue } from "../lib/storage";
import { getIconComponent } from "../lib/icons";

// Legacy named color → Tailwind class maps (backward compatibility)
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "bg-yellow-200",
  pink: "bg-pink-200",
  blue: "bg-blue-200",
  green: "bg-green-200",
  purple: "bg-purple-200",
  orange: "bg-orange-200",
};

const UNDERLINE_STYLE_CLASS: Record<string, string> = {
  single: "underline",
  double: "underline decoration-double",
  wavy: "underline decoration-wavy",
};

const UNDERLINE_COLOR_CLASS: Record<string, string> = {
  yellow: "decoration-yellow-500",
  pink: "decoration-pink-500",
  blue: "decoration-blue-500",
  green: "decoration-green-500",
  purple: "decoration-purple-500",
  orange: "decoration-orange-500",
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  verse: number;
  wordIndex: number;
  word: string;
  isSelected: boolean;
  isDragOver?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

function renderSymbol(value: string) {
  const parsed = parseSymbolValue(value);
  if (!parsed) {
    // Legacy emoji fallback
    return (
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl leading-none pointer-events-none select-none">
        {value}
      </span>
    );
  }

  const IconComponent = getIconComponent(parsed.icon);

  if (!IconComponent) {
    return (
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs leading-none pointer-events-none select-none">
        {parsed.icon}
      </span>
    );
  }

  return (
    <span className="absolute -top-4 left-1/2 -translate-x-1/2 leading-none pointer-events-none select-none flex items-center justify-center">
      <IconComponent
        size={16}
        color={parsed.color}
        weight={parsed.weight as "regular" | "bold" | "fill" | "duotone"}
      />
    </span>
  );
}

export function WordSpan({
  verse,
  wordIndex,
  word,
  isSelected,
  isDragOver,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const marking = useMarkingStore((s) => s.markings[`${verse}:${wordIndex}`]);

  let className = "relative cursor-pointer rounded-sm px-[1px] transition-colors ";
  const inlineStyle: React.CSSProperties = {};

  if (isSelected) {
    className += "bg-blue-100 ";
  }

  if (isDragOver) {
    className += "ring-2 ring-blue-400 ";
  }

  // Apply highlight layer
  if (marking?.highlight) {
    const val = marking.highlight.value;
    if (val.startsWith("#")) {
      // Hex color → semi-transparent inline style
      inlineStyle.backgroundColor = hexToRgba(val, 0.3);
    } else {
      // Legacy named color → Tailwind class
      className += (HIGHLIGHT_COLORS[val] ?? "") + " ";
    }
  }

  // Apply underline layer
  if (marking?.underline) {
    const parts = marking.underline.value.split(":");
    const style = parts[0];
    const color = parts[1];
    className += (UNDERLINE_STYLE_CLASS[style] ?? "underline") + " ";
    if (color?.startsWith("#")) {
      // Hex color → inline style
      inlineStyle.textDecorationColor = color;
    } else {
      // Legacy named color → Tailwind class
      className += (color ? UNDERLINE_COLOR_CLASS[color] ?? "" : "decoration-gray-700") + " ";
    }
  }

  return (
    <span
      className={className}
      style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-verse={verse}
      data-word={wordIndex}
    >
      {marking?.symbol && renderSymbol(marking.symbol.value)}
      {word}
    </span>
  );
}
