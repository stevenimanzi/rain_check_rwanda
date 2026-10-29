import { Bars3Icon, CalendarDaysIcon } from '@heroicons/react/24/outline'

export default function TopBar({ title, onMenuClick }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick} aria-label="Open menu">
        <Bars3Icon className="icon" />
      </button>

      <h1>{title}</h1>

      <div className="topbar-info">
        <CalendarDaysIcon className="icon" />
        <span>Survey period: Oct 2023 - Oct 2024</span>
      </div>
    </header>
  )
}
