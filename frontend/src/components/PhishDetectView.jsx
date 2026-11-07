import { useState } from "react";
import CyberFeatureCard from "./CyberFeatureCard";
import { analyzeEmail } from "../cyberFeatures/phishDetect";

export default function PhishDetectView() {
  const [from, setFrom] = useState("Security Team <support@outlook.com>");
  const [subject, setSubject] = useState("Urgent: Account Suspended");
  const [body, setBody] = useState(
    "Your account will be closed unless you confirm your identity immediately. Click the link below to verify your account."
  );

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const parseSender = (value) => {
    const match = value.match(/(.*)<(.+)>/);

    if (!match) {
      return {
        name: value.trim(),
        email: value.trim(),
      };
    }

    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  };

  const analyze = () => {
    setLoading(true);

    setTimeout(() => {
      const sender = parseSender(from);

      const analysis = analyzeEmail(
        sender,
        subject,
        body,
        ""
      );

      setResult(analysis);
      setLoading(false);
    }, 1200);
  };

  const loadScam = () => {
    setFrom("State Bank Security <verify@sbi-secure-login.com>");
    setSubject("Urgent: Verify Your Account");
    setBody(
      "Your account has been temporarily suspended. Verify your identity immediately by clicking the secure link below or your account will be permanently blocked."
    );
  };

  const loadSafe = () => {
    setFrom("GitHub <noreply@github.com>");
    setSubject("Weekly Repository Digest");
    setBody(
      "Here is your weekly summary of repository activity. No action is required."
    );
  };

  const clearFields = () => {
    setFrom("");
    setSubject("");
    setBody("");
    setResult(null);
  };

  const badgeColor = {
    LOW: "bg-green-100 text-green-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-red-100 text-red-700",
    CRITICAL: "bg-red-600 text-white",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">
          PhishDetect
        </p>

        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
          AI Email Phishing Detector
        </h1>

        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">
          Analyze suspicious emails using sender verification, content
          inspection, phishing pattern detection, and AI-powered risk scoring.
        </p>
      </div>

      <CyberFeatureCard
        eyebrow="Email Security"
        title="Analyze Suspicious Email"
        description="Paste the sender, subject, and body of an email to identify phishing attempts."
      >
        <div className="space-y-5">

          <div>
            <label className="mb-2 block text-sm font-semibold">
              📧 Sender
            </label>

            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Security Team <support@example.com>"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              📝 Subject
            </label>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              📄 Email Body
            </label>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-40 w-full rounded-xl border p-3"
            />
          </div>

          <div className="flex flex-wrap gap-3">

            <button
              onClick={loadScam}
              className="rounded-full border px-4 py-2 text-sm"
            >
              Load Scam
            </button>

            <button
              onClick={loadSafe}
              className="rounded-full border px-4 py-2 text-sm"
            >
              Load Safe Email
            </button>

            <button
              onClick={clearFields}
              className="rounded-full border px-4 py-2 text-sm"
            >
              Clear
            </button>

            <button
              onClick={analyze}
              className="ml-auto rounded-full bg-[var(--ink)] px-6 py-2 text-white"
            >
              Analyze Email
            </button>
          </div>

          {loading && (
            <div className="rounded-xl border p-5">

              <p className="font-semibold">
                Analyzing Email...
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded bg-gray-200">

                <div className="h-full w-2/3 animate-pulse bg-red-500" />

              </div>

              <p className="mt-2 text-xs text-gray-500">
                Checking sender • Inspecting content • Calculating risk...
              </p>

            </div>
          )}

          {result && (
            <div className="rounded-2xl border bg-[var(--paper)] p-6">

              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                      badgeColor[result.risk_band] || "bg-gray-100"
                    }`}
                  >
                    {result.risk_band} Risk
                  </span>

                  <h3 className="mt-4 text-lg font-bold">
                    AI Assessment
                  </h3>

                </div>

                {result.score && (
                  <div className="w-56">

                    <div className="mb-2 flex justify-between text-sm">

                      <span>Risk Score</span>

                      <span>{result.score}/100</span>

                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-gray-200">

                      <div
                        style={{ width: `${result.score}%` }}
                        className="h-full bg-red-500"
                      />

                    </div>

                  </div>
                )}

              </div>

              <p className="mt-5">
                {result.recommendation}
              </p>

              <h4 className="mt-6 font-semibold">
                Detected Indicators
              </h4>

              <div className="mt-3 flex flex-wrap gap-2">

                {result.signals.map((signal) => (
                  <span
                    key={signal.type}
                    className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                  >
                    {signal.detail}
                  </span>
                ))}

              </div>

              <div className="mt-8 rounded-xl bg-gray-50 p-4">

                <h4 className="font-semibold">
                  AI Summary
                </h4>

                <p className="mt-2 text-sm text-gray-700">
                  This email has been analyzed for impersonation attempts,
                  urgency cues, suspicious language, and credential harvesting
                  patterns. Based on the detected indicators, the likelihood of
                  phishing is <strong>{result.risk_band}</strong>.
                </p>

              </div>

            </div>
          )}
        </div>
      </CyberFeatureCard>
    </div>
  );
}
