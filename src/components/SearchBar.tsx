import { forwardRef, useId } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  disabled?: boolean
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, onClear, disabled = false },
  ref,
) {
  const id = useId()

  return (
    <div className="searchBar">
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
        placeholder="Tìm bài, ca sĩ hoặc mã YouTube…"
        autoComplete="off"
        spellCheck={false}
        aria-keyshortcuts="Control+K Meta+K /"
      />
      {value.trim() ? (
        <button className="ghost" onClick={onClear} aria-label="Xoá nội dung tìm kiếm" disabled={disabled} type="button">
          Xoá
        </button>
      ) : null}
    </div>
  )
})
