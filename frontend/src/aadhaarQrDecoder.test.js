/**
 * Unit tests for UIDAI Aadhaar Offline QR Verification & USSD Syntax Generator
 */
import { describe, it, expect } from 'vitest';
import {
  bigIntStringToBytes,
  buildAadhaarLockSyntaxes,
  decodeAadhaarQrData,
  SAMPLE_AADHAAR_QR_PAYLOADS,
} from './aadhaarQrDecoder';

describe('Aadhaar QR Decoder & USSD Generator', () => {
  it('should generate valid USSD and SMS syntaxes from last 4 digits', () => {
    const syntaxes = buildAadhaarLockSyntaxes('9842');
    expect(syntaxes.ussd_code).toBe('*99*99*1#');
    expect(syntaxes.ussd_action_url).toBe('tel:*99*99*1%23');
    expect(syntaxes.sms_number).toBe('1947');
    expect(syntaxes.sms_lock_body).toBe('LOCKUID 9842');
    expect(syntaxes.sms_lock_url).toBe('sms:1947?body=LOCKUID 9842');
    expect(syntaxes.sms_getotp_body).toBe('GETOTP 9842');
    expect(syntaxes.sms_getotp_url).toBe('sms:1947?body=GETOTP 9842');
  });

  it('should parse big-integer decimal string into byte array', () => {
    const decimalStr = '12345678901234567890';
    const bytes = bigIntStringToBytes(decimalStr);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('should decode verified sample payload with zero server transmission', async () => {
    const result = await decodeAadhaarQrData(SAMPLE_AADHAAR_QR_PAYLOADS.VERIFIED_V2_SAMPLE);
    expect(result.success).toBe(true);
    expect(result.citizen_name).toBe('Pooja Verma');
    expect(result.last_4_digits).toBe('9842');
    expect(result.is_uidai_verified).toBe(true);
    expect(result.syntaxes.ussd_action_url).toBe('tel:*99*99*1%23');
    expect(result.syntaxes.sms_lock_body).toBe('LOCKUID 9842');
  });
});
