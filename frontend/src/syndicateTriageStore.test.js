import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseChatLocally,
  analyzeApkLocally,
  SAMPLE_CHAT_WHATSAPP,
  SAMPLE_CHAT_TELEGRAM,
  SAMPLE_APK_PAYLOAD,
} from './syndicateTriageStore.js';

describe('Syndicate Group Parser and APK Triage Store', () => {
  it('extracts WhatsApp invite link, Cambodian admin number, TRON wallet, and UPI handle', () => {
    const result = parseChatLocally(SAMPLE_CHAT_WHATSAPP, 'whatsapp', 'INC-TEST-001');

    assert.ok(result.artifact_id.startsWith('ART-CHAT-'));
    assert.strictEqual(result.incident_id, 'INC-TEST-001');
    assert.strictEqual(result.source_platform, 'whatsapp');

    // Invite links (both WhatsApp and Telegram VIP invite present in syndicate recruitment)
    assert.ok(result.invite_links.length >= 1);
    const waLink = result.invite_links.find((x) => x.platform === 'WhatsApp');
    assert.ok(waLink);
    assert.strictEqual(waLink.code, 'GzK491lKz938fLqM018zXy');

    // Phone numbers
    const cambodiaAdmin = result.phone_numbers.find((p) => p.number.includes('855'));
    assert.ok(cambodiaAdmin, 'Cambodian admin number should be extracted');
    assert.strictEqual(cambodiaAdmin.country, 'Cambodia');
    assert.strictEqual(cambodiaAdmin.is_syndicate_intl, true);
    assert.strictEqual(cambodiaAdmin.role, 'admin');

    // Crypto Wallets
    assert.strictEqual(result.crypto_wallets.length, 1);
    assert.strictEqual(result.crypto_wallets[0].network, 'TRON');
    assert.strictEqual(result.crypto_wallets[0].address, 'TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k');

    // UPI handles
    assert.ok(result.upi_ids.includes('paytmfast.mule09@ybl'));

    // Threat scoring
    assert.ok(result.risk_score >= 0.70);
    assert.ok(['HIGH', 'CRITICAL'].includes(result.threat_band));
  });

  it('extracts Telegram channel, Myanmar recruiter, EVM address, and filters emails from UPI handles', () => {
    const result = parseChatLocally(SAMPLE_CHAT_TELEGRAM, 'telegram', 'INC-TEST-002');

    assert.strictEqual(result.source_platform, 'telegram');

    // Telegram Channel
    const tgLink = result.invite_links.find((x) => x.platform === 'Telegram');
    assert.ok(tgLink);
    assert.strictEqual(tgLink.code, 'IndiaReserveVIPTask99');

    // Myanmar Recruiter
    const myanmarNum = result.phone_numbers.find((p) => p.number.includes('95'));
    assert.ok(myanmarNum);
    assert.strictEqual(myanmarNum.country, 'Myanmar');
    assert.strictEqual(myanmarNum.is_syndicate_intl, true);

    // EVM Ethereum Address
    const ethWallet = result.crypto_wallets.find((w) => w.network === 'ETH');
    assert.ok(ethWallet);
    assert.strictEqual(ethWallet.address, '0x71C8360537ab1e504F0b6771F49b94CE80f07eab');

    // Standard email support@cybercell-alert.com must not be in UPI handles
    assert.ok(!result.upi_ids.some((id) => id.includes('cybercell-alert.com')));
    assert.ok(result.upi_ids.includes('safeexpress.recovery@okhdfcbank'));
  });

  it('throws validation error when chat text is empty', () => {
    assert.throws(() => {
      parseChatLocally('   ');
    }, /Chat text cannot be empty/);
  });

  it('inspects APK payload and flags dangerous accessibility and SMS permissions', () => {
    const result = analyzeApkLocally('e-Challan_Parivahan_v3.apk', SAMPLE_APK_PAYLOAD, 'INC-TEST-APK');

    assert.ok(result.artifact_id.startsWith('ART-APK-'));
    assert.strictEqual(result.is_quarantined, true);
    assert.strictEqual(result.filename, 'e-Challan_Parivahan_v3.apk');

    const perms = result.dangerous_permissions.map((p) => p.permission);
    assert.ok(perms.includes('android.permission.BIND_ACCESSIBILITY_SERVICE'));
    assert.ok(perms.includes('android.permission.RECEIVE_SMS'));
    assert.ok(perms.includes('android.permission.SYSTEM_ALERT_WINDOW'));

    // C2 Endpoints
    assert.ok(result.c2_endpoints.some((c) => c.endpoint_type === 'telegram_bot'));
    assert.ok(result.c2_endpoints.some((c) => c.target.includes('185.220.101.45')));

    // Classification
    assert.ok(result.malware_family.includes('Accessibility Overlay'));
    assert.strictEqual(result.threat_level, 'CRITICAL');
    assert.ok(result.overall_risk_score >= 0.90);
  });
});
