import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { SOURCES } from '../sources'

/**
 * The explanation shown under every chart: what it shows, how to read it, how the numbers are
 * calculated (in plain steps), and where the data comes from.
 * `calculation` is a list of short steps; `example` is an optional worked example in one sentence.
 */
export default function ChartInfo({ shows, howToRead, calculation, example, sources }) {
  return (
    <div className="chart-info">
      <InformationCircleIcon className="icon" />
      <dl>
        <dt>What it shows</dt>
        <dd>{shows}</dd>
        <dt>How to read it</dt>
        <dd>{howToRead}</dd>
        {calculation && (
          <>
            <dt>How it is calculated</dt>
            <dd>
              <ol className="calc-steps">
                {calculation.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {example && (
                <p className="calc-example">
                  <strong>Example:</strong> {example}
                </p>
              )}
            </dd>
          </>
        )}
        <dt>Where the data comes from</dt>
        <dd>
          {sources.map((key, index) => (
            <span key={key}>
              {index > 0 && '; '}
              <a href={SOURCES[key].url} target="_blank" rel="noreferrer">
                {SOURCES[key].label}
              </a>
            </span>
          ))}
        </dd>
      </dl>
    </div>
  )
}
