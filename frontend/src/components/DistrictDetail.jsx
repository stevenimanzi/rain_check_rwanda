import { useEffect, useState } from 'react'
import { fetchDistrict } from '../api'
import { monthLabel } from '../utils'
import ChartInfo from './ChartInfo'
import DryPatternCharts from './DryPatternCharts'
import Notice from './Notice'
import RainDeviationChart from './RainDeviationChart'
import RiskBadge from './RiskBadge'

const OUTCOME_TEXT = {
  match: 'Match',
  missed_payout: 'Missed payout',
  false_payout: 'False payout',
}

export default function DistrictDetail({ districtId }) {
  const [district, setDistrict] = useState(null)

  useEffect(() => {
    fetchDistrict(districtId).then(setDistrict)
  }, [districtId])

  if (!district) return <div className="panel">Loading...</div>

  const { summary, history } = district

  return (
    <>
      <div className="panel">
        <h2>
          {district.name} <RiskBadge level={summary.risk_level} />
        </h2>
        <p className="muted">
          {district.province} - {summary.avg_dry_months_per_year} dry months a year on average (2014 to 2024),{' '}
          {summary.satellite_drought_months} in the survey period
        </p>

        <h3>Rain compared to normal</h3>
        <RainDeviationChart series={district.rainfall} />
        <ChartInfo
          shows={`How much more or less rain fell in ${district.name} each month than in a normal year, last 36 months.`}
          howToRead="Blue bars: more rain than normal. Red bars: a dry month, at least 20% below normal. Grey bars: June to August, normally very dry, so not judged."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <DryPatternCharts
        byYear={history.by_year}
        byMonth={history.by_calendar_month}
        area={district.name}
        isAverage={false}
      />

      <div className="panel">
        <h3>Satellite vs household reports</h3>
        {district.months.length === 0 ? (
          <Notice title="No household survey data yet">
            Import the NISR EICV7 drought reports for this district to see whether the satellite matches what
            households experienced.
          </Notice>
        ) : (
          <>
            <p>
              Across {summary.months_tested} months the satellite matched households {summary.matches} times,
              missed {summary.missed_payouts} real droughts and flagged {summary.false_payouts} droughts
              households did not report.
            </p>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Rainfall deficit</th>
                    <th>Households reporting drought</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {district.months.map((m) => (
                    <tr key={monthLabel(m)}>
                      <td>{monthLabel(m)}</td>
                      <td>{m.rainfall_deficit_pct}%</td>
                      <td>{m.reported_drought_pct}%</td>
                      <td>{OUTCOME_TEXT[m.outcome]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <ChartInfo
          shows="Month by month, whether the satellite and the households surveyed in this district agree there was a drought."
          howToRead="Match: both agree. Missed payout: households had a drought but the satellite did not. False payout: the satellite saw a drought but households did not."
          sources={['rainfall', 'eicv7']}
        />
      </div>
    </>
  )
}
