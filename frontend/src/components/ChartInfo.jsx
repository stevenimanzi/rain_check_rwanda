import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { SOURCES } from '../sources'

/**
 * The explanation shown under every chart: what it shows, how to read it and where the data comes from.
 */
export default function ChartInfo({ shows, howToRead, sources = [], sourceLabel }) {
  return (
    <div className="chart-info">
      <InformationCircleIcon className="icon" />
      <dl>
        <dt>What it shows</dt>
        <dd>{shows}</dd>
        <dt>How to read it</dt>
        <dd>{howToRead}</dd>
        <dt>Where the data comes from</dt>
        <dd>
          {sourceLabel}
          {sourceLabel && sources.length > 0 && '; '}
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
