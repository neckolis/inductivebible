import type { ReactNode } from "react";
import type { WordStudyEntry } from "../lib/types";
import { WordStudyCard } from "./WordStudyCard";

interface Props {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  wordStudy?: WordStudyEntry[];
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderMarkdown(content: string) {
  const paragraphs = content.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Handle lines within a paragraph (single newlines)
    const lines = trimmed.split("\n");

    return (
      <p key={i} className="mb-2 last:mb-0">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {renderInlineMarkdown(line)}
          </span>
        ))}
      </p>
    );
  });
}

export function ChatMessage({ role, content, isStreaming, wordStudy }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? "flex flex-col items-end gap-1.5" : ""}`}>
        {isUser && wordStudy && wordStudy.length > 0 && (
          <div className="flex flex-col gap-1 w-full">
            {wordStudy.map((entry) => (
              <WordStudyCard key={entry.strongs || entry.word} entry={entry} />
            ))}
          </div>
        )}
      <div
        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-500 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        {!isUser && !content && isStreaming && (
          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded-sm" />
        )}
        {content && renderMarkdown(content)}
        {isStreaming && content && (
          <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
        )}
      </div>
      </div>
    </div>
  );
}
