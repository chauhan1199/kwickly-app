import { useEffect, useRef } from 'react'

// Re-run `refresh` when AppLayout rebroadcasts a server DASHBOARD_UPDATE (or a page
// dispatches 'admin-action'). Bursts of events are debounced into one call.
export default function useAdminRefresh(refresh, delay = 1000) {
  const ref = useRef(refresh)
  ref.current = refresh

  useEffect(() => {
    let timer
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { ref.current?.() }, delay)
    }
    window.addEventListener('admin-action', handler)
    return () => { clearTimeout(timer); window.removeEventListener('admin-action', handler) }
  }, [delay])
}
