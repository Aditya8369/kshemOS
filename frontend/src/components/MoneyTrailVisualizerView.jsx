import { useState, useEffect, useMemo } from 'react';
import {
  GitMerge,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  Download,
  Copy,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  Building,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Layers,
  ChevronRight,
  Printer,
  UploadCloud,
  FileText,
  Lock,
} from 'lucide-react';

import {
  fetchMoneyTrailAnalysisApi,
  ingestMoneyTrailTransactionsApi,
  fetchSection102ScheduleApi,
  fetchSampleMoneyTrailCsvApi,
  defaultMoneyTrailStore,
  MONEY_TRAIL_CHANGED_EVENT,
} from '../api';

function formatInr(val) {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
}

export default function MoneyTrailVisualizerView() {
  const [caseId, setCaseId] = useState('CASE-2026-DELHI-01');
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('hop-graph'); // 'hop-graph' | 'sankey' | 'schedule' | 'ingest'
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [copiedSchedule, setCopiedSchedule] = useState(false);
  const [filterPriority, setFilterPriority] = useState('ALL');

  // CSV Ingestion state
  const [rawCsvInput, setRawCsvInput] = useState('');
  const [ingestStatus, setIngestStatus] = useState(null);

  // Load analysis
  async function loadData(targetCase = caseId) {
    setLoading(true);
    try {
      const data = await fetchMoneyTrailAnalysisApi(targetCase);
      setAnalysis(data);
      if (data && data.nodes && data.nodes.length > 0 && !selectedNodeId) {
        // Select central hub or first critical account by default
        const hub = data.nodes.find((n) => n.is_mule_hub) || data.nodes[0];
        setSelectedNodeId(hub.account_id);
      }
    } catch (err) {
      console.error('Failed to load money trail:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(caseId);

    const onStoreChange = (e) => {
      if (e.detail) setAnalysis(e.detail);
    };
    window.addEventListener(MONEY_TRAIL_CHANGED_EVENT, onStoreChange);
    return () => window.removeEventListener(MONEY_TRAIL_CHANGED_EVENT, onStoreChange);
  }, [caseId]);

  // Load sample CSV into text box
  async function handleLoadSampleCsv() {
    const res = await fetchSampleMoneyTrailCsvApi();
    if (res && res.csv_data) {
      setRawCsvInput(res.csv_data);
    }
  }

  // Handle CSV Ingestion
  async function handleIngestCsv() {
    if (!rawCsvInput.trim()) return;
    setLoading(true);
    setIngestStatus(null);
    try {
      const result = await ingestMoneyTrailTransactionsApi({
        case_id: caseId || 'CASE-INGESTED-01',
        raw_csv: rawCsvInput,
        format: 'CSV',
      });
      setAnalysis(result);
      setIngestStatus({ success: true, message: `Reconstructed ${result.nodes.length} nodes & ${result.edges.length} flow hops!` });
      setActiveTab('hop-graph');
    } catch (err) {
      setIngestStatus({ success: false, message: `Ingestion failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }

  // Copy Section 102 Schedule text
  function handleCopySchedule() {
    if (!analysis || !analysis.section_102_schedule) return;
    const schedule = analysis.section_102_schedule;
    const lines = [
      `SECTION 102 CrPC / SECTION 107 BNSS ASSET ATTACHMENT SCHEDULE`,
      `Schedule ID: ${schedule.schedule_id}`,
      `Case ID: ${schedule.case_id}`,
      `Investigating Officer: ${schedule.investigating_officer}`,
      `Police Station: ${schedule.police_station}`,
      `Total Resting Proceeds Subject to Freeze: ${formatInr(schedule.total_resting_amount_inr)}`,
      `Verification Hash: ${schedule.schedule_hash}`,
      `Generated At: ${schedule.generated_at_iso}`,
      `--------------------------------------------------------------------------------`,
      ...schedule.items.map(
        (it) =>
          `[#${it.schedule_index}] Beneficiary: ${it.beneficiary_account} | Bank: ${it.bank_name} (${it.ifsc_code}) | Resting INR: ${formatInr(it.seized_amount_resting_inr)} | Priority: ${it.freeze_mandate_priority}\nGrounds: ${it.statutory_grounds}\nUTRs: ${it.utr_references.join(', ')}`
      ),
      `--------------------------------------------------------------------------------`,
      schedule.statutory_declaration,
    ];

    navigator.clipboard.writeText(lines.join('\n\n'));
    setCopiedSchedule(true);
    setTimeout(() => setCopiedSchedule(false), 3000);
  }

  // Export Section 102 Schedule as CSV
  function handleDownloadCsv() {
    const csvContent = defaultMoneyTrailStore.exportScheduleAsCsv(caseId);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Section_102_CrPC_Attachment_Schedule_${caseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Nodes grouped by Hop Level
  const nodesByHop = useMemo(() => {
    if (!analysis || !analysis.nodes) return {};
    const grouped = {};
    analysis.nodes.forEach((n) => {
      const hop = n.hop_level;
      if (!grouped[hop]) grouped[hop] = [];
      grouped[hop].push(n);
    });
    return grouped;
  }, [analysis]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!analysis || !analysis.nodes || !selectedNodeId) return null;
    return analysis.nodes.find((n) => n.account_id === selectedNodeId) || null;
  }, [analysis, selectedNodeId]);

  // Filtered schedule items
  const filteredScheduleItems = useMemo(() => {
    if (!analysis || !analysis.section_102_schedule) return [];
    const items = analysis.section_102_schedule.items;
    if (filterPriority === 'ALL') return items;
    return items.filter((it) => it.freeze_mandate_priority === filterPriority);
  }, [analysis, filterPriority]);

  return (
    <div className="space-y-6 text-white">
      {/* Header & Title Banner */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <GitMerge className="w-3.5 h-3.5 text-emerald-400" /> Multi-Hop Money Trail Engine
              </span>
              <span className="text-xs font-mono uppercase text-[var(--saffron)] font-bold">
                CFCFRMS / Section 102 CrPC
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Syndicate Mule Ring Money-Trail Visualizer
            </h1>
            <p className="text-sm text-[var(--mist)] mt-1 max-w-3xl">
              Ingests multi-hop bank transaction logs, reconstructs fund dispersion hops from victims to exit points,
              identifies bottleneck Mule Hub accounts, and prioritizes immediate Section 102 CrPC provisional debit freezes
              on accounts where funds are still resting.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadData(caseId)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-2 border border-white/10 transition"
              title="Refresh money trail"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={handleDownloadCsv}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
            >
              <Download className="w-3.5 h-3.5" /> Export Schedule (CSV)
            </button>
            <button
              onClick={() => setActiveTab('ingest')}
              className="px-3.5 py-2 rounded-xl bg-[var(--saffron)] hover:brightness-110 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-orange-900/30 transition"
            >
              <UploadCloud className="w-3.5 h-3.5" /> Ingest Logs
            </button>
          </div>
        </div>

        {/* Case ID selector & KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[var(--navy-line)]">
          <div className="bg-[var(--ink)]/60 rounded-xl p-3.5 border border-white/5">
            <div className="text-[11px] font-mono uppercase text-[var(--mist)]">Total Stolen Volume</div>
            <div className="text-xl font-bold text-white mt-1">
              {analysis ? formatInr(analysis.total_volume_inr) : '₹0'}
            </div>
            <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Across {analysis?.nodes?.length || 0} reconstructed accounts
            </div>
          </div>

          <div className="bg-[var(--ink)]/60 rounded-xl p-3.5 border border-emerald-500/20">
            <div className="text-[11px] font-mono uppercase text-emerald-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Active Resting Balance
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              {analysis ? formatInr(analysis.active_resting_balance_inr) : '₹0'}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">
              {analysis && analysis.total_volume_inr > 0
                ? `${Math.round((analysis.active_resting_balance_inr / analysis.total_volume_inr) * 100)}% recoverable in Golden Hour`
                : 'Priority freeze mandate'}
            </div>
          </div>

          <div className="bg-[var(--ink)]/60 rounded-xl p-3.5 border border-red-500/20">
            <div className="text-[11px] font-mono uppercase text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Bottleneck Mule Hubs
            </div>
            <div className="text-xl font-bold text-red-300 mt-1">
              {analysis?.mule_hubs?.length || 0} Account{analysis?.mule_hubs?.length === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] text-red-400/80 mt-1">
              Fan-in &ge; 2 | High concentration score
            </div>
          </div>

          <div className="bg-[var(--ink)]/60 rounded-xl p-3.5 border border-cyan-500/20">
            <div className="text-[11px] font-mono uppercase text-cyan-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Layering Velocity
            </div>
            <div className="text-xl font-bold text-cyan-300 mt-1">
              13 - 18 Mins
            </div>
            <div className="text-[11px] text-cyan-400/80 mt-1">
              Rapid onward IMPS dispersion
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="flex border-b border-[var(--navy-line)] gap-2">
        <button
          onClick={() => setActiveTab('hop-graph')}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'hop-graph'
              ? 'border-[var(--saffron)] text-[var(--saffron)]'
              : 'border-transparent text-[var(--mist)] hover:text-white'
          }`}
        >
          <GitMerge className="w-4 h-4" /> Multi-Hop Flow Architecture
        </button>
        <button
          onClick={() => setActiveTab('sankey')}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'sankey'
              ? 'border-[var(--saffron)] text-[var(--saffron)]'
              : 'border-transparent text-[var(--mist)] hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" /> Proportional Sankey Dispersion
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'schedule'
              ? 'border-[var(--saffron)] text-[var(--saffron)]'
              : 'border-transparent text-[var(--mist)] hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" /> Section 102 CrPC Attachment Schedule
          {analysis?.section_102_schedule?.items?.length ? (
            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">
              {analysis.section_102_schedule.items.length} Freezes
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab('ingest')}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'ingest'
              ? 'border-[var(--saffron)] text-[var(--saffron)]'
              : 'border-transparent text-[var(--mist)] hover:text-white'
          }`}
        >
          <UploadCloud className="w-4 h-4" /> Ingest CSV / CFCFRMS Logs
        </button>
      </div>

      {/* TAB 1: MULTI-HOP GRAPH & NODE INSPECTOR */}
      {activeTab === 'hop-graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hop Flow Column Diagram */}
          <div className="lg:col-span-2 bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-[var(--saffron)]" /> Hop Dispersion Columns
                </h2>
                <p className="text-xs text-[var(--mist)]">
                  Click any account node to inspect inward transfers, outward velocity, and freeze requisitions.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Resting &gt; ₹0
                </span>
                <span className="flex items-center gap-1 text-red-400 ml-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Mule Hub
                </span>
              </div>
            </div>

            {/* Hop Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
              {/* Hop 0: Victims */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-purple-300 bg-purple-950/40 border border-purple-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span>Hop 0: Victims</span>
                  <span className="font-bold">{nodesByHop[0]?.length || 0}</span>
                </div>
                <div className="space-y-2.5">
                  {nodesByHop[0]?.map((node) => (
                    <button
                      key={node.account_id}
                      onClick={() => setSelectedNodeId(node.account_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedNodeId === node.account_id
                          ? 'bg-purple-900/40 border-purple-400 ring-2 ring-purple-400/40'
                          : 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-purple-500/40'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white truncate">{node.account_id}</div>
                      <div className="text-[11px] text-[var(--mist)]">{node.bank_name}</div>
                      <div className="text-xs font-mono font-bold text-red-400 mt-1">
                        -{formatInr(node.total_outflow)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hop 1: Layer 1 Intake Mules */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-300 bg-amber-950/40 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span>Hop 1: Intake Mules</span>
                  <span className="font-bold">{nodesByHop[1]?.length || 0}</span>
                </div>
                <div className="space-y-2.5">
                  {nodesByHop[1]?.map((node) => (
                    <button
                      key={node.account_id}
                      onClick={() => setSelectedNodeId(node.account_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all relative ${
                        selectedNodeId === node.account_id
                          ? 'bg-amber-900/40 border-amber-400 ring-2 ring-amber-400/40'
                          : 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-amber-500/40'
                      }`}
                    >
                      {node.resting_balance > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500 text-black font-bold">
                          Resting
                        </span>
                      )}
                      <div className="text-xs font-semibold text-white truncate">{node.account_id}</div>
                      <div className="text-[11px] text-[var(--mist)]">{node.bank_name}</div>
                      <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                        <span className="text-emerald-400">+{formatInr(node.total_inflow)}</span>
                        {node.transfer_velocity_minutes && (
                          <span className="text-cyan-400">{node.transfer_velocity_minutes}m vel</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hop 2: Mule Hub Concentrators */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-red-300 bg-red-950/40 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span>Hop 2: Mule Hubs</span>
                  <span className="font-bold">{nodesByHop[2]?.length || 0}</span>
                </div>
                <div className="space-y-2.5">
                  {nodesByHop[2]?.map((node) => (
                    <button
                      key={node.account_id}
                      onClick={() => setSelectedNodeId(node.account_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all relative ${
                        selectedNodeId === node.account_id
                          ? 'bg-red-900/40 border-red-400 ring-2 ring-red-400/40'
                          : 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-red-500/40'
                      } ${node.is_mule_hub ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      {node.is_mule_hub && (
                        <div className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/30 text-red-300 border border-red-500/40 mb-1">
                          HUB BOTTLENECK ({node.mule_hub_score}%)
                        </div>
                      )}
                      <div className="text-xs font-semibold text-white truncate">{node.account_id}</div>
                      <div className="text-[11px] text-[var(--mist)]">{node.bank_name}</div>
                      <div className="text-xs font-mono font-bold text-emerald-300 mt-1">
                        Resting: {formatInr(node.resting_balance)}
                      </div>
                      <div className="text-[10px] text-[var(--mist)] mt-0.5 font-mono">
                        In: {node.inflow_count} txns | Out: {node.outflow_count} txns
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hop 3: Exit Channels & Splitters */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span>Hop 3+: Exit & Cash</span>
                  <span className="font-bold">
                    {(nodesByHop[3]?.length || 0) + (nodesByHop[4]?.length || 0)}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[...(nodesByHop[3] || []), ...(nodesByHop[4] || [])].map((node) => (
                    <button
                      key={node.account_id}
                      onClick={() => setSelectedNodeId(node.account_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedNodeId === node.account_id
                          ? 'bg-cyan-900/40 border-cyan-400 ring-2 ring-cyan-400/40'
                          : 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-cyan-500/40'
                      }`}
                    >
                      {node.resting_balance > 0 ? (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500 text-black mb-1">
                          CRITICAL RESTING ({formatInr(node.resting_balance)})
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-mono text-[var(--mist)] bg-white/5 mb-1">
                          DRAINED / WITHDRAWN
                        </span>
                      )}
                      <div className="text-xs font-semibold text-white truncate">{node.account_id}</div>
                      <div className="text-[11px] text-[var(--mist)]">{node.bank_name}</div>
                      <div className="text-[10px] font-mono text-cyan-400 mt-1">
                        Total Inflow: {formatInr(node.total_inflow)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Directional Edges Summary */}
            <div className="pt-4 border-t border-[var(--navy-line)]">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-2">
                Reconstructed Flow Edges ({analysis?.edges?.length || 0} Transfers)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {analysis?.edges?.map((edge, idx) => (
                  <div
                    key={`${edge.utr_number}-${idx}`}
                    className="p-2.5 rounded-lg bg-[var(--ink)]/60 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <span className="font-mono text-purple-300">{edge.source_node}</span>
                      <ArrowRight className="w-3 h-3 inline mx-1.5 text-[var(--saffron)]" />
                      <span className="font-mono text-amber-300">{edge.target_node}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-bold text-emerald-400">{formatInr(edge.amount)}</div>
                      <div className="text-[10px] text-[var(--mist)] font-mono">{edge.utr_number}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Node Inspector Drawer */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-[var(--saffron)]" /> Account Forensic Dossier
            </h2>

            {selectedNode ? (
              <div className="space-y-4">
                {/* Node Status Banner */}
                <div
                  className={`p-4 rounded-xl border ${
                    selectedNode.freeze_priority === 'TIER_1_CRITICAL_RESTING'
                      ? 'bg-emerald-950/40 border-emerald-500/40'
                      : selectedNode.freeze_priority === 'TIER_2_HIGH_VELOCITY'
                      ? 'bg-amber-950/40 border-amber-500/40'
                      : 'bg-[var(--ink)] border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase font-bold text-[var(--mist)]">
                      {selectedNode.node_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        selectedNode.freeze_priority === 'TIER_1_CRITICAL_RESTING'
                          ? 'bg-emerald-500 text-black'
                          : selectedNode.freeze_priority === 'TIER_2_HIGH_VELOCITY'
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {selectedNode.freeze_priority}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white mt-1.5 break-all">
                    {selectedNode.account_id}
                  </div>
                  <div className="text-xs text-[var(--mist)] mt-0.5">
                    {selectedNode.bank_name} &bull; {selectedNode.ifsc_code}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--ink)]/80 border border-white/5">
                    <div className="text-[11px] text-[var(--mist)] font-mono">Total Inflow</div>
                    <div className="font-mono font-bold text-emerald-400 mt-1">
                      {formatInr(selectedNode.total_inflow)}
                    </div>
                    <div className="text-[10px] text-[var(--mist)]">{selectedNode.inflow_count} transaction(s)</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--ink)]/80 border border-white/5">
                    <div className="text-[11px] text-[var(--mist)] font-mono">Total Outflow</div>
                    <div className="font-mono font-bold text-red-400 mt-1">
                      {formatInr(selectedNode.total_outflow)}
                    </div>
                    <div className="text-[10px] text-[var(--mist)]">{selectedNode.outflow_count} transaction(s)</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--ink)]/80 border border-white/5 col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--mist)] font-mono">Active Resting Balance</span>
                      {selectedNode.resting_balance > 0 && (
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">Immediate Target</span>
                      )}
                    </div>
                    <div className="font-mono text-lg font-bold text-white mt-1">
                      {formatInr(selectedNode.resting_balance)}
                    </div>
                  </div>
                </div>

                {/* Velocity and Mule Hub Scoring */}
                <div className="p-3.5 rounded-xl bg-[var(--ink)]/80 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--mist)]">Transfer Velocity:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {selectedNode.transfer_velocity_minutes !== null
                        ? `${selectedNode.transfer_velocity_minutes} Minutes`
                        : 'No outbound transfer'}
                    </span>
                  </div>

                  {selectedNode.is_mule_hub && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-red-400 font-semibold">Mule Hub Score:</span>
                        <span className="font-mono font-bold text-red-300">{selectedNode.mule_hub_score}%</span>
                      </div>
                      <p className="text-[11px] text-[var(--mist)]">
                        High-risk concentration account aggregating multiple victim deposits before dispersing round-sum amounts.
                      </p>
                    </div>
                  )}
                </div>

                {/* Statutory Action Recommendation */}
                <div className="p-3.5 rounded-xl bg-[var(--ink)] border border-[var(--saffron)]/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--saffron)]">
                    <Lock className="w-3.5 h-3.5" /> Section 102 CrPC Recommendation
                  </div>
                  <p className="text-xs text-[var(--mist)] leading-relaxed">
                    {selectedNode.resting_balance > 0
                      ? `Mandate immediate provisional debit freeze for ${formatInr(selectedNode.resting_balance)} under Section 102 CrPC (Section 107 BNSS) to prevent further dissipation.`
                      : `Funds dissipated onward. Prioritize freeze orders on downstream recipient accounts (${selectedNode.outflow_count} outgoing hops).`}
                  </p>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    View in Attachment Schedule <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--mist)]">Select a node from the flow chart to inspect its ledger.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROPORTIONAL SANKEY FLOW DIAGRAM */}
      {activeTab === 'sankey' && (
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--saffron)]" /> Fund Dispersion Volume Sankey
              </h2>
              <p className="text-xs text-[var(--mist)]">
                Proportional breakdown of stolen funds traveling through each hop layer into exit terminals.
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-400">
              Total Dispersion: {formatInr(analysis?.total_volume_inr)}
            </div>
          </div>

          {/* Visual Sankey Blocks */}
          <div className="space-y-4">
            {analysis?.sankey_data?.links?.map((link, idx) => {
              const pct = analysis.total_volume_inr > 0 ? (link.value / analysis.total_volume_inr) * 100 : 0;
              return (
                <div
                  key={`sankey-link-${idx}`}
                  className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] hover:border-[var(--saffron)]/40 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-300">{link.source}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--saffron)]" />
                      <span className="font-mono font-bold text-amber-300">{link.target}</span>
                      <span className="text-[11px] font-mono text-[var(--mist)]">({link.utr})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-400">{formatInr(link.value)}</span>
                      <span className="text-[11px] font-mono text-[var(--mist)]">({Math.round(pct)}% of case)</span>
                    </div>
                  </div>
                  {/* Visual Bar */}
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SECTION 102 CRPC ATTACHMENT SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                  STATUTORY REQUISITION
                </span>
                <span className="text-xs font-mono text-[var(--mist)]">
                  {analysis?.section_102_schedule?.schedule_id}
                </span>
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                Section 102 CrPC (Section 107 BNSS) Asset Attachment Schedule
              </h2>
              <p className="text-xs text-[var(--mist)]">
                Certified schedule of recipient accounts ordered for immediate provisional debit freeze.
              </p>
            </div>

            {/* Filter and Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Accounts ({analysis?.section_102_schedule?.items?.length || 0})</option>
                <option value="TIER_1_CRITICAL_RESTING">Critical Resting Only</option>
                <option value="TIER_2_HIGH_VELOCITY">High Velocity</option>
                <option value="TIER_3_MONITOR">Monitor Only</option>
              </select>

              <button
                onClick={handleCopySchedule}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
              >
                {copiedSchedule ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSchedule ? 'Copied' : 'Copy Text'}
              </button>

              <button
                onClick={handleDownloadCsv}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Download CSV
              </button>
            </div>
          </div>

          {/* Statutory Verification Box */}
          <div className="p-4 rounded-xl bg-[var(--ink)] border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">Statutory Grounds & Cryptographic Integrity</span>
              <span className="font-mono text-[10px] text-[var(--mist)]">
                SHA-256: {analysis?.section_102_schedule?.schedule_hash?.slice(0, 20)}...
              </span>
            </div>
            <p className="text-[var(--mist)] leading-relaxed italic">
              &ldquo;{analysis?.section_102_schedule?.statutory_declaration}&rdquo;
            </p>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Beneficiary Account</th>
                  <th className="py-3 px-3">Bank & IFSC</th>
                  <th className="py-3 px-3">Resting Balance</th>
                  <th className="py-3 px-3">Total Received</th>
                  <th className="py-3 px-3">Priority Mandate</th>
                  <th className="py-3 px-3">Linked UTRs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--navy-line)]">
                {filteredScheduleItems.map((item) => (
                  <tr key={item.schedule_index} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3 font-mono font-bold text-[var(--saffron)]">{item.schedule_index}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-white">{item.beneficiary_account}</td>
                    <td className="py-3 px-3">
                      <div className="text-white">{item.bank_name}</div>
                      <div className="text-[10px] font-mono text-[var(--mist)]">{item.ifsc_code}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                      {formatInr(item.seized_amount_resting_inr)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[var(--mist)]">
                      {formatInr(item.total_fraud_received_inr)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          item.freeze_mandate_priority === 'TIER_1_CRITICAL_RESTING'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.freeze_mandate_priority === 'TIER_2_HIGH_VELOCITY'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {item.freeze_mandate_priority.replace('TIER_', '')}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-[var(--mist)] max-w-xs truncate">
                      {item.utr_references.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CSV / CFCFRMS INGESTION */}
      {activeTab === 'ingest' && (
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[var(--saffron)]" /> Ingest Transaction Logs
              </h2>
              <p className="text-xs text-[var(--mist)]">
                Paste CSV or CFCFRMS tab/comma separated bank transaction records to instantly map fund dispersion hops.
              </p>
            </div>
            <button
              onClick={handleLoadSampleCsv}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold border border-white/10 transition"
            >
              Load Sample Digital Arrest CSV
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
                Case Identifier
              </label>
              <input
                type="text"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="CASE-2026-DELHI-01"
                className="w-full max-w-sm rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[var(--saffron)]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
                Transaction CSV Content (utr_number, timestamp_iso, sender_account, sender_bank, receiver_account, receiver_bank, amount, txn_type)
              </label>
              <textarea
                rows={10}
                value={rawCsvInput}
                onChange={(e) => setRawCsvInput(e.target.value)}
                placeholder="utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type..."
                className="w-full rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--saffron)]"
              />
            </div>

            {ingestStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-mono border ${
                  ingestStatus.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                {ingestStatus.message}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleIngestCsv}
                disabled={loading || !rawCsvInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-[var(--saffron)] hover:brightness-110 text-white font-semibold text-xs shadow-lg shadow-orange-900/30 transition disabled:opacity-40"
              >
                {loading ? 'Reconstructing Hops...' : 'Reconstruct Money Trail'}
              </button>
              <button
                onClick={() => setRawCsvInput('')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

