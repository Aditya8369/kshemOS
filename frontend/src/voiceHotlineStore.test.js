import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_INDIC_LANGUAGES,
  DTMF_TO_LANG_CODE,
  INDIC_HOTLINE_CATALOG,
  resolveDesk,
  maskPhoneLocally,
  startLocalVoiceHotlineCall,
  processLocalVoiceHotlineInput,
  listLocalVoiceHotlineSessions,
  getLocalDispatchedSms,
} from './voiceHotlineStore.js';

test('SUPPORTED_INDIC_LANGUAGES provides exactly 8 Indic languages with native names', () => {
  assert.equal(SUPPORTED_INDIC_LANGUAGES.length, 8);
  const codes = SUPPORTED_INDIC_LANGUAGES.map((l) => l.code);
  const expected = ['en', 'hi', 'ta', 'te', 'kn', 'bn', 'mr', 'gu'];
  for (const c of expected) {
    assert.ok(codes.includes(c), `Language code ${c} must be supported`);
  }

  // Native script validation
  const hi = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === 'hi');
  assert.equal(hi.native_name, 'हिन्दी');
  assert.equal(hi.dtmf_key, '2');

  const ta = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === 'ta');
  assert.equal(ta.native_name, 'தமிழ்');
  assert.equal(ta.dtmf_key, '3');

  const te = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === 'te');
  assert.equal(te.native_name, 'తెలుగు');
  assert.equal(te.dtmf_key, '4');
});

test('maskPhoneLocally masks caller PII for anonymous logging', () => {
  assert.equal(maskPhoneLocally('+91 98765 43210'), '+91 XXXXX 3210');
  assert.equal(maskPhoneLocally('9123456789'), '+91 XXXXX 6789');
  assert.equal(maskPhoneLocally(null), 'ANONYMOUS_CALLER');
});

test('resolveDesk resolves regional cyber police desk and zone', () => {
  const delhi = resolveDesk('Delhi NCR');
  assert.ok(delhi.desk.includes('Rohini'));
  assert.equal(delhi.region, 'North Zone');

  const mumbai = resolveDesk('Mumbai Circle');
  assert.ok(mumbai.desk.includes('BKC'));
  assert.equal(mumbai.region, 'West Zone');

  const bangalore = resolveDesk('Karnataka / Bengaluru');
  assert.ok(bangalore.desk.includes('CID Cyber'));
  assert.equal(bangalore.region, 'South Zone');
});

test('startLocalVoiceHotlineCall initializes call in welcome language state', () => {
  const call = startLocalVoiceHotlineCall({
    caller_phone: '+91 98765 43210',
    initial_language: 'en',
    telecom_circle: 'Delhi',
  });

  assert.ok(call.session_id.startsWith('HOTLINE-'));
  assert.equal(call.current_step, 'WELCOME_LANG_SELECT');
  assert.equal(call.selected_language, 'en');
  assert.ok(call.audio_text.includes('Welcome to the KshemOS Cyber Safety Hotline'));
  assert.equal(call.is_completed, false);
});

test('full local IVR flow in Hindi delivers calm reassurance, dispatches SMS, and logs triage incident', () => {
  // 1. Start call
  const call = startLocalVoiceHotlineCall({
    caller_phone: '+91 98765 12345',
    initial_language: 'en',
    telecom_circle: 'Delhi',
  });

  // 2. Select Hindi via DTMF '2'
  const turn1 = processLocalVoiceHotlineInput({
    session_id: call.session_id,
    dtmf_digit: '2',
  });
  assert.equal(turn1.current_step, 'PROMPT_AUTHORITY');
  assert.equal(turn1.selected_language, 'hi');
  assert.ok(turn1.audio_text.includes('कस्टम्स, पुलिस, सीबीआई'));
  assert.deepEqual(turn1.allowed_dtmf_keys, ['1', '2']);

  // 3. Citizen presses '1' (Yes, caller claimed to be police)
  const turn2 = processLocalVoiceHotlineInput({
    session_id: call.session_id,
    dtmf_digit: '1',
  });
  assert.equal(turn2.current_step, 'PROMPT_EXTORTION');
  assert.equal(turn2.claimed_authority, true);
  assert.ok(turn2.audio_text.includes('गिरफ्तारी से बचने के लिए पैसे'));

  // 4. Citizen presses '1' (Yes, demanded money / video digital arrest)
  const turn3 = processLocalVoiceHotlineInput({
    session_id: call.session_id,
    dtmf_digit: '1',
  });
  assert.equal(turn3.current_step, 'COMPLETED');
  assert.equal(turn3.demanded_money, true);
  assert.equal(turn3.reassurance_delivered, true);
  assert.equal(turn3.is_completed, true);

  // Spoken reassurance check in Hindi
  assert.ok(turn3.audio_text.includes('सरकारी एजेंसियां कभी भी ऑनलाइन ट्रांसफर'));
  assert.ok(turn3.audio_text.includes('तुरंत फोन काट दें'));

  // SMS summary check
  assert.equal(turn3.sms_dispatched, true);
  assert.ok(turn3.sms_summary.includes('1930'));
  assert.ok(turn3.sms_summary.includes('cybercrime.gov.in'));

  // Anonymous triage incident entry
  assert.ok(turn3.triage_incident_id);
  assert.ok(turn3.triage_incident_id.startsWith('INC-'));
});

test('local IVR flow in Tamil via DTMF 3 delivers localized reassurance and SMS', () => {
  const call = startLocalVoiceHotlineCall({
    caller_phone: '+91 94440 99887',
    initial_language: 'en',
    telecom_circle: 'Chennai',
  });

  // Select Tamil
  const turn1 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '3' });
  assert.equal(turn1.selected_language, 'ta');
  assert.ok(turn1.audio_text.includes('சுங்கத்துறை, காவல்துறை'));

  // Step 1: Yes
  const turn2 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '1' });
  assert.equal(turn2.claimed_authority, true);
  assert.ok(turn2.audio_text.includes('கைதைத் தவிர்க்க பணம்'));

  // Step 2: Yes
  const turn3 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '1' });
  assert.equal(turn3.reassurance_delivered, true);
  assert.ok(turn3.audio_text.includes('அரசு அமைப்புகள் ஒருபோதும் ஆன்லைன் பணப்பரிமாற்றம்'));
  assert.ok(turn3.audio_text.includes('உடனடியாக அழைப்பைத் துண்டிக்கவும்'));
  assert.equal(turn3.sms_dispatched, true);
  assert.ok(turn3.sms_summary.includes('1930'));
});

test('local IVR flow in Marathi via DTMF 7 delivers localized reassurance and SMS', () => {
  const call = startLocalVoiceHotlineCall({
    caller_phone: '+91 98200 11223',
    initial_language: 'en',
    telecom_circle: 'Mumbai',
  });

  // Select Marathi
  const turn1 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '7' });
  assert.equal(turn1.selected_language, 'mr');
  assert.ok(turn1.audio_text.includes('कस्टम्स, पोलीस'));

  // Step 1: Yes
  const turn2 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '1' });
  assert.equal(turn2.claimed_authority, true);

  // Step 2: Yes
  const turn3 = processLocalVoiceHotlineInput({ session_id: call.session_id, dtmf_digit: '1' });
  assert.equal(turn3.reassurance_delivered, true);
  assert.ok(turn3.audio_text.includes('सरकारी यंत्रणा कधीही ऑनलाइन पैसे ट्रान्सफर'));
  assert.ok(turn3.nearest_cyber_desk.includes('BKC'));
});

