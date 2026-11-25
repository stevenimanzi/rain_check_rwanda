import { monthYear } from '../utils'
import Notice from './Notice'

/**
 * Explains why a survey cannot be compared with the satellite yet, and shows the download progress.
 * `result` comes from useSurveyComparison; `meanwhile` says what the page shows until the comparison is ready.
 */
export default function SatelliteDataNotice({ result, meanwhile }) {
  const { comparison, satellite, progress, message, retry } = result

  if (!comparison || comparison.window.complete) return null

  const period = `${monthYear(comparison.window.start, 'long')} to ${monthYear(comparison.window.end, 'long')}`

  if (satellite === 'fetching') {
    const available = progress?.available ?? 0
    const total = progress?.total ?? 12

    return (
      <Notice title="Getting satellite data for this survey's period">
        <span role="status">
          {progress ? `${available} of ${total} months ready` : 'Starting the download'} ({period}), from the official
          CHIRPS satellite maps. This can take a few minutes. {meanwhile}
        </span>
        <progress className="satellite-progress" max={total} value={available} aria-label="Satellite months ready" />
      </Notice>
    )
  }

  if (satellite === 'not_published') {
    return (
      <Notice title="Satellite data for this period is not complete yet">
        {progress.available} of {progress.total} months are available for {period}. The satellite maps are published
        about two weeks after each month ends, so open this survey again later. {meanwhile}
      </Notice>
    )
  }

  if (satellite === 'failed') {
    return (
      <Notice title="Could not get satellite data">
        {message} {meanwhile}{' '}
        <button type="button" className="notice-action" onClick={retry}>
          Try again
        </button>
      </Notice>
    )
  }

  return (
    <Notice title="No satellite rainfall for this survey's period">
      Satellite rainfall is missing for part of {period}. {meanwhile}
    </Notice>
  )
}
