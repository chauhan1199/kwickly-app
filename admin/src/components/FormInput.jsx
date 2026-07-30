import React from 'react'

function FormField({ label, children, error, hint, fieldId, errorId, hintId }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label className="input-label" htmlFor={fieldId}>{label}</label>}
      {children}
      {error && <div id={errorId} style={{ fontSize: 12, color: '#EF4444', marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} role="alert">
        <span style={{ fontSize: 14 }}>⚠</span> {error}
      </div>}
      {hint && !error && <div id={hintId} style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4, fontFamily: 'var(--font-body)' }}>{hint}</div>}
    </div>
  )
}

export function TextInput({ label, value, onChange, placeholder, required, type = 'text', error, hint, disabled, maxLength, pattern, inputMode, id }) {
  const borderColor = error ? '#EF4444' : undefined
  const fieldId = id || (label ? `field-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <FormField label={label} error={error} hint={hint} fieldId={fieldId} errorId={errorId} hintId={hintId}>
      <input
        type={type}
        className="form-control"
        id={fieldId}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        style={{
          background: disabled ? 'var(--bg)' : 'var(--input-bg)',
          borderColor: borderColor,
        }}
      />
    </FormField>
  )
}

export function SelectInput({ label, value, onChange, options, required, error, hint, id }) {
  const borderColor = error ? '#EF4444' : undefined
  const fieldId = id || (label ? `field-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <FormField label={label} error={error} hint={hint} fieldId={fieldId} errorId={errorId} hintId={hintId}>
      <select
        className="form-control"
        id={fieldId}
        value={value || ''}
        onChange={onChange}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        style={{ borderColor }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FormField>
  )
}

export function TextArea({ label, value, onChange, placeholder, rows = 3, error, hint, maxLength, id }) {
  const borderColor = error ? '#EF4444' : undefined
  const fieldId = id || (label ? `field-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <FormField label={label} error={error} hint={hint} fieldId={fieldId} errorId={errorId} hintId={hintId}>
      <textarea
        className="form-control"
        id={fieldId}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        style={{ height: 'auto', padding: '10px 12px', resize: 'vertical', minHeight: 80, borderColor }}
      />
      {maxLength && <div style={{ fontSize: 10, color: 'var(--light)', textAlign: 'right', marginTop: 2 }}>{(value || '').length}/{maxLength}</div>}
    </FormField>
  )
}

export function FormRow({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {children}
    </div>
  )
}

// ─── Validation Helpers ──────────────────────────────────────────────────────
export const validators = {
  phone: (value) => {
    if (!value) return 'Phone number is required'
    const cleaned = value.replace(/[\s\-+()]/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) return 'Enter a valid 10-digit Indian mobile number starting with 6-9'
    return null
  },
  name: (value, minLength = 2) => {
    if (!value || !value.trim()) return 'Name is required'
    if (value.trim().length < minLength) return `Name must be at least ${minLength} characters`
    if (/\d/.test(value)) return 'Name should not contain numbers'
    return null
  },
  email: (value) => {
    if (!value) return null // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
    return null
  },
  required: (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) return `${fieldName} is required`
    return null
  },
  price: (value) => {
    if (!value && value !== 0) return 'Price is required'
    if (isNaN(value) || Number(value) <= 0) return 'Price must be greater than 0'
    return null
  },
  shopName: (value) => {
    if (!value || !value.trim()) return 'Shop name is required'
    if (value.trim().length < 3) return 'Shop name must be at least 3 characters'
    return null
  },
  number: (value, fieldName, min = 0) => {
    if (!value && value !== 0) return `${fieldName} is required`
    if (isNaN(value) || Number(value) < min) return `Enter a valid ${fieldName.toLowerCase()} (min: ${min})`
    return null
  },
  pincode: (value) => {
    if (!value) return 'Pincode is required'
    const cleaned = String(value).replace(/\s/g, '')
    if (!/^\d{6}$/.test(cleaned)) return 'Enter a valid 6-digit pincode'
    return null
  },
}
