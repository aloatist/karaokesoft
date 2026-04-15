import { useEffect, useRef, useState } from 'react'
import { AppIcon } from './AppIcon'
import { clearSearchHistory, loadSearchHistory } from '../lib/searchHistory'

const QUICK_FILTERS = [
  { label: '🎵 Karaoke', value: 'karaoke' },
  { label: '🎤 Beat', value: 'beat' },
  { label: '🇻🇳 Việt', value: 'nhạc việt' },
  { label: '🇰🇷 Kpop', value: 'kpop' },
  { label: '💃 Nhảy', value: 'dance' },
  { label: '🎸 Rock', value: 'rock' },
]

type Props = {
  onSelect: (query: string) => void
  onClose: () => void
}

export function SearchHistoryDropdown({ onSelect, onClose }: Props) {
  const [history, setHistory] = useState<string[]>(() => loadSearchHistory())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const clearHistory = () => {
    clearSearchHistory()
    setHistory([])
  }

  return (
    <div className="searchHistoryDropdown" ref={ref}>
      {/* Quick filter pills */}
      <div className="searchHistorySection">
        <div className="searchHistoryLabel">Tìm nhanh</div>
        <div className="searchQuickFilters">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              className="ghost compactButton searchQuickFilterBtn"
              onClick={() => onSelect(f.value)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="searchHistorySection">
          <div className="searchHistoryLabelRow">
            <div className="searchHistoryLabel">Tìm gần đây</div>
            <button className="ghost compactButton buttonToneMuted" onClick={clearHistory} type="button" style={{ fontSize: 11 }}>
              Xoá
            </button>
          </div>
          <div className="searchHistoryList">
            {history.map((item) => (
              <button
                key={item}
                className="ghost searchHistoryItem"
                onClick={() => onSelect(item)}
                type="button"
              >
                <AppIcon name="search" className="buttonIcon" style={{ opacity: 0.5 }} />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
