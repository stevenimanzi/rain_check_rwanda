export const formatPercent = (value) => (value === null || value === undefined ? '-' : `${value}%`)

export const monthLabel = (item) => `${item.year}-${String(item.month).padStart(2, '0')}`

// "Oct 23" style label for chart axes.
export const shortMonth = (item) =>
  new Date(item.year, item.month - 1).toLocaleString('en', { month: 'short', year: '2-digit' })

// "October 2023" style label for sentences and tooltips.
export const longMonth = (item) =>
  new Date(item.year, item.month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })

// "2025-04" -> "Apr 2025" (or "April 2025" with month = 'long')
export const monthYear = (key, month = 'short') => {
  const [year, number] = key.split('-').map(Number)

  return new Date(year, number - 1).toLocaleString('en', { month, year: 'numeric' })
}

export const RISK_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  no_data: 'No survey data',
}

export const RISK_COLORS = {
  low: '#16a34a',
  medium: '#f59e0b',
  high: '#dc2626',
  no_data: '#cbd5e1',
}

export const CHART_COLORS = {
  wet: '#00a6d6',
  skipped: '#cbd5e1',
  dry: '#dc2626',
  normal: '#f59e0b',
  rain: '#1d4f91',
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const monthShort = (month) => MONTH_NAMES[month - 1].slice(0, 3)
