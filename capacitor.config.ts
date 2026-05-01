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
  ios: {
    path: 'ios',
  },
  plugins: {
    // Chromecast plugin configuration
    GoogleCast: {
      receiverApplicationId: 'CC1AD845', // Default Media Receiver
    },
  },
}

export default config
