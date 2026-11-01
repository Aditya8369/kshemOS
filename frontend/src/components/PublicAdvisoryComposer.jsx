import React, { useState } from 'react';

const advisoryTemplates = [
  {
    id: "tpl-1",
    name: "Digital Arrest Scam Alert",
    title: "ALERT: Fake CBI / Cyber Police Impersonation Scams",
    description: "Scammers claiming to be law enforcement are requesting 'video trial arrest' and instant account verification. Police will never ask for funds via call.",
    severity: "critical",
    affected_location: "Pan-India / Metropolitan Regions",
    target_audience: "citizens"
  },
  {
    id: "tpl-2",
    name: "Mule Account Fraud Warning",
    title: "NOTICE: Coerced Bank Account Usage",
    description: "Do not rent or lend bank credentials or UPI accounts to third parties under pretext of quick work options. Mule account holders are legally liable.",
    severity: "high",
    affected_location: "Tier 1 & Tier 2 Cities",
    target_audience: "banks"
  }
];

export default function PublicAdvisoryComposer() {
  const [advisories, setAdvisories] = useState([]);
  const [selectedAdvisory, setSelectedAdvisory] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    affected_location: 'Nationwide',
    target_audience: 'citizens'
  });

  const handleTemplateSelect = (tpl) => {
    setFormData({
      title: tpl.title,
      description: tpl.description,
      severity: tpl.severity,
      affected_location: tpl.affected_location,
      target_audience: tpl.target_audience
    });
  };

  const handleCreateDraft = (e) => {
    e.preventDefault();
    const id = `ADV-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newAdvisory = {
      ...formData,
      id,
      status: "draft",
      created_at: now,
      updated_at: now,
      delivery_status: { sent: 0, pending: 0, failed: 0 },
      audit_trail: [
        { action: "CREATED", timestamp: now, details: "Draft advisory created." }
      ]
    };
    setAdvisories([newAdvisory, ...advisories]);
    setSelectedAdvisory(newAdvisory);
    setFormData({ title: '', description: '', severity: 'medium', affected_location: 'Nationwide', target_audience: 'citizens' });
  };

  const handleStatusTransition = (advisoryId, newStatus) => {
    const now = new Date().toISOString();
    setAdvisories(prev => prev.map(adv => {
      if (adv.id !== advisoryId) return adv;
      const updatedDelivery = newStatus === 'published' ? { sent: 4820, pending: 35, failed: 5 } : adv.delivery_status;
      const newAudit = {
        action: `STATUS_${newStatus.toUpperCase()}`,
        timestamp: now,
        details: `Advisory transitioned to ${newStatus}`
      };
      const updated = {
        ...adv,
        status: newStatus,
        updated_at: now,
        delivery_status: updatedDelivery,
        audit_trail: [...adv.audit_trail, newAudit]
      };
      if (selectedAdvisory?.id === advisoryId) setSelectedAdvisory(updated);
      return updated;
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Public Advisory Bulletin Composer</h1>
          <p className="text-sm text-gray-500">Draft, review, approve, and track real-time emergency safety broadcasts.</p>
        </div>
        <button 
          onClick={() => setShowPreview(!showPreview)} 
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          {showPreview ? "Edit / Dashboard View" : "Toggle Live Preview"}
        </button>
      </div>

      {!showPreview ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Emergency Templates</h2>
              <div className="space-y-2">
                {advisoryTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl)}
                    className="w-full text-left p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition text-xs"
                  >
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 block">{tpl.name}</span>
                    <span className="text-gray-500 line-clamp-1">{tpl.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateDraft} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <h2 className="text-md font-semibold text-gray-900 dark:text-white">Smart Advisory Composer</h2>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. Critical Fraud Alert: Fake Law Enforcement Calls"
                  className="w-full p-2 text-sm border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Severity Level</label>
                  <select 
                    value={formData.severity} 
                    onChange={e => setFormData({...formData, severity: e.target.value})}
                    className="w-full p-2 text-sm border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Audience</label>
                  <select 
                    value={formData.target_audience} 
                    onChange={e => setFormData({...formData, target_audience: e.target.value})}
                    className="w-full p-2 text-sm border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                  >
                    <option value="citizens">Citizens</option>
                    <option value="banks">Banks & Financial</option>
                    <option value="telecom">Telecoms</option>
                    <option value="officers">Law Enforcement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Affected Location</label>
                <input 
                  type="text" 
                  value={formData.affected_location} 
                  onChange={e => setFormData({...formData, affected_location: e.target.value})}
                  className="w-full p-2 text-sm border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Advisory Description</label>
                <textarea 
                  rows={4}
                  required
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Provide detailed incident analysis, scam signals, and precautionary steps..."
                  className="w-full p-2 text-sm border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                />
              </div>

              <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                Save as Draft
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Advisory Queue & Approval Workflow</h2>
              {advisories.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No advisories generated yet. Select a template or submit a draft to begin.</p>
              ) : (
                <div className="space-y-4">
                  {advisories.map(adv => (
                    <div 
                      key={adv.id} 
                      onClick={() => setSelectedAdvisory(adv)}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        selectedAdvisory?.id === adv.id 
                          ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-mono font-bold text-gray-400">{adv.id}</span>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{adv.title}</h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          adv.status === 'published' ? 'bg-green-100 text-green-800' :
                          adv.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {adv.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 my-3">
                        {adv.status === 'draft' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleStatusTransition(adv.id, 'pending_approval'); }}
                            className="px-2.5 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          >
                            Submit for Approval
                          </button>
                        )}
                        {adv.status === 'pending_approval' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleStatusTransition(adv.id, 'published'); }}
                            className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve & Publish
                          </button>
                        )}
                      </div>

                      {adv.status === 'published' && (
                        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                            <span className="block text-emerald-600 font-bold">{adv.delivery_status.sent}</span>
                            <span className="text-gray-500 text-[10px]">Delivered</span>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                            <span className="block text-amber-600 font-bold">{adv.delivery_status.pending}</span>
                            <span className="text-gray-500 text-[10px]">Pending</span>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-950/30 p-2 rounded">
                            <span className="block text-rose-600 font-bold">{adv.delivery_status.failed}</span>
                            <span className="text-gray-500 text-[10px]">Failed</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedAdvisory && (
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Audit Trail — {selectedAdvisory.id}</h3>
                <div className="space-y-2 text-xs">
                  {selectedAdvisory.audit_trail.map((entry, idx) => (
                    <div key={idx} className="flex items-start space-x-3 text-gray-600 dark:text-gray-300">
                      <span className="font-mono text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">{entry.action}:</span> {entry.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 border-2 border-red-500 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-full uppercase tracking-widest">
              PUBLIC SAFETY ADVISORY
            </span>
            <span className="text-xs font-mono text-gray-400">{formData.affected_location || "All Regions"}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {formData.title || "Untitled Emergency Advisory"}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
            {formData.description || "No advisory details configured."}
          </p>
          <div className="pt-4 border-t text-xs text-gray-400 flex justify-between">
            <span>Target Audience: <strong className="capitalize">{formData.target_audience}</strong></span>
            <span>Issued via KshemOS Public Intelligence Engine</span>
          </div>
        </div>
      )}
    </div>
  );
}