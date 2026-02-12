export type BlockType =
  | "text"
  | "heading"
  | "bullet"
  | "numbered"
  | "quote"
  | "divider"
  | "callout"
  | "todo";

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}
