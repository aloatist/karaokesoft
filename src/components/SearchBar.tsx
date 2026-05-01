import { forwardRef, useId } from 'react'
import { AppIcon } from './AppIcon'

type Props = {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  onSubmit?: () => void
  showSubmit?: boolean
  disabled?: boolean
  onFocus?: () => void
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, onClear, onSubmit, showSubmit = false, disabled = false, onFocus },
  ref,
) {
  const id = useId()

  return (
    <form
      className={`searchBar ${showSubmit ? 'searchBarWithSubmit' : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <label className="srOnly" htmlFor={id}>
        Tìm bài karaoke
      </label>
      <input
        ref={ref}
        id={id}
        className="input searchInput"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Tìm bài, ca sĩ hoặc mã YouTube…"
        autoComplete="off"
        spellCheck={false}
        aria-keyshortcuts="Control+K Meta+K /"
      />
      {value.trim() ? (
        <button className="ghost buttonWithIcon" onClick={onClear} aria-label="Xoá nội dung tìm kiếm" disabled={disabled} type="button">
          <AppIcon name="clear" className="buttonIcon" />
          <span className="buttonLabel">Xoá</span>
        </button>
      ) : null}
      {showSubmit ? (
        <button className="primary buttonToneAccent buttonWithIcon searchSubmitButton" disabled={disabled || value.trim().length < 2} type="submit">
          <AppIcon name="search" className="buttonIcon" />
          <span className="buttonLabel">Tìm</span>
        </button>
      ) : null}
    </form>
  )
})
