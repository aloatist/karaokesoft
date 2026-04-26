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

function looksLikeYoutubeApiKey(value) {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(normalizeApiKey(value))
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
    const normalizedKey = normalizeApiKey(apiKey)
    if (!normalizedKey) {
      throw new Error('Bạn chưa nhập YouTube API key.')
    }

    if (!looksLikeYoutubeApiKey(normalizedKey)) {
      throw new Error('YouTube API key không đúng định dạng. Key thường bắt đầu bằng AIza và dài 39 ký tự.')
    }

    if (this.useKeytar && this.keytar) {
      await this.keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, normalizedKey)
      console.log('[SecureStorage] API key saved to OS Keychain')
    } else {
      const encrypted = encryptData(normalizedKey)
      fs.writeFileSync(getFallbackPath(), encrypted, 'utf-8')
      console.log('[SecureStorage] API key saved to encrypted file')
    }

    // Also set env for relay server
    process.env.YOUTUBE_API_KEY = normalizedKey
  }

  async getApiKey() {
    // Check env first (for dev or pre-configured)
    if (process.env.YOUTUBE_API_KEY) {
      return normalizeApiKey(process.env.YOUTUBE_API_KEY)
    }

    if (this.useKeytar && this.keytar) {
      const key = await this.keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      if (key) {
        const normalizedKey = normalizeApiKey(key)
        process.env.YOUTUBE_API_KEY = normalizedKey
        return normalizedKey
      }
    }

    // Fallback to encrypted file
    const fallbackPath = getFallbackPath()
    if (fs.existsSync(fallbackPath)) {
      try {
        const encrypted = fs.readFileSync(fallbackPath, 'utf-8')
        const decrypted = normalizeApiKey(decryptData(encrypted))
        process.env.YOUTUBE_API_KEY = decrypted
        return decrypted
      } catch (error) {
        console.error('[SecureStorage] Failed to decrypt fallback file:', error)
        return null
      }
    }

    return null
  }

  async deleteApiKey() {
    if (this.useKeytar && this.keytar) {
      await this.keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    }
    
    const fallbackPath = getFallbackPath()
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath)
    }
    
    delete process.env.YOUTUBE_API_KEY
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

  async validateStoredApiKey() {
    const key = await this.getApiKey()
    if (!key) {
      return { valid: false, message: 'Laptop này chưa lưu YouTube API key.' }
    }
    return this.validateApiKey(key)
  }

  async hasApiKey() {
    const key = await this.getApiKey()
    return looksLikeYoutubeApiKey(key)
  }
}

module.exports = { SecureStorage, SERVICE_NAME, ACCOUNT_NAME }
