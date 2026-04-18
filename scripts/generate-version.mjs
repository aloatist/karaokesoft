import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const packageJsonPath = path.join(rootDir, 'package.json')
const versionJsonPath = path.join(rootDir, 'public', 'version.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

function readEnv(name) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function assignIfSet(target, key, value) {
  if (value) {
    target[key] = value
  }
}

const payload = {
  version,
  minimumVersion: readEnv('UPDATE_MINIMUM_VERSION') ?? version,
}

assignIfSet(payload, 'releaseDate', readEnv('UPDATE_RELEASE_DATE'))
assignIfSet(payload, 'releaseNotes', readEnv('UPDATE_RELEASE_NOTES'))
assignIfSet(payload, 'downloadUrl', readEnv('UPDATE_DOWNLOAD_URL'))
assignIfSet(payload, 'desktopDownloadUrl', readEnv('UPDATE_DESKTOP_DOWNLOAD_URL'))
assignIfSet(payload, 'windowsDownloadUrl', readEnv('UPDATE_WINDOWS_DOWNLOAD_URL'))
assignIfSet(payload, 'macDownloadUrl', readEnv('UPDATE_MAC_DOWNLOAD_URL'))
assignIfSet(payload, 'linuxDownloadUrl', readEnv('UPDATE_LINUX_DOWNLOAD_URL'))
assignIfSet(payload, 'androidDownloadUrl', readEnv('UPDATE_ANDROID_DOWNLOAD_URL'))
assignIfSet(payload, 'iosDownloadUrl', readEnv('UPDATE_IOS_DOWNLOAD_URL'))
assignIfSet(payload, 'webUrl', readEnv('UPDATE_WEB_URL'))

const tempPath = `${versionJsonPath}.tmp`
fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
fs.renameSync(tempPath, versionJsonPath)
console.log(`[version] ${versionJsonPath} => v${version}`)
