import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { RISK_COLORS, RISK_LABELS } from '../utils'

const RWANDA_CENTER = [-1.95, 29.9]

const DROUGHT_STEPS = [
  { min: 5, color: '#dc2626', label: '5+ months' },
  { min: 3, color: '#fb923c', label: '3-4 months' },
  { min: 1, color: '#fde68a', label: '1-2 months' },
  { min: 0, color: '#dbeafe', label: 'None' },
]

const droughtColor = (months) => DROUGHT_STEPS.find((step) => months >= step.min).color

function colorFor(district, metric) {
  if (!district) return RISK_COLORS.no_data
  if (metric === 'risk') return RISK_COLORS[district.summary.risk_level]
  return droughtColor(district.summary.satellite_drought_months)
}

function tooltipFor(district, metric) {
  if (metric === 'risk') return `${district.name}: ${RISK_LABELS[district.summary.risk_level]}`
  return `${district.name}: ${district.summary.satellite_drought_months} drought months`
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

  const styleFor = (feature) => ({
    fillColor: colorFor(byName[feature.properties.shapeName], metric),
    fillOpacity: 0.8,
    color: '#ffffff',
    weight: 1.5,
  })

  const bindEvents = (feature, layer) => {
    const district = byName[feature.properties.shapeName]
    if (!district) return

    layer.bindTooltip(tooltipFor(district, metric))
    layer.on('click', () => onSelect(district.id))
  }

  const legend =
    metric === 'risk'
      ? Object.entries(RISK_LABELS).map(([level, label]) => ({ color: RISK_COLORS[level], label }))
      : DROUGHT_STEPS.map(({ color, label }) => ({ color, label }))

  return (
    <div className="panel">
      <MapContainer center={RWANDA_CENTER} zoom={8} className="map" scrollWheelZoom={false}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* key forces the layer to redraw when the metric or data changes */}
        <GeoJSON
          key={`${metric}-${districts.length}`}
          data={boundaries}
          style={styleFor}
          onEachFeature={bindEvents}
        />
      </MapContainer>

      <div className="legend">
        {legend.map(({ color, label }) => (
          <span key={label}>
            <i style={{ background: color }} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}
