import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { fetchDistrictRainfall, fetchHouseholdSurveyImports, fetchSurveyComparison, importHouseholdSurvey } from '../api'
import ChartInfo from '../components/ChartInfo'
import ChartSection from '../components/ChartSection'
import CountryDroughtCharts from '../components/CountryDroughtCharts'
import DistrictMultiSelect from '../components/DistrictMultiSelect'
import DryMonthsChart from '../components/DryMonthsChart'
import ExpandableChart from '../components/ExpandableChart'
import GapChart from '../components/GapChart'
import HouseholdSurveyImportPanel from '../components/HouseholdSurveyImportPanel'
import MismatchOverview from '../components/MismatchOverview'
import Notice from '../components/Notice'
import RainDeviationChart from '../components/RainDeviationChart'
import StatCard from '../components/StatCard'
import SurveyPreviewDialog from '../components/SurveyPreviewDialog'
import { CHART_COLORS, RISK_LABELS, monthYear } from '../utils'

const matchText = (value) => {
  if (value === null) return ''
  const strength = Math.abs(value) < 0.3 ? 'only a little' : Math.abs(value) < 0.6 ? 'fairly well' : 'very well'
  return `Overall, the satellite and households match ${strength} (match score ${value}, where 1 is a perfect match and 0 is no match).`
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

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

// lockedDistrictId: show this page for one district only (used by the Districts page); the district picker is hidden.
export default function OverviewPage({ districts, overview, lockedDistrictId = null }) {
  const { national, rank_correlation: matchScore } = overview
  const [surveyImports, setSurveyImports] = useState([])
  const [surveyImportsError, setSurveyImportsError] = useState(null)
  const [selectedImportId, setSelectedImportId] = useState('')
  const [surveyView, setSurveyView] = useState('merged')
  const [importFormOpen, setImportFormOpen] = useState(false)
  const [importAccessToken, setImportAccessToken] = useState('')
  // A preview is a survey that was checked but not saved; it only lives in this page's memory.
  const [previewImport, setPreviewImport] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewSaving, setPreviewSaving] = useState(false)
  const [previewMessage, setPreviewMessage] = useState(null)
  const [comparison, setComparison] = useState(null)
  const importDialogRef = useRef(null)
  const [selectedDistrictIds, setSelectedDistrictIds] = useState(lockedDistrictId ? [lockedDistrictId] : null)
  const [districtRainfall, setDistrictRainfall] = useState({})
  const [districtError, setDistrictError] = useState(null)
  const [countryRainfall, setCountryRainfall] = useState({ key: null, series: null, error: null })

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
    const dialog = importDialogRef.current
    if (importFormOpen && dialog && !dialog.open) dialog.showModal()
  }, [importFormOpen])

  // 'baseline' = the original CFSVA 2024 values only; otherwise a saved import (the latest by default).
  const selectedImport = selectedImportId === 'baseline'
    ? null
    : surveyImports.find((surveyImport) => String(surveyImport.id) === selectedImportId) ?? surveyImports[0] ?? null
  const comparisonKey = selectedImport
    ? `${selectedImport.id}:${selectedImport.survey_year}:${surveyView}:${selectedImport.observations.length}`
    : null

  useEffect(() => {
    if (!selectedImport) return undefined

    let active = true
    const controller = new AbortController()

    fetchSurveyComparison(
      { surveyYear: selectedImport.survey_year, view: surveyView, observations: selectedImport.observations },
      controller.signal,
    )
      .then((result) => {
        if (active) setComparison({ key: comparisonKey, ...result })
      })
      .catch((error) => {
        if (active && error.name !== 'CanceledError') setComparison({ key: comparisonKey, failed: true })
      })

    return () => {
      active = false
      controller.abort()
    }
    // selectedImport is identified by comparisonKey; its values do not change without the key changing.
  }, [comparisonKey, selectedImport, surveyView])

  // The comparison replaces the original one only once it matches the chosen survey and has satellite rainfall
  // for the survey's period; otherwise the dashboards keep using CFSVA 2024 for the mismatch charts.
  const surveyComparison = comparisonKey && comparison?.key === comparisonKey && !comparison.failed ? comparison : null
  const comparisonActive = Boolean(surveyComparison?.window.complete)
  const comparisonUnavailable = Boolean(selectedImport) && Boolean(surveyComparison) && !surveyComparison.window.complete
  const comparisonWindow = comparisonActive ? surveyComparison.window : overview.window
  const windowKey = `${comparisonWindow.start}:${comparisonWindow.end}`
  const districtRequestKey = `${windowKey}:${selectedDistrictIds?.join(',') ?? ''}`
  const currentDistrictError = districtError?.key === districtRequestKey ? districtError.message : null
  const isDefaultWindow =
    comparisonWindow.start === overview.window.start && comparisonWindow.end === overview.window.end
  const surveyPeriod = `${monthYear(comparisonWindow.start)} to ${monthYear(comparisonWindow.end)}`
  const surveyPeriodLong = `${monthYear(comparisonWindow.start, 'long')} to ${monthYear(comparisonWindow.end, 'long')}`
  const isInComparisonWindow = (month) => {
    const key = `${month.year}-${String(month.month).padStart(2, '0')}`

    return key >= comparisonWindow.start && key <= comparisonWindow.end
  }
  const currentCountryRainfall = countryRainfall.key === windowKey ? countryRainfall : null
  const countryRainfallLoading = !isDefaultWindow && !currentCountryRainfall
  const countryRainfallError = currentCountryRainfall?.error

  useEffect(() => {
    if (isDefaultWindow) return undefined

    let active = true
    const controller = new AbortController()

    fetchDistrictRainfall(districts.map(({ id }) => id), controller.signal, comparisonWindow)
      .then((details) => {
        if (active) {
          setCountryRainfall({
            key: windowKey,
            series: aggregateRainfall(details, overview.settings),
            error: null,
          })
        }
      })
      .catch((error) => {
        if (active && error.name !== 'CanceledError') {
          setCountryRainfall({
            key: windowKey,
            series: null,
            error: error.message || 'The country rainfall data could not be loaded.',
          })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [comparisonWindow, districts, isDefaultWindow, overview.settings, windowKey])

  useEffect(() => {
    if (selectedDistrictIds === null || selectedDistrictIds.length === 0) return undefined

    let active = true
    const controller = new AbortController()
    const missingIds = selectedDistrictIds.filter((id) => districtRainfall[`${windowKey}:${id}`] === undefined)
    if (missingIds.length === 0) return undefined

    const timer = setTimeout(() => {
      fetchDistrictRainfall(missingIds, controller.signal, comparisonWindow)
        .then((details) => {
          if (active) {
            setDistrictRainfall((current) => ({
              ...current,
              ...Object.fromEntries(details.map(({ id, rainfall }) => [`${windowKey}:${id}`, rainfall])),
            }))
          }
        })
        .catch((error) => {
          if (active && error.name !== 'CanceledError') {
            setDistrictError({
              key: districtRequestKey,
              message: error.message || 'The selected district data could not be loaded.',
            })
          }
        })
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [comparisonWindow, districtRainfall, districtRequestKey, selectedDistrictIds, windowKey])

  const comparisonDistricts = comparisonActive ? surveyComparison.districts : districts
  const selectedDistrictIdList = selectedDistrictIds ?? []
  const selectedIds = new Set(selectedDistrictIdList)
  const activeDistricts = selectedDistrictIds !== null
    ? comparisonDistricts.filter((district) => selectedIds.has(district.id))
    : comparisonDistricts
  const selectedDistrictDetails = selectedDistrictIdList
    .map((id) => {
      const district = districts.find((item) => item.id === id)
      const rainfall = districtRainfall[`${windowKey}:${id}`]

      return district && rainfall ? { ...district, rainfall } : null
    })
    .filter((district) => district !== null)
  const selectedDistrictReady = selectedDistrictIds === null
    ? !countryRainfallLoading && !countryRainfallError
    : selectedDistrictIdList.length > 0 && selectedDistrictDetails.length === selectedDistrictIdList.length
  const districtLoading =
    (selectedDistrictIds !== null && selectedDistrictIdList.length > 0 && !currentDistrictError && !selectedDistrictReady) ||
    (selectedDistrictIds === null && countryRainfallLoading)
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
    ? isDefaultWindow ? national : currentCountryRainfall?.series ?? []
    : isSingleDistrict
      ? selectedDistrictDetails[0]?.rainfall ?? []
      : aggregateRainfall(selectedDistrictDetails, overview.settings)
  const filteredSeries = rainfallSeries.filter(isInComparisonWindow)
  const assessedMonths = filteredSeries.filter((month) => month.judged)
  const dryMonths = assessedMonths.filter((month) => month.satellite_drought).length
  const highRisk = activeDistricts.filter((district) => district.summary.risk_level === 'high').length
  const periodLabel = surveyPeriod
  const mismatchValue = isSingleDistrict
    ? RISK_LABELS[singleDistrict.summary.risk_level] ?? 'No survey data'
    : `${highRisk} of ${districtCount}`
  const combinedTag = isSingleDistrict ? area : 'All selected districts combined'
  const surveyTitle = comparisonActive && selectedImport
    ? `${selectedImport.source_name} (${selectedImport.survey_year})`
    : '2024 survey'
  const activeMatchScore = comparisonActive ? surveyComparison.rank_correlation : matchScore
  const mismatchLabel = isSingleDistrict ? `Mismatch risk (${surveyTitle})` : 'High-mismatch districts'
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
      : `Household reports cover ${surveyPeriodLong}.`
  const includeCfsvaSource = surveyView === 'merged'

  const handleSurveyImport = (imported) => {
    setSurveyImports((current) => [imported, ...current.filter((item) => item.id !== imported.id)])
    setSelectedImportId(String(imported.id))
    setSurveyImportsError(null)
  }

  // View only: the survey opens in its own large dialog and never touches the dashboards or the database.
  const handlePreview = (preview, file) => {
    setPreviewImport(preview)
    setPreviewFile(file)
    setPreviewMessage(null)
    setImportFormOpen(false)
  }

  const closePreview = () => {
    setPreviewImport(null)
    setPreviewFile(null)
    setPreviewMessage(null)
  }

  // Turns the previewed file into a permanent, merged import.
  const savePreview = async () => {
    if (!previewImport || !previewFile) return

    if (!importAccessToken) {
      setPreviewMessage('Your sign-in expired. Close this preview, sign in again and upload the file once more to save it.')
      return
    }

    setPreviewSaving(true)
    setPreviewMessage(null)

    try {
      const saved = await importHouseholdSurvey({
        file: previewFile,
        surveyYear: previewImport.survey_year,
        sourceName: previewImport.source_name,
        token: importAccessToken,
        mode: 'save',
      })

      setPreviewImport(null)
      setPreviewFile(null)
      handleSurveyImport(saved)
      setSurveyView('merged')
    } catch (error) {
      if (error.response?.status === 401) setImportAccessToken('')
      setPreviewMessage(
        error.response?.status === 401
          ? 'Your sign-in expired. Close this preview, sign in again and upload the file once more to save it.'
          : error.response?.data?.message || 'The survey could not be saved. Try again.',
      )
    } finally {
      setPreviewSaving(false)
    }
  }

  const filters = (
    <section className="overview-filters" aria-label="Overview filters">
      <div className="overview-filter-heading">
        <div>
          <h2>{lockedDistrictId ? 'Household survey' : 'Explore by district'}</h2>
          <p>
            {lockedDistrictId
              ? `Satellite rainfall and household reports use the same 12-month period (${surveyPeriod}).`
              : 'Choose districts and a household survey. Satellite rainfall is always matched to that survey period.'}
          </p>
        </div>
        <div className="overview-filter-range">
          <CalendarDaysIcon className="icon" aria-hidden="true" />
          <span>Showing {surveyPeriod}</span>
        </div>
      </div>

      <div className="overview-filter-controls">
        {!lockedDistrictId && (
          <DistrictMultiSelect
            districts={districts}
            selectedIds={selectedDistrictIds}
            onChange={(ids) => {
              setSelectedDistrictIds(ids)
              setDistrictError(null)
            }}
          />
        )}

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
                value={selectedImport ? selectedImport.id : 'baseline'}
                options={[
                  { value: 'baseline', label: 'CFSVA 2024 only (original)' },
                  ...surveyImports.map((surveyImport) => ({
                    value: surveyImport.id,
                    label: `${surveyImport.source_name} (${surveyImport.survey_year})`,
                  })),
                ]}
                onChange={(value) => setSelectedImportId(String(value))}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )

  return (
    <>
      {!lockedDistrictId && (
        <p className="intro">
          A dry month is a month with at least 20% less rain than normal. This page compares satellite rainfall with what
          households told NISR about drought.
        </p>
      )}

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
            // Clicks inside the dialog (including its padding) never close it; only clicks on the backdrop do.
            const box = event.currentTarget.getBoundingClientRect()
            const inside =
              event.clientX >= box.left && event.clientX <= box.right &&
              event.clientY >= box.top && event.clientY <= box.bottom

            if (!inside) setImportFormOpen(false)
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
            onPreview={handlePreview}
            onLogin={setImportAccessToken}
            onLogout={() => setImportAccessToken('')}
          />
        </dialog>
      )}

      {previewImport && (
        <SurveyPreviewDialog
          preview={previewImport}
          districts={districts}
          saving={previewSaving}
          message={previewMessage}
          onSave={savePreview}
          onClose={closePreview}
        />
      )}
      {comparisonUnavailable && (
        <Notice title="No satellite rainfall for this survey's period yet">
          Satellite rainfall is missing for {monthYear(surveyComparison.window.start, 'long')} to{' '}
          {monthYear(surveyComparison.window.end, 'long')}, so the mismatch charts still compare against CFSVA 2024.
          The household charts show the selected survey.
        </Notice>
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
      {currentDistrictError && (
        <Notice title="Could not load district data">
          {currentDistrictError} Change the district selection or choose all districts to continue.
        </Notice>
      )}
      {countryRainfallError && (
        <Notice title="Could not load rainfall for this survey period">
          {countryRainfallError} The household comparison remains available, but rainfall charts could not be loaded.
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
              label="Satellite data coverage"
              value={`${filteredSeries.length} of 12`}
              hint={`Monthly records for ${surveyPeriod}`}
            />
            <StatCard label={mismatchLabel} value={mismatchValue} hint={`Household survey comparison: ${surveyPeriod}`} />
          </div>

          <ChartSection
            number={1}
            title="The big picture"
            tag={combinedTag}
            description="How closely satellite rainfall and household reports agree overall."
          >
          {!isSingleDistrict && <MismatchOverview districts={activeDistricts} period={surveyPeriod} />}

          <CountryDroughtCharts
            districts={householdChartDistricts}
            series={filteredSeries}
            area={area}
            isAllDistricts={isAllDistricts}
            isSingleDistrict={isSingleDistrict}
            districtCount={districtCount}
            period={surveyPeriod}
            householdSurveyLabel={householdSurveyLabel}
            householdSurveyNote={householdSurveyNote}
            householdSourceName={selectedImport?.source_name}
            includeCfsvaSource={includeCfsvaSource}
          />
          </ChartSection>

          <ChartSection
            number={2}
            title="District by district"
            tag={isSingleDistrict ? area : 'One bar per district'}
            description="Which districts are driest, report the most drought, or show the biggest gap."
          >
          <ExpandableChart>
            <h3>{isAllDistricts ? 'Where the satellite and households disagree' : `Satellite and households in ${area}`}</h3>
            <p className="muted">
              This comparison uses the same period as the household survey ({surveyPeriod}).
              Red: households reported more drought; blue: satellite rainfall indicated more drought.
            </p>
            <GapChart districts={activeDistricts} period={surveyPeriod} />
            <ChartInfo
              shows={`Each district is ranked on satellite dry months and households reporting drought for ${surveyPeriod}. The bar is the difference between those ranks. ${
                isSingleDistrict
                  ? `The selected district's mismatch risk is ${mismatchValue}.`
                  : isAllDistricts
                    ? matchText(activeMatchScore)
                    : `The ${districtCount} selected districts are shown separately. ${highRisk} have high mismatch risk.`
              }`}
              howToRead="A short bar means the two agree. A long red bar means households reported drought that the satellite missed; a long blue bar means satellite rainfall indicated drought that fewer households reported."
              sources={['rainfall', 'cfsva']}
            />
          </ExpandableChart>

          <div className="grid-2 even">
            <ExpandableChart>
              <h3>Dry months seen by the satellite</h3>
              <p className="muted">
                {isAllDistricts ? 'All 30 districts' : area}, {surveyPeriodLong}.
              </p>
              <DryMonthsChart
                districts={activeDistricts}
                period={surveyPeriod}
                getValue={(district) => district.summary.satellite_drought_months}
                unit="dry months"
                color={CHART_COLORS.dry}
              />
              <ChartInfo
                shows={`How many months had at least 20% less rain than normal in the 12 months households were asked about (${surveyPeriod}).`}
                howToRead="A longer bar means more dry months. This comparison stays on the survey period so it can be compared with household reports."
                sources={['rainfall', 'boundaries']}
              />
            </ExpandableChart>

            <ExpandableChart>
              <h3>Households that reported drought</h3>
              <p className="muted">{householdSurveyLabel}.</p>
              {householdChartDistricts.length ? (
                <DryMonthsChart
                  districts={householdChartDistricts}
                  period={surveyPeriod}
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
                    ? selectedImport ? `${selectedImport.source_name} (${selectedImport.survey_year}).` : 'No imported source is selected.'
                    : selectedImport ? `${selectedImport.source_name} (${selectedImport.survey_year}); CFSVA 2024 is used for missing districts.` : undefined
                }
                sources={surveyView === 'imported' ? [] : ['cfsva']}
              />
            </ExpandableChart>
          </div>

          </ChartSection>

          <ChartSection
            number={3}
            title="Rainfall over time"
            tag={combinedTag}
            description={`Whether each month was wetter or drier than normal during ${surveyPeriod}.`}
          >
          <ExpandableChart>
            <h3>Was each month wetter or drier than normal?</h3>
            <p className="muted">
              {isSingleDistrict
                ? area
                : `Average rainfall across ${districtCount} ${isAllDistricts ? 'districts' : 'selected districts'}`}, {periodLabel}.
            </p>
            <RainDeviationChart series={filteredSeries} maxMonths={12} />
            <ChartInfo
              shows={`Monthly rainfall compared with normal rainfall for ${isSingleDistrict ? area : `${districtCount} districts`}, ${periodLabel}.`}
              howToRead="Each month has two bars: rainfall and its historical normal for that calendar month. Red rainfall bars are at least 20% below normal; grey bars are normally very dry and are not assessed."
              sources={['rainfall', 'boundaries']}
            />
          </ExpandableChart>
          </ChartSection>
        </>
      )}
    </>
  )
}
