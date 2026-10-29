const SOURCES = [
  {
    name: 'CHIRPS v3 satellite rainfall',
    detail: 'Monthly rainfall averaged over each district (Climate Hazards Center, UC Santa Barbara).',
  },
  {
    name: 'District boundaries',
    detail: 'geoBoundaries Rwanda ADM2, 30 districts.',
  },
  {
    name: 'EICV7 2023/24 household survey',
    detail: 'Share of households reporting drought as a main shock, by district and month (NISR). Imported by CSV.',
  },
]

export default function MethodPage() {
  return (
    <div className="panel prose">
      <h3>The problem</h3>
      <p>
        Index insurance pays farmers when satellite rainfall falls below a threshold, not when a farm
        actually loses its crop. If the satellite and the farmers disagree, some farmers are not paid for
        real droughts and others are paid when nothing happened. This is called basis risk.
      </p>

      <h3>How it is measured</h3>
      <ol>
        <li>
          A month is a <strong>satellite drought</strong> when rainfall is 20% or more below the district's
          normal for that calendar month (average of the other years).
        </li>
        <li>
          A month is a <strong>reported drought</strong> when 20% or more of surveyed households in the
          district say drought was a main problem.
        </li>
        <li>
          <strong>Basis risk</strong> is the share of months where the two disagree: below 25% is low,
          25-50% medium, 50% or more high.
        </li>
      </ol>

      <h3>Data sources</h3>
      <ul>
        {SOURCES.map((source) => (
          <li key={source.name}>
            <strong>{source.name}.</strong> {source.detail}
          </li>
        ))}
      </ul>

      <h3>Importing data</h3>
      <p>From the backend folder:</p>
      <pre>
        {`php artisan raincheck:import rainfall ../data/rainfall.csv
php artisan raincheck:import reports ../data/drought_reports.csv
php artisan raincheck:import poverty ../data/poverty.csv`}
      </pre>
    </div>
  )
}
