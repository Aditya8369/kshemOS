import React, { useState } from 'react';

const SENSITIVITY_BADGES = {
  public: 'bg-gray-100 text-gray-800 border-gray-300',
  internal: 'bg-blue-50 text-blue-700 border-blue-200',
  restricted: 'bg-amber-50 text-amber-700 border-amber-200',
  confidential: 'bg-red-50 text-red-700 border-red-200'
};

export default function EvidenceVaultView({ userRole = 'command_officer' }) {
  const [incidentId] = useState('INC-8492');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('document');
  const [sensitivity, setSensitivity] = useState('restricted');
  const [notes, setNotes] = useState('');
  const [vaultItems, setVaultItems] = useState([
    {
      evidence_id: 'EVD-9A81B2C3',
      incident_id: 'INC-8492',
      file_name: 'CCTV_Footage_ATM_Loc4.mp4',
      file_type: 'video',
      file_size_kb: 45200,
      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sensitivity_level: 'restricted',
      version: 1,
      notes: 'Secured CCTV recording from opposite merchant camera.',
      created_at: new Date().toISOString(),
      access_history: [
        {
          timestamp: new Date().toISOString(),
          user_id: 'OFFICER_302',
          user_role: 'analyst',
          action: 'UPLOAD'
        }
      ]
    }
  ]);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!fileName) return;

    const newEvidence = {
      evidence_id: `EVD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      incident_id: incidentId,
      file_name: fileName,
      file_type: fileType,
      file_size_kb: Math.floor(Math.random() * 5000) + 100,
      content_hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      sensitivity_level: sensitivity,
      version: 1,
      notes: notes,
      created_at: new Date().toISOString(),
      access_history: [
        {
          timestamp: new Date().toISOString(),
          user_id: 'USER_CURRENT',
          user_role: userRole,
          action: 'UPLOAD'
        }
      ]
    };

    setVaultItems([newEvidence, ...vaultItems]);
    setFileName('');
    setNotes('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Secure Evidence & Documentation Vault</h1>
          <p className="text-xs text-gray-500">Case-linked records, media custody tracking, and auditable evidence packaging.</p>
        </div>
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full text-xs font-mono font-semibold">
          Case: {incidentId}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attach Evidence Record</h2>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">File Name / Label</label>
              <input
                type="text"
                required
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. Call_Transcript_Audio_Log.pdf"
                className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Record Type</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                >
                  <option value="document">Document</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="operational_note">Operational Note</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Sensitivity</label>
                <select
                  value={sensitivity}
                  onChange={(e) => setSensitivity(e.target.value)}
                  className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="restricted">Restricted</option>
                  <option value="confidential">Confidential</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Operational Notes & Context</label>
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details on source, chain of custody, or verification status..."
                className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Securely Upload Evidence
            </button>
          </form>
        </div>

        {/* Evidence List & Audit Trail */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vault Inventory ({vaultItems.length})</h2>
          {vaultItems.map((item) => (
            <div key={item.evidence_id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{item.file_name}</span>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded border ${SENSITIVITY_BADGES[item.sensitivity_level]}`}>
                      {item.sensitivity_level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {item.evidence_id} | Type: {item.file_type} | Version: v{item.version}</p>
                </div>
                <button
                  onClick={() => alert(`Export package generated for ${item.evidence_id}`)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-xs font-medium"
                >
                  Export File
                </button>
              </div>
              {item.notes && <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded">{item.notes}</p>}
              <div className="border-t pt-2 border-gray-100 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Audit Log:</span>
                <div className="mt-1 space-y-1">
                  {item.access_history.map((h, idx) => (
                    <p key={idx} className="text-[11px] text-gray-500 font-mono">
                      [{new Date(h.timestamp).toLocaleTimeString()}] {h.action} by {h.user_id} ({h.user_role})
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}