import { useEffect, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { RISK_COLORS, RISK_LABELS } from '../utils'
import ChartInfo from './ChartInfo'

const RWANDA_CENTER = [-1.95, 29.9]

// The first color is the lowest value and the last is the highest.
const SCALE_COLORS = ['#d5e9f6', '#78b9df', '#328dc4', '#174a86']

const VALUE_OF = {
  drought: (d) => d.summary.satellite_drought_months,
  households: (d) => d.household_drought_pct,
}

function formatLegendValue(value, metric) {
  if (metric === 'households') {
    return `${value}%`
  }

  return `${value} ${value === 1 ? 'dry month' : 'dry months'}`
}

function formatBandLabels(cuts, metric) {
  const firstLabel = `Up to ${formatLegendValue(cuts[0], metric)}`
  const middleLabels = cuts.slice(1).map((value, index) =>
    `More than ${formatLegendValue(cuts[index], metric)} to ${formatLegendValue(value, metric)}`,
  )
  const lastLabel = `More than ${formatLegendValue(cuts[cuts.length - 1], metric)}`

  return [firstLabel, ...middleLabels, lastLabel]
}

/**
 * Gives each value a color. A small number of distinct values get individual colors;
 * otherwise, values are grouped into up to four bands.
 */
function buildSteps(districts, metric) {
  const values = districts
    .map(VALUE_OF[metric])
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number)
  const distinct = [...new Set(values)].sort((a, b) => a - b)

  if (distinct.length <= SCALE_COLORS.length) {
    const colors = distinct.map((_, i) => SCALE_COLORS[Math.round((i * (SCALE_COLORS.length - 1)) / Math.max(distinct.length - 1, 1))])
    return {
      colorFor: (value) => colors[distinct.indexOf(Number(value))] ?? RISK_COLORS.no_data,
      legend: distinct.map((value, i) => ({ color: colors[i], label: formatLegendValue(value, metric) })),
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const cuts = [...new Set([0.25, 0.5, 0.75].map((q) => sorted[Math.floor(q * (sorted.length - 1))]))]
  const colorCount = cuts.length + 1
  const colors = Array.from({ length: colorCount }, (_, index) =>
    SCALE_COLORS[Math.round((index * (SCALE_COLORS.length - 1)) / (colorCount - 1))],
  )
  const bandLabels = formatBandLabels(cuts, metric)

  return {
    colorFor: (value) => colors[cuts.filter((cut) => value > cut).length],
    legend: colors.map((color, index) => ({ color, label: bandLabels[index] })),
  }
}

function FitMapToDistricts({ boundaries }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.geoJSON(boundaries).getBounds()

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 9 })
    }
  }, [boundaries, map])

  return null
}

export default function DistrictMap({ districts, metric, periodLabel }) {
  const [boundaries, setBoundaries] = useState(null)

  useEffect(() => {
    fetch('/rwanda-districts.geojson')
      .then((res) => res.json())
      .then(setBoundaries)
  }, [])

  if (!boundaries) return <div className="panel">Loading map...</div>

  const byName = Object.fromEntries(districts.map((d) => [d.name, d]))
  const steps = metric === 'risk' ? null : buildSteps(districts, metric)

  const hasNoData = metric === 'risk'
    ? districts.some((district) => district.summary.risk_level === 'no_data')
    : districts.some((district) => {
        const value = VALUE_OF[metric](district)
        return value === null || value === undefined || !Number.isFinite(Number(value))
      })

  const colorOf = (district) => {
    if (!district) return RISK_COLORS.no_data
    if (metric === 'risk') return RISK_COLORS[district.summary.risk_level] ?? RISK_COLORS.no_data

    const value = VALUE_OF[metric](district)

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return RISK_COLORS.no_data
    }

    return steps.colorFor(value)
  }

  const tooltipOf = (district) => {
    if (metric === 'risk') {
      if (district.summary.risk_level === 'no_data') {
        return `${district.name}: No household survey data`
      }

      return `${district.name}: ${RISK_LABELS[district.summary.risk_level]} mismatch risk, ${district.summary.basis_risk_pct} points`
    }

    const value = VALUE_OF[metric](district)

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return `${district.name}: No data`
    }

    return metric === 'drought'
      ? `${district.name}: ${formatLegendValue(value, metric)} during ${periodLabel}`
      : `${district.name}: ${formatLegendValue(value, metric)} of households reported drought`
  }

  const legend =
    metric === 'risk'
      ? ['low', 'medium', 'high'].map((level) => ({ color: RISK_COLORS[level], label: `${RISK_LABELS[level]} mismatch risk` }))
      : steps.legend
  const legendItems = hasNoData ? [...legend, { color: RISK_COLORS.no_data, label: 'No data' }] : legend
  const legendTitle = metric === 'drought'
    ? `Satellite dry months (${periodLabel})`
    : metric === 'households'
      ? 'Households reporting drought'
      : 'Mismatch risk'
  const legendNote = metric === 'risk'
    ? 'Green means low mismatch; red means high mismatch.'
    : legend.length === 0
      ? 'No values are available for this measure.'
      : 'Lighter shades show lower values; darker shades show higher values. The key shows exact values when there are few values, otherwise it shows up to four ranges.'
  const explanation = {
    drought: {
      shows: `The number of dry months detected by satellite in each district during ${periodLabel}.`,
      howToRead: 'A dry month has at least 20% less rain than normal. Use the color key to read the value, or hover over a district to see its exact value.',
    },
    households: {
      shows: 'The percentage of households in each district that reported drought in the CFSVA 2024 survey.',
      howToRead: 'The color key shows the percentage range for each shade. A darker shade means a higher reported share. Grey means no data. Hover over a district to see its exact value.',
    },
    risk: {
      shows: 'How far apart the satellite and household drought rankings are for each district.',
      howToRead: 'Risk is the absolute gap between the two percentile ranks: low is under 25 points, medium is 25 to under 50, and high is 50 or more. Grey means no household data. Hover over a district to read its risk.',
    },
  }[metric]

  const style = (feature) => ({
    fillColor: colorOf(byName[feature.properties.shapeName]),
    fillOpacity: 0.9,
    color: '#ffffff',
    weight: 1.5,
  })

  const bindTooltip = (feature, layer) => {
    const district = byName[feature.properties.shapeName]
    if (!district) return

    layer.bindTooltip(tooltipOf(district))
  }

  return (
    <div className="panel">
      <MapContainer center={RWANDA_CENTER} zoom={8} className="map" scrollWheelZoom={false}>
        <FitMapToDistricts boundaries={boundaries} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* key forces the layer to redraw when the metric or data changes */}
        <GeoJSON key={`${metric}-${districts.length}`} data={boundaries} style={style} onEachFeature={bindTooltip} />
      </MapContainer>

      <section className="map-legend" aria-label="Map color key">
        <div className="map-legend-heading">
          <strong>Map key: {legendTitle}</strong>
          <span>Hover over a district to read its value.</span>
        </div>
        <ul className="map-legend-items">
          {legendItems.map(({ color, label }) => (
            <li key={label}>
              <i aria-hidden="true" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
        <p className="map-legend-note">{legendNote}</p>
      </section>

      <div className="map-explanation">
        <ChartInfo
          shows={explanation.shows}
          howToRead={explanation.howToRead}
          sources={['rainfall', 'boundaries', 'cfsva']}
        />
      </div>
    </div>
  )
}
