"use client"
import { useState, useEffect } from "react"
import { FlaskConical, ChevronRight } from "lucide-react"
import { ConnectionBar } from "@/components/ConnectionBar"
import { DataSetupPanel } from "@/components/DataSetupPanel"
import { QueryPlayground, type ExampleQuery } from "@/components/QueryPlayground"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { initializeDataset } from "./actions"
import type { QueryResult } from "@/lib/api"

const EXAMPLES: ExampleQuery[] = [
  { label: "All papers", badge: "SQL", query: "SELECT title, metadata.authors, metadata.year FROM papers ORDER BY metadata.year ASC" },
  { label: "By year", badge: "SQL", query: "SELECT * FROM papers WHERE metadata.year >= 2018" },
  { label: "SEARCH attention", badge: "BM25", query: "SELECT * FROM papers SEARCH 'attention mechanism self-attention multi-head'" },
  { label: "SEARCH pretraining", badge: "BM25", query: "SELECT * FROM papers SEARCH 'pre-training fine-tuning transfer learning BERT'" },
  { label: "REASON evolution", badge: "LLM", query: "SELECT * FROM papers ORDER BY metadata.year ASC REASON 'How has the approach to language model training evolved from 2017 to 2020?'" },
  { label: "REASON architecture", badge: "LLM", query: "SELECT * FROM papers REASON 'What architectural innovations do these papers introduce and how do they relate to each other?'" },
  { label: "Count papers", badge: "AGG", query: "SELECT COUNT(*) FROM papers" },
  { label: "REASON benchmarks", badge: "LLM", query: "SELECT * FROM papers REASON 'What datasets and benchmarks were used to evaluate these models, and what were the headline results?'" },
  { label: "REASON compute & scale", badge: "LLM", query: "SELECT * FROM papers REASON 'What computational requirements and scaling challenges do the authors describe, and how does model size affect performance?'" },
  { label: "REASON limitations", badge: "LLM", query: "SELECT * FROM papers REASON 'What limitations, failure modes, and future research directions do the authors identify in each paper?'" },
]

const STEPS = [
  { num: 1, title: "List Papers", badge: "SQL", desc: "Browse the 3 ingested ML papers ordered by publication year.", exIdx: 0 },
  { num: 2, title: "Filter by Year", badge: "SQL", desc: "Filter papers published from 2018 onward (BERT and GPT-3).", exIdx: 1 },
  { num: 3, title: "SEARCH Terms", badge: "BM25", desc: "Find papers mentioning specific ML concepts using BM25 search.", exIdx: 2 },
  { num: 4, title: "REASON — Evolution", badge: "LLM", desc: "Ask how LM training evolved across papers, ordered by year.", exIdx: 4 },
  { num: 5, title: "REASON — Architecture", badge: "LLM", desc: "Synthesize architectural innovations across all three papers.", exIdx: 5 },
  { num: 6, title: "Count Docs", badge: "AGG", desc: "Verify all 3 PDF papers were ingested successfully.", exIdx: 6 },
  { num: 7, title: "REASON — Benchmarks", badge: "LLM", desc: "Explore what datasets and benchmarks each paper uses and what results were achieved.", exIdx: 7 },
  { num: 8, title: "REASON — Compute & Scale", badge: "LLM", desc: "Understand the computational requirements and scaling laws discussed across papers.", exIdx: 8 },
  { num: 9, title: "REASON — Limitations", badge: "LLM", desc: "Identify failure modes and future research directions flagged by each set of authors.", exIdx: 9 },
]

const BADGE_COLORS: Record<string, string> = {
  SQL: "bg-slate-100 text-slate-700", BM25: "bg-amber-100 text-amber-800",
  LLM: "bg-purple-100 text-purple-800", AGG: "bg-blue-100 text-blue-800",
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

  const handleUrlChange = (url: string) => { setServerUrl(url); localStorage.setItem("reasondb_server_url", url) }
  const handleKeyChange = (key: string) => { setApiKey(key); localStorage.setItem("reasondb_api_key", key) }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ConnectionBar serverUrl={serverUrl} apiKey={apiKey} onServerUrlChange={handleUrlChange} onApiKeyChange={handleKeyChange} />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-br from-purple-50 to-violet-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-purple-600"><FlaskConical className="h-4 w-4 text-white" /></div>
              <div>
                <h1 className="text-sm font-bold">Research Paper Analysis</h1>
                <p className="text-[11px] text-muted-foreground">Tutorial 03 · Intermediate · 45 min</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Analyze 3 seminal ML papers ingested as PDFs — Attention Is All You Need, BERT, and GPT-3.</p>
          </div>
          <div className="p-3 border-b">
            <DataSetupPanel
              tableName="papers" docCount={3} serverUrl={serverUrl} apiKey={apiKey}
              label="ArXiv ML Papers (PDF)"
              description="3 PDF papers from ArXiv: Attention Is All You Need (2017), BERT (2018), Language Models are Few-Shot Learners / GPT-3 (2020)."
              onInitialize={initializeDataset} onReady={() => setIsDataReady(true)}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Query Steps</p>
            {STEPS.map((step) => (
              <div key={step.num} className={`rounded-md border p-3 space-y-1.5 cursor-pointer transition-colors ${activeStep === step.num ? "border-purple-200 bg-purple-50" : "hover:bg-muted/40"}`}
                onClick={() => { setActiveStep(step.num); setPlaygroundIdx(step.exIdx); setResult(null); setError(null) }}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{step.num}</span>
                  <span className="text-xs font-medium flex-1">{step.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[step.badge]}`}>{step.badge}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">{step.desc}</p>
                <div className="pl-7"><button className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 font-medium">Try it <ChevronRight className="h-3 w-3" /></button></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold">Query Playground</h2>
              <Badge variant="outline" className="text-xs">papers</Badge>
              <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">PDF ingestion</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Query across 3 ML research papers ingested from PDF via <code className="bg-muted px-1 rounded text-[11px]">ingest/file</code>.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <QueryPlayground serverUrl={serverUrl} apiKey={apiKey} examples={EXAMPLES} onResult={setResult} onError={setError} isDataReady={isDataReady} selectedIdx={playgroundIdx} />
            <Separator />
            <div><h3 className="text-sm font-semibold mb-3">Results</h3><ResultsDisplay result={result} error={error} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
