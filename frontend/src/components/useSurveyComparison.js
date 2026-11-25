import { useEffect, useState } from 'react'
import { fetchSatelliteRainfall, fetchSurveyComparison } from '../api'

// One request per month; the extra ones cover a month another visitor was downloading at the same time.
const MAX_REQUESTS = 24

/**
 * Compares a survey with the satellite. When the satellite rainfall for the survey's period is not stored yet,
 * it is fetched month by month and the comparison is run again.
 *
 * satellite: undefined (nothing to fetch), 'fetching', 'complete', 'not_published' or 'failed'.
 */
export default function useSurveyComparison(survey, view, accessToken) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)
  const key = survey
    ? `${survey.id ?? 'preview'}:${survey.survey_year}:${view}:${survey.observations.length}`
    : null

  useEffect(() => {
    if (!survey) return undefined

    const controller = new AbortController()
    const { signal } = controller
    const request = { surveyYear: survey.survey_year, view, observations: survey.observations }
    const publish = (next) => {
      if (!signal.aborted) setState({ key, ...next })
    }

    const run = async () => {
      let comparison

      try {
        comparison = await fetchSurveyComparison(request, signal)
      } catch {
        publish({ failed: true })
        return
      }

      if (comparison.window.complete) {
        publish({ comparison })
        return
      }

      try {
        let progress = null

        for (let count = 0; count < MAX_REQUESTS; count += 1) {
          publish({ comparison, satellite: 'fetching', progress })
          progress = await fetchSatelliteRainfall(survey.survey_year, accessToken, signal)
          if (signal.aborted) return
          if (progress.status !== 'fetching') break
        }

        if (progress.status === 'complete') comparison = await fetchSurveyComparison(request, signal)
        publish({ comparison, satellite: progress.status, progress })
      } catch (error) {
        publish({
          comparison,
          satellite: 'failed',
          message: error.response?.data?.message || 'The satellite data could not be loaded. Please try again.',
        })
      }
    }

    run()

    return () => controller.abort()
    // The survey is identified by key; its values do not change without the key changing.
  }, [key, survey, view, accessToken, attempt])

  const current = key && state?.key === key ? state : null

  return {
    comparison: current?.comparison ?? null,
    failed: Boolean(current?.failed),
    satellite: current?.satellite,
    progress: current?.progress ?? null,
    message: current?.message,
    retry: () => setAttempt((value) => value + 1),
  }
}
