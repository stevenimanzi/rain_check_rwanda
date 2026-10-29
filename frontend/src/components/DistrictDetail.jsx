import { useEffect, useState } from 'react'
import { fetchDistrict } from '../api'
import { monthLabel } from '../utils'
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

  return (
    <div className="panel">
      <h2>
        {district.name} <RiskBadge level={district.summary.risk_level} />
      </h2>
      <p className="muted">
        {district.province} - {district.summary.satellite_drought_months} dry months in the survey period
      </p>

      <h3>Rain compared to normal</h3>
      <p className="muted">Blue: wetter than normal. Red: a dry month (20% or more below normal). Grey: normally very dry months, not judged.</p>
      <RainDeviationChart series={district.rainfall} />

      <h3>Satellite vs household reports</h3>
      {district.months.length === 0 ? (
        <Notice title="No household survey data yet">
          Import the EICV7 drought reports for this district to see whether the satellite matches what
          households experienced.
        </Notice>
      ) : (
        <>
          <p>
            Across {district.summary.months_tested} months the satellite matched households{' '}
            {district.summary.matches} times, missed {district.summary.missed_payouts} real droughts and
            flagged {district.summary.false_payouts} droughts households did not report.
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
    </div>
  )
}
