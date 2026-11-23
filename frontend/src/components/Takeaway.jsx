/**
 * One plain sentence above a chart that says what the chart tells us. The text is built from the
 * loaded data, so it always matches what the chart shows.
 */
export default function Takeaway({ children }) {
  if (!children) return null

  return (
    <p className="chart-takeaway">
      <strong>In short:</strong> {children}
    </p>
  )
}
