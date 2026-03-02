"use client"
import { useState, useEffect } from "react"
import { TrendingUp, ChevronRight } from "lucide-react"
import { ConnectionBar } from "@/components/ConnectionBar"
import { DataSetupPanel } from "@/components/DataSetupPanel"
import { QueryPlayground, type ExampleQuery } from "@/components/QueryPlayground"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { initializeDataset } from "./actions"
import type { QueryResult } from "@/lib/api"

const EXAMPLES: ExampleQuery[] = [
  { label: "All filings", badge: "SQL", query: "SELECT title, metadata.company, metadata.year FROM financials ORDER BY metadata.company ASC" },
  { label: "By company", badge: "SQL", query: "SELECT * FROM financials WHERE metadata.company = 'Apple Inc.'" },
  { label: "SEARCH revenue", badge: "BM25", query: "SELECT * FROM financials SEARCH 'revenue growth net income operating margin'" },
  { label: "SEARCH risks", badge: "BM25", query: "SELECT * FROM financials SEARCH 'risk factors competition regulatory market volatility'" },
  { label: "REASON revenue", badge: "LLM", query: "SELECT * FROM financials REASON 'Compare revenue growth and profitability trends across Apple, Tesla, and Microsoft in FY2023'" },
  { label: "REASON AI strategy", badge: "LLM", query: "SELECT * FROM financials REASON 'How does each company describe their AI and machine learning strategy in their annual report?'" },
  { label: "REASON risks", badge: "LLM", query: "SELECT * FROM financials REASON 'What are the most significant risk factors common to all three companies?'" },
  { label: "REASON competition", badge: "LLM", query: "SELECT * FROM financials REASON 'How do Apple, Tesla, and Microsoft describe their competitive landscape and what strategies do they use to maintain their advantages?'" },
  { label: "REASON cybersecurity", badge: "LLM", query: "SELECT * FROM financials REASON 'How do these companies approach data privacy, cybersecurity risks, and regulatory compliance across their operations?'" },
  { label: "REASON global growth", badge: "LLM", query: "SELECT * FROM financials REASON 'Which international markets and geographic expansion strategies do Apple, Tesla, and Microsoft prioritize for future growth?'" },
]

const STEPS = [
  { num: 1, title: "List Filings", badge: "SQL", desc: "Browse the 3 ingested 10-K annual reports from SEC EDGAR.", exIdx: 0 },
  { num: 2, title: "Filter by Company", badge: "SQL", desc: "Filter to a specific company's annual report.", exIdx: 1 },
  { num: 3, title: "SEARCH Financial Terms", badge: "BM25", desc: "Search for specific financial metrics across all filings.", exIdx: 2 },
  { num: 4, title: "REASON — Financials", badge: "LLM", desc: "Compare revenue growth and profitability across all 3 companies.", exIdx: 4 },
  { num: 5, title: "REASON — AI Strategy", badge: "LLM", desc: "Extract and compare each company's AI/ML strategy from their 10-K.", exIdx: 5 },
  { num: 6, title: "REASON — Risk Analysis", badge: "LLM", desc: "Identify common risk factors across Apple, Tesla, and Microsoft.", exIdx: 6 },
  { num: 7, title: "REASON — Competition", badge: "LLM", desc: "Explore how each company describes its competitive landscape and defensive strategies.", exIdx: 7 },
  { num: 8, title: "REASON — Cybersecurity", badge: "LLM", desc: "Understand how each company manages data privacy and cybersecurity risk.", exIdx: 8 },
  { num: 9, title: "REASON — Global Growth", badge: "LLM", desc: "Discover which international markets each company targets for expansion.", exIdx: 9 },
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
          <div className="p-4 border-b bg-gradient-to-br from-teal-50 to-cyan-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-teal-600"><TrendingUp className="h-4 w-4 text-white" /></div>
              <div>
                <h1 className="text-sm font-bold">PDF Financial Analysis</h1>
                <p className="text-[11px] text-muted-foreground">Tutorial 05 · Advanced · 45 min</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Analyze Apple, Tesla, and Microsoft FY2023 10-K filings from SEC EDGAR using ReasonDB.</p>
          </div>
          <div className="p-3 border-b">
            <DataSetupPanel
              tableName="financials" docCount={3} serverUrl={serverUrl} apiKey={apiKey}
              label="SEC EDGAR 10-K Filings"
              description="FY2023 annual reports: Apple Inc., Tesla Inc., and Microsoft Corporation — all from SEC EDGAR (public domain)."
              onInitialize={initializeDataset} onReady={() => setIsDataReady(true)}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Query Steps</p>
            {STEPS.map((step) => (
              <div key={step.num} className={`rounded-md border p-3 space-y-1.5 cursor-pointer transition-colors ${activeStep === step.num ? "border-teal-200 bg-teal-50" : "hover:bg-muted/40"}`}
                onClick={() => { setActiveStep(step.num); setPlaygroundIdx(step.exIdx); setResult(null); setError(null) }}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{step.num}</span>
                  <span className="text-xs font-medium flex-1">{step.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[step.badge]}`}>{step.badge}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">{step.desc}</p>
                <div className="pl-7"><button className="flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-medium">Try it <ChevronRight className="h-3 w-3" /></button></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold">Query Playground</h2>
              <Badge variant="outline" className="text-xs">financials</Badge>
              <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">SEC EDGAR</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Query across Apple, Tesla, and Microsoft FY2023 10-K filings.</p>
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
