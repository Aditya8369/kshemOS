import { useState, useEffect } from 'react';
import {
  Mail,
  Bell,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Lock,
  RefreshCw,
  Clock,
  Send,
  UserCheck,
  ChevronRight,
  Sliders,
  Filter,
  Check,
  XCircle,
  Info,
} from 'lucide-react';
import {
  subscribeToAdvisoriesApi,
  fetchSubscriptionPreferencesApi,
  updateSubscriptionPreferencesApi,
  unsubscribeAdvisoriesApi,
  fetchInAppAdvisoryFeedApi,
  fetchSubscriberSummaryApi,
  fetchRestrictedSubscribersApi,
  AVAILABLE_ZONES,
  AVAILABLE_TOPICS,
  defaultSubscriptionStore,
  SUBSCRIPTION_CHANGED_EVENT,
} from '../api.js';

export default function AdvisorySubscriptionView({ setActiveView }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'subscribe' | 'manage' | 'officer'

  // Feed State
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedArea, setFeedArea] = useState('all');
  const [feedTopic, setFeedTopic] = useState('all');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Subscribe Form State
  const [email, setEmail] = useState('');
  const [selectedAreas, setSelectedAreas] = useState(['Central Zone']);
  const [selectedTopics, setSelectedTopics] = useState(['digital_arrest']);
  const [selectedChannels, setSelectedChannels] = useState(['email', 'in_app']);
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscribeResult, setSubscribeResult] = useState(null);
  const [subscribeError, setSubscribeError] = useState(null);

  // Manage / Preferences State
  const [manageToken, setManageToken] = useState(() => defaultSubscriptionStore.getActiveToken() || '');
  const [currentPref, setCurrentPref] = useState(null);
  const [loadingPref, setLoadingPref] = useState(false);
  const [prefError, setPrefError] = useState(null);
  const [prefSuccess, setPrefSuccess] = useState(null);

  // Summary & Officer Directory State
  const [summary, setSummary] = useState(null);
  const [officerBadge, setOfficerBadge] = useState('BADGE-CMD-701');
  const [restrictedSubscribers, setRestrictedSubscribers] = useState(null);
  const [officerAccessError, setOfficerAccessError] = useState(null);
  const [loadingOfficer, setLoadingOfficer] = useState(false);

  // Load feed on mount and when filter changes
  async function loadFeed() {
    setFeedLoading(true);
    try {
      const items = await fetchInAppAdvisoryFeedApi({
        area: feedArea,
        topic: feedTopic,
        include_expired: includeExpired,
      });
      setFeedItems(items);
    } catch (err) {
      console.error('Failed to load in-app feed:', err);
    } finally {
      setFeedLoading(false);
    }
  }

  // Load summary metrics
  async function loadSummary() {
    try {
      const data = await fetchSubscriberSummaryApi();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }

  // Load preferences by token
  async function loadPreferences(tokenToLoad) {
    const t = tokenToLoad || manageToken;
    if (!t || !t.trim()) return;
    setLoadingPref(true);
    setPrefError(null);
    setPrefSuccess(null);
    try {
      const data = await fetchSubscriptionPreferencesApi(t.trim());
      setCurrentPref(data);
      defaultSubscriptionStore.saveActiveToken(t.trim());
    } catch (err) {
      setPrefError(err.message || 'Failed to load subscription preferences.');
      setCurrentPref(null);
    } finally {
      setLoadingPref(false);
    }
  }

  // Handle URL token query if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const action = params.get('action');
      if (urlToken) {
        setManageToken(urlToken);
        setActiveTab('manage');
        loadPreferences(urlToken);
      } else if (action === 'subscribe') {
        setActiveTab('subscribe');
      }
    }
    loadFeed();
    loadSummary();

    const handler = () => {
      loadFeed();
      loadSummary();
    };
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    loadFeed();
  }, [feedArea, feedTopic, includeExpired]);

  // Handle Subscribe
  async function handleSubscribe(e) {
    e.preventDefault();
    setSubscribeError(null);
    setSubscribeResult(null);

    if (!consentGiven) {
      setSubscribeError('You must provide explicit consent to receive public safety advisories.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await subscribeToAdvisoriesApi({
        email: email.trim(),
        areas: selectedAreas.length > 0 ? selectedAreas : ['All'],
        topics: selectedTopics.length > 0 ? selectedTopics : ['All'],
        channels: selectedChannels.length > 0 ? selectedChannels : ['email', 'in_app'],
        consent_given: true,
      });
      setSubscribeResult(res);
      setManageToken(res.management_token);
      loadSummary();
    } catch (err) {
      setSubscribeError(err.message || 'Subscription failed. Please verify your email.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Update Preferences
  async function handleUpdatePreferences(newPrefData) {
    if (!manageToken) return;
    setPrefError(null);
    setPrefSuccess(null);
    try {
      const updated = await updateSubscriptionPreferencesApi(manageToken, newPrefData);
      setCurrentPref(updated);
      setPrefSuccess('Your notification preferences have been successfully updated.');
      loadSummary();
    } catch (err) {
      setPrefError(err.message || 'Failed to update preferences.');
    }
  }

  // Handle Unsubscribe
  async function handleUnsubscribe() {
    if (!manageToken) return;
    setPrefError(null);
    setPrefSuccess(null);
    try {
      await unsubscribeAdvisoriesApi(manageToken);
      setCurrentPref((prev) => (prev ? { ...prev, is_active: false } : null));
      setPrefSuccess('You have successfully withdrawn consent and unsubscribed from advisory emails.');
      loadSummary();
    } catch (err) {
      setPrefError(err.message || 'Failed to unsubscribe.');
    }
  }

  // Handle Officer Directory Fetch
  async function handleFetchOfficerSubscribers() {
    setOfficerAccessError(null);
    setLoadingOfficer(true);
    try {
      const list = await fetchRestrictedSubscribersApi(officerBadge);
      setRestrictedSubscribers(list);
    } catch (err) {
      setOfficerAccessError(err.message || 'Access restricted.');
      setRestrictedSubscribers(null);
    } finally {
      setLoadingOfficer(false);
    }
  }

  function toggleArea(areaId) {
    if (areaId === 'all') {
      setSelectedAreas(['all']);
      return;
    }
    const filtered = selectedAreas.filter((a) => a !== 'all');
    if (filtered.includes(areaId)) {
      const next = filtered.filter((a) => a !== areaId);
      setSelectedAreas(next.length > 0 ? next : ['all']);
    } else {
      setSelectedAreas([...filtered, areaId]);
    }
  }

  function toggleTopic(topicId) {
    if (topicId === 'all') {
      setSelectedTopics(['all']);
      return;
    }
    const filtered = selectedTopics.filter((t) => t !== 'all');
    if (filtered.includes(topicId)) {
      const next = filtered.filter((t) => t !== topicId);
      setSelectedTopics(next.length > 0 ? next : ['all']);
    } else {
      setSelectedTopics([...filtered, topicId]);
    }
  }

  function toggleChannel(ch) {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length === 1) return; // Must keep at least one
      setSelectedChannels(selectedChannels.filter((c) => c !== ch));
    } else {
      setSelectedChannels([...selectedChannels, ch]);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in font-sans">
      {/* Page Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-medium border border-amber-500/30">
              <Radio size={13} className="animate-pulse text-amber-400" />
              Verified Public Incident Advisories &middot; Issue #43
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Public Incident Advisory Subscriptions
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Opt into verified, approved law enforcement emergency bulletins for your neighborhood and chosen topics.
              Receive critical alerts via email and in-app feed with full consent withdrawal and zero PII retention.
            </p>
          </div>

          {/* Quick Metrics */}
          {summary && (
            <div className="flex sm:flex-col gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center sm:text-right">
                <div className="text-xs font-mono text-amber-300 uppercase">Active Subscribers</div>
                <div className="text-2xl font-bold font-mono text-white mt-0.5">
                  {summary.total_active_subscribers.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  {summary.by_channel.email || 0} email &middot; {summary.by_channel.in_app || 0} in-app
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-white/15 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-xl font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              activeTab === 'feed'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Radio size={14} />
            Verified In-App Feed
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subscribe')}
            className={`px-4 py-2 rounded-xl font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              activeTab === 'subscribe'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Mail size={14} />
            Subscribe to Alerts
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-xl font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              activeTab === 'manage'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sliders size={14} />
            Manage Preferences &amp; Unsubscribe
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('officer')}
            className={`px-4 py-2 rounded-xl font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              activeTab === 'officer'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Lock size={14} />
            Officer Directory (Restricted)
          </button>
        </div>
      </div>

      {/* TAB 1: IN-APP ADVISORY FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-6">
          {/* Feed Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-amber-600 shrink-0" />
                <label htmlFor="feed-area-select" className="text-xs font-semibold text-slate-600">
                  Area:
                </label>
                <select
                  id="feed-area-select"
                  value={feedArea}
                  onChange={(e) => setFeedArea(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">📍 All Areas</option>
                  {AVAILABLE_ZONES.filter((z) => z.id !== 'all').map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter size={15} className="text-amber-600 shrink-0" />
                <label htmlFor="feed-topic-select" className="text-xs font-semibold text-slate-600">
                  Topic:
                </label>
                <select
                  id="feed-topic-select"
                  value={feedTopic}
                  onChange={(e) => setFeedTopic(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">🛡️ All Threat Categories</option>
                  {AVAILABLE_TOPICS.filter((t) => t.id !== 'all').map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                Include Expired / Resolved
              </label>

              <button
                type="button"
                onClick={loadFeed}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Refresh feed"
                aria-label="Refresh feed"
              >
                <RefreshCw size={14} className={feedLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Feed List */}
          {feedLoading ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono">
              Loading verified public advisories...
            </div>
          ) : feedItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <ShieldCheck size={36} className="text-emerald-500 mx-auto" />
              <h3 className="font-display font-semibold text-lg text-slate-800">
                No Active Emergency Advisories
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No published advisories match your selected area or topic. All neighborhood sectors are operating normally.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedItems.map((item) => (
                <div
                  key={item.advisory_id}
                  className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm transition-all ${
                    item.is_expired
                      ? 'border-slate-300 bg-slate-50/70 opacity-75'
                      : item.severity === 'critical'
                      ? 'border-red-200 ring-1 ring-red-500/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          item.severity === 'critical'
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : item.severity === 'high'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-blue-50 text-blue-700 border-blue-300'
                        }`}
                      >
                        {item.severity} Alert
                      </span>

                      {item.is_expired ? (
                        <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                          Expired / Resolved
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Verified Active
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      Issued: {new Date(item.issued_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div className="mt-3.5 space-y-2">
                    <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-amber-600" />
                        <strong className="text-slate-700">Area:</strong> {item.affected_location}
                      </span>
                      <span>
                        <strong className="text-slate-700">Source:</strong> {item.source}
                      </span>
                      <span>
                        <strong className="text-slate-700">Expires:</strong> {new Date(item.expires_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-red-700 font-semibold font-mono text-[11px] bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                      Helpline: Dial 1930
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBSCRIBE FORM */}
      {activeTab === 'subscribe' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-amber-600 font-bold mb-1">
              Statutory Consent-Based Citizen Opt-In
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Subscribe to Verified Incident Advisories
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select your districts and alert categories. We never spam, sell citizen data, or send unapproved alerts.
            </p>
          </div>

          {subscribeResult ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-950 space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-700 font-bold font-display text-base">
                <CheckCircle2 size={20} />
                Subscription Activated Successfully!
              </div>

              <p className="text-xs leading-relaxed text-emerald-900">
                You are now subscribed to verified law enforcement safety alerts. Your preferences have been saved securely.
              </p>

              <div className="bg-white rounded-xl p-4 border border-emerald-200/80 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Subscription ID:</span>{' '}
                  <strong className="text-slate-900">{subscribeResult.id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Registered Email:</span>{' '}
                  <strong className="text-slate-900">{subscribeResult.email}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Private Management Token:</span>{' '}
                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono select-all">
                    {subscribeResult.management_token}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('manage');
                    loadPreferences(subscribeResult.management_token);
                  }}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-medium hover:bg-emerald-800 transition-colors"
                >
                  View &amp; Manage Preferences
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubscribeResult(null);
                    setEmail('');
                    setConsentGiven(false);
                  }}
                  className="px-4 py-2 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-medium hover:bg-emerald-100/50"
                >
                  Register Another Email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-6">
              {subscribeError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <span>{subscribeError}</span>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label htmlFor="sub-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    id="sub-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* District / Zone Preferences */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Covered Districts / Zones
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_ZONES.map((zone) => {
                    const isSelected = selectedAreas.includes(zone.id);
                    return (
                      <button
                        type="button"
                        key={zone.id}
                        onClick={() => toggleArea(zone.id)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-medium'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{zone.name}</span>
                        {isSelected && <Check size={14} className="text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic Preferences */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Threat Topics
                </label>
                <div className="space-y-2">
                  {AVAILABLE_TOPICS.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        type="button"
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-medium'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{topic.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{topic.description}</div>
                        </div>
                        {isSelected && <Check size={16} className="text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Channels */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Delivery Channels
                </label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('email')}
                      onChange={() => toggleChannel('email')}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    Email Notification
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('in_app')}
                      onChange={() => toggleChannel('in_app')}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    In-App Portal Feed
                  </label>
                </div>
              </div>

              {/* Explicit Consent Checkbox */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Statutory Consent Declaration:</strong> I explicitly consent to receive
                    official public safety incident alerts matching my selected areas and topics. I understand every email includes
                    a one-click link to update preferences or immediately withdraw consent (unsubscribe).
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Activating Subscription...
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Confirm &amp; Subscribe to Alerts
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE PREFERENCES & UNSUBSCRIBE */}
      {activeTab === 'manage' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-amber-600 font-bold mb-1">
              Citizen Self-Service Control
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Manage Preferences &amp; Unsubscribe
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your private management token from your confirmation email to update your alert preferences or withdraw consent.
            </p>
          </div>

          {/* Token Search Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manageToken}
              onChange={(e) => setManageToken(e.target.value)}
              placeholder="Paste token-sub-xxxx or enter your token"
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => loadPreferences(manageToken)}
              disabled={loadingPref || !manageToken.trim()}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
            >
              {loadingPref ? 'Loading...' : 'Lookup'}
            </button>
          </div>

          {prefError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <span>{prefError}</span>
            </div>
          )}

          {prefSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{prefSuccess}</span>
            </div>
          )}

          {currentPref && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="font-mono text-slate-500 text-[11px]">SUBSCRIPTION ID</div>
                  <div className="font-bold text-slate-900 text-sm">{currentPref.id}</div>
                </div>

                <div>
                  {currentPref.is_active ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-mono font-bold text-[10px] uppercase">
                      Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full font-mono font-bold text-[10px] uppercase">
                      Unsubscribed (Withdrawn)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Registered Email:</span>{' '}
                <strong className="text-slate-900">{currentPref.email}</strong>
              </div>

              {/* Subscribed Areas */}
              <div className="space-y-1.5">
                <span className="text-slate-500 font-medium">Subscribed Areas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentPref.areas.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-medium text-[11px]">
                      📍 {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Subscribed Topics */}
              <div className="space-y-1.5">
                <span className="text-slate-500 font-medium">Subscribed Topics:</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentPref.topics.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded font-medium text-[11px]">
                      🛡️ {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-3">
                {currentPref.is_active ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdatePreferences({ areas: ['All'], topics: ['All'] })}
                      className="px-3.5 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                    >
                      Receive All Alerts
                    </button>
                    <button
                      type="button"
                      onClick={handleUnsubscribe}
                      className="px-3.5 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      <XCircle size={14} />
                      Unsubscribe (Withdraw Consent)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdatePreferences({ is_active: true })}
                    className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Reactivate Subscription
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESTRICTED OFFICER DIRECTORY */}
      {activeTab === 'officer' && (
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-red-600">
                <Lock size={13} />
                Restricted Access &middot; DPDP Section 8 Compliance
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                Authorized Subscriber Directory
              </h2>
              <p className="text-xs text-slate-500">
                Citizen subscriber registry is restricted to authorized cyber cell officers. All access attempts are audited.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={officerBadge}
                onChange={(e) => setOfficerBadge(e.target.value)}
                placeholder="Officer Badge (e.g. BADGE-CMD-701)"
                className="px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-300 text-slate-800"
              />
              <button
                type="button"
                onClick={handleFetchOfficerSubscribers}
                disabled={loadingOfficer}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {loadingOfficer ? 'Verifying...' : 'Verify & List'}
              </button>
            </div>
          </div>

          {officerAccessError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <XCircle size={15} className="text-red-600" />
                Access Prohibited
              </div>
              <p>{officerAccessError}</p>
            </div>
          )}

          {restrictedSubscribers && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 font-mono">
                Showing {restrictedSubscribers.length} registered citizen subscriptions
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-mono text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Subscriber ID</th>
                      <th className="px-4 py-3 text-left">Email Address</th>
                      <th className="px-4 py-3 text-left">Covered Areas</th>
                      <th className="px-4 py-3 text-left">Channels</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Consent Given</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {restrictedSubscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{sub.id}</td>
                        <td className="px-4 py-3 text-slate-800">{sub.email}</td>
                        <td className="px-4 py-3 text-slate-600">{sub.areas.join(', ')}</td>
                        <td className="px-4 py-3 text-slate-600">{sub.channels.join(', ')}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold ${
                              sub.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sub.is_active ? 'Active' : 'Unsubscribed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{new Date(sub.consent_timestamp).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

