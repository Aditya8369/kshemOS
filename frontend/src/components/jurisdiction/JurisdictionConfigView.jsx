import { useState, useEffect, useCallback } from 'react';
import {
  fetchJurisdictionData,
  saveServiceAreaApi,
  reviewProposalApi,
  restoreSnapshotApi,
  saveDispatchRuleApi,
  deleteDispatchRuleApi,
  defaultJurisdictionStore,
  JURISDICTION_CHANGED_EVENT,
} from '../../jurisdictionStore.js';
import ServiceAreaMapManager from './ServiceAreaMapManager';
import DispatchRulesEditor from './DispatchRulesEditor';
import HighImpactReviewModal from './HighImpactReviewModal';
import SnapshotHistoryDrawer from './SnapshotHistoryDrawer';

const TABS = [
  { key: 'zones', label: 'Zones & Service Areas' },
  { key: 'rules', label: 'Dispatch Routing Rules' },
  { key: 'proposals', label: 'Review Queue' },
  { key: 'snapshots', label: 'Audit Snapshots' },
];

export default function JurisdictionConfigView() {
  const [data, setData] = useState({
    jurisdictions: [],
    serviceAreas: [],
    dispatchRules: [],
    proposals: [],
    snapshots: [],
    source: 'loading',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('zones');

  // Modals state
  const [activeProposalForReview, setActiveProposalForReview] = useState(null);
  const [showSnapshotsDrawer, setShowSnapshotsDrawer] = useState(false);

  const reloadData = useCallback(async () => {
    try {
      const res = await fetchJurisdictionData();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load jurisdiction configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();

    function handleEvent() {
      reloadData();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(JURISDICTION_CHANGED_EVENT, handleEvent);
      return () => window.removeEventListener(JURISDICTION_CHANGED_EVENT, handleEvent);
    }
  }, [reloadData]);

  const pendingProposals = (data.proposals || []).filter((p) => p.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Jurisdictions</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">
            {data.jurisdictions?.length || 0}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">Metropolitan Authorities</div>
        </div>

        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Service Areas</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">
            {data.serviceAreas?.length || 0}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">5 Operational Regions</div>
        </div>

        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Dispatch Rules</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">
            {data.dispatchRules?.length || 0}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">Automated Assignment</div>
        </div>

        <div
          onClick={() => setActiveTab('proposals')}
          className={`border rounded-xl p-4 cursor-pointer transition ${
            pendingProposals.length > 0
              ? 'bg-amber-950/40 border-amber-500/50 hover:bg-amber-900/40'
              : 'bg-[var(--navy)] border-[var(--navy-line)]'
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[var(--mist)] flex items-center justify-between">
            <span>Pending Reviews</span>
            {pendingProposals.length > 0 && <span className="animate-pulse text-amber-400">⚠️</span>}
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${
              pendingProposals.length > 0 ? 'text-amber-400' : 'text-white'
            }`}
          >
            {pendingProposals.length}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">Multi-Officer Review</div>
        </div>

        <div
          onClick={() => setShowSnapshotsDrawer(true)}
          className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4 cursor-pointer hover:border-[var(--saffron)] transition"
        >
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Audit Snapshots</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">
            {data.snapshots?.length || 0}
          </div>
          <div className="text-[11px] text-[var(--saffron)] mt-0.5">View Audit / Rollback →</div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-3">
        <div role="tablist" className="inline-flex gap-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-full p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-full font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === t.key
                  ? 'bg-[var(--saffron)] text-white shadow-sm'
                  : 'text-[var(--mist)] hover:text-white'
              }`}
            >
              <span>{t.label}</span>
              {t.key === 'proposals' && pendingProposals.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-mono font-bold">
                  {pendingProposals.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--mist)]">
            Sync Source: <span className="text-white capitalize">{data.source}</span>
          </span>
          <button
            onClick={() => setShowSnapshotsDrawer(true)}
            className="px-3 py-1.5 rounded-lg border border-[var(--navy-line)] text-xs text-[var(--mist)] hover:text-white hover:border-[var(--saffron)] transition flex items-center gap-1.5"
          >
            <span>📜</span> Snapshot History
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--mist)]">Loading jurisdiction data…</div>
      ) : activeTab === 'zones' ? (
        <ServiceAreaMapManager
          serviceAreas={data.serviceAreas}
          jurisdictions={data.jurisdictions}
          onSaveServiceArea={async (sa) => {
            const res = await saveServiceAreaApi(sa);
            await reloadData();
            return res;
          }}
        />
      ) : activeTab === 'rules' ? (
        <DispatchRulesEditor
          dispatchRules={data.dispatchRules}
          serviceAreas={data.serviceAreas}
          store={defaultJurisdictionStore}
          onSaveRule={async (rule) => {
            await saveDispatchRuleApi(rule);
            await reloadData();
          }}
          onDeleteRule={async (ruleId) => {
            await deleteDispatchRuleApi(ruleId);
            await reloadData();
          }}
        />
      ) : activeTab === 'proposals' ? (
        <div className="space-y-4">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">
                Dual Authorization Queue
              </div>
              <h2 className="font-display text-xl font-semibold mt-1">Pending High-Impact Changes</h2>
              <p className="text-xs text-[var(--mist)] mt-0.5">
                Modifications that shrink operational coverage by &gt;25% or alter active zones are held in staging.
              </p>
            </div>

            {pendingProposals.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[var(--navy-line)] rounded-xl text-xs text-[var(--mist)]">
                ✓ No pending change proposals requiring authorization. All boundary systems normal.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingProposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl bg-[var(--ink)] border border-amber-500/40 text-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-300">{prop.id}</span>
                        <span className="text-white font-semibold">{prop.change_summary}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--mist)]">
                        {new Date(prop.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-[var(--mist)]">
                      Proposed by: <span className="font-mono text-white">{prop.proposed_by}</span> | Entity:{' '}
                      <span className="font-mono text-white">{prop.entity_id}</span>
                    </div>

                    {prop.validation?.warnings?.length > 0 && (
                      <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px]">
                        <strong>Guardrail Flag:</strong> {prop.validation.warnings[0]}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setActiveProposalForReview(prop)}
                        className="px-4 py-2 rounded-xl bg-[var(--saffron)] text-white font-semibold hover:brightness-110 transition shadow"
                      >
                        Review Proposal & Authorize →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'snapshots' ? (
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">
                Audit Trail & Rollback
              </div>
              <h2 className="font-display text-xl font-semibold mt-1">Immutable Configuration Snapshots</h2>
            </div>
            <button
              onClick={() => setShowSnapshotsDrawer(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 transition"
            >
              Open Full Rollback Drawer
            </button>
          </div>
          <div className="space-y-2">
            {(data.snapshots || []).slice(0, 5).map((s) => (
              <div
                key={s.snapshot_id}
                className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-white">
                    v{s.version} — {s.snapshot_id}
                  </div>
                  <div className="text-white/80 mt-0.5">{s.change_summary}</div>
                  <div className="text-[11px] text-[var(--mist)] mt-0.5">Author: {s.author}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                      s.impact_level === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {s.impact_level || 'standard'}
                  </span>
                  <div className="text-[11px] font-mono text-[var(--mist)] mt-1">
                    {new Date(s.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Review Modal */}
      {activeProposalForReview && (
        <HighImpactReviewModal
          proposal={activeProposalForReview}
          onReview={async (propId, action) => {
            await reviewProposalApi(propId, action);
            await reloadData();
          }}
          onClose={() => setActiveProposalForReview(null)}
        />
      )}

      {/* Snapshots & Rollback Drawer */}
      {showSnapshotsDrawer && (
        <SnapshotHistoryDrawer
          snapshots={data.snapshots}
          onRestore={async (snapId, opts) => {
            await restoreSnapshotApi(snapId, opts?.restoredBy);
            await reloadData();
          }}
          onClose={() => setShowSnapshotsDrawer(false)}
        />
      )}
    </div>
  );
}
