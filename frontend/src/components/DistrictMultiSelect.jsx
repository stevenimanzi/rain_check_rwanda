import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

/**
 * Pick which districts to show. selectedIds is null when every district is selected.
 */
export default function DistrictMultiSelect({ districts, selectedIds, onChange }) {
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
