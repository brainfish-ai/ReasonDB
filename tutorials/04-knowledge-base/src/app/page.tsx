"use client"
import { useState, useEffect } from "react"
import { Brain, ChevronRight } from "lucide-react"
import { ConnectionBar } from "@/components/ConnectionBar"
import { DataSetupPanel } from "@/components/DataSetupPanel"
import { QueryPlayground, type ExampleQuery } from "@/components/QueryPlayground"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { initializeDataset } from "./actions"
import type { QueryResult } from "@/lib/api"

const EXAMPLES: ExampleQuery[] = [
  { label: "List articles", badge: "SQL", query: "SELECT title, metadata.slug FROM wiki LIMIT 10" },
  { label: "Filter by tag", badge: "SQL", query: "SELECT * FROM wiki WHERE tags CONTAINS ANY ('transformer')" },
  { label: "SEARCH neural nets", badge: "BM25", query: "SELECT * FROM wiki SEARCH 'backpropagation gradient descent activation function'" },
  { label: "SEARCH LLMs", badge: "BM25", query: "SELECT * FROM wiki SEARCH 'large language model GPT BERT training'" },
  { label: "REASON explain ML", badge: "LLM", query: "SELECT * FROM wiki REASON 'Explain how machine learning models learn from data, citing specific techniques'" },
  { label: "REASON transformers", badge: "LLM", query: "SELECT * FROM wiki REASON 'What is the transformer architecture and why did it replace RNNs for NLP?'" },
  { label: "REASON comparison", badge: "LLM", query: "SELECT * FROM wiki REASON 'Compare supervised, unsupervised, and reinforcement learning with concrete examples'" },
  { label: "REASON LLM challenges", badge: "LLM", query: "SELECT * FROM wiki REASON 'What are the main technical and ethical challenges in building and deploying large language models?'" },
  { label: "REASON embeddings", badge: "LLM", query: "SELECT * FROM wiki REASON 'Explain the concept of embeddings — how do neural networks represent words, sentences, and documents as vectors?'" },
  { label: "REASON NLP → LLM path", badge: "LLM", query: "SELECT * FROM wiki REASON 'Trace the evolution from classical NLP to transformers to modern LLMs — what were the key breakthroughs at each stage?'" },
]

const STEPS = [
  { num: 1, title: "Browse Articles", badge: "SQL", desc: "List all Wikipedia ML articles in the knowledge base.", exIdx: 0 },
  { num: 2, title: "Tag Filtering", badge: "SQL", desc: "Filter articles by tag using CONTAINS ANY.", exIdx: 1 },
  { num: 3, title: "SEARCH Concepts", badge: "BM25", desc: "Find articles mentioning specific ML terms with BM25 ranking.", exIdx: 2 },
  { num: 4, title: "REASON — Explain ML", badge: "LLM", desc: "Ask the knowledge base to explain ML concepts across articles.", exIdx: 4 },
  { num: 5, title: "REASON — Transformers", badge: "LLM", desc: "Deep-dive into transformer architecture by synthesizing across docs.", exIdx: 5 },
  { num: 6, title: "REASON — Compare Paradigms", badge: "LLM", desc: "Compare supervised, unsupervised, and reinforcement learning across articles.", exIdx: 6 },
  { num: 7, title: "REASON — LLM Challenges", badge: "LLM", desc: "Explore the technical and ethical challenges in building large language models.", exIdx: 7 },
  { num: 8, title: "REASON — Embeddings", badge: "LLM", desc: "Understand how neural networks represent text as dense vector embeddings.", exIdx: 8 },
  { num: 9, title: "REASON — NLP to LLM", badge: "LLM", desc: "Trace the full evolution from classical NLP through transformers to modern LLMs.", exIdx: 9 },
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
          <div className="p-4 border-b bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-emerald-600"><Brain className="h-4 w-4 text-white" /></div>
              <div>
                <h1 className="text-sm font-bold">Knowledge Base Q&amp;A</h1>
                <p className="text-[11px] text-muted-foreground">Tutorial 04 · Beginner · 30 min</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Build an ML knowledge base from Wikipedia and query it with natural language using REASON.</p>
          </div>
          <div className="p-3 border-b">
            <DataSetupPanel
              tableName="wiki" docCount={5} serverUrl={serverUrl} apiKey={apiKey}
              label="Wikipedia ML Knowledge Base"
              description="5 Wikipedia articles: Machine Learning, Neural Networks, NLP, Transformers, and Large Language Models."
              onInitialize={initializeDataset} onReady={() => setIsDataReady(true)}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Query Steps</p>
            {STEPS.map((step) => (
              <div key={step.num} className={`rounded-md border p-3 space-y-1.5 cursor-pointer transition-colors ${activeStep === step.num ? "border-emerald-200 bg-emerald-50" : "hover:bg-muted/40"}`}
                onClick={() => { setActiveStep(step.num); setPlaygroundIdx(step.exIdx); setResult(null); setError(null) }}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{step.num}</span>
                  <span className="text-xs font-medium flex-1">{step.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[step.badge]}`}>{step.badge}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">{step.desc}</p>
                <div className="pl-7"><button className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-medium">Try it <ChevronRight className="h-3 w-3" /></button></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold">Query Playground</h2>
              <Badge variant="outline" className="text-xs">wiki</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Ask natural language questions across your ML knowledge base.</p>
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
