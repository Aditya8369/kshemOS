import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  verifyTelephonyRouteLocally,
  MANDATORY_WARNING_BANNER,
  DEMO_CALL_PRESETS,
} from './cliSpoofStore.js';

describe('SIM Box & Spoofed Calling Line Identification (CLI) Detection Engine Store', () => {
  it('flags international call masquerading as Mumbai Police Commissionerate with mandatory warning banner', () => {
    const preset = DEMO_CALL_PRESETS.find((p) => p.key === 'mumbai-police-cambodia-spoof');
    assert.ok(preset, 'Preset should exist');

    const result = verifyTelephonyRouteLocally(preset.data);

    assert.ok(result.verification_id.startsWith('CLI-VERIF-'));
    assert.strictEqual(result.claimed_cli, '+91 22 2262 0111');
    assert.strictEqual(result.is_spoofed, true);
    assert.strictEqual(result.threat_tier, 'CRITICAL');
    assert.ok(result.carrier_legitimacy_score <= 35);

    // Verify Mandatory Warning Banner
    assert.strictEqual(result.warning_banner, MANDATORY_WARNING_BANNER);
    assert.ok(result.warning_banner.includes('Warning: Official law enforcement agencies never place summons'));

    // Check TRAI Circle
    assert.strictEqual(result.trai_circle_info.circle_code, 'MH');
    assert.strictEqual(result.trai_circle_info.is_known_government_police_number, true);
    assert.ok(result.trai_circle_info.verified_department.includes('Mumbai Police'));

    // Verify Anomaly Flags
    const flagTypes = result.anomaly_flags.map((f) => f.flag_type);
    assert.ok(flagTypes.includes('OFFSHORE_VOIP_INGRESS'));
    assert.ok(flagTypes.includes('SIMBOX_USER_AGENT_SIGNATURE'));
    assert.ok(flagTypes.includes('HIGH_LATENCY_GREY_ROUTE'));

    // Verify Forwarded to Officer Telecom Triage
    assert.strictEqual(result.forwarded_to_telecom_triage, true);
    assert.ok(result.ingress_point_id);
  });

  it('detects Mewat SIM Box gateway spoofing CBI New Delhi', () => {
    const preset = DEMO_CALL_PRESETS.find((p) => p.key === 'cbi-mewat-simbox-spoof');
    const result = verifyTelephonyRouteLocally(preset.data);

    assert.strictEqual(result.is_spoofed, true);
    assert.strictEqual(result.threat_tier, 'CRITICAL');
    assert.strictEqual(result.route_telemetry.is_simbox_gateway, true);
    assert.ok(result.route_telemetry.gateway_model.includes('DINSTAR'));

    // TRAI Delhi Circle
    assert.strictEqual(result.trai_circle_info.circle_code, 'DL');
    assert.strictEqual(result.trai_circle_info.is_known_government_police_number, true);
  });

  it('flags WhatsApp VoIP call claiming to be Supreme Court or Police', () => {
    const preset = DEMO_CALL_PRESETS.find((p) => p.key === 'whatsapp-supreme-court-voip');
    const result = verifyTelephonyRouteLocally(preset.data);

    assert.strictEqual(result.is_spoofed, true);
    assert.strictEqual(result.threat_tier, 'CRITICAL');
    const flagTypes = result.anomaly_flags.map((f) => f.flag_type);
    assert.ok(flagTypes.includes('UNOFFICIAL_VOIP_PROTOCOL'));
  });

  it('verifies legitimate domestic PSTN fixed-line call with high carrier legitimacy', () => {
    const preset = DEMO_CALL_PRESETS.find((p) => p.key === 'legitimate-domestic-call');
    const result = verifyTelephonyRouteLocally(preset.data);

    assert.strictEqual(result.is_spoofed, false);
    assert.strictEqual(result.threat_tier, 'VERIFIED_LEGITIMATE');
    assert.ok(result.carrier_legitimacy_score >= 85);
    assert.strictEqual(result.forwarded_to_telecom_triage, false);
    assert.strictEqual(result.anomaly_flags.length, 0);
  });
});

