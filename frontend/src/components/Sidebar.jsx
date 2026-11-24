import { CloudIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PAGES } from '../navigation'

export default function Sidebar({ page, open, onChange, onClose }) {
  return (
    <>
      <div className={`overlay ${open ? 'show' : ''}`} onClick={onClose} />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <CloudIcon className="icon brand-icon" />
          <span>RainCheck Rwanda</span>
          <button className="close-button" onClick={onClose} aria-label="Close menu">
            <XMarkIcon className="icon" />
          </button>
        </div>

        <nav>
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => onChange(id)}
            >
              <Icon className="icon" />
              {label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
