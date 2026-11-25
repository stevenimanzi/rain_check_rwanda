import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const PALETTE = ['#1d4f91', '#40a6df', '#f59e0b', '#16a34a', '#8b5cf6']
const RISK_COLORS = { low: '#16a34a', medium: '#d97706', high: '#dc2626' }

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
            {chart.unit}
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

  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
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
