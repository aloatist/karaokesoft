import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const packageJsonPath = path.join(rootDir, 'package.json')
const versionJsonPath = path.join(rootDir, 'public', 'version.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const appVersion = String(packageJson.version || '')
const warnings = []
const errors = []

function isSemverLike(value) {
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
}

if (!isSemverLike(appVersion)) {
  errors.push(`package.json version khong hop le: "${appVersion}"`)
}

if (!fs.existsSync(versionJsonPath)) {
  errors.push('Thieu public/version.json. Chay: node scripts/generate-version.mjs')
} else {
  try {
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
    if (String(versionJson.version || '') !== appVersion) {
      errors.push(`public/version.json (${versionJson.version}) khong khop package.json (${appVersion})`)
    }
  } catch {
    errors.push('public/version.json khong parse duoc JSON. Chay lai: node scripts/generate-version.mjs')
  }
}

if (process.env.VITE_YT_API_KEY) {
  errors.push('VITE_YT_API_KEY dang duoc set. Ban public khong nen dong goi key YouTube vao client.')
}

if (!process.env.VITE_YOUTUBE_SEARCH_PROXY_URL) {
  warnings.push('Chua set VITE_YOUTUBE_SEARCH_PROXY_URL. Ban production se khong tim YouTube duoc neu khong co proxy.')
}

if (!process.env.AUTH_ACCESS_SECRET || process.env.AUTH_ACCESS_SECRET.includes('change-me')) {
  warnings.push('AUTH_ACCESS_SECRET chua duoc cau hinh an toan.')
}

if (!process.env.AUTH_REFRESH_SECRET || process.env.AUTH_REFRESH_SECRET.includes('change-me')) {
  warnings.push('AUTH_REFRESH_SECRET chua duoc cau hinh an toan.')
}

console.log('== KaraokeYT Release Readiness ==')
console.log(`Version: ${appVersion}`)

if (warnings.length) {
  console.log('\nWarnings:')
  for (const warning of warnings) {
    console.log(`- ${warning}`)
  }
}

if (errors.length) {
  console.log('\nErrors:')
  for (const error of errors) {
    console.log(`- ${error}`)
  }
  process.exit(1)
}

console.log('\nOK: Khong co loi blocking truoc release.')
