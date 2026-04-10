import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  value: string
}

export function QrCodePanel({ value }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void QRCode.toDataURL(value, {
      width: 280,
      margin: 1,
      color: {
        dark: '#111218',
        light: '#f7efe9',
      },
    })
      .then((nextUrl: string) => {
        if (!alive) return
        setDataUrl(nextUrl)
        setError(null)
      })
      .catch(() => {
        if (!alive) return
        setDataUrl(null)
        setError('Không tạo được QR cho link remote.')
      })

    return () => {
      alive = false
    }
  }, [value])

  if (error) {
    return <div className="qrFallback">{error}</div>
  }

  if (!dataUrl) {
    return <div className="qrFallback">Đang tạo QR…</div>
  }

  return (
    <div className="qrPanel">
      <img className="qrImage" src={dataUrl} alt="QR code mở màn mobile remote" width={280} height={280} />
      <div className="qrHint">Quét QR bằng điện thoại để vào thẳng màn điều khiển mobile của phòng này.</div>
    </div>
  )
}
