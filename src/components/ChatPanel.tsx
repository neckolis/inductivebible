import { useEffect, useRef, useState, useCallback } from "react";
import { X, PaperPlaneRight, Plus, Stop, Trash, CaretDown } from "@phosphor-icons/react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { ChatMessage } from "./ChatMessage";

interface Props {
  onSignIn: () => void;
}

const SUGGESTED_PROMPTS = [
  "What does John 3:16 mean?",
  "Explain the armor of God in Ephesians 6",
  "What is justification by faith?",
  "Who were the 12 disciples?",
];

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

export function ChatPanel({ onSignIn }: Props) {
  const {
    isOpen,
    chatWidth,
    setChatWidth,
    close,
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    selectionContext,
    setSelectionContext,
    createConversation,
    setActiveConversation,
    deleteConversation,
    sendMessage,
    stopStreaming,
  } = useChatStore();

  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && user) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen, user]);

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleNewConversation() {
    try {
      await createConversation();
    } catch {
      // error
    }
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = chatWidth;

    function onMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      setChatWidth(newWidth);
    }

    function onUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const title = activeConv?.title || "New Chat";

  return (
    <>
      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 sm:hidden"
          onClick={close}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: window.innerWidth < 640 ? "100%" : chatWidth }}
      >
        {/* Resize handle (desktop only) */}
        <div
          className="hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300/50 transition-colors z-10"
          style={isResizing ? { backgroundColor: "rgba(147, 197, 253, 0.5)" } : undefined}
          onMouseDown={handleResizeStart}
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex-1 min-w-0 relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-1 text-sm font-medium text-gray-800 bg-transparent border-none cursor-pointer truncate max-w-full hover:text-gray-600"
            >
              <span className="truncate">{title}</span>
              <CaretDown size={12} className="shrink-0 text-gray-400" />
            </button>

            {showPicker && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 max-h-64 overflow-y-auto">
                {conversations.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No conversations yet</div>
                )}
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      c.id === activeConversationId
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveConversation(c.id);
                        setShowPicker(false);
                      }}
                      className="flex-1 text-left bg-transparent border-none cursor-pointer p-0 truncate text-inherit"
                    >
                      {c.title || "New Chat"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(c.id);
                      }}
                      className="shrink-0 p-1 text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer rounded"
                      title="Delete"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleNewConversation}
            className="p-1.5 text-gray-500 hover:text-gray-800 bg-transparent hover:bg-gray-200 border-none cursor-pointer rounded-lg transition-colors"
            title="New conversation"
          >
            <Plus size={18} />
          </button>

          <button
            onClick={close}
            className="p-1.5 text-gray-500 hover:text-gray-800 bg-transparent hover:bg-gray-200 border-none cursor-pointer rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-2xl mb-2">&#128218;</div>
              <h3 className="text-base font-medium text-gray-800 mb-1">
                Bible Study Companion
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Ask about Scripture, word meanings, theology, or select text to study.
              </p>
              {user && (
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 bg-white cursor-pointer transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.isStreaming}
              wordStudy={msg.wordStudy}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Selection context banner */}
        {selectionContext && (
          <div className="mx-4 mb-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 flex items-start gap-2">
            <span className="flex-1 line-clamp-2">
              Studying <strong>{selectionContext.bookName} {selectionContext.chapter}:{selectionContext.startVerse}
              {selectionContext.endVerse !== selectionContext.startVerse && `\u2013${selectionContext.endVerse}`}</strong>: &ldquo;{selectionContext.selectedText}&rdquo;
            </span>
            <button
              onClick={() => setSelectionContext(null)}
              className="shrink-0 text-blue-400 hover:text-blue-600 bg-transparent border-none cursor-pointer p-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
          {!user ? (
            <button
              onClick={onSignIn}
              className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg border-none cursor-pointer transition-colors"
            >
              Sign in to chat
            </button>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Scripture..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-colors bg-gray-50"
                style={{ maxHeight: 120 }}
              />
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl border-none cursor-pointer transition-colors"
                  title="Stop"
                >
                  <Stop size={18} weight="fill" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="shrink-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
                  title="Send"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
