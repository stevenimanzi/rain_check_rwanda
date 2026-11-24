import { Bars3Icon, CalendarDaysIcon, LanguageIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

const LANGUAGES = {
  en: 'English',
  rw: 'Kinyarwanda',
  fr: 'French',
}

function setGoogleTranslateLanguage(language) {
  const isEnglish = language === 'en'

  document.cookie = `googtrans=/en/${language}; path=/`
  document.cookie = `googtrans=/en/${language}; path=/; domain=${window.location.hostname}`

  if (isEnglish) {
    document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }

  window.location.reload()
}

export default function TopBar({ title, onMenuClick }) {
  const [language, setLanguage] = useState(() => {
    const cookieLanguage = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/)?.[1]
    return cookieLanguage && LANGUAGES[cookieLanguage] ? cookieLanguage : 'en'
  })

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return

      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'en,rw,fr',
          autoDisplay: false,
        },
        'google_translate_element',
      )
    }

    if (!document.querySelector('script[src*="translate.google.com"]')) {
      const script = document.createElement('script')
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const changeLanguage = (event) => {
    const nextLanguage = event.target.value
    setLanguage(nextLanguage)
    setGoogleTranslateLanguage(nextLanguage)
  }

  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick} aria-label="Open menu">
        <Bars3Icon className="icon" />
      </button>

      <h1>{title}</h1>

      <div className="topbar-actions">
        <div className="topbar-info">
          <CalendarDaysIcon className="icon" />
          <span>Comparison period: Apr 2023 - Mar 2024</span>
        </div>

        <label className="language-switcher" aria-label="Choose language">
          <LanguageIcon className="icon" />
          <select value={language} onChange={changeLanguage}>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div id="google_translate_element" aria-hidden="true" />
    </header>
  )
}
