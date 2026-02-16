/**
 * Semantic tag registry for icon search.
 * Tags map icon names to descriptive keywords for tag-aware search.
 */

const ICON_TAGS: Record<string, string[]> = {
  // Custom Bible study icons
  Dove: ["holy spirit", "spirit", "peace", "dove", "bird"],
  Lamb: ["sacrifice", "lamb", "jesus", "passover", "offering"],
  Serpent: ["satan", "devil", "evil", "snake", "serpent", "tempt"],
  Tombstone: ["death", "die", "dead", "grave", "tomb", "bury"],
  Chains: ["bondage", "slavery", "captive", "prison", "bound", "chain"],
  BrokenChain: ["freedom", "free", "deliver", "release", "liberty", "redeem"],
  Tablets: ["law", "commandment", "command", "moses", "sinai", "rules"],
  OilLamp: ["light", "lamp", "oil", "anoint", "watch", "parable"],
  Chalice: ["blood", "cup", "wine", "communion", "drink"],
  Shofar: ["trumpet", "horn", "shofar", "announce", "jubilee", "call"],
  Altar: ["altar", "sacrifice", "offering", "worship", "burn"],
  Tent: ["tabernacle", "tent", "dwell", "presence", "meeting"],
  CrownOfThorns: ["suffering", "thorns", "passion", "crucify", "pain"],
  Crook: ["shepherd", "staff", "guide", "lead", "pastor", "sheep"],
  Ichthys: ["fish", "christian", "believer", "disciple", "follow"],
  Trident: ["satan", "devil", "evil", "enemy", "adversary"],
  Vine: ["vine", "branch", "abide", "fruit", "remain"],
  Wheat: ["harvest", "wheat", "grain", "reap", "sow", "seed"],
  Bread: ["bread", "body", "communion", "manna", "feed", "eat"],
  OpenTomb: ["resurrection", "risen", "empty", "tomb", "alive", "easter"],
  OliveBranch: ["peace", "olive", "anoint", "oil", "blessing"],
  AngelWings: ["angel", "messenger", "heaven", "wing", "glory"],
  Pillar: ["pillar", "foundation", "church", "temple", "strong"],
  Covenant: ["covenant", "promise", "agreement", "oath", "rainbow"],
  Yoke: ["yoke", "burden", "serve", "rest", "easy", "submit"],

  // Phosphor icons with Bible study tags
  Cross: ["christ", "jesus", "crucify", "death", "salvation", "cross"],
  Heart: ["love", "heart", "compassion", "mercy", "affection"],
  Fire: ["fire", "spirit", "judgment", "purify", "refine", "holy"],
  Crown: ["king", "lord", "reign", "authority", "rule", "royal"],
  BookOpen: ["book", "word", "scripture", "bible", "read", "study"],
  Star: ["star", "bethlehem", "light", "guide", "wise"],
  HandsPraying: ["prayer", "pray", "worship", "supplication"],
  Church: ["church", "assembly", "congregation", "body", "gather"],
  Eye: ["see", "watch", "vision", "behold", "witness", "sight"],
  Lightbulb: ["light", "wisdom", "idea", "understand", "insight"],
  Sword: ["word", "sword", "truth", "fight", "battle", "warfare"],
  Shield: ["faith", "shield", "protect", "defend", "armor"],
  Bird: ["bird", "sparrow", "raven", "provision", "care"],
  Triangle: ["god", "trinity", "father", "almighty", "sovereign"],
  Scroll: ["scroll", "book", "write", "prophecy", "record"],
  Mountains: ["mountain", "zion", "sinai", "high", "exalt"],
  Drop: ["water", "baptism", "wash", "cleanse", "rain", "tear"],
  Leaf: ["growth", "leaf", "flourish", "prosper", "tree"],
  Globe: ["world", "nations", "earth", "gentile", "mission"],
  Bell: ["bell", "call", "announce", "hear", "listen"],
  Key: ["key", "authority", "kingdom", "unlock", "access"],
  Compass: ["direction", "guide", "path", "way", "navigate"],
  Scales: ["justice", "judge", "righteous", "fair", "balance"],
  SunHorizon: ["sunrise", "dawn", "hope", "new", "morning", "day"],
  Clock: ["time", "when", "season", "hour", "day", "appointed"],
  Ear: ["hear", "listen", "obey", "ear", "attention"],
  Megaphone: ["proclaim", "preach", "declare", "shout", "announce"],
  HandsClapping: ["praise", "clap", "rejoice", "celebrate", "joy"],
  Gift: ["gift", "grace", "give", "blessing", "present"],
  Footprints: ["walk", "follow", "path", "journey", "way"],
  Lightning: ["power", "glory", "thunder", "miracle", "sign"],
  TreeEvergreen: ["tree", "life", "cedar", "plant", "grow"],
  Boat: ["boat", "ship", "sea", "storm", "ark", "galilee"],
  Door: ["door", "gate", "enter", "way", "knock"],
  Lamp: ["lamp", "light", "oil", "watch", "ready"],
  Candle: ["candle", "light", "menorah", "witness"],
  Cloud: ["cloud", "glory", "presence", "pillar", "heaven"],
  Rainbow: ["rainbow", "covenant", "promise", "sign"],
  Tornado: ["wind", "storm", "spirit", "whirlwind"],
  Feather: ["wing", "soar", "eagle", "mount up"],
  HandHeart: ["mercy", "compassion", "give", "help", "serve"],
  Users: ["people", "nation", "tribe", "multitude", "crowd"],
  Baby: ["child", "birth", "born", "son", "daughter"],
  Skull: ["death", "golgotha", "calvary", "die"],
  Hammer: ["build", "nail", "crucify", "work"],
  Gavel: ["judge", "judgment", "court", "verdict", "decree"],
  Handshake: ["covenant", "peace", "agree", "reconcile"],
  Flag: ["banner", "victory", "triumph", "nation"],
  Sparkle: ["glory", "holy", "divine", "miracle", "wonder"],
  Sun: ["glory", "light", "day", "righteous", "sun"],
  Moon: ["night", "moon", "time", "season", "sign"],
};

/** Split camelCase name into lowercase tags: "BookOpen" → ["book", "open"] */
function splitCamelCase(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/);
}

/** Get tags for an icon, falling back to camelCase split */
function getIconTags(name: string): string[] {
  return ICON_TAGS[name] ?? splitCamelCase(name);
}

export interface SearchResult {
  name: string;
  score: number;
}

/**
 * Search icons by query with relevance scoring.
 * Scores: exact name match (100), tag match (50), name-contains (10).
 * Returns up to `limit` results sorted by score descending.
 */
export function searchIcons(
  query: string,
  allIconNames: string[],
  limit = 40
): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const name of allIconNames) {
    let score = 0;
    const nameLower = name.toLowerCase();

    // Exact name match
    if (nameLower === q) {
      score = 100;
    } else {
      // Tag match — check if query matches any tag
      const tags = getIconTags(name);
      for (const tag of tags) {
        if (tag === q) {
          score = Math.max(score, 50);
        } else if (tag.startsWith(q)) {
          score = Math.max(score, 40);
        } else if (tag.includes(q)) {
          score = Math.max(score, 30);
        }
      }

      // Name-contains (substring of icon name)
      if (nameLower.startsWith(q)) {
        score = Math.max(score, 25);
      } else if (nameLower.includes(q)) {
        score = Math.max(score, 10);
      }
    }

    if (score > 0) {
      results.push({ name, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
