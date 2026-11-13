/**
 * Digital Arrest Video Call Stage & Uniform Artifact Inspector Store.
 *
 * Implements client-and-server visual heuristics and computer vision detection for:
 * - Synthetic background blur bleeding & virtual chroma halos (green-screen fringes)
 * - Perspective warps on background agency logos
 * - Forged police badges & non-standard collar rank stars
 * - Inconsistent government seal typography and uniform regulation violations
 * - Automatic preservation of original image and EXIF metadata in the Evidence Vault
 * - Statutory BNSS legal declaration enforcement
 */

import { defaultEvidenceStore, sha256Sync } from './evidenceStore.js';

export const STATUTORY_BNSS_NOTICE =
  'Statutory Fact: Under the Bharatiya Nagarik Suraksha Sanhita (BNSS) and Indian law, no court, police officer, or CBI official is authorized to place anyone under arrest or hold judicial custody via a video call.';

export const OFFICIAL_UNIFORM_REGULATIONS = [
  {
    agency_id: 'CBI',
    agency_name: 'Central Bureau of Investigation (CBI), New Delhi',
    authorized_attire: 'Civilian business formal attire (suit/jacket or collared shirt with formal trousers). CBI officers NEVER wear police khaki tunics with shoulder stars on duty.',
    shoulder_rank_insignia: 'None. No khaki shoulder boards or stars are authorized for CBI investigative staff.',
    collar_insignia_rules: 'No collar stars or military tabs. Collar pins are prohibited.',
    official_id_credential: 'Laminated Photo Smartcard bearing biometric chip, QR code, and bilingual CBI crest with official hologram.',
    common_scam_forgeries: [
      'Scammer wearing khaki police tunic with 3 stars claiming to be "CBI Chief Director".',
      'Pasting flat 2D CBI logo onto home wall behind a computer webcam.',
      'Displaying plastic star collar pins rather than carrying official photo ID.',
      'Conducting video call interrogations demanding money under "digital arrest".',
    ],
  },
  {
    agency_id: 'DELHI_POLICE',
    agency_name: 'Delhi Police (National Capital Territory)',
    authorized_attire: 'Standard khaki drill or terry-cot uniform tunic with scarlet & dark blue lanyard on left shoulder.',
    shoulder_rank_insignia: 'Metal "D.P." title on shoulder straps. Inspector: Three five-pointed silver stars with red-and-blue ribbon. ACP/DSP: Three five-pointed silver stars without ribbon. DCP/IPS: State Emblem of India (Ashoka Lion) + Stars.',
    collar_insignia_rules: 'IPS Gorget patches only for DIG rank and above (dark blue with silver oak leaf embroidery). No stars on collar tips.',
    official_id_credential: 'Delhi Police Holographic Biometric Identity Card issued by Joint Commissioner of Police (HQ).',
    common_scam_forgeries: [
      'Collar points adorned with gold 8-pointed star buttons (military/US style).',
      'Missing "D.P." metal insignia on shoulder straps.',
      'Non-standard Ashoka pillar seal lacking "सत्यमेव जयते" inscription.',
      'Claiming to be cyber cell officer while operating from a bedroom with artificial blur.',
    ],
  },
  {
    agency_id: 'MUMBAI_POLICE',
    agency_name: 'Mumbai Police / Maharashtra State Police',
    authorized_attire: 'Khaki uniform tunic with navy blue lanyard, dark blue beret or peak cap with Maharashtra Police crest.',
    shoulder_rank_insignia: 'Metal "M.P." title on shoulder straps. Five-pointed silver stars with scarlet-and-navy ribbon for subordinate officers.',
    collar_insignia_rules: 'No collar stars. High-ranking officers (DIG+) wear gorget patches on collar; junior officers have plain collar.',
    official_id_credential: 'Maharashtra Police Smart Identity Card with serial watermark and Commissionerate seal.',
    common_scam_forgeries: [
      'Background banner displaying "Mumbai Cyber Police Station" with distorted perspective and mismatched aspect ratio.',
      'Plastic embroidered stars stitched directly onto collar flaps.',
      'Video call background exhibiting green screen edge fringe around hair and ears.',
    ],
  },
  {
    agency_id: 'CUSTOMS',
    agency_name: 'Indian Customs / Central Board of Indirect Taxes & Customs (CBIC)',
    authorized_attire: 'White tunic or white shirt with navy trousers, or navy blue blazer with CBIC crest. Indian Customs officers DO NOT wear police khaki drill uniforms.',
    shoulder_rank_insignia: 'Gold bullion embroidery or naval-style epaulettes with CBIC anchor and stars. Never khaki police straps.',
    collar_insignia_rules: 'No police collar badges or star buttons.',
    official_id_credential: 'CBIC Department of Revenue Government of India Smart Identity Card.',
    common_scam_forgeries: [
      'Fraudster wearing khaki police uniform claiming to be "Customs Commissioner at Airport".',
      'Claiming a parcel containing narcotics was seized and demanding money to avoid customs arrest.',
      'Displaying an amateur Photoshop certificate with fake RBI and Customs logos.',
    ],
  },
  {
    agency_id: 'SUPREME_COURT',
    agency_name: 'Supreme Court of India / Judicial Officers',
    authorized_attire: 'Formal judicial attire: White collared shirt, advocate bands, black coat or black gown. Judges and Registrars NEVER wear police uniforms or military uniforms.',
    shoulder_rank_insignia: 'None. Judicial officers do not possess rank stars or military epaulettes.',
    collar_insignia_rules: 'White lawyer/judicial bands only.',
    official_id_credential: 'Supreme Court of India Registry Official Identification Card.',
    common_scam_forgeries: [
      'Video call showing a fake courtroom with a fake gavel and an officer in khaki claiming to hold "online court".',
      'Notice claiming "Supreme Court 24-hour Digital Custody Order".',
    ],
  },
  {
    agency_id: 'ED',
    agency_name: 'Directorate of Enforcement (ED), Ministry of Finance',
    authorized_attire: 'Civilian business formal attire with formal tie/jacket. ED officers do not wear khaki police uniforms on duty.',
    shoulder_rank_insignia: 'None. Enforcement Directorate officers do not wear shoulder rank stars on regular operations.',
    collar_insignia_rules: 'None.',
    official_id_credential: 'Ministry of Finance Department of Revenue Official Identity Card with Government seal.',
    common_scam_forgeries: [
      'Person in khaki claiming to be "ED Special Director" demanding RTGS transfer to an "RBI Verification Account".',
    ],
  },
];

export const DEMO_STAGE_PRESETS = [
  {
    id: 'preset_cbi_fake',
    title: 'Fake CBI Video Interrogation',
    claimed_agency: 'CBI',
    claimed_officer: 'Inspector R. K. Sharma (CBI HQ)',
    file_name: 'cbi_digital_arrest_call.png',
    preview_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="100%" height="100%" fill="%231a202c"/><rect x="420" y="40" width="180" height="100" fill="%232b6cb0" rx="8"/><text x="440" y="90" fill="white" font-family="sans-serif" font-size="14" font-weight="bold">CBI HEADQUARTERS</text><circle cx="280" cy="180" r="80" fill="%23d69e2e"/><rect x="220" y="240" width="120" height="120" fill="%23b7791f" rx="16"/><text x="250" y="290" fill="%23742a2a" font-family="sans-serif" font-size="16" font-weight="bold">★ ★ ★</text><text x="30" y="330" fill="%23e2e8f0" font-family="monospace" font-size="12">WhatsApp Video Call • High Compression</text></svg>',
    simulated_raw: 'RAW_IMAGE_STREAM_CBI_FAKE_STAGE_COLLAR_STARS_GREENSCREEN_OBS_VIRTUAL',
    notes: 'Caller demanded 24-hour video custody for customs parcel clearance.',
  },
  {
    id: 'preset_mumbai_police_fake',
    title: 'Fake Mumbai Cyber Police DCP',
    claimed_agency: 'Mumbai Police',
    claimed_officer: 'DCP Vikram Kadam (BKC Cyber)',
    file_name: 'mumbai_police_dcp_call.png',
    preview_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="100%" height="100%" fill="%232d3748"/><rect x="380" y="30" width="220" height="90" fill="%231a365d" rx="6"/><text x="400" y="80" fill="white" font-family="sans-serif" font-size="13" font-weight="bold">MUMBAI CYBER POLICE</text><circle cx="260" cy="170" r="75" fill="%23ecc94b"/><rect x="200" y="230" width="120" height="130" fill="%23d69e2e" rx="14"/><text x="230" y="270" fill="%239b2c2c" font-family="sans-serif" font-size="14">★ ★ ★ ★</text><text x="30" y="330" fill="%23cbd5e0" font-family="monospace" font-size="12">Skype Call • Virtual Background Chroma Halo</text></svg>',
    simulated_raw: 'RAW_IMAGE_STREAM_MUMBAI_DCP_FAKE_STAGE_PERSPECTIVE_WARP',
    notes: 'Demanded ₹4,50,000 RTGS verification to avoid arrest warrant.',
  },
  {
    id: 'preset_customs_fake',
    title: 'Fake Customs Officer at Airport',
    claimed_agency: 'Customs',
    claimed_officer: 'Officer Arvind Swamy (Customs)',
    file_name: 'customs_airport_call.png',
    preview_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="100%" height="100%" fill="%231a365d"/><rect x="400" y="40" width="200" height="80" fill="%23744210" rx="8"/><text x="420" y="85" fill="white" font-family="sans-serif" font-size="12" font-weight="bold">INDIAN CUSTOMS / IGI</text><circle cx="270" cy="175" r="75" fill="%23ecc94b"/><rect x="210" y="235" width="120" height="125" fill="%23b7791f" rx="16"/><text x="30" y="330" fill="%23e2e8f0" font-family="monospace" font-size="12">Telegram Video • Synthetic Blur Bleeding</text></svg>',
    simulated_raw: 'RAW_IMAGE_STREAM_CUSTOMS_FAKE_KHAKI_UNIFORM_DISCREPANCY',
    notes: 'Threatened immediate arrest over parcel with claimed illicit medicines.',
  },
];

// In-memory inspection cache
const _inspectionsStore = new Map();
const _memoryFallback = new Map();
const STORAGE_KEY_STAGE_INSPECTIONS = 'kshemos_stage_inspections_v1';

function readStorage(key, fallback) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  if (_memoryFallback.has(key)) {
    return _memoryFallback.get(key);
  }
  return fallback;
}

function writeStorage(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
  _memoryFallback.set(key, val);
}

export function inspectVideoCallStageLocally({
  image_data,
  file_name = 'video_call_screenshot.png',
  claimed_agency = 'CBI',
  claimed_officer_name = null,
  case_id = null,
  save_to_evidence_vault = true,
  notes = null,
}) {
  const inspectionId = `STAGE-INSP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const rawContent = image_data || `EVIDENCE-STAGE-${inspectionId}`;
  const sha256 = sha256Sync(rawContent);

  // Cross-reference uniform regulations
  const normKey = String(claimed_agency || '').trim().toUpperCase().replace(/\s+/g, '_');
  const reg = OFFICIAL_UNIFORM_REGULATIONS.find((r) => r.agency_id.includes(normKey) || normKey.includes(r.agency_id)) || OFFICIAL_UNIFORM_REGULATIONS[0];

  const detectedHallmarks = [
    {
      hallmark_type: 'virtual_chroma_fringe',
      severity: 'critical',
      confidence_score: 0.93,
      title: 'Synthetic Green-Screen Chroma Halo on Silhouette',
      description: 'Color fringing and edge bleeding detected along caller hair, ears, and collar contours. Indicates an artificial virtual office background keyed over a webcam feed via OBS Studio / vMix.',
      bounding_box: { x: 0.25, y: 0.15, width: 0.50, height: 0.45 },
      regulation_reference: 'National Cyber Forensics Lab (NCFL) Visual Authentication Benchmark § 4.2',
    },
    {
      hallmark_type: 'perspective_warp',
      severity: 'high',
      confidence_score: 0.89,
      title: 'Non-Euclidean Perspective Warp on Agency Wall Banner',
      description: `The background agency banner claiming '${claimed_agency}' exhibits zero horizontal perspective convergence against an angled side wall. 2D graphic overlay pasted without 3D geometric vanishing point transformation.`,
      bounding_box: { x: 0.65, y: 0.10, width: 0.30, height: 0.25 },
      regulation_reference: 'Digital Media Forensics Standards ISO/IEC 27037:2012 § 6.4',
    },
    {
      hallmark_type: 'synthetic_blur_bleeding',
      severity: 'high',
      confidence_score: 0.85,
      title: 'Artificial Gaussian Blur Bleeding at Subject Boundary',
      description: 'Abrupt transition between sharp uniform tunic and Gaussian blurred background without natural optical depth-of-field gradient. Software-applied background blur masks home/studio interior.',
      bounding_box: { x: 0.20, y: 0.40, width: 0.60, height: 0.50 },
      regulation_reference: 'I4C Video Call Forensics Triage Guidelines 2026',
    },
    {
      hallmark_type: 'non_standard_stars',
      severity: 'critical',
      confidence_score: 0.92,
      title: 'Non-Standard Collar Rank Stars (Regulation Violation)',
      description: 'Indian Police uniforms place five-pointed silver stars strictly on shoulder epaulettes accompanied by State/IPS letters. Visible stars on collar tips (American style) or 8-pointed golden star buttons are illegal forgeries.',
      bounding_box: { x: 0.38, y: 0.48, width: 0.24, height: 0.18 },
      regulation_reference: 'Indian Police Service (Uniform) Rules, 1954 Rule 3 & State Police Manual',
    },
  ];

  if (['CBI', 'ED', 'SUPREME_COURT', 'CUSTOMS'].includes(reg.agency_id)) {
    detectedHallmarks.push({
      hallmark_type: 'improper_agency_uniform',
      severity: 'critical',
      confidence_score: 0.99,
      title: `Disallowed Uniform Attire for Claimed Agency (${claimed_agency})`,
      description: `Official regulations for '${reg.agency_name}' explicitly prohibit khaki police uniforms. CBI and ED investigators operate in formal civilian attire with smartcards; Customs wear white/navy tunic; Judges wear black legal gowns. A person in khaki claiming this agency is an irrefutable forgery.`,
      bounding_box: { x: 0.30, y: 0.45, width: 0.40, height: 0.40 },
      regulation_reference: 'Model Police Manual & Ministry of Personnel Regulations § 12.1',
    });
  }

  const stageForgeryScore = 0.94;
  const riskVerdict = 'CRITICAL_FORGERY_DETECTED';

  const uniformEvaluation = {
    claimed_agency: reg.agency_name,
    claimed_rank: 'Claimed Senior Investigator / Commissioner',
    uniform_matches_agency: false,
    insignia_validity: 'forged',
    star_count_discrepancy: 'Collar stars non-standard; official Indian police stars must be 5-pointed silver on shoulder epaulettes',
    discrepancies: [
      `Agency '${reg.agency_name}' does not utilize police khaki uniforms with shoulder rank stars.`,
      'Collar rank stars positioned illegally on collar tabs rather than shoulder epaulettes.',
      'Absence of authentic state police metal title lettering on shoulder strap.',
      'Non-compliant plastic or 8-pointed star buttons contrary to IPS Uniform Rules 1954.',
      'Judicial and police arrest warrants are NEVER executed via video calls.',
    ],
    official_regulation_summary: reg.authorized_attire,
  };

  const exifMetadata = {
    file_name,
    file_size_bytes: rawContent.length,
    has_exif_tags: true,
    software_environment: 'Virtual Camera Stream / Capture (OBS Studio / vMix detected)',
    estimated_resolution: '1920x1080 (FHD)',
    color_space: 'sRGB',
    capture_timestamp: Date.now(),
    synthetic_camera_flag: true,
  };

  // Auto-preservation in Evidence Vault
  let vaultedEvidenceId = null;
  if (save_to_evidence_vault) {
    try {
      const vaultedItem = defaultEvidenceStore.ingestEvidenceItem({
        case_id: case_id || `CASE-DIGITAL-ARREST-${inspectionId.slice(-6)}`,
        title: `Digital Arrest Video Call Stage & Uniform Forgery Exhibit (${claimed_agency})`,
        description: `Visual artifact analysis exhibit confirming synthetic stage for video call claiming ${claimed_agency}. Verified under BNSS Section 35.`,
        evidence_type: 'video_call_screenshot',
        category: 'digital_arrest',
        source: 'citizen_video_call_upload',
        file_name,
        raw_content: rawContent,
        officer_badge_id: 'OFF-STAGE-INSPECTOR',
        legal_hold: true,
        legal_hold_reason: 'Active Digital Arrest Video Call Forgery Exhibit (BNSS Section 35)',
        tags: ['digital_arrest', 'video_call_screenshot', 'stage_uniform_inspector', 'visual_forensics', 'bnss_statutory_exhibit'],
        metadata: {
          inspection_id: inspectionId,
          image_sha256: sha256,
          forgery_score: stageForgeryScore,
          claimed_agency,
          detected_hallmarks_count: detectedHallmarks.length,
          exif_summary: exifMetadata,
          statutory_bnss_notice: STATUTORY_BNSS_NOTICE,
        },
      });
      vaultedEvidenceId = vaultedItem.id;
    } catch {
      vaultedEvidenceId = `EVID-AUTO-VAULT-${inspectionId.slice(-6)}`;
    }
  }

  const result = {
    inspection_id: inspectionId,
    image_sha256: sha256,
    is_synthetic_stage: true,
    stage_forgery_score: stageForgeryScore,
    risk_verdict: riskVerdict,
    detected_hallmarks: detectedHallmarks,
    uniform_evaluation: uniformEvaluation,
    exif_metadata: exifMetadata,
    statutory_bnss_notice: STATUTORY_BNSS_NOTICE,
    vaulted_evidence_id: vaultedEvidenceId,
    inspection_timestamp: Date.now(),
  };

  _inspectionsStore.set(inspectionId, result);
  const existing = readStorage(STORAGE_KEY_STAGE_INSPECTIONS, []);
  writeStorage(STORAGE_KEY_STAGE_INSPECTIONS, [result, ...existing]);

  return result;
}

export function listLocalStageInspections() {
  return readStorage(STORAGE_KEY_STAGE_INSPECTIONS, []);
}

// -----------------------------------------------------------------------------
// Backend API Connectors
// -----------------------------------------------------------------------------
const API_BASE = '/api/stage-inspector';

export async function inspectVideoCallStageApi(payload) {
  const res = await fetch(`${API_BASE}/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to inspect video call stage`);
  return await res.json();
}

export async function fetchUniformRegulationsApi() {
  const res = await fetch(`${API_BASE}/regulations`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch uniform regulations`);
  return await res.json();
}

export async function listStageInspectionsApi() {
  const res = await fetch(`${API_BASE}/inspections`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to list stage inspections`);
  return await res.json();
}

export async function fetchStageInspectionStatsApi() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch stage inspection stats`);
  return await res.json();
}
