import { cloneElement } from 'react'

export default function FormField({ id, label, helperText, error, children }) {
  const helperId = helperText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-[var(--mist)]">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
      })}
      {helperText && (
        <p id={helperId} className="text-[11px] text-slate-400">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}