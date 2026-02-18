import { create } from "zustand";
import type { WordStudyEntry } from "../lib/types";

interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
  isStreaming?: boolean;
  wordStudy?: WordStudyEntry[];
}

interface SelectionContext {
  bookName: string;
  book: number;
  chapter: number;
  startVerse: number;
  endVerse: number;
  translation: string;
  selectedText: string;
}

interface ChatState {
  isOpen: boolean;
  chatWidth: number;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  abortController: AbortController | null;
  selectionContext: SelectionContext | null;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setChatWidth: (w: number) => void;
  setSelectionContext: (ctx: SelectionContext | null) => void;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  setActiveConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
}

const API = "/api/chat";

function fetchOpts(extra?: RequestInit): RequestInit {
  const deviceId = localStorage.getItem("device-id") ?? "";
  return {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": deviceId,
    },
    ...extra,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  chatWidth: 420,
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  abortController: null,
  selectionContext: null,

  open: () => {
    set({ isOpen: true });
    if (get().conversations.length === 0) {
      get().loadConversations();
    }
  },

  close: () => set({ isOpen: false }),
  toggle: () => {
    const wasOpen = get().isOpen;
    if (!wasOpen) {
      get().open();
    } else {
      get().close();
    }
  },

  setChatWidth: (w) => set({ chatWidth: w }),

  setSelectionContext: (ctx) => set({ selectionContext: ctx }),

  loadConversations: async () => {
    try {
      const res = await fetch(`${API}/conversations`, fetchOpts());
      if (!res.ok) return;
      const data = await res.json();
      set({ conversations: data.conversations ?? [] });
    } catch {
      // offline
    }
  },

  createConversation: async () => {
    const res = await fetch(`${API}/conversations`, fetchOpts({ method: "POST" }));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const conv: Conversation = {
      id: data.id,
      title: data.title ?? "",
      created_at: data.createdAt,
      updated_at: data.createdAt,
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: conv.id,
      messages: [],
    }));
    return conv.id;
  },

  setActiveConversation: async (id) => {
    set({ activeConversationId: id, messages: [] });
    try {
      const res = await fetch(`${API}/conversations/${id}/messages`, fetchOpts());
      if (!res.ok) return;
      const data = await res.json();
      set({ messages: data.messages ?? [] });
    } catch {
      // offline
    }
  },

  deleteConversation: async (id) => {
    try {
      await fetch(`${API}/conversations/${id}`, fetchOpts({ method: "DELETE" }));
    } catch {
      // offline
    }
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const isActive = s.activeConversationId === id;
      return {
        conversations,
        activeConversationId: isActive ? null : s.activeConversationId,
        messages: isActive ? [] : s.messages,
      };
    });
  },

  sendMessage: async (content) => {
    const state = get();
    if (state.isStreaming) return;

    let convId = state.activeConversationId;

    // Auto-create conversation if none
    if (!convId) {
      try {
        convId = await get().createConversation();
      } catch {
        return;
      }
    }

    // Build context prompt from selection + fetch word study
    const ctx = state.selectionContext;
    let contextPrompt: string | undefined;
    let wordStudyEntries: WordStudyEntry[] | undefined;
    if (ctx) {
      const verseRange = ctx.startVerse === ctx.endVerse
        ? `${ctx.chapter}:${ctx.startVerse}`
        : `${ctx.chapter}:${ctx.startVerse}\u2013${ctx.endVerse}`;
      contextPrompt = `I'm studying ${ctx.bookName} ${verseRange} (${ctx.translation}):\n"${ctx.selectedText}"\nPlease explain the key words (Hebrew/Greek with transliteration and meaning), historical context, and relevant cross-references.`;

      // Fetch word study data for the selected words
      const words = ctx.selectedText.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        try {
          const res = await fetch("/api/word-study", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              words,
              book: ctx.book,
              chapter: ctx.chapter,
              startVerse: ctx.startVerse,
              endVerse: ctx.endVerse,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.entries?.length) {
              wordStudyEntries = data.entries;
            }
          }
        } catch {
          // Continue without word study
        }
      }
      set({ selectionContext: null });
    }

    // Optimistic user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: contextPrompt ? `${contextPrompt}\n\n${content}` : content,
      created_at: Date.now(),
      wordStudy: wordStudyEntries,
    };

    // Placeholder assistant message for streaming
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      created_at: Date.now(),
      isStreaming: true,
    };

    const controller = new AbortController();
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
      abortController: controller,
    }));

    // Update conversation title in local state if it was empty
    const conv = get().conversations.find((c) => c.id === convId);
    if (conv && !conv.title) {
      const title = content.length > 60 ? content.slice(0, 57) + "..." : content;
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, title, updated_at: Date.now() } : c
        ),
      }));
    }

    try {
      const res = await fetch(`${API}/messages`, {
        ...fetchOpts({
          method: "POST",
          body: JSON.stringify({
            conversationId: convId,
            content,
            contextPrompt,
            wordStudy: wordStudyEntries,
          }),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: err.error ?? "Something went wrong.", isStreaming: false }
              : m
          ),
          isStreaming: false,
          abortController: null,
        }));
        return;
      }

      // Read SSE stream — batch chunks with rAF for smooth rendering
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingContent = "";
      let rafId: number | null = null;

      function flushContent() {
        if (!pendingContent) return;
        const chunk = pendingContent;
        pendingContent = "";
        rafId = null;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + chunk }
              : m
          ),
        }));
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              pendingContent += parsed.content;
              if (rafId === null) {
                rafId = requestAnimationFrame(flushContent);
              }
            }
          } catch {
            // skip
          }
        }
      }

      // Flush any remaining buffered content
      if (rafId !== null) cancelAnimationFrame(rafId);
      flushContent();

      // Mark streaming complete
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
        ),
        isStreaming: false,
        abortController: null,
      }));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User stopped — keep partial content
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
          ),
          isStreaming: false,
          abortController: null,
        }));
      } else {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "Failed to connect. Please try again.", isStreaming: false }
              : m
          ),
          isStreaming: false,
          abortController: null,
        }));
      }
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
  },
}));
