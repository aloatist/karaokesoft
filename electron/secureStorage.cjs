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
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key')
    }

    if (this.useKeytar && this.keytar) {
      await this.keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey)
      console.log('[SecureStorage] API key saved to OS Keychain')
    } else {
      const encrypted = encryptData(apiKey)
      fs.writeFileSync(getFallbackPath(), encrypted, 'utf-8')
      console.log('[SecureStorage] API key saved to encrypted file')
    }

    // Also set env for relay server
    process.env.YOUTUBE_API_KEY = apiKey
  }

  async getApiKey() {
    // Check env first (for dev or pre-configured)
    if (process.env.YOUTUBE_API_KEY) {
      return process.env.YOUTUBE_API_KEY
    }

    if (this.useKeytar && this.keytar) {
      const key = await this.keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      if (key) {
        process.env.YOUTUBE_API_KEY = key
        return key
      }
    }

    // Fallback to encrypted file
    const fallbackPath = getFallbackPath()
    if (fs.existsSync(fallbackPath)) {
      try {
        const encrypted = fs.readFileSync(fallbackPath, 'utf-8')
        const decrypted = decryptData(encrypted)
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

  async hasApiKey() {
    const key = await this.getApiKey()
    return !!key
  }
}

module.exports = { SecureStorage, SERVICE_NAME, ACCOUNT_NAME }
