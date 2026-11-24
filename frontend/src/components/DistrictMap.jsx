import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { RISK_COLORS, RISK_LABELS } from '../utils'
import ChartInfo from './ChartInfo'

const RWANDA_CENTER = [-1.95, 29.9]

// Light to dark: more drought.
const SCALE_COLORS = ['#fef3c7', '#fcd34d', '#fb923c', '#dc2626']

const VALUE_OF = {
  history: (d) => d.summary.avg_dry_months_per_year,
  drought: (d) => d.summary.satellite_drought_months,
  households: (d) => d.household_drought_pct,
}

const UNIT = {
  history: 'dry months each year',
  drought: 'dry months, Apr 2023 to Mar 2024',
  households: '% of households that reported drought',
}

/**
 * Colours for a numeric metric. When there are only a few different values each gets its own colour;
 * otherwise the districts are split into four equal groups so the colours always show differences.
 */
function buildSteps(districts, metric) {
  const values = districts.map(VALUE_OF[metric])
  const distinct = [...new Set(values)].sort((a, b) => a - b)

  if (distinct.length <= SCALE_COLORS.length) {
    const colors = distinct.map((_, i) => SCALE_COLORS[Math.round((i * (SCALE_COLORS.length - 1)) / Math.max(distinct.length - 1, 1))])
    return {
      colorFor: (value) => colors[distinct.indexOf(value)],
      legend: distinct.map((value, i) => ({ color: colors[i], label: String(value) })),
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const cuts = [0.25, 0.5, 0.75].map((q) => sorted[Math.floor(q * (sorted.length - 1))])
  const labels = [`up to ${cuts[0]}`, `${cuts[0]} to ${cuts[1]}`, `${cuts[1]} to ${cuts[2]}`, `above ${cuts[2]}`]

  return {
    colorFor: (value) => SCALE_COLORS[cuts.filter((cut) => value > cut).length],
    legend: SCALE_COLORS.map((color, i) => ({ color, label: labels[i] })),
  }
}

export default function DistrictMap({ districts, metric, onSelect }) {
  const [boundaries, setBoundaries] = useState(null)

  useEffect(() => {
    fetch('/rwanda-districts.geojson')
      .then((res) => res.json())
      .then(setBoundaries)
  }, [])

  if (!boundaries) return <div className="panel">Loading map...</div>

  const byName = Object.fromEntries(districts.map((d) => [d.name, d]))
  const steps = metric === 'risk' ? null : buildSteps(districts, metric)

  const colorOf = (district) => {
    if (!district) return RISK_COLORS.no_data
    return metric === 'risk' ? RISK_COLORS[district.summary.risk_level] : steps.colorFor(VALUE_OF[metric](district))
  }

  const tooltipOf = (district) =>
    metric === 'risk'
      ? `${district.name}: ${RISK_LABELS[district.summary.risk_level]} mismatch risk`
      : `${district.name}: ${VALUE_OF[metric](district)} ${UNIT[metric]}`

  const legend =
    metric === 'risk'
      ? ['low', 'medium', 'high'].map((level) => ({ color: RISK_COLORS[level], label: `${RISK_LABELS[level]} mismatch risk` }))
      : steps.legend

  const style = (feature) => ({
    fillColor: colorOf(byName[feature.properties.shapeName]),
    fillOpacity: 0.8,
    color: '#ffffff',
    weight: 1.5,
  })

  const bindEvents = (feature, layer) => {
    const district = byName[feature.properties.shapeName]
    if (!district) return

    layer.bindTooltip(tooltipOf(district))
    layer.on('click', () => onSelect(district.id))
  }

  return (
    <div className="panel">
      <MapContainer center={RWANDA_CENTER} zoom={8} className="map" scrollWheelZoom={false}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* key forces the layer to redraw when the metric or data changes */}
        <GeoJSON key={`${metric}-${districts.length}`} data={boundaries} style={style} onEachFeature={bindEvents} />
      </MapContainer>

      <div className="legend">
        {metric !== 'risk' && <strong>{UNIT[metric]}:</strong>}
        {legend.map(({ color, label }) => (
          <span key={label}>
            <i style={{ background: color }} /> {label}
          </span>
        ))}
      </div>

      <ChartInfo
        shows="Rwanda's 30 districts, coloured by the measure you pick in the tabs above the map."
        howToRead="Darker colour means more drought. On the first three tabs the districts are split into four equal groups, so the darkest colour is the top quarter. On the mismatch tab, green means the satellite and households agree, and red means they disagree a lot. Click a district to see its charts below the map."
        sources={['rainfall', 'boundaries', 'cfsva']}
      />
    </div>
  )
}
