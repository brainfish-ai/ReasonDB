"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { Shield, ChevronRight, Search, Brain, Layers } from "lucide-react"
import { ConnectionBar } from "@/components/ConnectionBar"
import { DataSetupPanel } from "@/components/DataSetupPanel"
import { QueryPlayground, type ExampleQuery } from "@/components/QueryPlayground"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import { ChatCopilot } from "@/components/ChatCopilot"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { initializeDataset } from "./actions"
import type { QueryResult } from "@/lib/api"

const TABLE_NAME = "aia_insurance"

// Pre-built example queries drawn from benchmark.py test suite
const EXAMPLES: ExampleQuery[] = [
  // SQL
  { label: "All documents",       badge: "SQL",    query: `SELECT title, metadata.year, metadata.type FROM ${TABLE_NAME} ORDER BY metadata.year ASC` },
  { label: "By type",             badge: "SQL",    query: `SELECT * FROM ${TABLE_NAME} WHERE metadata.type = 'product-disclosure-statement'` },
  { label: "COUNT docs",          badge: "AGG",    query: `SELECT COUNT(*) FROM ${TABLE_NAME}` },
  // Search
  { label: "SEARCH waiting period", badge: "BM25", query: `SELECT * FROM ${TABLE_NAME} SEARCH 'waiting period income protection disability'` },
  { label: "SEARCH exclusions",     badge: "BM25", query: `SELECT * FROM ${TABLE_NAME} SEARCH 'exclusion pre-existing condition mental health'` },
  // Reason — simple
  { label: "REASON — waiting period",   badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What is the waiting period for income protection?' LIMIT 5` },
  { label: "REASON — TPD benefit",      badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What is the maximum benefit amount for total and permanent disability?' LIMIT 5` },
  { label: "REASON — exclusions",       badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What exclusions apply to income protection claims?' LIMIT 5` },
  { label: "REASON — premium options",  badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What are the premium rates or payment options for Priority Protection?' LIMIT 5` },
  // Reason — comparative
  { label: "REASON — disability definitions", badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'How do the Income Care Plus policy and Priority Protection policy differ in their definition of disability?' LIMIT 5` },
  { label: "REASON — 2025 changes",           badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What changes were made to the Priority Protection policy in the 2025 enhancement update?' LIMIT 5` },
  // Reason — multi-hop
  { label: "REASON — mental health claim",   badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'If a person has a pre-existing mental health condition and later files a disability claim, what exclusions and waiting periods apply?' LIMIT 5` },
  { label: "REASON — accident + occupation", badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What benefit is payable if someone becomes permanently disabled due to an accident and cannot return to their own occupation?' LIMIT 5` },
  // Reason — synthesis
  { label: "REASON — all benefit types",         badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'List all the different types of insurance benefits available under the Priority Protection policies' LIMIT 5` },
  { label: "REASON — policy vs IBR differences", badge: "REASON", query: `SELECT * FROM ${TABLE_NAME} REASON 'What are the key differences between the incorporated by reference document and the main policy document?' LIMIT 5` },
  // Combo
  { label: "COMBO — cancel or alter policy",   badge: "COMBO", query: `SELECT * FROM ${TABLE_NAME} SEARCH 'cancel terminate lapse policy' REASON 'Under what circumstances can the insurer cancel or alter a policy?' LIMIT 5` },
  { label: "COMBO — hazardous occupation",     badge: "COMBO", query: `SELECT * FROM ${TABLE_NAME} SEARCH 'dangerous occupation aviation war exclusion' REASON 'What happens to a claim if the insured person engages in a hazardous occupation or extreme sport?' LIMIT 5` },
]

// Suggested questions for the chat copilot (right panel)
const CHAT_SUGGESTIONS = [
  "What is the waiting period for income protection?",
  "What exclusions apply to mental health claims?",
  "How do Income Care Plus and Priority Protection differ on disability definitions?",
  "What benefit changes were introduced in the 2025 enhancement update?",
  "What happens if I engage in a hazardous occupation?",
]

type StepGroup = "search" | "reason" | "combo"

interface Step {
  num: number
  title: string
  badge: string
  desc: string
  exIdx: number
  group: StepGroup
}

const STEPS: Step[] = [
  // Search
  { num: 1,  title: "Browse Documents",     badge: "SQL",    desc: "List all 4 AIA insurance documents ordered by year.",                                                    exIdx: 0,  group: "search" },
  { num: 2,  title: "Filter by Type",        badge: "SQL",    desc: "Retrieve only Product Disclosure Statement documents.",                                                   exIdx: 1,  group: "search" },
  { num: 3,  title: "SEARCH Terms",          badge: "BM25",   desc: "BM25 full-text search for waiting period and disability clauses.",                                        exIdx: 3,  group: "search" },
  { num: 4,  title: "COUNT Documents",       badge: "AGG",    desc: "Verify all 4 documents were ingested.",                                                                   exIdx: 2,  group: "search" },
  // Reason
  { num: 5,  title: "REASON — Waiting Period",  badge: "REASON", desc: "Ask about income protection waiting periods across all policy documents.",                            exIdx: 5,  group: "reason" },
  { num: 6,  title: "REASON — TPD Benefit",     badge: "REASON", desc: "Find the maximum benefit for total and permanent disability.",                                         exIdx: 6,  group: "reason" },
  { num: 7,  title: "REASON — Exclusions",      badge: "REASON", desc: "Identify all income protection claim exclusions.",                                                     exIdx: 7,  group: "reason" },
  { num: 8,  title: "REASON — Disability Defs", badge: "REASON", desc: "Compare how Income Care Plus and Priority Protection define disability.",                              exIdx: 9,  group: "reason" },
  { num: 9,  title: "REASON — 2025 Changes",    badge: "REASON", desc: "Summarise what changed in the November 2025 policy enhancement.",                                     exIdx: 10, group: "reason" },
  { num: 10, title: "REASON — Mental Health",   badge: "REASON", desc: "Multi-hop: pre-existing mental health condition + disability claim — what exclusions and waits apply?", exIdx: 11, group: "reason" },
  { num: 11, title: "REASON — All Benefits",    badge: "REASON", desc: "Synthesise all benefit types across Priority Protection policies.",                                    exIdx: 13, group: "reason" },
  // Combo
  { num: 12, title: "COMBO — Cancel Policy",     badge: "COMBO", desc: "BM25-search cancel/terminate passages, then reason about insurer cancellation rights.",                exIdx: 15, group: "combo" },
  { num: 13, title: "COMBO — Hazardous Work",    badge: "COMBO", desc: "Search dangerous occupation passages, then reason about claim impact.",                               exIdx: 16, group: "combo" },
]

const BADGE_COLORS: Record<string, string> = {
  SQL:    "bg-slate-100 text-slate-700",
  BM25:   "bg-amber-100 text-amber-800",
  REASON: "bg-blue-100 text-blue-800",
  AGG:    "bg-emerald-100 text-emerald-800",
  COMBO:  "bg-rose-100 text-rose-800",
}

const GROUP_META: Record<StepGroup, { label: string; icon: React.ReactNode; color: string }> = {
  search: { label: "Search",      icon: <Search className="h-3 w-3" />, color: "text-slate-500" },
  reason: { label: "Reason",      icon: <Brain className="h-3 w-3" />,  color: "text-blue-600" },
  combo:  { label: "Combination", icon: <Layers className="h-3 w-3" />, color: "text-rose-600" },
}

export default function Page() {
  const [serverUrl, setServerUrl] = useState("http://localhost:4444")
  const [apiKey, setApiKey] = useState("")
  const [isDataReady, setIsDataReady] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [playgroundIdx, setPlaygroundIdx] = useState(0)

  // Chat-driven query state — a new object ref triggers the externalQuery effect in QueryPlayground
  const [externalQuery, setExternalQuery] = useState<string | undefined>(undefined)
  const [chatRunning, setChatRunning] = useState(false)
  const [chatProgressMsg, setChatProgressMsg] = useState("")
  const externalQueryCountRef = useRef(0)

  useEffect(() => {
    const url = localStorage.getItem("reasondb_server_url")
    const key = localStorage.getItem("reasondb_api_key")
    if (url) setServerUrl(url)
    if (key) setApiKey(key)
  }, [])

  const handleUrlChange = (url: string) => { setServerUrl(url); localStorage.setItem("reasondb_server_url", url) }
  const handleKeyChange = (key: string) => { setApiKey(key); localStorage.setItem("reasondb_api_key", key) }

  // Called by ChatCopilot when user asks a question — drives the centre panel
  const handleChatQuery = useCallback((rqlQuery: string) => {
    // Each call must produce a new string identity to trigger the useEffect in QueryPlayground.
    // Append a unique suffix that is stripped by the RQL parser.
    externalQueryCountRef.current += 1
    setExternalQuery(rqlQuery)
    setActiveStep(null)
    setResult(null)
    setError(null)
  }, [])

  const groups: StepGroup[] = ["search", "reason", "combo"]

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ConnectionBar serverUrl={serverUrl} apiKey={apiKey} onServerUrlChange={handleUrlChange} onApiKeyChange={handleKeyChange} />

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left panel: setup + step list ── */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-sky-50 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-blue-600">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold">Insurance Policy Analyser</h1>
                <p className="text-[11px] text-muted-foreground">AIA Australia · POV Demo</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask natural language questions about 4 AIA insurance policy documents and get cited, traceable answers.
            </p>
          </div>

          {/* Dataset setup */}
          <div className="p-3 border-b shrink-0">
            <DataSetupPanel
              tableName={TABLE_NAME}
              docCount={4}
              serverUrl={serverUrl}
              apiKey={apiKey}
              label="AIA Insurance Documents"
              description="4 AIA Australia documents: Income Care Plus (2011), Priority Protection PDS, IBR, and Enhancement Summary (Nov 2025)."
              onInitialize={initializeDataset}
              onReady={() => setIsDataReady(true)}
            />
          </div>

          {/* Step list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {groups.map((group) => {
              const meta = GROUP_META[group]
              const groupSteps = STEPS.filter((s) => s.group === group)
              return (
                <div key={group}>
                  <div className={`flex items-center gap-1.5 px-1 mb-1.5 ${meta.color}`}>
                    {meta.icon}
                    <p className="text-[11px] font-semibold uppercase tracking-wide">{meta.label}</p>
                  </div>
                  <div className="space-y-1.5">
                    {groupSteps.map((step) => (
                      <div
                        key={step.num}
                        className={`rounded-md border p-3 space-y-1.5 cursor-pointer transition-colors ${
                          activeStep === step.num ? "border-blue-200 bg-blue-50" : "hover:bg-muted/40"
                        }`}
                        onClick={() => {
                          setActiveStep(step.num)
                          setPlaygroundIdx(step.exIdx)
                          setExternalQuery(undefined)
                          setResult(null)
                          setError(null)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {step.num}
                          </span>
                          <span className="text-xs font-medium flex-1">{step.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[step.badge]}`}>
                            {step.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground pl-7">{step.desc}</p>
                        <div className="pl-7">
                          <button className="flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-medium">
                            Try it <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Centre panel: query editor + results ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold">Query Playground</h2>
              <Badge variant="outline" className="text-xs">{TABLE_NAME}</Badge>
              <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">4 policy docs</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Questions from the chat auto-build a REASON query here. Results include cited policy sections and reasoning traces.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <QueryPlayground
              serverUrl={serverUrl}
              apiKey={apiKey}
              examples={EXAMPLES}
              onResult={setResult}
              onError={setError}
              onRunningChange={setChatRunning}
              onProgress={setChatProgressMsg}
              isDataReady={isDataReady}
              selectedIdx={playgroundIdx}
              externalQuery={externalQuery}
            />
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3">Results</h3>
              <ResultsDisplay result={result} error={error} />
            </div>
          </div>
        </div>

        {/* ── Right panel: Brainfish Assist chat copilot ── */}
        <div className="w-[380px] shrink-0 flex flex-col overflow-hidden">
          <ChatCopilot
            tableName={TABLE_NAME}
            isDataReady={isDataReady}
            suggestedQuestions={CHAT_SUGGESTIONS}
            onQuery={handleChatQuery}
            isRunning={chatRunning}
            progressMsg={chatProgressMsg}
            result={result}
          />
        </div>

      </div>
    </div>
  )
}
