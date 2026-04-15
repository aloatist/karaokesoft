import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.karaokeyt.app',
  appName: 'KaraokeYT',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  android: {
    path: 'android',
    allowMixedContent: true,
  },
}

export default config
