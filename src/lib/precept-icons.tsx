/**
 * Custom SVG icon library for Precept-style Bible study.
 * Each icon matches the Phosphor Icons API (size, color, weight, mirrored).
 * Viewbox: 256x256. Optimized for clarity at 16px.
 */
import { forwardRef, type ReactNode, type SVGAttributes } from "react";

type Weight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

type RenderFn = (p: {
  color: string;
  sw: number;
  filled: boolean;
  duotone: boolean;
}) => ReactNode;

interface IconProps extends SVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
  weight?: Weight;
  mirrored?: boolean;
}

function defineIcon(displayName: string, render: RenderFn) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, color = "currentColor", weight = "regular", mirrored, style, ...rest }, ref) => {
      const sw = weight === "bold" ? 24 : weight === "thin" ? 8 : weight === "light" ? 12 : 16;
      const filled = weight === "fill" || weight === "duotone";
      const duotone = weight === "duotone";
      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 256 256"
          fill="none"
          style={{ ...style, ...(mirrored ? { transform: "scaleX(-1)" } : {}) }}
          {...rest}
        >
          {render({ color, sw, filled, duotone })}
        </svg>
      );
    }
  );
  Icon.displayName = displayName;
  return Icon;
}

/** Common stroke/fill props helper */
function sf(filled: boolean, duotone: boolean, color: string, sw: number) {
  return {
    fill: filled ? color : "none",
    fillOpacity: duotone ? 0.2 : 1,
    stroke: !filled || duotone ? color : "none",
    strokeWidth: !filled || duotone ? sw : 0,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

// ─────────────────────── Icons ───────────────────────

export const Dove = defineIcon("Dove", ({ color, sw, filled, duotone }) => (
  <>
    <path
      d="M48,160 C48,108 88,76 128,76 L184,44 L216,28 L188,84 C216,112 220,160 188,196 C156,228 100,220 64,192 C48,180 48,168 48,160Z"
      {...sf(filled, duotone, color, sw)}
    />
    {/* Wing detail */}
    <path
      d="M100,112 C112,88 140,80 160,88"
      fill="none" stroke={color} strokeWidth={sw * 0.75}
      strokeLinecap="round"
    />
  </>
));

export const Lamb = defineIcon("Lamb", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Fluffy body */}
      <path
        d="M96,108 C84,88 100,68 120,76 C128,60 156,60 164,76 C180,68 200,84 192,108 C208,116 208,140 192,148 C196,168 176,176 156,168 C144,180 112,180 104,168 C84,172 68,156 76,140 C60,132 64,108 80,104 C84,96 92,96 96,108Z"
        {...p}
      />
      {/* Head */}
      <circle cx="68" cy="108" r="24" {...p} />
      {/* Legs */}
      <line x1="100" y1="176" x2="96" y2="224" stroke={color} strokeWidth={sw * 0.7} strokeLinecap="round" />
      <line x1="136" y1="180" x2="132" y2="224" stroke={color} strokeWidth={sw * 0.7} strokeLinecap="round" />
      <line x1="160" y1="176" x2="164" y2="224" stroke={color} strokeWidth={sw * 0.7} strokeLinecap="round" />
      <line x1="188" y1="168" x2="192" y2="216" stroke={color} strokeWidth={sw * 0.7} strokeLinecap="round" />
      {/* Eye */}
      <circle cx="58" cy="104" r="4" fill={color} />
    </>
  );
});

export const Serpent = defineIcon("Serpent", ({ color, sw, filled }) => (
  <>
    <path
      d="M72,216 C52,172 148,172 148,128 C148,84 52,84 72,40"
      fill="none" stroke={color} strokeWidth={filled ? sw * 1.5 : sw}
      strokeLinecap="round" strokeLinejoin="round"
    />
    {/* Head */}
    <path
      d="M72,40 L60,24 L84,28 L72,40Z"
      fill={color}
    />
    {/* Tongue */}
    <path d="M60,24 L48,12 M60,24 L44,28" fill="none" stroke={color} strokeWidth={sw * 0.5} strokeLinecap="round" />
    {/* Eyes */}
    <circle cx="76" cy="36" r="3" fill={filled ? "white" : color} />
  </>
));

export const Tombstone = defineIcon("Tombstone", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Stone shape */}
      <path d="M72,224 L72,104 A56,56 0 0,1 184,104 L184,224Z" {...p} />
      {/* Cross */}
      <line x1="128" y1="96" x2="128" y2="176" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.75} strokeLinecap="round" />
      <line x1="104" y1="124" x2="152" y2="124" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.75} strokeLinecap="round" />
      {/* Ground line */}
      <line x1="40" y1="224" x2="216" y2="224" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

export const Chains = defineIcon("Chains", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Upper link */}
      <rect x="56" y="40" width="72" height="96" rx="36" {...p} />
      {/* Lower link */}
      <rect x="128" y="120" width="72" height="96" rx="36" {...p} />
    </>
  );
});

export const BrokenChain = defineIcon("BrokenChain", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Left link */}
      <rect x="32" y="56" width="72" height="96" rx="36" {...p} />
      {/* Right link (shifted away to show break) */}
      <rect x="152" y="104" width="72" height="96" rx="36" {...p} />
      {/* Break sparks */}
      <line x1="120" y1="108" x2="136" y2="96" stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" />
      <line x1="120" y1="128" x2="140" y2="128" stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" />
      <line x1="120" y1="148" x2="136" y2="160" stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" />
    </>
  );
});

export const Tablets = defineIcon("Tablets", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Left tablet */}
      <path d="M36,216 L36,88 A44,44 0 0,1 120,88 L120,216Z" {...p} />
      {/* Right tablet */}
      <path d="M136,216 L136,88 A44,44 0 0,1 220,88 L220,216Z" {...p} />
      {/* Lines on left */}
      <line x1="56" y1="120" x2="100" y2="120" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <line x1="56" y1="148" x2="100" y2="148" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <line x1="56" y1="176" x2="100" y2="176" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
      {/* Lines on right */}
      <line x1="156" y1="120" x2="200" y2="120" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <line x1="156" y1="148" x2="200" y2="148" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <line x1="156" y1="176" x2="200" y2="176" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.4} strokeLinecap="round" />
    </>
  );
});

export const OilLamp = defineIcon("OilLamp", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Lamp body */}
      <path d="M80,160 Q56,160 48,136 Q40,112 64,104 L120,104 Q160,104 176,120 L200,136 Q216,144 200,152 L176,148 Q160,160 120,160Z" {...p} />
      {/* Spout/flame */}
      <path d="M200,136 L212,120" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Flame */}
      <path
        d="M212,120 C204,96 216,76 212,60 C220,76 228,96 220,120"
        fill={filled ? color : "none"}
        fillOpacity={duotone ? 0.2 : 1}
        stroke={color} strokeWidth={sw * 0.6}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Handle */}
      <path d="M96,104 C96,72 128,64 128,104" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Base */}
      <path d="M80,160 L72,188 L148,188 L120,160" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
});

export const Chalice = defineIcon("Chalice", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Bowl */}
      <path d="M56,48 L72,136 Q128,176 184,136 L200,48Z" {...p} />
      {/* Rim */}
      <line x1="48" y1="48" x2="208" y2="48" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Stem */}
      <line x1="128" y1="148" x2="128" y2="196" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Base */}
      <path d="M80,196 L176,196 Q176,220 128,220 Q80,220 80,196Z" {...p} />
    </>
  );
});

export const Shofar = defineIcon("Shofar", ({ color, sw, filled, duotone }) => (
  <path
    d="M48,200 C40,152 56,96 96,64 C128,40 168,32 200,48 C216,56 224,72 216,88 C208,104 188,100 180,88 C168,68 140,60 112,76 C80,96 64,136 68,184Z"
    {...sf(filled, duotone, color, sw)}
  />
));

export const Altar = defineIcon("Altar", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Stone block */}
      <rect x="56" y="128" width="144" height="88" rx="4" {...p} />
      {/* Top slab */}
      <rect x="44" y="120" width="168" height="16" rx="4" {...p} />
      {/* Flames */}
      <path d="M104,120 C96,92 108,68 104,48 C112,68 120,88 116,112" fill={filled ? color : "none"} fillOpacity={duotone ? 0.2 : 1} stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M136,120 C128,88 140,60 136,36 C144,60 156,88 148,112" fill={filled ? color : "none"} fillOpacity={duotone ? 0.2 : 1} stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M168,120 C164,100 172,84 168,68 C176,84 180,100 176,116" fill={filled ? color : "none"} fillOpacity={duotone ? 0.2 : 1} stroke={color} strokeWidth={sw * 0.6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
});

export const Tent = defineIcon("Tent", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Tent body */}
      <path d="M128,32 L24,216 L232,216Z" {...p} />
      {/* Opening */}
      <path d="M104,216 L120,136 L128,128 L136,136 L152,216" fill={filled ? "white" : "none"} fillOpacity={filled ? (duotone ? 0.6 : 1) : 0} stroke={color} strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round" />
      {/* Center pole */}
      <line x1="128" y1="32" x2="128" y2="24" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

export const CrownOfThorns = defineIcon("CrownOfThorns", ({ color, sw, filled, duotone }) => {
  // A braided/thorny circle
  const r = 72;
  const cx = 128;
  const cy = 128;
  const thorns = 12;
  const innerR = r - 16;
  const outerR = r + 12;

  const points: string[] = [];
  for (let i = 0; i < thorns; i++) {
    const angle1 = (i / thorns) * Math.PI * 2 - Math.PI / 2;
    const angle2 = ((i + 0.5) / thorns) * Math.PI * 2 - Math.PI / 2;
    points.push(
      `${cx + Math.cos(angle1) * outerR},${cy + Math.sin(angle1) * outerR}`,
      `${cx + Math.cos(angle2) * innerR},${cy + Math.sin(angle2) * innerR}`
    );
  }
  const d = `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;

  return (
    <path d={d} {...sf(filled, duotone, color, sw)} />
  );
});

export const Crook = defineIcon("Crook", ({ color, sw }) => (
  <>
    {/* Staff */}
    <line x1="148" y1="232" x2="148" y2="80" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    {/* Hook */}
    <path
      d="M148,80 C148,32 88,24 72,56 C60,80 72,100 92,100"
      fill="none" stroke={color} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round"
    />
  </>
));

export const Ichthys = defineIcon("Ichthys", ({ color, sw, filled, duotone }) => (
  <>
    {/* Fish body */}
    <path
      d="M32,128 C80,56 176,56 208,128 C176,200 80,200 32,128Z"
      {...sf(filled, duotone, color, sw)}
    />
    {/* Tail */}
    <path
      d="M208,128 L240,96 L240,160Z"
      {...sf(filled, duotone, color, sw)}
    />
    {/* Eye */}
    <circle cx="80" cy="120" r={filled ? 8 : 6} fill={filled && !duotone ? "white" : color} />
  </>
));

export const Trident = defineIcon("Trident", ({ color, sw }) => (
  <>
    {/* Handle */}
    <line x1="128" y1="232" x2="128" y2="88" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    {/* Center prong */}
    <line x1="128" y1="88" x2="128" y2="24" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    <path d="M120,32 L128,16 L136,32" fill="none" stroke={color} strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round" />
    {/* Left prong */}
    <path d="M128,88 C108,88 76,72 68,32" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M60,40 L68,24 L76,40" fill="none" stroke={color} strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round" />
    {/* Right prong */}
    <path d="M128,88 C148,88 180,72 188,32" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M180,40 L188,24 L196,40" fill="none" stroke={color} strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round" />
  </>
));

export const Vine = defineIcon("Vine", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Main vine stem */}
      <path
        d="M48,224 C48,176 80,160 112,144 C144,128 160,96 128,64 C112,48 96,56 104,80"
        fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Leaves */}
      <path d="M112,144 C128,120 152,128 144,152 C136,168 112,160 112,144Z" {...p} />
      <path d="M80,184 C72,160 92,148 104,168 C112,180 96,196 80,184Z" {...p} />
      {/* Grapes cluster */}
      <circle cx="168" cy="80" r="12" {...p} />
      <circle cx="184" cy="96" r="12" {...p} />
      <circle cx="168" cy="104" r="12" {...p} />
      <circle cx="152" cy="92" r="12" {...p} />
    </>
  );
});

export const Wheat = defineIcon("Wheat", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Main stem */}
      <line x1="128" y1="240" x2="128" y2="80" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Grain kernels - left */}
      <path d="M128,80 C108,72 100,48 116,36 C124,44 128,68 128,80Z" {...p} />
      <path d="M128,112 C104,108 92,88 108,76 C120,84 128,100 128,112Z" {...p} />
      <path d="M128,144 C104,140 92,120 108,108 C120,116 128,132 128,144Z" {...p} />
      {/* Grain kernels - right */}
      <path d="M128,96 C148,88 156,64 140,52 C132,60 128,84 128,96Z" {...p} />
      <path d="M128,128 C152,124 164,104 148,92 C136,100 128,116 128,128Z" {...p} />
      <path d="M128,160 C152,156 164,136 148,124 C136,132 128,148 128,160Z" {...p} />
      {/* Top kernel */}
      <path d="M128,80 C120,56 128,28 136,24 C140,40 136,64 128,80Z" {...p} />
    </>
  );
});

export const Bread = defineIcon("Bread", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Loaf body */}
      <path d="M40,176 L40,136 C40,72 216,72 216,136 L216,176Z" {...p} />
      {/* Score lines */}
      <path d="M96,88 C96,120 88,152 88,172" fill="none" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d="M160,88 C160,120 168,152 168,172" fill="none" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.5} strokeLinecap="round" />
      {/* Base line */}
      <line x1="40" y1="176" x2="216" y2="176" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

export const OpenTomb = defineIcon("OpenTomb", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Cave/rock face */}
      <path d="M24,224 L24,88 C24,40 160,40 160,88 L160,224Z" {...p} />
      {/* Opening (arch) */}
      <path
        d="M56,224 L56,120 C56,76 128,76 128,120 L128,224"
        fill={filled ? "white" : "none"} fillOpacity={filled ? (duotone ? 0.5 : 1) : 0}
        stroke={color} strokeWidth={sw * 0.75}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Rolled stone */}
      <circle cx="200" cy="176" r="40" {...p} />
      {/* Ground */}
      <line x1="16" y1="224" x2="248" y2="224" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

export const OliveBranch = defineIcon("OliveBranch", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Branch */}
      <path
        d="M48,208 C64,176 96,144 128,120 C160,96 192,80 216,72"
        fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Leaves */}
      <ellipse cx="88" cy="160" rx="16" ry="8" transform="rotate(-40 88 160)" {...p} />
      <ellipse cx="120" cy="132" rx="16" ry="8" transform="rotate(-30 120 132)" {...p} />
      <ellipse cx="156" cy="108" rx="16" ry="8" transform="rotate(-25 156 108)" {...p} />
      <ellipse cx="188" cy="88" rx="16" ry="8" transform="rotate(-20 188 88)" {...p} />
      {/* Olives */}
      <circle cx="100" cy="148" r="6" fill={color} />
      <circle cx="140" cy="120" r="6" fill={color} />
      <circle cx="172" cy="100" r="6" fill={color} />
    </>
  );
});

export const AngelWings = defineIcon("AngelWings", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Left wing */}
      <path d="M128,128 C96,80 32,56 24,104 C16,152 80,176 128,160Z" {...p} />
      {/* Right wing */}
      <path d="M128,128 C160,80 224,56 232,104 C240,152 176,176 128,160Z" {...p} />
      {/* Halo */}
      <ellipse cx="128" cy="56" rx="28" ry="12" fill="none" stroke={color} strokeWidth={sw} />
    </>
  );
});

export const Pillar = defineIcon("Pillar", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Capital (top) */}
      <path d="M72,56 L88,40 L168,40 L184,56Z" {...p} />
      {/* Shaft */}
      <rect x="88" y="56" width="80" height="144" {...p} />
      {/* Fluting lines */}
      <line x1="112" y1="60" x2="112" y2="196" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.3} strokeLinecap="round" />
      <line x1="144" y1="60" x2="144" y2="196" stroke={filled && !duotone ? "white" : color} strokeWidth={sw * 0.3} strokeLinecap="round" />
      {/* Base */}
      <path d="M72,200 L88,216 L168,216 L184,200Z" {...p} />
      <line x1="72" y1="200" x2="184" y2="200" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

export const Covenant = defineIcon("Covenant", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Rainbow arc */}
      <path d="M32,192 C32,96 80,32 128,32 C176,32 224,96 224,192" fill="none" stroke={color} strokeWidth={sw * 1.5} strokeLinecap="round" />
      <path d="M56,192 C56,112 88,56 128,56 C168,56 200,112 200,192" fill="none" stroke={color} strokeWidth={sw * 0.75} strokeLinecap="round" />
      {/* Hands clasped (simplified) */}
      <path d="M100,192 C100,172 112,164 128,164 C144,164 156,172 156,192" {...p} />
      <line x1="128" y1="164" x2="128" y2="148" stroke={color} strokeWidth={sw * 0.5} strokeLinecap="round" />
    </>
  );
});

export const Yoke = defineIcon("Yoke", ({ color, sw, filled, duotone }) => {
  const p = sf(filled, duotone, color, sw);
  return (
    <>
      {/* Beam */}
      <path d="M24,80 L232,80" fill="none" stroke={color} strokeWidth={sw * 1.2} strokeLinecap="round" />
      {/* Left bow */}
      <path d="M56,80 C56,160 40,192 56,208 C72,224 88,208 88,160 L88,80" {...p} />
      {/* Right bow */}
      <path d="M168,80 C168,160 152,192 168,208 C184,224 200,208 200,160 L200,80" {...p} />
      {/* Center pin */}
      <line x1="128" y1="72" x2="128" y2="96" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
});

// ─────────────────────── Registry ───────────────────────

export const PRECEPT_ICONS: Record<string, ReturnType<typeof defineIcon>> = {
  Dove,
  Lamb,
  Serpent,
  Tombstone,
  Chains,
  BrokenChain,
  Tablets,
  OilLamp,
  Chalice,
  Shofar,
  Altar,
  Tent,
  CrownOfThorns,
  Crook,
  Ichthys,
  Trident,
  Vine,
  Wheat,
  Bread,
  OpenTomb,
  OliveBranch,
  AngelWings,
  Pillar,
  Covenant,
  Yoke,
};

export const PRECEPT_ICON_NAMES = Object.keys(PRECEPT_ICONS);
