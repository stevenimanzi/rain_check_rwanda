import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchAssistantSources } from '../api'
import SourceDialog from './SourceDialog'

const PALETTE = ['#1d4f91', '#40a6df', '#f59e0b', '#16a34a', '#8b5cf6']
// low, medium and high are mismatch risk; good, fair and poor are the confidence of a prediction.
const RISK_COLORS = { low: '#16a34a', medium: '#d97706', high: '#dc2626', good: '#16a34a', fair: '#d97706', poor: '#dc2626' }

/**
 * The model writes a chart as a fenced block:
 *
 *   ```bars            (or ```columns)
 *   title: Satellite vs household score
 *   max: 100
 *   unit: %
 *   Satellite score | 48.3
 *   Household score | 48.3
 *   ```
 */
function parseChart(source) {
  const chart = { title: '', max: null, unit: '', rows: [] }

  for (const line of source.split('\n')) {
    const text = line.trim()
    if (!text) continue

    const setting = text.match(/^(title|max|unit)\s*:\s*(.*)$/i)
    if (setting) {
      const key = setting[1].toLowerCase()
      chart[key] = key === 'max' ? Number(setting[2]) || null : setting[2].trim()
      continue
    }

    const [label, raw] = text.split('|').map((part) => part.trim())
    const value = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''))
    if (label && raw !== undefined && Number.isFinite(value)) chart.rows.push({ label, value })
  }

  return chart
}

function Bars({ chart }) {
  const max = chart.max ?? Math.max(...chart.rows.map((row) => row.value), 1)

  return (
    <figure className="md-chart md-bars">
      {chart.title && <figcaption>{chart.title}</figcaption>}
      {chart.rows.map((row, index) => (
        <div className="md-bar-row" key={row.label}>
          <span className="md-bar-label">{row.label}</span>
          <span className="md-bar-track">
            <span
              className="md-bar-fill"
              style={{ width: `${Math.min(100, Math.max(2, (row.value / max) * 100))}%`, background: PALETTE[index % PALETTE.length] }}
            />
          </span>
          <span className="md-bar-value">
            {row.value}
            {/^[a-z]/i.test(chart.unit) ? ` ${chart.unit}` : chart.unit}
          </span>
        </div>
      ))}
    </figure>
  )
}

function Columns({ chart }) {
  const max = chart.max ?? Math.max(...chart.rows.map((row) => row.value), 1)

  return (
    <figure className="md-chart md-columns">
      {chart.title && <figcaption>{chart.title}</figcaption>}
      <div className="md-columns-plot">
        {chart.rows.map((row) => (
          <div className="md-column" key={row.label} title={`${row.label}: ${row.value}${chart.unit}`}>
            <span className="md-column-value">{row.value}</span>
            <span className="md-column-fill" style={{ height: `${Math.max(3, (row.value / max) * 82)}%` }} />
            <span className="md-column-label">{row.label}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

/**
 * The closing "Data from" line. The model writes it as a fenced block:
 *
 *   ```sources
 *   title: Data from
 *   rainfall | Satellite rainfall (CHIRPS v3)
 *   ```
 */
function parseSources(source) {
  const list = { title: '', items: [] }

  for (const line of source.split('\n')) {
    const text = line.trim()
    const title = text.match(/^title\s*:\s*(.*)$/i)

    if (title) {
      list.title = title[1].trim()
      continue
    }

    const [id, label] = text.split('|').map((part) => part.trim())
    if (id && label) list.items.push({ id: id.toLowerCase(), label })
  }

  return list
}

/** Clickable sources: a click loads the full details of that source and shows them in a dialog. */
function Sources({ list }) {
  const [active, setActive] = useState(null)
  const [busy, setBusy] = useState('')
  const [failed, setFailed] = useState(false)

  // Start loading the details now (the request is slow); a click then opens the dialog at once.
  useEffect(() => {
    fetchAssistantSources().catch(() => {})
  }, [])

  const open = async (id) => {
    setBusy(id)
    setFailed(false)

    try {
      const all = await fetchAssistantSources()
      if (all[id]) setActive(all[id])
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="md-sources">
      <span className="md-sources-title">{list.title || 'Data from'}:</span>
      {list.items.map((item) => (
        <button key={item.id} type="button" className="md-source-link" disabled={busy === item.id} onClick={() => open(item.id)}>
          {busy === item.id ? '...' : item.label}
        </button>
      ))}
      {failed && <span className="md-sources-error">Could not load the source details.</span>}
      {active && <SourceDialog source={active} onClose={() => setActive(null)} />}
    </div>
  )
}

/** `risk:high|High mismatch risk` becomes a colored badge. */
function Badge({ text }) {
  const [kind, label] = text.slice(5).split('|')
  const level = kind.trim().toLowerCase()

  return (
    <span className="md-badge" style={{ '--badge': RISK_COLORS[level] ?? '#5b7182' }}>
      {(label ?? kind).trim()}
    </span>
  )
}

/**
 * Models often skip the blank lines Markdown needs between blocks: a line right after a table becomes a table row
 * and "---" under a line of text turns it into a heading. This puts a blank line around every block.
 */
function normalizeMarkdown(source) {
  const out = []
  let inFence = false

  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    // A doubled marker such as "## ## Title" would show the second pair of hashes as text.
    const line = rawLine.replace(/^(\s*#{1,6})\s+#{1,6}\s+/, '$1 ')
    const text = line.trim()
    const previous = out.length ? out[out.length - 1].trim() : ''
    const isFence = text.startsWith('```')

    if (inFence) {
      out.push(line)
      if (isFence) {
        inFence = false
        out.push('')
      }
      continue
    }

    const startsBlock = isFence || /^(---+|#{1,6}\s|>|`risk:)/.test(text)
    const leavesTable = previous.startsWith('|') && text !== '' && !text.startsWith('|')

    if (previous !== '' && (startsBlock || leavesTable)) out.push('')
    if (isFence) inFence = true
    out.push(line)
    if (/^(---+|#{1,6}\s)/.test(text)) out.push('')
  }

  return out.join('\n')
}

const components = {
  // Block code is only used for the chart fences; everything else shows as plain text.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, '')
    const language = /language-(\w+)/.exec(className ?? '')?.[1]

    if (language === 'bars' || language === 'columns') {
      const chart = parseChart(text)
      if (chart.rows.length === 0) return null
      return language === 'bars' ? <Bars chart={chart} /> : <Columns chart={chart} />
    }

    if (language === 'sources') {
      const list = parseSources(text)
      return list.items.length ? <Sources list={list} /> : null
    }

    if (!language && text.startsWith('risk:')) return <Badge text={text} />

    return language ? <pre className="md-plain">{text}</pre> : <code>{text}</code>
  },
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ children }) => <span>{children}</span>,
}

/**
 * Shows an assistant reply: Markdown text with tables, colored risk badges and simple bar or column charts.
 */
export default function AssistantMarkdown({ children }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  )
}
