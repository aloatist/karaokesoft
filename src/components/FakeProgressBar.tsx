import { useEffect, useState } from 'react'

type Props = {
  durationSeconds?: number // thời lượng ước tính (giây)
  isPlaying: boolean
  className?: string
}

// Progress bar giả lập dựa vào timer — reset khi bài mới bắt đầu
export function FakeProgressBar({ durationSeconds = 240, isPlaying, className = '' }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= durationSeconds) return prev
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying, durationSeconds])

  const percent = Math.min((elapsed / durationSeconds) * 100, 100)
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={`fakeProgress ${className}`}>
      <div className="fakeProgressTrack">
        <div className="fakeProgressFill" style={{ width: `${percent}%` }} />
        <div className="fakeProgressThumb" style={{ left: `${percent}%` }} />
      </div>
      <div className="fakeProgressTimes">
        <span>{fmtTime(elapsed)}</span>
        <span>{fmtTime(durationSeconds)}</span>
      </div>
    </div>
  )
}
