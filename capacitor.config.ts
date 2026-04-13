import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.karaokeyt.app',
  appName: 'KaraokeYT',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    path: 'android',
  },
}

export default config
