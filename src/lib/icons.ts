import {
  Cross,
  Heart,
  Fire,
  Crown,
  BookOpen,
  Star,
  HandsPraying,
  Church,
  Eye,
  Lightbulb,
  Sword,
  Shield,
  Bird,
  Triangle,
  Scroll,
  Mountains,
  Drop,
  Leaf,
  Globe,
  Bell,
  Key,
  Compass,
  Scales,
  SunHorizon,
  Clock,
  Highlighter,
  Sticker,
  TextUnderline,
  Eraser,
  NotePencil,
} from "@phosphor-icons/react";
import type { ForwardRefExoticComponent, RefAttributes, SVGAttributes } from "react";

// Phosphor icon component type
type PhosphorIcon = ForwardRefExoticComponent<
  { size?: number | string; color?: string; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; mirrored?: boolean } &
  RefAttributes<SVGSVGElement> &
  SVGAttributes<SVGSVGElement>
>;

// Registry of all supported icons (only these are bundled)
export const ICON_REGISTRY: Record<string, PhosphorIcon> = {
  Cross: Cross as PhosphorIcon,
  Heart: Heart as PhosphorIcon,
  Fire: Fire as PhosphorIcon,
  Crown: Crown as PhosphorIcon,
  BookOpen: BookOpen as PhosphorIcon,
  Star: Star as PhosphorIcon,
  HandsPraying: HandsPraying as PhosphorIcon,
  Church: Church as PhosphorIcon,
  Eye: Eye as PhosphorIcon,
  Lightbulb: Lightbulb as PhosphorIcon,
  Sword: Sword as PhosphorIcon,
  Shield: Shield as PhosphorIcon,
  Bird: Bird as PhosphorIcon,
  Triangle: Triangle as PhosphorIcon,
  Scroll: Scroll as PhosphorIcon,
  Mountains: Mountains as PhosphorIcon,
  Drop: Drop as PhosphorIcon,
  Leaf: Leaf as PhosphorIcon,
  Globe: Globe as PhosphorIcon,
  Bell: Bell as PhosphorIcon,
  Key: Key as PhosphorIcon,
  Compass: Compass as PhosphorIcon,
  Scales: Scales as PhosphorIcon,
  SunHorizon: SunHorizon as PhosphorIcon,
  Clock: Clock as PhosphorIcon,
};

export const CURATED_ICON_NAMES = Object.keys(ICON_REGISTRY);

// Re-export toolbar icons for direct use
export {
  Highlighter,
  Sticker,
  TextUnderline,
  Eraser,
  BookOpen,
  NotePencil,
};

export type { PhosphorIcon };

// Runtime registration for full library (called from lazy-loaded allIcons.ts)
export function registerAll(icons: Record<string, PhosphorIcon>) {
  for (const [name, component] of Object.entries(icons)) {
    if (!ICON_REGISTRY[name]) {
      ICON_REGISTRY[name] = component;
    }
  }
}

export function getIconComponent(name: string): PhosphorIcon | undefined {
  return ICON_REGISTRY[name];
}
