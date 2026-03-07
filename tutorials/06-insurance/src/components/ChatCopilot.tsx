"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { ArrowUp, Plus, Clock, X, Sparkles, Loader2, Code2 } from "lucide-react"
import type { QueryResult } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  rqlQuery?: string
  status?: "building" | "running" | "done" | "error"
  progressMsg?: string
  resultSummary?: string
}

interface Props {
  tableName: string
  isDataReady: boolean
  suggestedQuestions: string[]
  onQuery: (rqlQuery: string, question: string) => void
  isRunning: boolean
  progressMsg: string
  result: QueryResult | null
  onClose?: () => void
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[16px] rounded-tr-[4px] bg-[#1868DB] text-white px-3.5 py-2.5 text-[13px] leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Assistant icon row */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(168deg, #1868DB 0%, #7EE2B8 60%, #B3EE2B 100%)" }}>
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">Brainfish Assist</span>
      </div>

      {/* Building/running status */}
      {(msg.status === "building" || msg.status === "running") && (
        <div className="ml-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>{msg.status === "building" ? "Building query…" : (msg.progressMsg ?? "Searching policy documents…")}</span>
        </div>
      )}

      {/* Generated RQL code snippet */}
      {msg.rqlQuery && (
        <div className="ml-8 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-200 bg-slate-100">
            <Code2 className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Generated RQL</span>
          </div>
          <pre className="px-3 py-2 text-[11px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {msg.rqlQuery}
          </pre>
        </div>
      )}

      {/* Result summary */}
      {msg.status === "done" && msg.resultSummary && (
        <div className="ml-8 text-[13px] text-foreground leading-relaxed">
          {msg.resultSummary}
        </div>
      )}

      {/* Error */}
      {msg.status === "error" && (
        <div className="ml-8 text-[13px] text-destructive">
          Something went wrong. Please try again.
        </div>
      )}
    </div>
  )
}

export function ChatCopilot({
  tableName,
  isDataReady,
  suggestedQuestions,
  onQuery,
  isRunning,
  progressMsg,
  result,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevResultRef = useRef<QueryResult | null>(null)
  const prevRunningRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

  // Update assistant message as query runs
  useEffect(() => {
    if (!pendingMsgId) return

    // Running just started
    if (isRunning && !prevRunningRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId
            ? { ...m, status: "running", progressMsg: progressMsg || "Searching policy documents…" }
            : m
        )
      )
    }

    // Progress message updated while running
    if (isRunning && progressMsg) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId ? { ...m, progressMsg } : m
        )
      )
    }

    // Query finished — result arrived
    if (!isRunning && prevRunningRef.current && result !== prevResultRef.current) {
      const nodes = result?.matchedNodes ?? []
      const summary =
        nodes.length > 0
          ? `Found ${nodes.length} relevant section${nodes.length !== 1 ? "s" : ""} across the policy documents. See the centre panel for the full answer with citations.`
          : "No matching sections found. Try rephrasing your question."
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsgId
            ? { ...m, status: nodes.length > 0 ? "done" : "error", resultSummary: summary }
            : m
        )
      )
      setPendingMsgId(null)
    }

    prevRunningRef.current = isRunning
    prevResultRef.current = result
  }, [isRunning, progressMsg, result, pendingMsgId])

  const sendQuestion = useCallback(
    (question: string) => {
      if (!question.trim() || isRunning) return

      const rqlQuery = `SELECT * FROM ${tableName} REASON '${question.trim()}' LIMIT 5`
      const userMsgId = crypto.randomUUID()
      const assistantMsgId = crypto.randomUUID()

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: question.trim() },
        { id: assistantMsgId, role: "assistant", content: "", rqlQuery, status: "building" },
      ])
      setPendingMsgId(assistantMsgId)
      setInputValue("")
      onQuery(rqlQuery, question.trim())
    },
    [tableName, isRunning, onQuery]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendQuestion(inputValue)
    }
  }

  const canSend = inputValue.trim().length > 0 && !isRunning && isDataReady
  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full border-l bg-white">
      {/* Header — Figma 33:1908 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-white shrink-0">
        <div className="flex items-center gap-2">
          {/* Gradient sparkle logo */}
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: "linear-gradient(168deg, #1868DB 7%, #357DE8 24%, #7EE2B8 61%, #B3EE2B 83%)" }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white drop-shadow-sm" />
          </div>
          <span className="text-[12px] font-medium text-foreground">Brainfish Assist</span>
        </div>

        {/* Control buttons — Figma 33:1913 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMessages([])}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="History"
          >
            <Clock className="h-4 w-4" />
          </button>
          {onClose && (
            <>
              <div className="w-px h-3.5 bg-border mx-0.5" />
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0">
        {isEmpty ? (
          /* Empty state — show suggested questions (Figma 33:1899 style) */
          <div className="h-full flex flex-col justify-end gap-2 pb-2">
            {!isDataReady && (
              <p className="text-center text-xs text-muted-foreground mb-4 px-4">
                Load the insurance dataset first, then ask any policy question.
              </p>
            )}
            <div className="flex flex-col items-end gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuestion(q)}
                  disabled={!isDataReady || isRunning}
                  className="max-w-[90%] text-right px-3 py-2 rounded-full border border-[#e5e5e5] bg-white text-[12px] text-black leading-snug hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — Figma 33:1919 gradient border prompt */}
      <div className="shrink-0 px-2 pb-2">
        <div
          className="rounded-[16px] rounded-b-[8px] p-[2px]"
          style={{
            background: "linear-gradient(168.324deg, #1868DB 7.35%, #357DE8 23.69%, #7EE2B8 61.42%, #B3EE2B 82.59%)",
          }}
        >
          <div className="bg-white rounded-[14px] rounded-b-[6px] shadow-[2px_4px_12px_0px_rgba(0,0,0,0.14)] overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isDataReady ? "What can we help with today?" : "Load dataset to start…"}
                disabled={!isDataReady || isRunning}
                rows={1}
                className="w-full resize-none bg-transparent text-[16px] leading-6 text-foreground placeholder:text-[#737373] outline-none disabled:opacity-50 min-h-[32px] max-h-[120px]"
                style={{ fontFamily: "inherit" }}
              />
            </div>
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Attach"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendQuestion(inputValue)}
                disabled={!canSend}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40"
                style={{
                  background: canSend ? "#262626" : "#e5e5e5",
                }}
                title="Send"
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                ) : (
                  <ArrowUp className={`h-3.5 w-3.5 ${canSend ? "text-white" : "text-muted-foreground"}`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
