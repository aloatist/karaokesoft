/**
 * Secure Storage for Desktop App
 * Sử dụng OS Keychain (keytar) hoặc file mã hóa nếu keytar không khả dụng
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { app } = require('electron')

const SERVICE_NAME = 'KaraokeYT'
const ACCOUNT_NAME = 'youtube-api-key'
const FALLBACK_FILE = 'karaokeyt-secure.dat'
const YOUTUBE_TEST_VIDEO_ID = 'dQw4w9WgXcQ'

// AES-256 encryption fallback
function getMachineSecret() {
  const hostname = require('os').hostname()
  const username = require('os').userInfo().username
  return crypto.scryptSync(`${hostname}:${username}:karaokeyt-salt-v1`, 'salt', 32)
}

function encryptData(data) {
  const algorithm = 'aes-256-gcm'
  const key = getMachineSecret()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptData(encryptedData) {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
  const algorithm = 'aes-256-gcm'
  const key = getMachineSecret()
  
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function getFallbackPath() {
  return path.join(app.getPath('userData'), FALLBACK_FILE)
}

function normalizeApiKey(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeApiKeys(value) {
  const rawItems = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/)
  const seen = new Set()
  const keys = []

  for (const item of rawItems) {
    const key = normalizeApiKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }

  return keys
}

function looksLikeYoutubeApiKey(value) {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(normalizeApiKey(value))
}

function parseStoredApiKeys(rawValue) {
  const normalized = normalizeApiKey(rawValue)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed?.keys)) return normalizeApiKeys(parsed.keys)
  } catch {}

  return normalizeApiKeys(normalized)
}

function serializeApiKeys(keys) {
  return JSON.stringify({
    version: 2,
    keys,
  })
}

function applyApiKeysToEnv(keys) {
  if (!keys.length) {
    delete process.env.YOUTUBE_API_KEY
    delete process.env.YOUTUBE_API_KEYS
    return
  }

  process.env.YOUTUBE_API_KEY = keys[0]
  process.env.YOUTUBE_API_KEYS = keys.join(',')
}

async function readYoutubeApiErrorMessage(response) {
  const json = await response.json().catch(() => null)
  const rawMessage = String(json?.error?.message || '').trim()
  const reason = String(json?.error?.errors?.[0]?.reason || '').trim()
  const normalized = `${rawMessage} ${reason}`.toLowerCase()

  if (normalized.includes('api key not valid') || normalized.includes('keyinvalid')) {
    return 'YouTube API key không hợp lệ. Hãy tạo key mới và bật YouTube Data API v3 trong Google Cloud.'
  }

  if (normalized.includes('quota') || normalized.includes('dailylimitexceeded')) {
    return 'YouTube API key đã hết quota trong ngày.'
  }

  if (normalized.includes('referer') || normalized.includes('iprefererblocked')) {
    return 'YouTube API key đang bị chặn bởi giới hạn domain/IP. Hãy bỏ giới hạn đó hoặc dùng key khác.'
  }

  if (normalized.includes('accessnotconfigured') || normalized.includes('youtube data api has not been used')) {
    return 'YouTube Data API v3 chưa được bật cho project này. Hãy bật API rồi thử lại.'
  }

  if (rawMessage) {
    return `Không kiểm tra được YouTube API key: ${rawMessage}`
  }

  return `Không kiểm tra được YouTube API key (HTTP ${response.status}).`
}

class SecureStorage {
  constructor() {
    this.keytar = null
    this.useKeytar = false
  }

  async init() {
    try {
      this.keytar = require('keytar')
      // Test if keytar works
      await this.keytar.getPassword(SERVICE_NAME, 'test')
      this.useKeytar = true
      console.log('[SecureStorage] Using OS Keychain via keytar')
    } catch (error) {
      console.log('[SecureStorage] keytar not available, using encrypted file fallback')
      this.useKeytar = false
    }
  }

  async saveApiKey(apiKey) {
    const keys = normalizeApiKeys(apiKey)
    if (!keys.length) {
      throw new Error('Bạn chưa nhập YouTube API key.')
    }

    if (keys.some((key) => !looksLikeYoutubeApiKey(key))) {
      throw new Error('YouTube API key không đúng định dạng. Key thường bắt đầu bằng AIza và dài 39 ký tự.')
    }

    const storedValue = serializeApiKeys(keys)
    if (this.useKeytar && this.keytar) {
      await this.keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, storedValue)
      console.log('[SecureStorage] API keys saved to OS Keychain')
    } else {
      const encrypted = encryptData(storedValue)
      fs.writeFileSync(getFallbackPath(), encrypted, 'utf-8')
      console.log('[SecureStorage] API keys saved to encrypted file')
    }

    applyApiKeysToEnv(keys)
  }

  async getApiKeys() {
    const envKeys = normalizeApiKeys([
      process.env.YOUTUBE_API_KEY,
      process.env.YOUTUBE_API_KEYS,
      process.env.YT_API_KEY,
      process.env.VITE_YT_API_KEY,
    ].filter(Boolean).join(','))
    if (envKeys.length) {
      applyApiKeysToEnv(envKeys)
      return envKeys
    }

    if (this.useKeytar && this.keytar) {
      const key = await this.keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      const keys = parseStoredApiKeys(key)
      if (keys.length) {
        applyApiKeysToEnv(keys)
        return keys
      }
    }

    const fallbackPath = getFallbackPath()
    if (fs.existsSync(fallbackPath)) {
      try {
        const encrypted = fs.readFileSync(fallbackPath, 'utf-8')
        const keys = parseStoredApiKeys(decryptData(encrypted))
        applyApiKeysToEnv(keys)
        return keys
      } catch (error) {
        console.error('[SecureStorage] Failed to decrypt fallback file:', error)
        return []
      }
    }

    return []
  }

  async getApiKey() {
    const keys = await this.getApiKeys()
    return keys[0] || null
  }

  async deleteApiKey() {
    if (this.useKeytar && this.keytar) {
      await this.keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    }
    
    const fallbackPath = getFallbackPath()
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath)
    }
    
    applyApiKeysToEnv([])
  }

  async validateApiKey(apiKey) {
    const normalizedKey = normalizeApiKey(apiKey)

    if (!normalizedKey) {
      return { valid: false, message: 'Bạn chưa nhập YouTube API key.' }
    }

    if (!looksLikeYoutubeApiKey(normalizedKey)) {
      return {
        valid: false,
        message: 'YouTube API key không đúng định dạng. Key thường bắt đầu bằng AIza và dài 39 ký tự.',
      }
    }

    const params = new URLSearchParams({
      key: normalizedKey,
      id: YOUTUBE_TEST_VIDEO_ID,
      part: 'status',
      maxResults: '1',
    })

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
      if (!response.ok) {
        return { valid: false, message: await readYoutubeApiErrorMessage(response) }
      }

      return {
        valid: true,
        message: 'YouTube API key hợp lệ và đã bật YouTube Data API v3.',
      }
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Không kiểm tra được YouTube API key.',
      }
    }
  }

  async validateApiKeyList(apiKeys) {
    const keys = normalizeApiKeys(apiKeys)
    if (!keys.length) {
      return { valid: false, message: 'Bạn chưa nhập YouTube API key.' }
    }

    for (const [index, key] of keys.entries()) {
      if (!looksLikeYoutubeApiKey(key)) {
        return {
          valid: false,
          message: `Key ${index + 1} không đúng định dạng. Key thường bắt đầu bằng AIza và dài 39 ký tự.`,
        }
      }
    }

    const messages = []
    let usableCount = 0
    for (const [index, key] of keys.entries()) {
      const result = await this.validateApiKey(key)
      if (result.valid) {
        usableCount += 1
        continue
      }

      const message = result.message || 'Không kiểm tra được key.'
      if (message.includes('hết quota')) {
        messages.push(`Key ${index + 1} đã hết quota hôm nay`)
        continue
      }

      return {
        valid: false,
        message: `Key ${index + 1}: ${message}`,
      }
    }

    if (usableCount <= 0) {
      return {
        valid: false,
        message: 'Tất cả YouTube API key đều đã hết quota hoặc chưa dùng được.',
      }
    }

    return {
      valid: true,
      keyCount: keys.length,
      usableCount,
      message: messages.length
        ? `Đã lưu ${keys.length} key. ${messages.join('; ')}; app sẽ ưu tiên key còn quota.`
        : `Đã kiểm tra và lưu ${keys.length} YouTube API key.`,
    }
  }

  async validateStoredApiKey() {
    const keys = await this.getApiKeys()
    if (!keys.length) {
      return { valid: false, message: 'Laptop này chưa lưu YouTube API key.' }
    }

    const messages = []
    let usableCount = 0
    for (const [index, key] of keys.entries()) {
      const result = await this.validateApiKey(key)
      if (result.valid) {
        usableCount += 1
        continue
      }

      const message = result.message || 'Không kiểm tra được key.'
      if (message.includes('hết quota')) {
        messages.push(`Key ${index + 1} đã hết quota hôm nay`)
        continue
      }

      return {
        valid: false,
        message: `Key ${index + 1}: ${message}`,
        keyCount: keys.length,
      }
    }

    if (usableCount <= 0) {
      return {
        valid: false,
        message: 'Tất cả YouTube API key đều đã hết quota hoặc chưa dùng được.',
        keyCount: keys.length,
      }
    }

    return {
      valid: true,
      message: messages.length
        ? `Có ${usableCount}/${keys.length} key còn dùng được. ${messages.join('; ')}.`
        : `Đã kiểm tra ${keys.length} YouTube API key. Tất cả đang hoạt động.`,
      keyCount: keys.length,
    }
  }

  async hasApiKey() {
    const keys = await this.getApiKeys()
    return keys.some((key) => looksLikeYoutubeApiKey(key))
  }

  async getApiKeyCount() {
    const keys = await this.getApiKeys()
    return keys.filter((key) => looksLikeYoutubeApiKey(key)).length
  }
}

module.exports = { SecureStorage, SERVICE_NAME, ACCOUNT_NAME }
