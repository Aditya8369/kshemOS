import { useEffect, useState } from 'react';
import RiskGauge from './RiskGauge';
import { REGIONS } from '../incidentDashboard';
import { analyzeScamTranscript, scanCurrencyImage, askCitizenAssistant, submitCitizenReport, sendReportConfirmationEmail } from '../api';
import CitizenMicroAdvisoryCard from './spatial/CitizenMicroAdvisoryCard.jsx';

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Kannada'];

const SAMPLE_CASES = [
  {
    id: 'digital-arrest',
    label: 'Digital arrest',
    transcript:
      'This is the CBI. A parcel with your Aadhaar number has been seized. You are under digital arrest, do not disconnect this call, and transfer the verification amount immediately or a warrant will be issued.',
    claim: 'CBI officer',
  },
  {
    id: 'courier-fraud',
    label: 'Fake courier',
    transcript:
      'We are from the customs office. Your parcel has illegal items and you must pay the fee now or your account will be frozen.',
    claim: 'customs officer',
  },
  {
    id: 'bank-otp',
    label: 'Bank OTP scam',
    transcript:
      'Your bank account is under review. Share the OTP now to verify your identity and avoid suspension.',
    claim: 'bank officer',
  },
  {
    id: 'benign',
    label: 'Benign call',
    transcript:
      'I am calling to confirm your loan appointment for tomorrow afternoon. Please bring your documents to the branch.',
    claim: 'bank officer',
  },
];

const SAMPLE_TRANSCRIPT = SAMPLE_CASES[0].transcript;

function SectionCard({ eyebrow, title, children }) {
  return (
    <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-6 shadow-sm">
      <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1">{eyebrow}</div>
      <h2 className="font-display text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ScamCheck() {
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [claim, setClaim] = useState('CBI officer');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeScamTranscript({ transcript, callerClaimsToBe: claim });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard eyebrow="Digital Arrest Agent" title="Is this call a scam?">
      <p className="text-sm text-[var(--ink-text)]/70 mb-3">
        Paste the call transcript (or what you remember of it). We'll score it in real time —
        this never asks you for an OTP, password, or bank details.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {SAMPLE_CASES.map((sample) => (
          <button
            key={sample.id}
            onClick={() => {
              setTranscript(sample.transcript);
              setClaim(sample.claim);
              setResult(null);
            }}
            className="rounded-full border border-[var(--paper-line)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:border-[var(--saffron)]"
          >
            {sample.label}
          </button>
        ))}
      </div>
      <textarea
        className="w-full h-28 rounded-lg border border-[var(--paper-line)] p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />
      <input
        className="w-full mt-2 rounded-lg border border-[var(--paper-line)] p-2 text-sm"
        placeholder="Caller claims to be (e.g. CBI officer)"
        value={claim}
        onChange={(e) => setClaim(e.target.value)}
      />
      <button
        onClick={run}
        disabled={loading || !transcript.trim()}
        className="mt-3 bg-[var(--ink)] text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
      >
        {loading ? 'Analyzing…' : 'Check this call'}
      </button>
      {error && <p className="text-sm text-[var(--alert)] mt-2">{error}</p>}

      {result && (
        <div className="mt-5 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-5 items-start">
            <RiskGauge score={result.risk_score} band={result.risk_band} />
            <div className="flex-1 text-sm">
              <div className="mb-2 inline-flex items-center rounded-full border border-[var(--saffron)]/25 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">
                {result.risk_band} risk assessment
              </div>
              <p className="font-semibold mb-1">{result.recommendation}</p>
              <p className="text-[var(--ink-text)]/70 mb-3">{result.explanation}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--paper-line)] bg-white p-3">
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--ink-text)]/50 mb-2">Evidence summary</div>
                  <ul className="space-y-1 text-[var(--ink-text)]/80">
                    {result.matched_patterns.map((p) => (
                      <li key={p} className="text-sm">• {p}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--paper-line)] bg-white p-3">
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--ink-text)]/50 mb-2">Score breakdown</div>
                  <ul className="space-y-1 text-[var(--ink-text)]/80">
                    <li className="text-sm">Threats: {result.evidence?.score_breakdown?.threat ?? 0}</li>
                    <li className="text-sm">Urgency: {result.evidence?.score_breakdown?.urgency ?? 0}</li>
                    <li className="text-sm">Secrecy: {result.evidence?.score_breakdown?.secrecy ?? 0}</li>
                    <li className="text-sm">Payment: {result.evidence?.score_breakdown?.payment ?? 0}</li>
                    <li className="text-sm">Pattern strength: {result.evidence?.score_breakdown?.pattern_strength ?? 0}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function CurrencyScanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  }

  async function run() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await scanCurrencyImage(file);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const verdictColor =
    result?.verdict === 'likely_genuine'
      ? 'var(--safe)'
      : result?.verdict === 'suspicious'
      ? 'var(--alert)'
      : 'var(--caution)';

  return (
    <SectionCard eyebrow="Counterfeit Currency Agent" title="Scan a note before you accept it">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <label className="border-2 border-dashed border-[var(--paper-line)] rounded-xl p-4 text-sm text-center cursor-pointer w-full sm:w-40 h-32 flex items-center justify-center hover:border-[var(--saffron)]">
          {preview ? (
            <img src={preview} alt="Uploaded note" className="max-h-full max-w-full object-contain rounded" />
          ) : (
            'Upload photo'
          )}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        <div className="flex-1">
          <button
            onClick={run}
            disabled={!file || loading}
            className="bg-[var(--ink)] text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {loading ? 'Scanning…' : 'Scan note'}
          </button>
          {error && <p className="text-sm text-[var(--alert)] mt-2">{error}</p>}
          {result && (
            <div className="mt-3 text-sm">
              <div
                className="inline-block font-display font-semibold uppercase text-xs px-3 py-1 rounded-full mb-2"
                style={{ color: verdictColor, border: `1px solid ${verdictColor}` }}
              >
                {result.verdict.replace('_', ' ')} · {(result.confidence * 100).toFixed(0)}% confidence
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[var(--ink-text)]/80">
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function Assistant() {
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState('English');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await askCitizenAssistant({ question, language });
      setAnswer(res.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard eyebrow="Citizen Assistant" title="Ask in your own language">
      <div className="flex gap-2 mb-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-[var(--paper-line)] p-2 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <input
          className="flex-1 rounded-lg border border-[var(--paper-line)] p-2 text-sm"
          placeholder="e.g. Is a video call from 'income tax department' normal?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          onClick={run}
          disabled={loading}
          className="bg-[var(--ink)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
      {answer && <p className="text-sm whitespace-pre-line bg-[var(--paper)] rounded-lg p-3 border border-[var(--paper-line)]">{answer}</p>}
    </SectionCard>
  );
}

function ReportForm({ addReport }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('scam_call');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('English');
  const [region, setRegion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);

  async function submit() {
    if (!name.trim() || !description.trim()) return;
    if (!region) {
      setError('Please select your region so the report reaches the right cyber desk.');
      return;
    }
    setLoading(true);
    setError(null);
    setEmailStatus(null);
    try {
      const res = await submitCitizenReport({
        reporter_name: name,
        language,
        category,
        description,
        region,
      });
      setResult(res);
      addReport({
        report_id: res.report_id,
        reporter_name: name,
        email,
        category,
        description,
        acknowledgement: res.acknowledgement,
        submitted_at: res.submitted_at,
      });

      if (email.trim()) {
        const emailResponse = await sendReportConfirmationEmail({
          reportId: res.report_id,
          reporterName: name,
          recipientEmail: email,
          category,
          description,
          acknowledgement: res.acknowledgement,
        });
        setEmailStatus(emailResponse);
      } else {
        setEmailStatus({ success: false, message: 'No email entered. Confirmation email not sent.' });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard eyebrow="Zero-Click Reporting" title="File a report">
      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        <input
          className="rounded-lg border border-[var(--paper-line)] p-2 text-sm"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-lg border border-[var(--paper-line)] p-2 text-sm"
          placeholder="Your email for confirmation"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[var(--paper-line)] p-2 text-sm"
        >
          <option value="scam_call">Digital arrest / scam call</option>
          <option value="counterfeit">Counterfeit currency</option>
          <option value="fraud_tx">Fraudulent transaction</option>
          <option value="other">Other</option>
        </select>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border border-[var(--paper-line)] p-2 text-sm"
          aria-label="Your region"
        >
          <option value="">Select your region</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="w-full h-20 rounded-lg border border-[var(--paper-line)] p-3 text-sm"
        placeholder="What happened?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        onClick={submit}
        disabled={loading}
        className="mt-2 bg-[var(--saffron)] text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
      >
        {loading ? 'Submitting…' : 'Submit report'}
      </button>
      {error && <p className="text-sm text-[var(--alert)] mt-2">{error}</p>}
      {emailStatus && (
        <p className={`text-sm mt-2 ${emailStatus.success ? 'text-[var(--safe)]' : 'text-[var(--alert)]'}`}>
          {emailStatus.message}
        </p>
      )}
      {result && (
        <div className="mt-3 text-sm bg-[var(--paper)] rounded-lg p-3 border border-[var(--paper-line)] space-y-2">
          <p className="font-mono text-xs text-[var(--saffron)]">{result.report_id}</p>
          <p>{result.acknowledgement}</p>
          {result.incident_id && (
            <p className="text-xs text-[var(--ink-text)]/70">
              Logged as incident <span className="font-mono">{result.incident_id}</span> for the {region} cyber desk.
            </p>
          )}
          {result.incident_error && (
            <p className="text-xs text-[var(--alert)]">
              Your report was saved, but it could not be sent to the cyber desk queue: {result.incident_error}
            </p>
          )}
          <details>
            <summary className="cursor-pointer font-semibold">Draft FIR statement</summary>
            <p className="mt-1 whitespace-pre-line">{result.draft_fir}</p>
          </details>
        </div>
      )}
    </SectionCard>
  );
}

function ReportHistory({ reports }) {
  if (!reports.length) {
    return (
      <SectionCard eyebrow="Report history" title="Recent submissions">
        <p className="text-sm text-[var(--ink-text)]/70">No reports have been submitted in this browser session yet.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard eyebrow="Report history" title="Recent submissions">
      <div className="space-y-3">
        {reports.map((report) => (
          <div key={report.report_id} className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--ink)]">{report.report_id}</div>
                <div className="text-xs text-[var(--ink-text)]/70">{report.submitted_at}</div>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--saffron)]">{report.category.replace('_', ' ')}</div>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-text)]/80">{report.description}</p>
            <div className="mt-2 text-xs text-[var(--ink-text)]/60">Reporter: {report.reporter_name} {report.email ? `• ${report.email}` : ''}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function CitizenPortal() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const stored = window.localStorage.getItem('kshemos_reports');
    if (stored) {
      try {
        setReports(JSON.parse(stored));
      } catch (e) {
        setReports([]);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('kshemos_reports', JSON.stringify(reports));
  }, [reports]);

  function addReport(report) {
    setReports((existing) => [report, ...existing]);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--saffron)] mb-2">
          Citizen Portal
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight">
          Verify before you trust it.
        </h1>
        <p className="text-[var(--ink-text)]/70 mt-1">
          Check a call, a note, or a payment request — before you act on it, not after.
        </p>
      </div>
      <CitizenMicroAdvisoryCard />
      <ScamCheck />
      <CurrencyScanner />
      <Assistant />
      <ReportForm addReport={addReport} />
      <ReportHistory reports={reports} />
    </div>
  );
}
