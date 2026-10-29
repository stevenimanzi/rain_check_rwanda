import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { RISK_COLORS, RISK_LABELS } from '../utils'
import ChartInfo from './ChartInfo'

const RWANDA_CENTER = [-1.95, 29.9]

// Light to dark red: more dry months.
const SCALE_COLORS = ['#fef3c7', '#fcd34d', '#fb923c', '#dc2626']

const VALUE_OF = {
  history: (d) => d.summary.avg_dry_months_per_year,
  drought: (d) => d.summary.satellite_drought_months,
}

const UNIT = {
  history: 'dry months a year',
  drought: 'dry months in the survey period',
}

/**
 * Splits the districts' values into four equal groups so the colours always show differences.
 */
function buildSteps(districts, metric) {
  const values = districts.map(VALUE_OF[metric]).sort((a, b) => a - b)
  const cuts = [0.25, 0.5, 0.75].map((q) => values[Math.floor(q * (values.length - 1))])
  const colorFor = (value) => SCALE_COLORS[cuts.filter((cut) => value > cut).length]

  const labels = [`up to ${cuts[0]}`, `${cuts[0]} to ${cuts[1]}`, `${cuts[1]} to ${cuts[2]}`, `above ${cuts[2]}`]
  return { colorFor, legend: SCALE_COLORS.map((color, i) => ({ color, label: labels[i] })) }
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
      ? `${district.name}: ${RISK_LABELS[district.summary.risk_level]}`
      : `${district.name}: ${VALUE_OF[metric](district)} ${UNIT[metric]}`

  const legend =
    metric === 'risk'
      ? Object.entries(RISK_LABELS).map(([level, label]) => ({ color: RISK_COLORS[level], label }))
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
        {legend.map(({ color, label }) => (
          <span key={label}>
            <i style={{ background: color }} /> {label}
          </span>
        ))}
      </div>

      <ChartInfo
        shows="Rwanda's 30 districts coloured by drought risk or basis risk, depending on the tab selected."
        howToRead="Darker red means more dry months. On the long-term and survey-period tabs the colours split the districts into four equal groups, so the darkest districts are the top quarter. Click a district for its charts. Grey on the basis risk tab means no household survey data yet."
        sources={['rainfall', 'boundaries', 'eicv7']}
      />
    </div>
  )
}
