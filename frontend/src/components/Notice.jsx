import { InformationCircleIcon } from '@heroicons/react/24/outline'

export default function Notice({ title, children }) {
  return (
    <div className="notice">
      <InformationCircleIcon className="icon" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}
