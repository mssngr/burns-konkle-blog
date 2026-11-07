// Small inputs shared by the Settings sections.
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Button, ErrorText, Input } from '@/lib/ui'

/** Whole-number input. `null` when blank. */
export function IntInput({
  value,
  onChange,
  min = 0,
  max,
  id,
  placeholder,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  id?: string
  placeholder?: string
  label?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when the value changes from outside
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text)
    if (parsed !== value) setText(value == null ? '' : String(value))
  }, [value])
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      placeholder={placeholder}
      aria-label={label}
      value={text}
      onInput={(e: Event) => {
        const raw = (e.currentTarget as HTMLInputElement).value
        setText(raw)
        onChange(raw.trim() === '' ? null : Number(raw))
      }}
    />
  )
}

/** 24-hour "HH:MM" time in 15-minute steps. */
export function ClockInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  return (
    <Input
      type="time"
      step={900}
      aria-label={label}
      value={value}
      onInput={(e: Event) =>
        onChange((e.currentTarget as HTMLInputElement).value)
      }
    />
  )
}

/** A section's card with its own heading, save button and error. */
export function Section({
  title,
  lede,
  children,
  onSave,
  busy,
  error,
  dirty,
  saveLabel = 'Save',
  footer,
}: {
  title: string
  lede?: ComponentChildren
  children: ComponentChildren
  onSave?: () => void
  busy?: boolean
  error?: unknown
  dirty?: boolean
  saveLabel?: string
  footer?: ComponentChildren
}) {
  return (
    <section class="set-section stack" aria-label={title}>
      <header class="set-section-head">
        <h2>{title}</h2>
        {lede && <div class="muted set-lede">{lede}</div>}
      </header>
      {children}
      {(onSave || footer) && (
        <div class="set-save stack">
          <ErrorText error={error} />
          <div class="actions">
            {onSave && (
              <Button
                variant="primary"
                busy={busy}
                disabled={!dirty}
                onClick={onSave}
              >
                {saveLabel}
              </Button>
            )}
            {onSave && dirty && (
              <span class="small muted">Unsaved changes</span>
            )}
            {footer}
          </div>
        </div>
      )}
    </section>
  )
}

/** Up / down / remove buttons for a list row. */
export function RowTools({
  index,
  count,
  onMove,
  onRemove,
  removeLabel = 'Remove',
  what,
}: {
  index: number
  count: number
  onMove: (d: number) => void
  onRemove?: () => void
  removeLabel?: string
  what: string
}) {
  return (
    <div class="row set-tools">
      <Button
        size="sm"
        variant="ghost"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Move ${what} up`}
      >
        Up
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        aria-label={`Move ${what} down`}
      >
        Down
      </Button>
      {onRemove && (
        <Button
          size="sm"
          variant="danger"
          onClick={onRemove}
          aria-label={`${removeLabel} ${what}`}
        >
          {removeLabel}
        </Button>
      )}
    </div>
  )
}
