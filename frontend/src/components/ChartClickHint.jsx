import { CursorArrowRaysIcon } from '@heroicons/react/24/outline'

/** Short prompt under a chart that tells people the chart is clickable and what they will see. */
export default function ChartClickHint({ children }) {
  return (
    <p className="chart-click-hint">
      <CursorArrowRaysIcon className="icon" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
