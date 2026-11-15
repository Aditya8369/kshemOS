import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRouteForm } from './formValidation.js'

const valid = {
  callerCli: '+91 22 2262 0111',
  ingressIp: '45.154.255.42',
  originatingCountry: 'KH',
  latencyMs: 285,
  jitterMs: 48,
  packetLossPct: 3.8,
}

test('valid input has no errors', () => {
  assert.deepEqual(validateRouteForm(valid), {})
})

test('empty caller number and bad IP are reported', () => {
  const e = validateRouteForm({ ...valid, callerCli: '', ingressIp: '999.1.1.1' })
  assert.ok(e.callerCli)
  assert.ok(e.ingressIp)
})

test('host names are accepted', () => {
  assert.deepEqual(validateRouteForm({ ...valid, ingressIp: 'gw.example.com' }), {})
})

test('country must be 2 letters', () => {
  assert.ok(validateRouteForm({ ...valid, originatingCountry: 'IND' }).originatingCountry)
})

test('numeric ranges are enforced', () => {
  const e = validateRouteForm({ ...valid, latencyMs: -5, packetLossPct: 120 })
  assert.ok(e.latencyMs)
  assert.ok(e.packetLossPct)
})