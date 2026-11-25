import { formatPercent, longMonth, MONTH_NAMES } from '../utils'
import RiskBadge from './RiskBadge'

/**
 * Builders for the tables shown when a chart segment is clicked.
 */

// ---- districts -------------------------------------------------------------------------------------------------

export const districtColumns = (districts, period) => {
  const hasSummary = districts.some((district) => district.summary)

  return [
    { key: 'name', label: 'District' },
    { key: 'province', label: 'Province' },
    { key: 'household', label: 'Households that reported drought' },
    ...(hasSummary
      ? [
          { key: 'dry', label: period ? `Dry months, ${period}` : 'Dry months in the survey period' },
          { key: 'avg', label: 'Dry months each year' },
          { key: 'gap', label: 'Gap with households' },
          { key: 'risk', label: 'Mismatch risk' },
        ]
      : []),
  ]
}

export const districtRow = (district, highlight = false) => ({
  id: district.id ?? district.name,
  highlight,
  cells: {
    name: district.name,
    province: district.province ?? '-',
    household: formatPercent(district.household_drought_pct),
    dry: district.summary?.satellite_drought_months ?? '-',
    avg: district.summary?.avg_dry_months_per_year ?? '-',
    gap: district.summary?.basis_risk_pct != null ? `${district.summary.basis_risk_pct} points` : '-',
    risk: district.summary?.risk_level ? <RiskBadge level={district.summary.risk_level} /> : '-',
  },
})

const byName = (a, b) => a.name.localeCompare(b.name)

/**
 * Table of every district with `isHighlighted` rows marked; optionally a first tab with only those rows.
 */
export const districtTabs = ({ districts, period, isHighlighted, focusLabel, focusSort }) => {
  const columns = districtColumns(districts, period)
  const focus = districts.filter(isHighlighted)
  const sortedFocus = focusSort ? [...focus].sort(focusSort) : [...focus].sort(byName)

  return [
    { id: 'focus', label: focusLabel, columns, rows: sortedFocus.map((district) => districtRow(district, true)) },
    {
      id: 'all',
      label: 'All districts',
      columns,
      rows: [...districts].sort(byName).map((district) => districtRow(district, isHighlighted(district))),
    },
  ]
}

// ---- months ----------------------------------------------------------------------------------------------------

export const monthColumns = (labelHeader = 'Month') => [
  { key: 'label', label: labelHeader },
  { key: 'rainfall', label: 'Rainfall' },
  { key: 'normal', label: 'Normal rainfall' },
  { key: 'change', label: 'Compared with normal' },
  { key: 'status', label: 'Status' },
]

const changeText = (rainfall, normal) => {
  if (!normal) return '-'
  const change = ((rainfall - normal) / normal) * 100

  return `${Math.abs(change).toFixed(1)}% ${change >= 0 ? 'above' : 'below'}`
}

const statusText = (month) =>
  !month.judged ? 'Not assessed (normally very dry)' : month.satellite_drought ? 'Drought month' : 'Not drought'

/** A row for one month of the satellite rainfall series ({ year, month, rainfall_mm, normal_mm, judged, satellite_drought }). */
export const monthRow = (month, { label, highlight = false } = {}) => ({
  id: `${month.year}-${month.month}`,
  highlight,
  cells: {
    label: label ?? longMonth(month),
    rainfall: `${Number(month.rainfall_mm).toFixed(1)} mm`,
    normal: `${Number(month.normal_mm).toFixed(1)} mm`,
    change: changeText(Number(month.rainfall_mm), Number(month.normal_mm)),
    status: statusText(month),
  },
})

export { MONTH_NAMES }
