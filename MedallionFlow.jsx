import { useState } from "react";

const SAMPLE_CSV = `transaction_id,date,amount,currency,pool_type,status,agency,cpr
TXN001,2024-01-15,250000.50,USD,GNMS,SETTLED,GNMA,3.2
TXN002,2024-01-15,,USD,FNMS,PENDING,FNMA,
TXN003,2024-01-16,180000.00,USD,GNMS,SETTLED,GNMA,2.8
TXN001,2024-01-15,250000.50,USD,GNMS,SETTLED,GNMA,3.2
TXN004,2024-01-16,420000.75,USD,FNMS,FAILED,FNMA,4.1
TXN005,2024-01-17,195000.00,usd,GNMS,settled,GNMA,2.9
TXN006,2024-01-17,,USD,FNMS,PENDING,FNMA,
TXN007,2024-01-18,310000.00,USD,GNMS,SETTLED,GNMA,3.5
TXN008,2024-01-18,275000.25,USD,FNMS,SETTLED,FNMA,3.1
TXN009,,150000.00,USD,GNMS,SETTLED,GNMA,2.7`;

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").trim()]));
  });
  return { headers, rows };
}

function getBronze(csv) {
  const { headers, rows } = parseCSV(csv);
  const nullCount = rows.reduce((n, r) => n + Object.values(r).filter(v => v === "").length, 0);
  const keys = rows.map(r => JSON.stringify(r));
  const dupCount = keys.length - new Set(keys).size;
  const qs = Math.max(0, 100 - nullCount * 5 - dupCount * 10);
  return { headers, rows, stats: { rows: rows.length, cols: headers.length, nulls: nullCount, dupes: dupCount, qs } };
}

function getSilver(bronze) {
  const { headers, rows } = bronze;
  const seen = new Set();
  const deduped = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
  const critical = headers.slice(0, 2);
  const filtered = deduped.filter(r => critical.every(c => r[c] !== ""));
  const cleaned = filtered.map(r => {
    const out = {};
    headers.forEach(h => { out[h] = r[h] ? r[h].toUpperCase() : ""; });
    return out;
  });
  const nullCount = cleaned.reduce((n, r) => n + Object.values(r).filter(v => v === "").length, 0);
  return {
    headers, rows: cleaned,
    stats: {
      rows: cleaned.length, cols: headers.length, nulls: nullCount, dupes: 0,
      qs: Math.max(0, 100 - nullCount * 3),
      removed: { dupes: rows.length - deduped.length, nullRows: deduped.length - filtered.length }
    }
  };
}

function getGold(silver) {
  const { rows } = silver;
  const groups = {};
  rows.forEach(r => {
    const k = `${r.pool_type}__${r.status}`;
    if (!groups[k]) groups[k] = { pool_type: r.pool_type, status: r.status, n: 0, total: 0, cprs: [] };
    groups[k].n++;
    if (r.amount) groups[k].total += parseFloat(r.amount) || 0;
    if (r.cpr) groups[k].cprs.push(parseFloat(r.cpr) || 0);
  });
  const goldHeaders = ["pool_type", "status", "tx_count", "total_volume", "avg_cpr"];
  const goldRows = Object.values(groups).map(g => ({
    pool_type: g.pool_type,
    status: g.status,
    tx_count: String(g.n),
    total_volume: g.total > 0 ? "$" + g.total.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A",
    avg_cpr: g.cprs.length ? (g.cprs.reduce((a, b) => a + b) / g.cprs.length).toFixed(2) + "%" : "N/A"
  }));
  return { headers: goldHeaders, rows: goldRows, stats: { rows: goldRows.length, cols: goldHeaders.length, nulls: 0, dupes: 0, qs: 99 } };
}

const CFG = {
  bronze: { label: "Bronze", tag: "RAW INGESTION", color: "#c07830", bg: "rgba(192,120,48,0.07)", bdr: "rgba(192,120,48,0.35)" },
  silver: { label: "Silver", tag: "CLEANED & TYPED", color: "#9aa5b4", bg: "rgba(154,165,180,0.07)", bdr: "rgba(154,165,180,0.35)" },
  gold:   { label: "Gold",   tag: "AGGREGATED",     color: "#e8b840", bg: "rgba(232,184,64,0.07)",  bdr: "rgba(232,184,64,0.35)" },
};

function QBar({ score, color }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginBottom: 3, fontFamily: "monospace" }}>
        <span>QUALITY SCORE</span>
        <span style={{ color }}>{score}/100</span>
      </div>
      <div style={{ height: 2, background: "#1e293b", borderRadius: 1 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 1, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

function StatGrid({ stats, color }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
      {[["rows", stats.rows], ["cols", stats.cols], ["nulls", stats.nulls], ["dupes", stats.dupes]].map(([k, v]) => (
        <div key={k}>
          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 600, lineHeight: 1.1, color: (k === "nulls" && v > 0) ? "#f59e0b" : (k === "dupes" && v > 0) ? "#ef4444" : "#e2e8f0" }}>{v}</div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ data, layerKey }) {
  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, fontFamily: "monospace", fontSize: 11, color: "#2d3a4a", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>⬡</div>
      <div>Run pipeline → click a layer card</div>
    </div>
  );
  return (
    <div style={{ overflowX: "auto", maxHeight: 240, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
        <thead>
          <tr>{data.headers.map(h => (
            <th key={h} style={{ background: "#040a14", color: "#475569", padding: "7px 12px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1e293b", position: "sticky", top: 0, whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {data.headers.map(h => (
                <td key={h} style={{ padding: "5px 12px", color: row[h] === "" ? "#ef4444" : "#8899aa", background: row[h] === "" ? "rgba(239,68,68,0.05)" : "transparent", borderBottom: "1px solid #0d1624", whiteSpace: "nowrap" }}>
                  {row[h] === "" ? "NULL" : row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MedallionFlow() {
  const [csv, setCsv] = useState("");
  const [pipeline, setPipeline] = useState({ bronze: null, silver: null, gold: null });
  const [active, setActive] = useState(null);
  const [stage, setStage] = useState(null);
  const [aiMap, setAiMap] = useState({});
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const run = async () => {
    if (!csv.trim()) return;
    setRunning(true); setPipeline({ bronze: null, silver: null, gold: null });
    setActive(null); setAiMap({});
    setStage("bronze"); await sleep(500);
    const b = getBronze(csv);
    setPipeline(p => ({ ...p, bronze: b }));
    setStage("silver"); await sleep(700);
    const s = getSilver(b);
    setPipeline(p => ({ ...p, silver: s }));
    setStage("gold"); await sleep(600);
    const g = getGold(s);
    setPipeline(p => ({ ...p, gold: g }));
    setStage(null); setRunning(false); setActive("gold");
  };

  const analyze = async (key) => {
    const layer = pipeline[key];
    if (!layer) return;
    setBusy(true);
    const prompts = {
      bronze: `You are a senior data engineer. Analyze this Bronze layer (raw ingestion) in a Medallion ETL pipeline.\nSchema: ${layer.headers.join(", ")}\nSample rows:\n${layer.rows.slice(0,5).map(r=>JSON.stringify(r)).join("\n")}\nStats: ${layer.stats.rows} rows, ${layer.stats.nulls} nulls, ${layer.stats.dupes} duplicates, quality score: ${layer.stats.qs}/100\n\nGive: 1) Quality assessment 2) Issues found 3) Silver transformation recommendations. Max 140 words.`,
      silver: `You are a senior data engineer. Analyze this Silver layer (cleaned & typed) in a Medallion ETL pipeline.\nSchema: ${layer.headers.join(", ")}\nSample rows:\n${layer.rows.slice(0,5).map(r=>JSON.stringify(r)).join("\n")}\nRemovals: ${JSON.stringify(layer.stats.removed)}, quality score: ${layer.stats.qs}/100\n\nGive: 1) Cleanliness assessment 2) Any remaining concerns 3) Gold aggregation strategy. Max 140 words.`,
      gold: `You are a senior data engineer. Analyze this Gold (aggregated) layer in a Medallion ETL pipeline.\nSchema: ${layer.headers.join(", ")}\nAll rows:\n${layer.rows.map(r=>JSON.stringify(r)).join("\n")}\n\nGive: 1) Business insights 2) Star/Snowflake schema recommendations 3) Suggested KPIs or further analysis. Max 140 words.`
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompts[key] }] })
      });
      const d = await res.json();
      const text = d.content?.find(b => b.type === "text")?.text || "Analysis unavailable.";
      setAiMap(m => ({ ...m, [key]: text }));
    } catch { setAiMap(m => ({ ...m, [key]: "Analysis failed. Please try again." })); }
    setBusy(false);
  };

  const activeData = active ? pipeline[active] : null;
  const root = { fontFamily: "system-ui, -apple-system, sans-serif", background: "#020817", minHeight: "100vh", color: "#cbd5e1", padding: "20px", fontSize: 14 };

  return (
    <div style={root}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0d1624; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        textarea:focus { outline: none; border-color: #2563eb !important; }
        textarea::placeholder { color: #2d3a4a; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5 }}>
            Medallion<span style={{ color: "#e8b840" }}>Flow</span>
          </span>
          <span style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>v1.0</span>
        </div>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: "#334155", margin: "3px 0 0" }}>
          {"// AI-Powered ETL Pipeline Orchestrator · Bronze → Silver → Gold Medallion Architecture"}
        </p>
      </div>

      {/* Input Row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          placeholder="Paste CSV data here (first row = headers)..."
          style={{ flex: 1, height: 86, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 8, color: "#94a3b8", fontFamily: "monospace", fontSize: 10.5, padding: "10px 12px", resize: "none", transition: "border-color 0.2s" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 120 }}>
          <button onClick={() => setCsv(SAMPLE_CSV)} style={{ flex: 1, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 6, color: "#64748b", cursor: "pointer", fontSize: 11, transition: "all 0.15s" }}>
            Load Sample
          </button>
          <button onClick={run} disabled={!csv.trim() || running}
            style={{ flex: 1, background: (csv.trim() && !running) ? "#1d4ed8" : "#131c2e", border: "none", borderRadius: 6, color: (csv.trim() && !running) ? "white" : "#334155", cursor: (csv.trim() && !running) ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 600, transition: "all 0.15s", animation: running ? "pulse 1.2s infinite" : "none" }}>
            {running ? "⟳ Running…" : "▶ Run Pipeline"}
          </button>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 18 }}>
        {["bronze", "silver", "gold"].map((key, i) => {
          const cfg = CFG[key];
          const layer = pipeline[key];
          const isActive = active === key;
          const isLoading = stage === key;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", flex: 1, gap: 0 }}>
              {i > 0 && (
                <div style={{ color: pipeline[["bronze","silver","gold"][i-1]] ? "#2563eb" : "#1e293b", fontSize: 22, padding: "0 6px", flexShrink: 0, userSelect: "none" }}>›</div>
              )}
              <div onClick={() => layer && setActive(key)} style={{
                flex: 1, background: isActive ? cfg.bg : "#0a1628",
                border: `1px solid ${isActive ? cfg.bdr : "#1e293b"}`,
                borderRadius: 10, padding: 14, cursor: layer ? "pointer" : "default",
                animation: isLoading ? "pulse 0.9s infinite" : "none",
                boxShadow: isActive ? `0 0 18px -7px ${cfg.color}55` : "none",
                transition: "all 0.2s", minHeight: 120
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 8, color: "#334155", letterSpacing: 0.5 }}>{cfg.tag}</span>
                </div>
                {layer ? (
                  <>
                    <StatGrid stats={layer.stats} color={cfg.color} />
                    <QBar score={layer.stats.qs} color={cfg.color} />
                  </>
                ) : (
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#263040", marginTop: 4 }}>
                    {isLoading ? "⟳ processing..." : "— awaiting pipeline run"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: Table + AI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 14 }}>
        {/* Data Preview */}
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
              {activeData ? `${CFG[active].label.toUpperCase()} LAYER · ${activeData.rows.length} records · ${activeData.headers.length} columns` : "DATA PREVIEW"}
            </span>
            {active && <span style={{ background: "rgba(37,99,235,0.12)", color: "#60a5fa", fontSize: 9, padding: "2px 7px", borderRadius: 3, fontFamily: "monospace" }}>{active}</span>}
          </div>
          <DataTable data={activeData} layerKey={active} />
        </div>

        {/* AI Analysis */}
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "blink 2s infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#475569", fontWeight: 600, fontFamily: "monospace", letterSpacing: 0.3 }}>AI ANALYSIS · Claude Sonnet</span>
          </div>
          <div style={{ flex: 1, padding: 14, overflowY: "auto", maxHeight: 210, minHeight: 100 }}>
            {active && aiMap[active]
              ? <p style={{ margin: 0, fontSize: 12, lineHeight: 1.75, color: "#94a3b8", whiteSpace: "pre-wrap" }}>{aiMap[active]}</p>
              : <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "#263040", lineHeight: 1.7 }}>
                  {active ? `Click below to get AI insights for the ${CFG[active]?.label} layer.` : "Select a layer after running the pipeline to analyze it."}
                </p>
            }
          </div>
          {active && pipeline[active] && (
            <div style={{ padding: "0 12px 12px" }}>
              <button onClick={() => analyze(active)} disabled={busy}
                style={{ width: "100%", padding: "9px", background: busy ? "#131c2e" : "#1d4ed8", border: "none", borderRadius: 6, color: busy ? "#334155" : "white", cursor: busy ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s" }}>
                {busy ? "⟳ Analyzing…" : `✦ Analyze ${CFG[active]?.label} Layer`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer tags */}
      <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Python", "Pandas", "NumPy", "Apache Spark", "Medallion Architecture", "ETL/ELT", "Star Schema", "Claude AI API"].map(t => (
          <span key={t} style={{ background: "#0f1a2e", border: "1px solid #1e293b", color: "#475569", fontSize: 9, padding: "3px 8px", borderRadius: 4, fontFamily: "monospace" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}
