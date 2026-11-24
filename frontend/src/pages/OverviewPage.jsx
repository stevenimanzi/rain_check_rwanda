import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { fetchDistrictRainfall, fetchHouseholdSurveyImports } from '../api'
import ChartInfo from '../components/ChartInfo'
import CountryDroughtCharts from '../components/CountryDroughtCharts'
import DryMonthsChart from '../components/DryMonthsChart'
import DryPatternCharts from '../components/DryPatternCharts'
import GapChart from '../components/GapChart'
import HouseholdSurveyImportPanel from '../components/HouseholdSurveyImportPanel'
import Notice from '../components/Notice'
import RainDeviationChart from '../components/RainDeviationChart'
import StatCard from '../components/StatCard'
import { CHART_COLORS, RISK_LABELS } from '../utils'

const matchText = (value) => {
  if (value === null) return ''
  const strength = Math.abs(value) < 0.3 ? 'only a little' : Math.abs(value) < 0.6 ? 'fairly well' : 'very well'
  return `Overall, the satellite and households match ${strength} (match score ${value}, where 1 is a perfect match and 0 is no match).`
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

const calendarMonthShares = (series) =>
  Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const judged = series.filter((item) => item.month === month && item.judged)

    return {
      month,
      dry_pct: judged.length
        ? Math.round((judged.filter((item) => item.satellite_drought).length / judged.length) * 1000) / 10
        : null,
    }
  })

const aggregateRainfall = (districtDetails, settings) => {
  const grouped = new Map()

  districtDetails.forEach((district) => {
    district.rainfall.forEach((month) => {
      const key = `${month.year}-${month.month}`
      const group = grouped.get(key) ?? { year: month.year, month: month.month, rainfall: [], normal: [] }
      group.rainfall.push(Number(month.rainfall_mm))
      group.normal.push(Number(month.normal_mm))
      grouped.set(key, group)
    })
  })

  return [...grouped.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((group) => {
      const rainfall = average(group.rainfall)
      const normal = average(group.normal)
      const rainfallDeficit = normal > 0 ? ((normal - rainfall) / normal) * 100 : 0
      const judged = normal >= settings.minimum_normal_mm

      return {
        year: group.year,
        month: group.month,
        rainfall_mm: rainfall,
        normal_mm: normal,
        rainfall_deficit_pct: rainfallDeficit,
        judged,
        satellite_drought: judged && rainfallDeficit >= settings.rainfall_deficit_threshold,
      }
    })
}

const aggregateYearlyHistory = (districtDetails) => {
  const grouped = new Map()

  districtDetails.forEach((district) => {
    district.history.by_year.forEach((row) => {
      const group = grouped.get(row.year) ?? { year: row.year, dryMonths: [] }
      group.dryMonths.push(Number(row.dry_months))
      grouped.set(row.year, group)
    })
  })

  return [...grouped.values()]
    .sort((a, b) => a.year - b.year)
    .map((group) => ({
      year: group.year,
      dry_months: Math.round(average(group.dryMonths) * 10) / 10,
    }))
}

function DistrictMultiSelect({ districts, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const allSelected = selectedIds === null
  const selectedCount = allSelected ? districts.length : selectedIds.length
  const summary = allSelected
    ? 'All districts'
    : selectedIds.length === 0
      ? 'No districts selected'
      : selectedIds.length === 1
        ? districts.find((district) => district.id === selectedIds[0])?.name ?? '1 district selected'
        : `${selectedIds.length} districts selected`

  useEffect(() => {
    const dismiss = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  const toggle = (id) => {
    const activeIds = allSelected ? districts.map((district) => district.id) : selectedIds
    const next = activeIds.includes(id) ? activeIds.filter((selectedId) => selectedId !== id) : [...activeIds, id]
    onChange(next.length === districts.length ? null : next)
  }

  const visibleDistricts = districts.filter((district) =>
    district.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="filter-field district-filter">
      <span>Districts</span>
      <div className="district-picker" ref={ref}>
        <button type="button" className="district-picker-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <span className="district-picker-summary">{summary}</span>
          <span className="district-picker-count">{selectedCount}/{districts.length}</span>
          <ChevronDownIcon className={`custom-select-chevron ${open ? 'open' : ''}`} />
        </button>
        {open && (
          <div className="district-picker-options" role="group" aria-label="Select districts">
            <div className="district-picker-search">
              <MagnifyingGlassIcon className="icon" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search districts" autoFocus />
            </div>
            <div className="district-picker-actions">
              <span>{selectedCount} of {districts.length} selected</span>
              <div className="district-picker-action-buttons">
                <button type="button" className="district-picker-all" disabled={allSelected} onClick={() => onChange(null)}>Select all</button>
                <button type="button" className="district-picker-clear" disabled={selectedCount === 0} onClick={() => onChange([])}>Clear</button>
              </div>
            </div>
            <div className="district-picker-list">
              {visibleDistricts.map((district) => (
                <label key={district.id}>
                  <input
                    type="checkbox"
                    checked={allSelected || selectedIds.includes(district.id)}
                    onChange={() => toggle(district.id)}
                  />
                  <span>{district.name}</span>
                </label>
              ))}
              {visibleDistricts.length === 0 && <div className="district-picker-empty">No districts found</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CustomSelect({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = options.find((option) => String(option.value) === String(value))

  useEffect(() => {
    const dismiss = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <div className={`filter-field ${className}`}>
      <span>{label}</span>
      <div className="custom-select" ref={ref}>
        <button type="button" className="custom-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <span>{active?.label ?? ''}</span>
          <ChevronDownIcon className={`custom-select-chevron ${open ? 'open' : ''}`} />
        </button>
        {open && (
          <div className="custom-select-menu" role="listbox">
            {options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={String(option.value) === String(value)}
                key={option.value}
                className={`custom-select-option ${String(option.value) === String(value) ? 'active' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OverviewPage({ districts, overview }) {
  const { national, by_year: countryByYear, rank_correlation: matchScore } = overview
  const [surveyImports, setSurveyImports] = useState([])
  const [surveyImportsError, setSurveyImportsError] = useState(null)
  const [selectedImportId, setSelectedImportId] = useState('')
  const [surveyView, setSurveyView] = useState('merged')
  const [importFormOpen, setImportFormOpen] = useState(false)
  const [importAccessToken, setImportAccessToken] = useState('')
  const importDialogRef = useRef(null)
  const rainfallYears = [...new Set(national.map((month) => month.year))].sort((a, b) => a - b)
  const availableYears = [...new Set([
    ...national.map((month) => month.year),
    ...surveyImports.map((surveyImport) => Number(surveyImport.survey_year)),
  ])].sort((a, b) => a - b)
  const yearOptions = rainfallYears.length ? rainfallYears : availableYears
  const [selectedYears, setSelectedYears] = useState(null)
  const defaultStartYear = yearOptions[0]
  const defaultEndYear = yearOptions[yearOptions.length - 1]
  const startYear = selectedYears?.start ?? defaultStartYear
  const endYear = selectedYears?.end ?? defaultEndYear
  const [selectedDistrictIds, setSelectedDistrictIds] = useState(null)
  const [districtRainfall, setDistrictRainfall] = useState({})
  const [districtError, setDistrictError] = useState(null)

  useEffect(() => {
    let active = true
    fetchHouseholdSurveyImports()
      .then((imports) => {
        if (active) setSurveyImports(imports)
      })
      .catch((error) => {
        if (active) setSurveyImportsError(error.response?.data?.message || error.message)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (selectedDistrictIds === null || selectedDistrictIds.length === 0) return undefined

    let active = true
    const controller = new AbortController()
    const missingIds = selectedDistrictIds.filter((id) => districtRainfall[id] === undefined)
    if (missingIds.length === 0) return undefined

    const timer = setTimeout(() => {
      fetchDistrictRainfall(missingIds, controller.signal)
        .then((details) => {
          if (active) {
            setDistrictRainfall((current) => ({
              ...current,
              ...Object.fromEntries(details.map(({ id, rainfall }) => [id, rainfall])),
            }))
          }
        })
        .catch((error) => {
          if (active) setDistrictError(error.message || 'The selected district data could not be loaded.')
        })
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [selectedDistrictIds, districtRainfall])

  useEffect(() => {
    const dialog = importDialogRef.current
    if (importFormOpen && dialog && !dialog.open) dialog.showModal()
  }, [importFormOpen])

  const selectedImport =
    surveyImports.find((surveyImport) => String(surveyImport.id) === selectedImportId) ?? surveyImports[0] ?? null
  const selectedDistrictIdList = selectedDistrictIds ?? []
  const selectedIds = new Set(selectedDistrictIdList)
  const activeDistricts = selectedDistrictIds !== null
    ? districts.filter((district) => selectedIds.has(district.id))
    : districts
  const selectedDistrictDetails = selectedDistrictIdList
    .map((id) => {
      const district = districts.find((item) => item.id === id)
      const rainfall = districtRainfall[id]

      return district && rainfall ? { ...district, rainfall } : null
    })
    .filter((district) => district !== null)
  const selectedDistrictReady =
    selectedDistrictIds === null ||
    (selectedDistrictIdList.length > 0 && selectedDistrictDetails.length === selectedDistrictIdList.length)
  const districtLoading =
    selectedDistrictIds !== null && selectedDistrictIdList.length > 0 && !districtError && !selectedDistrictReady
  const districtCount = activeDistricts.length
  const isAllDistricts = selectedDistrictIds === null
  const noDistrictsSelected = selectedDistrictIds !== null && selectedDistrictIdList.length === 0
  const isSingleDistrict = selectedDistrictIdList.length === 1
  const singleDistrict = isSingleDistrict ? activeDistricts[0] : null
  const area = isAllDistricts
    ? 'Rwanda'
    : isSingleDistrict
      ? singleDistrict?.name ?? 'Selected district'
      : `${districtCount} selected districts`
  const rainfallSeries = isAllDistricts
    ? national
    : isSingleDistrict
      ? selectedDistrictDetails[0]?.rainfall ?? []
      : aggregateRainfall(selectedDistrictDetails, overview.settings)
  const filteredSeries = rainfallSeries.filter((month) => month.year >= startYear && month.year <= endYear)
  const assessedMonths = filteredSeries.filter((month) => month.judged)
  const dryMonths = assessedMonths.filter((month) => month.satellite_drought).length
  const byYearSource = isAllDistricts
    ? countryByYear
    : isSingleDistrict
      ? selectedDistrictDetails[0]?.history.by_year ?? []
      : aggregateYearlyHistory(selectedDistrictDetails)
  const byYear = byYearSource.filter((row) => row.year >= startYear && row.year <= endYear)
  const byMonth = calendarMonthShares(filteredSeries)
  const driestYear = [...byYear].sort((a, b) => b.dry_months - a.dry_months)[0]
  const highRisk = activeDistricts.filter((district) => district.summary.risk_level === 'high').length
  const periodLabel = startYear === endYear ? String(startYear) : `${startYear} to ${endYear}`
  const mismatchValue = isSingleDistrict
    ? RISK_LABELS[singleDistrict.summary.risk_level] ?? 'No survey data'
    : `${highRisk} of ${districtCount}`
  const mismatchLabel = isSingleDistrict ? 'Mismatch risk (2024 survey)' : 'High-mismatch districts'
  const filteredDistricts = activeDistricts.map((district) => {
    const years = district.history.by_year.filter((row) => row.year >= startYear && row.year <= endYear)

    return {
      ...district,
      filtered_avg_dry_months: years.length ? Math.round(average(years.map((row) => row.dry_months)) * 10) / 10 : null,
    }
  })
  const importValues = new Map(
    (selectedImport?.observations ?? []).map((observation) => [
      Number(observation.district_id),
      Number(observation.household_drought_pct),
    ]),
  )
  const householdChartDistricts = activeDistricts
    .map((district) => {
      const hasImportedValue = importValues.has(district.id)
      const householdValue = surveyView === 'imported'
        ? hasImportedValue ? importValues.get(district.id) : null
        : hasImportedValue ? importValues.get(district.id) : district.household_drought_pct

      return {
        ...district,
        household_drought_pct: householdValue,
        household_source: hasImportedValue ? `${selectedImport.source_name} (${selectedImport.survey_year})` : 'CFSVA 2024',
      }
    })
    .filter((district) => district.household_drought_pct !== null && district.household_drought_pct !== undefined)
  const householdSurveyLabel = surveyView === 'imported'
    ? selectedImport
      ? `${selectedImport.source_name} (${selectedImport.survey_year}), imported only`
      : 'Imported survey only'
    : selectedImport
      ? `${selectedImport.source_name} (${selectedImport.survey_year}) with CFSVA 2024 fallback`
      : 'CFSVA 2024'
  const householdSurveyNote = surveyView === 'imported'
    ? selectedImport
      ? isSingleDistrict
        ? `Selected district value source: ${householdChartDistricts[0]?.household_source ?? 'no value in this upload'}.`
        : `Imported survey: ${selectedImport.source_name}, ${selectedImport.survey_year}. Districts absent from this upload have no value.`
      : 'Upload a survey to view imported-only data.'
    : selectedImport
      ? isSingleDistrict
        ? `Selected district value source: ${householdChartDistricts[0]?.household_source ?? 'no value available'}.`
        : `${selectedImport.source_name} (${selectedImport.survey_year}) values are used where available; missing districts use CFSVA 2024. The summary is an unweighted district average across the available values, not a single-survey national estimate.`
      : 'Household reports cover April 2023 to March 2024.'
  const includeCfsvaSource = surveyView === 'merged'

  const handleSurveyImport = (imported) => {
    setSurveyImports((current) => [imported, ...current.filter((item) => item.id !== imported.id)])
    setSelectedImportId(String(imported.id))
    setSurveyImportsError(null)
  }

  const filters = (
    <section className="overview-filters" aria-label="Overview filters">
      <div className="overview-filter-heading">
        <div>
          <h2>Explore by year and district</h2>
          <p>Choose a rainfall period and districts to update the dashboard.</p>
        </div>
        <div className="overview-filter-range">
          <CalendarDaysIcon className="icon" aria-hidden="true" />
          <span>Showing {startYear} - {endYear}</span>
        </div>
      </div>

      <div className="overview-filter-controls">
        <div className="overview-filter-years" role="group" aria-label="Rainfall year range">
          <CustomSelect
            label="From year"
            value={startYear}
            className="overview-year-filter"
            options={yearOptions.map((year) => ({ value: year, label: String(year) }))}
            onChange={(year) => {
              setSelectedYears((current) => {
                const currentEnd = current?.end ?? defaultEndYear
                return { start: Number(year), end: Number(year) > currentEnd ? Number(year) : currentEnd }
              })
            }}
          />

          <CustomSelect
            label="To year"
            value={endYear}
            className="overview-year-filter"
            options={yearOptions.map((year) => ({ value: year, label: String(year) }))}
            onChange={(year) => {
              setSelectedYears((current) => {
                const currentStart = current?.start ?? defaultStartYear
                return { start: Number(year) < currentStart ? Number(year) : currentStart, end: Number(year) }
              })
            }}
          />
        </div>

        <DistrictMultiSelect
          districts={districts}
          selectedIds={selectedDistrictIds}
          onChange={(ids) => {
            setSelectedDistrictIds(ids)
            setDistrictError(null)
          }}
        />

        <div className="overview-filter-actions">
          <button
            type="button"
            className="survey-import-toggle"
            aria-expanded={importFormOpen}
            aria-haspopup="dialog"
            onClick={() => setImportFormOpen(true)}
          >
            <ArrowUpTrayIcon className="icon" />
            Import survey data
          </button>
          {surveyImports.length > 0 && (
            <>
              <CustomSelect
                label="Household survey view"
                className="survey-view-filter"
                value={surveyView}
                options={[
                  { value: 'merged', label: 'Merge with CFSVA 2024' },
                  { value: 'imported', label: 'Imported data only' },
                ]}
                onChange={setSurveyView}
              />
              <CustomSelect
                label="Survey upload"
                className="survey-source-select"
                value={selectedImport?.id ?? ''}
                options={surveyImports.map((surveyImport) => ({
                  value: surveyImport.id,
                  label: `${surveyImport.source_name} (${surveyImport.survey_year})`,
                }))}
                onChange={setSelectedImportId}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )

  return (
    <>
      <p className="intro">
        A dry month is a month with at least 20% less rain than normal. This page compares satellite rainfall with what
        households told NISR about drought.
      </p>

      {filters}

      {importFormOpen && (
        <dialog
          ref={importDialogRef}
          className="survey-import-dialog"
          aria-labelledby="survey-import-title"
          onCancel={(event) => {
            event.preventDefault()
            setImportFormOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setImportFormOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setImportFormOpen(false)
          }}
        >
          <button
            type="button"
            className="survey-import-close"
            aria-label="Close import dialog"
            onClick={() => setImportFormOpen(false)}
          >
            <XMarkIcon className="icon" />
          </button>
          <HouseholdSurveyImportPanel
            districts={districts}
            accessToken={importAccessToken}
            onImported={handleSurveyImport}
            onLogin={setImportAccessToken}
            onLogout={() => setImportAccessToken('')}
          />
        </dialog>
      )}

      {surveyImportsError && (
        <Notice title="Could not load imported survey data">
          {surveyImportsError} Existing CFSVA comparisons remain available; uploaded survey choices may be incomplete.
        </Notice>
      )}
      {noDistrictsSelected && (
        <Notice title="No districts selected">
          Select one or more districts, or choose Select all districts to view the dashboard.
        </Notice>
      )}
      {districtLoading && <div className="panel" role="status">Loading {area} data...</div>}
      {districtError && (
        <Notice title="Could not load district data">
          {districtError} Change the district selection or choose all districts to continue.
        </Notice>
      )}

      {selectedDistrictReady && (
        <>
          <div className="stats">
            <StatCard
              label={isAllDistricts ? 'Districts covered' : isSingleDistrict ? 'Selected district' : 'Selected districts'}
              value={isAllDistricts ? districts.length : isSingleDistrict ? singleDistrict.name : districtCount}
              hint={isAllDistricts ? 'All 30 districts of Rwanda' : isSingleDistrict ? singleDistrict.province : 'District charts show each selection separately'}
            />
            <StatCard
              label={`Dry months in ${area}`}
              value={dryMonths}
              hint={`${assessedMonths.length} assessable months, ${periodLabel}`}
            />
            <StatCard
              label={`Driest year, ${periodLabel}`}
              value={driestYear?.year ?? '-'}
              hint={
                driestYear
                  ? isSingleDistrict
                    ? `${driestYear.dry_months} dry months in ${area}`
                    : `Average ${driestYear.dry_months} dry months across ${districtCount} districts`
                  : 'No rainfall data for this period'
              }
            />
            <StatCard label={mismatchLabel} value={mismatchValue} hint="Household survey comparison: Apr 2023 to Mar 2024" />
          </div>

          <CountryDroughtCharts
            districts={householdChartDistricts}
            series={filteredSeries}
            startYear={startYear}
            endYear={endYear}
            area={area}
            isAllDistricts={isAllDistricts}
            isSingleDistrict={isSingleDistrict}
            districtCount={districtCount}
            householdSurveyLabel={householdSurveyLabel}
            householdSurveyNote={householdSurveyNote}
            householdSourceName={selectedImport?.source_name}
            includeCfsvaSource={includeCfsvaSource}
          />

          <div className="panel">
            <h3>{isAllDistricts ? 'Where the satellite and households disagree' : `Satellite and households in ${area}`}</h3>
            <p className="muted">
              This comparison uses the 2024 household survey period, regardless of the selected satellite years.
              Red: households reported more drought; blue: satellite rainfall indicated more drought.
            </p>
            <GapChart districts={activeDistricts} />
            <ChartInfo
              shows={`Each district is ranked on satellite dry months and households reporting drought for Apr 2023 to Mar 2024. The bar is the difference between those ranks. ${
                isSingleDistrict
                  ? `The selected district's mismatch risk is ${mismatchValue}.`
                  : isAllDistricts
                    ? matchText(matchScore)
                    : `The ${districtCount} selected districts are shown separately. ${highRisk} have high mismatch risk.`
              }`}
              howToRead="A short bar means the two agree. A long red bar means households reported drought that the satellite missed; a long blue bar means satellite rainfall indicated drought that fewer households reported."
              sources={['rainfall', 'cfsva']}
            />
          </div>

          <div className="panel">
            <h3>Was each month wetter or drier than normal?</h3>
            <p className="muted">
              {isSingleDistrict
                ? area
                : `Average rainfall across ${districtCount} ${isAllDistricts ? 'districts' : 'selected districts'}`}, {periodLabel}
              {startYear === endYear ? '.' : '; monthly averages grouped by calendar month.'}
            </p>
            <RainDeviationChart series={filteredSeries} maxMonths={filteredSeries.length} />
            <ChartInfo
              shows={`Monthly rainfall compared with normal rainfall for ${isSingleDistrict ? area : `${districtCount} districts`}, ${periodLabel}.`}
              howToRead="Each month has two bars: rainfall and the normal amount. For a multi-year range, each bar is the average for that calendar month. Red rainfall bars are at least 20% below normal; grey bars are normally very dry and are not assessed."
              sources={['rainfall', 'boundaries']}
            />
          </div>

          <DryPatternCharts
            byYear={byYear}
            byMonth={byMonth}
            area={area}
            isAverage={!isSingleDistrict}
            averageDistrictCount={districtCount}
            isAllDistricts={isAllDistricts}
            startYear={startYear}
            endYear={endYear}
          />

          <div className="grid-2 even">
            <div className="panel">
              <h3>Dry months seen by the satellite</h3>
              <p className="muted">
                {isAllDistricts ? 'All 30 districts' : area}, April 2023 to March 2024.
              </p>
              <DryMonthsChart
                districts={activeDistricts}
                getValue={(district) => district.summary.satellite_drought_months}
                unit="dry months"
                color={CHART_COLORS.dry}
              />
              <ChartInfo
                shows="How many months had at least 20% less rain than normal in the 12 months before the April 2024 survey."
                howToRead="A longer bar means more dry months. This comparison stays on the survey period so it can be compared with household reports."
                sources={['rainfall', 'boundaries']}
              />
            </div>

            <div className="panel">
              <h3>Households that reported drought</h3>
              <p className="muted">{householdSurveyLabel}.</p>
              {householdChartDistricts.length ? (
                <DryMonthsChart
                  districts={householdChartDistricts}
                  getValue={(district) => district.household_drought_pct}
                  unit="% of households"
                  color={CHART_COLORS.normal}
                />
              ) : (
                <p className="muted">No household survey values are available for this view.</p>
              )}
              <ChartInfo
                shows={householdSurveyNote}
                howToRead="Each selected district is shown separately. A longer bar means more households reported drought."
                sourceLabel={
                  surveyView === 'imported'
                    ? selectedImport ? `Imported source: ${selectedImport.source_name}.` : 'No imported source is selected.'
                    : selectedImport ? `Imported source: ${selectedImport.source_name}; CFSVA 2024 is used for missing districts.` : undefined
                }
                sources={surveyView === 'imported' ? [] : ['cfsva']}
              />
            </div>
          </div>

          <div className="panel">
            <h3>Average dry months per year</h3>
            <p className="muted">
              Districts ranked from most to fewest for {periodLabel}. Longer bars mean more dry months.
            </p>
            <DryMonthsChart
              districts={filteredDistricts}
              getValue={(district) => district.filtered_avg_dry_months}
              unit="months per year"
              color={CHART_COLORS.rain}
            />
            <ChartInfo
              shows={`Average dry months per year in ${periodLabel}, calculated from rainfall at least 20% below normal.`}
              howToRead="A longer bar means the district was dry more often during the selected years."
              sources={['rainfall', 'boundaries']}
            />
          </div>
        </>
      )}
    </>
  )
}
