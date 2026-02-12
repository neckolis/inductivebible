import * as PhosphorIcons from "@phosphor-icons/react";
import { registerAll, type PhosphorIcon } from "./icons";

const EXCLUDE = new Set(["IconContext", "IconBase", "SSR"]);

const allIcons: Record<string, PhosphorIcon> = {};
const allIconNames: string[] = [];

for (const [name, component] of Object.entries(PhosphorIcons)) {
  if (
    /^[A-Z]/.test(name) &&
    !EXCLUDE.has(name) &&
    component != null &&
    typeof component === "object" &&
    "$$typeof" in (component as Record<string, unknown>) &&
    "render" in (component as Record<string, unknown>)
  ) {
    allIcons[name] = component as unknown as PhosphorIcon;
    allIconNames.push(name);
  }
}

allIconNames.sort();

// Register all icons in the main registry so WordSpan can render them
registerAll(allIcons);

export { allIcons, allIconNames };
