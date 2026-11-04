import React, { useState, useEffect } from 'react';
import {
  validateUploadTokenApi,
  fulfillEvidenceUploadApi,
  sha256Sync,
} from '../../evidenceStore.js';

export default function CitizenEvidenceUploadPortal({
  token: propToken = null,
  onClose = null,
  setActiveView = null,
}) {
  // Determine token from props or URL query string
  const [token, setToken] = useState(() => {
    if (propToken) return propToken;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('token') || 'kshem_tok_active_rpt0001';
    }
    return 'kshem_tok_active_rpt0001';
  });

  const [passcode, setPasscode] = useState('');
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState(null);

  // File Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [uploaderName, setUploaderName] = useState('Citizen Complainant');
  const [uploaderNotes, setUploaderNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Check validation on token or passcode change
  async function runValidation(targetToken = token, targetPasscode = passcode) {
    if (!targetToken) {
      setValidation({ valid: false, error: 'No upload link token specified.' });
      setValidating(false);
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const res = await validateUploadTokenApi(targetToken, targetPasscode || null);
      setValidation(res);
      if (!res.valid && res.status !== 'passcode_required') {
        setError(res.error);
      }
    } catch (err) {
      setError(err.message || 'Token validation failed.');
    } finally {
      setValidating(false);
    }
  }

  useEffect(() => {
    runValidation();
  }, [token]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit
    if (validation?.max_file_size_bytes && file.size > validation.max_file_size_bytes) {
      const maxMb = (validation.max_file_size_bytes / (1024 * 1024)).toFixed(1);
      setError(`File size exceeds limit (${(file.size / (1024 * 1024)).toFixed(1)} MB > ${maxMb} MB).`);
      setSelectedFile(null);
      setFileHash('');
      return;
    }

    // Check MIME type
    if (validation?.allowed_file_types?.length) {
      const allowed = validation.allowed_file_types.map((t) => t.toLowerCase());
      const fileType = file.type?.toLowerCase() || '';
      const isAllowed = allowed.includes(fileType) || allowed.some((a) => fileType.includes(a));
      if (!isAllowed && fileType) {
        setError(`File format '${fileType}' is not allowed. Permitted: ${validation.allowed_file_types.join(', ')}`);
        setSelectedFile(null);
        setFileHash('');
        return;
      }
    }

    setError(null);
    setSelectedFile(file);

    // Read content to compute client-side SHA-256 fingerprint preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target?.result || '';
      setFileContent(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      try {
        const hash = sha256Sync(typeof raw === 'string' ? raw : new Uint8Array(raw));
        setFileHash(hash);
      } catch (_) {
        setFileHash('Computed on server upon submission');
      }
    };
    reader.readAsText(file);
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await fulfillEvidenceUploadApi({
        token,
        passcode: passcode || null,
        file_name: selectedFile.name,
        mime_type: selectedFile.type || 'application/octet-stream',
        raw_payload_content: fileContent || `FILE-DATA-${selectedFile.name}`,
        file_size_bytes: selectedFile.size,
        uploader_name: uploaderName,
        uploader_notes: uploaderNotes,
        client_ip: '127.0.0.1',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'KshemOS-Citizen-Portal',
      });

      if (res.success && res.receipt) {
        setReceipt(res.receipt);
      } else {
        throw new Error(res.error || 'Failed to complete evidence upload.');
      }
    } catch (err) {
      setError(err.message || 'Evidence upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 text-white space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-7xl font-mono select-none">
          🔒
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Secure Evidence Intake
          </span>
          <span className="text-xs text-[var(--mist)] font-mono">
            Zero-Email Transmission Guarantee
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-white">
          Law Enforcement Evidence Intake Portal
        </h1>
        <p className="text-xs sm:text-sm text-[var(--mist)] mt-1 max-w-xl">
          Upload requested evidence directly to the KshemOS Cryptographic Evidence Vault. Files are stamped with RFC 3161 timestamps and kept strictly out of unencrypted email attachments.
        </p>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-[var(--mist)] hover:text-white"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Token input bar if custom token needed */}
      <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-3 flex flex-col sm:flex-row items-center gap-2 text-xs">
        <span className="text-[var(--mist)] shrink-0 font-mono font-semibold">Active Token:</span>
        <input
          className="flex-1 bg-black/40 border border-[var(--navy-line)] rounded-lg px-3 py-1.5 font-mono text-cyan-300 focus:outline-none"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste upload link token..."
        />
        <button
          onClick={() => runValidation(token, passcode)}
          className="px-3 py-1.5 bg-[var(--navy)] hover:bg-[var(--navy-line)] border border-[var(--navy-line)] rounded-lg font-semibold"
        >
          Check Link
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="font-semibold">Security Alert</div>
            <div className="text-xs mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {validating && (
        <div className="p-8 text-center bg-[var(--navy)] rounded-2xl border border-[var(--navy-line)] space-y-2">
          <div className="inline-block animate-spin text-2xl">⏳</div>
          <div className="text-sm font-semibold">Validating Secure Token & Cryptographic Expiry…</div>
        </div>
      )}

      {/* RECEIPT VIEW (Completed state) */}
      {receipt && (
        <div className="bg-emerald-950/20 border-2 border-emerald-500/50 rounded-2xl p-6 text-white space-y-5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-emerald-500/30 pb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold border border-emerald-500/40">
              ✓
            </div>
            <div>
              <div className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-widest">
                Evidence Ingested & Vault Sealed
              </div>
              <h2 className="text-xl font-display font-bold text-white">
                Cryptographic Evidence Upload Receipt
              </h2>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/30 font-mono text-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">Receipt ID:</span>
              <span className="text-emerald-300 font-bold">{receipt.receipt_id}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">Target Case / Report ID:</span>
              <span className="text-white font-bold">{receipt.report_id}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">Vault Evidence ID:</span>
              <span className="text-cyan-300 font-bold">{receipt.evidence_id}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">File Ingested:</span>
              <span className="text-white font-semibold">{receipt.file_name} ({receipt.file_size_bytes} bytes)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">SHA-256 Fingerprint:</span>
              <span className="text-emerald-400 break-all">{receipt.sha256_fingerprint}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-gray-800">
              <span className="text-gray-400">RFC 3161 Timestamp Serial:</span>
              <span className="text-amber-300">{receipt.rfc3161_serial}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1">
              <span className="text-gray-400">Verification Token:</span>
              <span className="text-white font-bold">{receipt.verification_token}</span>
            </div>
          </div>

          <div className="text-xs text-gray-300 bg-[var(--ink)] p-3 rounded-xl border border-[var(--navy-line)] space-y-1">
            <div className="font-semibold text-emerald-300">Section 65B Custody Certified:</div>
            <div>
              This digital record has been entered into the unbroken chain of custody. The single-use link has been safely expired to prevent unauthorized re-use.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--ink)] border border-[var(--navy-line)] text-white hover:bg-black/60 transition"
            >
              🖨️ Print Receipt
            </button>
            {setActiveView && (
              <button
                onClick={() => setActiveView('home')}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 transition shadow-md"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      {/* PASSCODE PROMPT IF PASSCODE REQUIRED */}
      {!validating && !receipt && validation?.status === 'passcode_required' && (
        <div className="bg-[var(--navy)] border border-amber-500/40 rounded-2xl p-6 text-white space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔐</span>
            <div>
              <h3 className="font-semibold text-lg text-white">Passcode Verification Required</h3>
              <p className="text-xs text-[var(--mist)]">
                The investigating officer configured a verification passcode for this case upload.
              </p>
            </div>
          </div>

          {validation.passcode_hint && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
              Hint: {validation.passcode_hint}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-mono text-[var(--mist)]">Enter Access Passcode / PIN:</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="w-48 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-4 py-2 font-mono text-center text-lg tracking-widest text-white focus:outline-none focus:border-[var(--saffron)]"
                maxLength={8}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••"
              />
              <button
                onClick={() => runValidation(token, passcode)}
                className="px-5 py-2 bg-[var(--saffron)] text-white rounded-xl text-xs font-semibold hover:brightness-110 transition"
              >
                Unlock Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE UPLOAD FORM */}
      {!validating && !receipt && validation?.valid && (
        <form onSubmit={handleUploadSubmit} className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 space-y-5">
          {/* Link Scope Details */}
          <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-[var(--saffron)]">
                Bound Case / Report: {validation.report_id}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Single-Purpose Token Active
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white">{validation.title}</h3>
            <p className="text-xs text-[var(--mist)] leading-relaxed">{validation.description}</p>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--navy-line)] text-xs text-gray-300">
              <div>
                <span className="text-[var(--mist)]">Allowed Formats: </span>
                <span className="font-mono text-cyan-300">
                  {validation.allowed_file_types?.map((t) => t.split('/')[1] || t).join(', ').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[var(--mist)]">Max Size: </span>
                <span className="font-mono text-white">
                  {(validation.max_file_size_bytes / (1024 * 1024)).toFixed(0)} MB
                </span>
              </div>
              <div>
                <span className="text-[var(--mist)]">Expires At: </span>
                <span className="font-mono text-amber-300">
                  {new Date(validation.expires_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Uploader Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-[var(--mist)]">Complainant / Uploader Name:</label>
              <input
                className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                placeholder="Full Legal Name"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-[var(--mist)]">Context / Descriptive Notes:</label>
              <input
                className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                value={uploaderNotes}
                onChange={(e) => setUploaderNotes(e.target.value)}
                placeholder="e.g. Call screenshot captured at 11:45 AM"
              />
            </div>
          </div>

          {/* File Selector Dropzone */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-[var(--mist)]">Select Evidence File:</label>
            <div className="border-2 border-dashed border-[var(--navy-line)] hover:border-[var(--saffron)] rounded-2xl p-6 text-center bg-black/20 transition-all cursor-pointer relative">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileSelect}
                required
              />
              <div className="space-y-2">
                <span className="text-3xl">📁</span>
                <div className="text-sm font-semibold text-white">
                  {selectedFile ? selectedFile.name : 'Click or drag file here to upload'}
                </div>
                <div className="text-xs text-[var(--mist)]">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB • Type: ${selectedFile.type || 'binary'}`
                    : `Allowed: ${validation.allowed_file_types?.join(', ')}`}
                </div>
              </div>
            </div>
          </div>

          {/* SHA-256 Preview Badge */}
          {fileHash && (
            <div className="p-3 rounded-xl bg-black/40 border border-[var(--navy-line)] text-xs font-mono space-y-1">
              <div className="text-gray-400 flex items-center justify-between">
                <span>Client Cryptographic Fingerprint Preview:</span>
                <span className="text-emerald-400 font-bold">✓ READY</span>
              </div>
              <div className="text-emerald-300 break-all">{fileHash}</div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-[var(--mist)] flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Encrypted transmission directly to evidence vault. Single-use token will seal immediately.</span>
            </div>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full sm:w-auto px-6 py-2.5 bg-[var(--saffron)] hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 shadow-lg flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Vaulting Evidence…
                </>
              ) : (
                'Securely Upload & Seal Link'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

