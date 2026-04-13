import type { SVGProps } from 'react'

type IconName =
  | 'screen'
  | 'settings'
  | 'shield'
  | 'user'
  | 'login'
  | 'logout'
  | 'cloud'
  | 'search'
  | 'karaoke'
  | 'queue'
  | 'control'
  | 'play'
  | 'pause'
  | 'next'
  | 'prev'
  | 'restart'
  | 'repeat'
  | 'volume'
  | 'clear'
  | 'add'
  | 'spark'
  | 'menu'

type Props = SVGProps<SVGSVGElement> & {
  name: IconName
}

function Path({ name }: { name: IconName }) {
  switch (name) {
    case 'screen':
      return (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M12 3 19 6v5.2c0 4.1-2.8 7.9-7 9.8-4.2-1.9-7-5.7-7-9.8V6l7-3Z" />
          <path d="m9.4 12 1.8 1.8 3.6-4" />
        </>
      )
    case 'user':
      return (
        <>
          <circle cx="12" cy="8.2" r="3.2" />
          <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
        </>
      )
    case 'login':
      return (
        <>
          <path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
          <path d="M10 16l4-4-4-4" />
          <path d="M14 12H4" />
        </>
      )
    case 'logout':
      return (
        <>
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
          <path d="M14 16l4-4-4-4" />
          <path d="M20 12H10" />
        </>
      )
    case 'cloud':
      return (
        <>
          <path d="M7 18h10.2a3.8 3.8 0 0 0 .2-7.6 5.4 5.4 0 0 0-10.5-1.2A4.1 4.1 0 0 0 7 18Z" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </>
      )
    case 'karaoke':
      return (
        <>
          <path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M12 14v5" />
          <path d="M9 19h6" />
          <path d="M8 8V7a4 4 0 1 1 8 0v1" />
        </>
      )
    case 'queue':
      return (
        <>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
        </>
      )
    case 'control':
      return (
        <>
          <path d="M5 7h14" />
          <path d="M5 17h14" />
          <circle cx="9" cy="7" r="2" />
          <circle cx="15" cy="17" r="2" />
        </>
      )
    case 'play':
      return <path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none" />
    case 'pause':
      return (
        <>
          <path d="M9 7v10" />
          <path d="M15 7v10" />
        </>
      )
    case 'next':
      return (
        <>
          <path d="m7 7 7 5-7 5V7Z" fill="currentColor" stroke="none" />
          <path d="m14 7 6 5-6 5V7Z" fill="currentColor" stroke="none" />
        </>
      )
    case 'prev':
      return (
        <>
          <path d="m17 7-7 5 7 5V7Z" fill="currentColor" stroke="none" />
          <path d="m10 7-6 5 6 5V7Z" fill="currentColor" stroke="none" />
        </>
      )
    case 'restart':
      return (
        <>
          <path d="M4 12a8 8 0 1 0 2.3-5.6" />
          <path d="M4 4v4h4" />
        </>
      )
    case 'repeat':
      return (
        <>
          <path d="M17 2l3 3-3 3" />
          <path d="M20 5H9a4 4 0 0 0-4 4v1" />
          <path d="M7 22l-3-3 3-3" />
          <path d="M4 19h11a4 4 0 0 0 4-4v-1" />
        </>
      )
    case 'volume':
      return (
        <>
          <path d="M5 10h3l4-4v12l-4-4H5Z" />
          <path d="M16 9a4.5 4.5 0 0 1 0 6" />
          <path d="M18.5 6.5a8 8 0 0 1 0 11" />
        </>
      )
    case 'clear':
      return (
        <>
          <path d="m18 6-12 12" />
          <path d="m6 6 12 12" />
        </>
      )
    case 'add':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      )
    case 'spark':
      return (
        <>
          <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
          <path d="m18.5 16 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
        </>
      )
    case 'menu':
      return (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )
    default:
      return null
  }
}

export function AppIcon({ name, className, ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <Path name={name} />
    </svg>
  )
}
