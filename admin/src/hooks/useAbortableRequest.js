import { useRef, useCallback, useEffect } from 'react'
import api from '../services/api'

export default function useAbortableRequest() {
  const controllersRef = useRef([])

  const request = useCallback(async (method, url, data = null, options = {}) => {
    const controller = new AbortController()
    controllersRef.current.push(controller)

    const config = { ...options, signal: controller.signal }

    try {
      let res
      if (method === 'get' || method === 'delete') {
        res = await api[method](url, config)
      } else {
        res = await api[method](url, data, config)
      }
      return res
    } finally {
      controllersRef.current = controllersRef.current.filter(c => c !== controller)
    }
  }, [])

  const abortAll = useCallback(() => {
    controllersRef.current.forEach(c => c.abort())
    controllersRef.current = []
  }, [])

  useEffect(() => {
    return () => abortAll()
  }, [abortAll])

  return {
    get: (url, options = {}) => request('get', url, null, options),
    post: (url, data = {}, options = {}) => request('post', url, data, options),
    put: (url, data = {}, options = {}) => request('put', url, data, options),
    patch: (url, data = {}, options = {}) => request('patch', url, data, options),
    delete: (url, options = {}) => request('delete', url, null, options),
    abortAll,
  }
}
