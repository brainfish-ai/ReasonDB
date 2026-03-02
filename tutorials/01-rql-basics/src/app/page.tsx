"use client"
import { useState, useEffect } from "react"
import { BookOpen, ChevronRight } from "lucide-react"
import { ConnectionBar } from "@/components/ConnectionBar"
import { DataSetupPanel } from "@/components/DataSetupPanel"
import { QueryPlayground, type ExampleQuery } from "@/components/QueryPlayground"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { initializeDataset } from "./actions"
import type { QueryResult } from "@/lib/api"

const EXAMPLES: ExampleQuery[] = [
  { label: "SELECT all", badge: "SQL", query: "SELECT * FROM books LIMIT 5" },
  { label: "WHERE filter", badge: "SQL", query: "SELECT title, metadata.author FROM books WHERE metadata.author = 'Jane Austen'" },
  { label: "LIKE pattern", badge: "SQL", query: "SELECT * FROM books WHERE title LIKE '%whale%'" },
  { label: "SEARCH (BM25)", badge: "BM25", query: "SELECT * FROM books SEARCH 'revenge obsession monster darkness'" },
  { label: "REASON — morals", badge: "LLM", query: "SELECT * FROM books REASON 'What moral lessons about human nature appear across these novels?'" },
  { label: "COUNT", badge: "AGG", query: "SELECT COUNT(*) FROM books" },
  { label: "ORDER BY", badge: "SQL", query: "SELECT title, metadata.author FROM books ORDER BY title ASC LIMIT 5" },
  { label: "REASON — villains", badge: "LLM", query: "SELECT * FROM books REASON 'Who are the most compelling antagonists or villains in these novels and what makes them memorable?'" },
  { label: "REASON — society", badge: "LLM", query: "SELECT * FROM books REASON 'How do these 19th-century novels reflect the social anxieties and cultural values of their era?'" },
  { label: "REASON — narrative", badge: "LLM", query: "SELECT * FROM books REASON 'Compare the narrative voices and storytelling techniques across these five novels — what makes each author unique?'" },
]

const STEPS = [
  {
    num: 1, title: "Basic SELECT", badge: "SQL",
    desc: "Retrieve documents from the books table. Use LIMIT to paginate.",
    exIdx: 0,
  },
  {
    num: 2, title: "WHERE Filtering", badge: "SQL",
    desc: "Filter by metadata fields. Supports =, !=, >, <, LIKE, CONTAINS ANY.",
    exIdx: 1,
  },
  {
    num: 3, title: "SEARCH — BM25", badge: "BM25",
    desc: "Full-text keyword search using BM25 ranking. Returns most relevant docs first.",
    exIdx: 3,
  },
  {
    num: 4, title: "REASON — Moral Lessons", badge: "LLM",
    desc: "Ask a natural language question. ReasonDB traverses the document tree with an LLM.",
    exIdx: 4,
  },
  {
    num: 5, title: "Aggregations", badge: "AGG",
    desc: "Use COUNT(*), AVG, GROUP BY to aggregate across documents.",
    exIdx: 5,
  },
  {
    num: 6, title: "ORDER + LIMIT", badge: "SQL",
    desc: "Sort results by any column and paginate with LIMIT / OFFSET.",
    exIdx: 6,
  },
  {
    num: 7, title: "REASON — Antagonists", badge: "LLM",
    desc: "Ask the LLM to identify and compare villains and antagonists across all novels.",
    exIdx: 7,
  },
  {
    num: 8, title: "REASON — Society & Era", badge: "LLM",
    desc: "Explore how 19th-century social anxieties and cultural values shaped each novel.",
    exIdx: 8,
  },
  {
    num: 9, title: "REASON — Narrative Style", badge: "LLM",
    desc: "Compare the distinct narrative voices and storytelling techniques of each author.",
    exIdx: 9,
  },
]

const BADGE_COLORS: Record<string, string> = {
  SQL: "bg-slate-100 text-slate-700",
  BM25: "bg-amber-100 text-amber-800",
  LLM: "bg-purple-100 text-purple-800",
  AGG: "bg-blue-100 text-blue-800",
}

export default function Page() {
  const [serverUrl, setServerUrl] = useState("http://localhost:4444")
  const [apiKey, setApiKey] = useState("")
  const [isDataReady, setIsDataReady] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [playgroundIdx, setPlaygroundIdx] = useState(0)

  useEffect(() => {
    const url = localStorage.getItem("reasondb_server_url")
    const key = localStorage.getItem("reasondb_api_key")
    if (url) setServerUrl(url)
    if (key) setApiKey(key)
  }, [])

  const handleUrlChange = (url: string) => {
    setServerUrl(url)
    localStorage.setItem("reasondb_server_url", url)
  }
  const handleKeyChange = (key: string) => {
    setApiKey(key)
    localStorage.setItem("reasondb_api_key", key)
  }

  const tryStep = (exIdx: number, stepNum: number) => {
    setPlaygroundIdx(exIdx)
    setActiveStep(stepNum)
    setResult(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ConnectionBar
        serverUrl={serverUrl}
        apiKey={apiKey}
        onServerUrlChange={handleUrlChange}
        onApiKeyChange={handleKeyChange}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Guide */}
        <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-blue-600">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold">RQL Query Language</h1>
                <p className="text-[11px] text-muted-foreground">Tutorial 01 · Beginner · 30 min</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Learn ReasonDB's query language using 5 classic novels from Project Gutenberg.
            </p>
          </div>

          <div className="p-3 border-b">
            <DataSetupPanel
              tableName="books"
              docCount={5}
              serverUrl={serverUrl}
              apiKey={apiKey}
              label="Classic Novels Dataset"
              description="5 public-domain books from Project Gutenberg — Pride & Prejudice, Moby Dick, Frankenstein, Dracula, Sherlock Holmes."
              onInitialize={initializeDataset}
              onReady={() => setIsDataReady(true)}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
              Query Steps
            </p>
            {STEPS.map((step) => (
              <div
                key={step.num}
                className={`rounded-md border p-3 space-y-1.5 transition-colors cursor-pointer ${
                  activeStep === step.num ? "border-blue-200 bg-blue-50" : "hover:bg-muted/40"
                }`}
                onClick={() => tryStep(step.exIdx, step.num)}
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
                  <button className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                    Try it <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Playground */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold">Query Playground</h2>
              <Badge variant="outline" className="text-xs">books</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Select a preset or write your own RQL. Press ⌘ Enter to run.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <QueryPlayground
              serverUrl={serverUrl}
              apiKey={apiKey}
              examples={EXAMPLES}
              onResult={setResult}
              onError={setError}
              isDataReady={isDataReady}
              selectedIdx={playgroundIdx}
            />

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-3">Results</h3>
              <ResultsDisplay result={result} error={error} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
