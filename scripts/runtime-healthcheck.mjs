const DEFAULT_TIMEOUT_MS = 5000

function withTimeout(promise, timeoutMs, label) {
  const timer = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`)), timeoutMs)
  })
  return Promise.race([promise, timer])
}

async function getJson(url, label) {
  const response = await withTimeout(fetch(url), DEFAULT_TIMEOUT_MS, label)
  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}`)
  }
  return response.json()
}

async function main() {
  const relayBase = process.env.RELAY_BASE_URL || 'http://127.0.0.1:8787'
  const authBase = process.env.AUTH_BASE_URL || 'http://127.0.0.1:8788'

  console.log('== KaraokeYT Runtime Healthcheck ==')
  console.log(`Relay: ${relayBase}`)
  console.log(`Auth:  ${authBase}`)

  let hasError = false

  try {
    const relayHealth = await getJson(`${relayBase}/health`, 'relay /health')
    console.log(`✓ relay /health => ${relayHealth.service || 'ok'}`)
  } catch (error) {
    hasError = true
    console.log(`✗ relay /health => ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const authHealth = await getJson(`${authBase}/health`, 'auth /health')
    console.log(`✓ auth /health => ownerReady=${authHealth.ownerReady ? 'yes' : 'no'} users=${authHealth.users ?? '?'}`)
  } catch (error) {
    hasError = true
    console.log(`✗ auth /health => ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const csrf = await getJson(`${authBase}/api/auth/csrf`, 'auth /api/auth/csrf')
    console.log(`✓ auth /api/auth/csrf => token=${csrf.csrfToken ? 'ok' : 'missing'}`)
  } catch (error) {
    hasError = true
    console.log(`✗ auth /api/auth/csrf => ${error instanceof Error ? error.message : String(error)}`)
  }

  if (hasError) {
    process.exit(1)
  }

  console.log('OK: Runtime endpoints healthy.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
