/**
 * A titled group of charts on the Overview page, so each chart is read in the context of its section.
 * `tag` says what level the charts in the section show (all districts combined, or one bar per district).
 */
export default function ChartSection({ number, title, description, tag, children }) {
  return (
    <section className="chart-section" aria-label={title}>
      <header className="chart-section-header">
        <span className="chart-section-number" aria-hidden="true">
          {number}
        </span>
        <div>
          <h2>
            {title}
            {tag && <span className="chart-section-tag">{tag}</span>}
          </h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}
