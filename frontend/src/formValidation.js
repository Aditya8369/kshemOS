const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
const PHONE = /^\+?[\d\s()-]{6,20}$/

function checkRange(value, min, max, label) {
  const n = Number(value)
  if (value === '' || value === null || Number.isNaN(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return ''
}

export function validateRouteForm(values) {
  const errors = {}

  const cli = String(values.callerCli ?? '').trim()
  if (!cli) errors.callerCli = 'Enter the number shown on the call.'
  else if (!PHONE.test(cli)) errors.callerCli = 'Use digits, spaces, + ( ) or - only (6 to 20 characters).'

  const ip = String(values.ingressIp ?? '').trim()
  if (!ip) errors.ingressIp = 'Enter an IP address or host name.'
  else if (/^[\d.]+$/.test(ip) ? !IPV4.test(ip) : !HOSTNAME.test(ip)) {
    errors.ingressIp = 'Enter a valid IPv4 address (e.g. 45.154.255.42) or host name.'
  }

  const country = String(values.originatingCountry ?? '').trim()
  if (!/^[A-Za-z]{2}$/.test(country)) errors.originatingCountry = 'Use a 2-letter country code, e.g. IN or KH.'

  const latency = checkRange(values.latencyMs, 0, 10000, 'Latency')
  if (latency) errors.latencyMs = latency
  const jitter = checkRange(values.jitterMs, 0, 10000, 'Jitter')
  if (jitter) errors.jitterMs = jitter
  const loss = checkRange(values.packetLossPct, 0, 100, 'Packet loss')
  if (loss) errors.packetLossPct = loss

  return errors
}