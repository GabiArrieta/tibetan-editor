import React from 'react'

interface NumberInputProps {
  label: string
  value: number
  onChange(value: number): void
  min?: number
  max?: number
  step?: number
  unit?: string
  className?: string
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  className = '',
}: NumberInputProps) {
  return (
    <label className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
        />
        {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
      </div>
    </label>
  )
}
