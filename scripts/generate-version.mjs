import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const packageJsonPath = path.join(rootDir, 'package.json')
const versionJsonPath = path.join(rootDir, 'public', 'version.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

const payload = {
  version,
  minimumVersion: version,
}

const tempPath = `${versionJsonPath}.tmp`
fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
fs.renameSync(tempPath, versionJsonPath)
console.log(`[version] ${versionJsonPath} => v${version}`)
