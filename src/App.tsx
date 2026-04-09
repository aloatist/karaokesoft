import { ControlScreen } from './screens/ControlScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { useEffect } from 'react'
import { useSettingsStore } from './store/settingsStore'

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const screen = params.get('screen') ?? 'control'

  const theme = useSettingsStore((s) => s.theme)
  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
  }, [theme])

  return screen === 'display' ? <DisplayScreen /> : <ControlScreen />
}
