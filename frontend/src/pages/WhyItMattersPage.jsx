import { SOURCES } from '../sources'

// Each fact is a published figure; `source` names where it comes from (see sources.js).
const SECTIONS = [
  {
    title: 'Rwanda today',
    facts: [
      {
        value: '27.4%',
        label: 'of Rwandans live in poverty (2023/24)',
        detail: 'Extreme poverty is 5.4%. Most poor households depend on farming and rain.',
        source: 'eicvPoverty',
      },
      {
        value: '+13 points',
        label: 'higher poverty in households receiving VUP support',
        detail: 'Poverty among Vision 2020 Umurenge Programme households is 13 percentage points above the national rate.',
        source: 'eicvBooklet',
      },
      {
        value: '~70%',
        label: 'of people experienced climate-related risks',
        detail: 'Reported from FinScope 2024 by the Governor of the National Bank of Rwanda.',
        source: 'finscopeClimate',
      },
    ],
  },
  {
    title: 'Financial inclusion: access is high, protection is not',
    facts: [
      {
        value: '92%',
        label: 'of adults use formal financial services (96% including informal)',
        detail: 'FinScope 2024. Access has nearly reached everyone.',
        source: 'finscopeInclusion',
      },
      {
        value: '27%',
        label: 'insurance uptake in 2024, up from 17% in 2020',
        detail: 'The national target is 45% by 2035, so most people are still unprotected.',
        source: 'finscopeClimate',
      },
      {
        value: '22%',
        label: 'of adults are banked, unchanged since 2020',
        detail: 'The national roadmap says the next goal is meaningful use of finance, not only access.',
        source: 'roadmap',
      },
    ],
  },
  {
    title: 'Crop insurance today',
    facts: [
      {
        value: '40%',
        label: 'of crop insurance premiums paid by government',
        detail: 'Under the National Agriculture Insurance Scheme (Tekana), running since 2019.',
        source: 'nais',
      },
      {
        value: '900,000+',
        label: 'smallholders insured against drought or excess rain in 2025',
        detail: 'One Acre Fund index insurance. Satellite-based cover is already reaching Rwandan farmers at scale.',
        source: 'oneAcreFund',
      },
      {
        value: 'Hard, but big potential',
        label: 'how the national roadmap describes agriculture insurance',
        detail: 'The National Financial Inclusion Roadmap 2025-2030 lists it as a challenge with major potential.',
        source: 'roadmap',
      },
    ],
  },
]

export default function WhyItMattersPage() {
  return (
    <>
      <div className="panel prose">
        <h3>The problem</h3>
        <p>
          A drought can wipe out a smallholder's harvest and push a family back into poverty. Insurance can
          protect them, and Rwanda is expanding it. But many crop insurance products do not check each farm.
          They pay out when <strong>satellite rainfall</strong> falls below a set level.
        </p>
        <p>
          If the satellite and the farmers disagree, a farmer can lose a harvest and get nothing, or the
          insurer pays when nothing happened. This gap is called <strong>basis risk</strong>. It erodes trust
          in insurance and makes it more expensive, which slows the national goal of more people being
          protected and financially healthy.
        </p>

        <h3>What RainCheck Rwanda does</h3>
        <ul>
          <li>Measures from satellite data when and where each of the 30 districts has dry months.</li>
          <li>
            Compares those dry months with what NISR surveyed households reported (EICV7), district by
            district, to show where satellite insurance matches reality and where it does not.
          </li>
          <li>Gives insurers, ministries and lenders a district-level view they can act on.</li>
        </ul>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="section-title">{section.title}</h3>
          <div className="facts">
            {section.facts.map((fact) => (
              <div className="fact" key={fact.label}>
                <div className="fact-value">{fact.value}</div>
                <div className="fact-label">{fact.label}</div>
                <p className="muted">{fact.detail}</p>
                <a href={SOURCES[fact.source].url} target="_blank" rel="noreferrer">
                  Source: {SOURCES[fact.source].label}
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
