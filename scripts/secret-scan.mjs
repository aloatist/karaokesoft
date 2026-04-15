import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const MAX_FILE_BYTES = 2 * 1024 * 1024

const skippedPathPrefixes = [
  'node_modules/',
  'dist/',
  'release/',
  '.playwright-cli/',
  'android/.gradle/',
  'android/app/build/',
  'server/data/',
]

const skippedPathSuffixes = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]

const binaryExtensions = new Set([
  '.apk',
  '.aab',
  '.app',
  '.bin',
  '.dmg',
  '.gif',
  '.icns',
  '.ico',
  '.jks',
  '.jpg',
  '.jpeg',
  '.keystore',
  '.mp4',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
])

const findings = []

const secretPatterns = [
  {
    name: 'Google API key',
    pattern: /AIza[0-9A-Za-z_-]{30,}/g,
  },
  {
    name: 'OpenAI API key',
    pattern: /sk-[A-Za-z0-9_-]{32,}/g,
  },
  {
    name: 'GitHub token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/g,
  },
  {
    name: 'Private key block',
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/g,
  },
]

const envSecretPattern =
  /^[ \t]*(VITE_YT_API_KEY|VITE_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|KEY)|YOUTUBE_API_KEY|YT_API_KEY|AUTH_ACCESS_SECRET|AUTH_REFRESH_SECRET|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET)[ \t]*=[ \t]*(['"]?)([^'"\s#]+)\2/gm

const safeEnvValues = new Set([
  '',
  'your_server_key',
  'your-key',
  'your_key',
  'change-me',
  'change_me',
  'example',
  'demo',
])

function listCandidateFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  if (skippedPathPrefixes.some((prefix) => normalized.startsWith(prefix))) return true
  if (skippedPathSuffixes.some((suffix) => normalized.endsWith(suffix))) return true
  if (binaryExtensions.has(path.extname(normalized).toLowerCase())) return true
  return false
}

function readTextFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath)
  const stat = fs.statSync(fullPath)
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return ''
  const buffer = fs.readFileSync(fullPath)
  if (buffer.includes(0)) return ''
  return buffer.toString('utf8')
}

function addFinding(relativePath, name, index, text) {
  const line = text.slice(0, index).split('\n').length
  findings.push({ file: relativePath, line, name })
}

for (const relativePath of listCandidateFiles()) {
  if (shouldSkip(relativePath)) continue

  let text = ''
  try {
    text = readTextFile(relativePath)
  } catch {
    continue
  }
  if (!text) continue

  for (const rule of secretPatterns) {
    rule.pattern.lastIndex = 0
    let match
    while ((match = rule.pattern.exec(text))) {
      addFinding(relativePath, rule.name, match.index, text)
    }
  }

  envSecretPattern.lastIndex = 0
  let envMatch
  while ((envMatch = envSecretPattern.exec(text))) {
    const key = envMatch[1]
    const value = String(envMatch[3] || '').trim()
    if (!value || safeEnvValues.has(value) || /^your[_-]/i.test(value)) continue
    if (relativePath === '.env.example' && value.startsWith('http://127.0.0.1')) continue
    addFinding(relativePath, `${key} has a non-placeholder value`, envMatch.index, text)
  }
}

console.log('== KaraokeYT Secret Scan ==')

if (findings.length) {
  console.log('Errors:')
  for (const finding of findings) {
    console.log(`- ${finding.file}:${finding.line} ${finding.name}`)
  }
  process.exit(1)
}

console.log('OK: Khong phat hien secret ro rang trong file dang track/untracked.')
