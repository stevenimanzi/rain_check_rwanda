import { Bars3Icon, CalendarDaysIcon, ChevronDownIcon, LanguageIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'

const LANGUAGES = {
  en: { label: 'English' },
  rw: { label: 'Kinyarwanda' },
  fr: { label: 'French' },
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

function Flag({ code }) {
  if (code === 'rw') {
    return (
      <svg className="language-flag" viewBox="0 0 30 20" role="img" aria-label="Rwanda flag">
        <rect width="30" height="7" fill="#00A1DE" />
        <rect y="7" width="30" height="7" fill="#FAD201" />
        <rect y="14" width="30" height="6" fill="#20603D" />
        <circle cx="24" cy="5" r="2.2" fill="#FAD201" />
        <circle cx="24" cy="5" r="1.3" fill="#00A1DE" />
      </svg>
    )
  }

  if (code === 'fr') {
    return (
      <svg className="language-flag" viewBox="0 0 30 20" role="img" aria-label="France flag">
        <rect width="10" height="20" fill="#1D4F91" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#EF3340" />
      </svg>
    )
  }

  return (
    <svg className="language-flag" viewBox="0 0 30 20" role="img" aria-label="United Kingdom flag">
      <rect width="30" height="20" fill="#1D4F91" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#C8102E" strokeWidth="3" />
    </svg>
  )
}

export default function TopBar({ title, onMenuClick }) {
  const [language, setLanguage] = useState(() => {
    const cookieLanguage = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/)?.[1]
    return cookieLanguage && LANGUAGES[cookieLanguage] ? cookieLanguage : 'en'
  })
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const languageMenuRef = useRef(null)

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

    const closeMenu = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage)
    setLanguageMenuOpen(false)
    setGoogleTranslateLanguage(nextLanguage)
  }

  const activeLanguage = LANGUAGES[language]

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

        <div className="language-switcher" ref={languageMenuRef}>
          <button
            className="language-switcher-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen((open) => !open)}
          >
            <LanguageIcon className="language-icon" />
            <span className="language-current-flag" aria-hidden="true">
              <Flag code={language} />
            </span>
            <span className="language-current-name">{activeLanguage.label}</span>
            <ChevronDownIcon className={`language-chevron ${languageMenuOpen ? 'open' : ''}`} />
          </button>

          {languageMenuOpen && (
            <div className="language-menu" role="menu" aria-label="Choose language">
              {Object.entries(LANGUAGES).map(([code, { label }]) => (
                <button
                  key={code}
                  type="button"
                  role="menuitem"
                  className={`language-option ${language === code ? 'active' : ''}`}
                  onClick={() => changeLanguage(code)}
                >
                  <span className="language-option-flag" aria-hidden="true">
                    <Flag code={code} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
