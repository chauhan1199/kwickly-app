import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import Toast from '../components/Toast'
import { isAbortError } from '../utils/errorUtils'

export function useServerPagination(endpoint, pageSize = 15, extraFilter = null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchTrigger, setSearchTrigger] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`${endpoint}?page=${page}&limit=${pageSize}&search=${encodeURIComponent(searchTrigger)}`)
      if (res.data.status === 'success') {
        let list = res.data.data
        if (list && !Array.isArray(list)) {
          const keys = Object.keys(list)
          const arrayKey = keys.find(k => Array.isArray(list[k]))
          if (arrayKey) list = list[arrayKey]
        }
        
        const arr = Array.isArray(list) ? list : []
        const isClientSideFallback = !res.data.pagination && arr.length > pageSize
        
        if (isClientSideFallback) {
          let filtered = arr
          if (searchTrigger) {
             const lower = searchTrigger.toLowerCase()
             filtered = arr.filter(item => JSON.stringify(item).toLowerCase().includes(lower))
          }
          if (extraFilter) {
             filtered = filtered.filter(extraFilter)
          }
          setTotal(filtered.length)
          setData(filtered.slice((page - 1) * pageSize, page * pageSize))
        } else {
          let listData = arr
          if (extraFilter) {
            listData = arr.filter(extraFilter)
          }
          setData(listData)
          const nestedTotal = res.data.data && typeof res.data.data === 'object' ? res.data.data.total : undefined
          if (res.data.pagination) setTotal(res.data.pagination.total)
          else setTotal(nestedTotal || res.data.total || arr.length)
        }
      } else {
        setError(res.data.message || 'Failed to fetch data')
        if (typeof Toast === 'function') Toast(res.data.message || 'Failed to fetch data')
        else if (Toast?.error) Toast.error(res.data.message || 'Failed to fetch data')
        else if (Toast?.show) Toast.show(res.data.message || 'Failed to fetch data')
      }
    } catch (e) {
      if (isAbortError(e)) return
      const errorMsg = e.response?.data?.message || 'Error fetching data'
      setError(errorMsg)
      if (typeof Toast === 'function') Toast(errorMsg)
      else if (Toast?.error) Toast.error(errorMsg)
      else if (Toast?.show) Toast.show(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [endpoint, page, pageSize, searchTrigger, extraFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearchTrigger(search)
  }

  const clearSearch = () => {
    setSearch('')
    setSearchTrigger('')
    setPage(1)
  }

  return {
    data,
    loading,
    error,
    page,
    setPage,
    total,
    totalPages: Math.ceil(total / pageSize),
    pageSize,
    search,
    setSearch,
    handleSearch,
    clearSearch,
    refresh: fetchData,
    setData
  }
}
