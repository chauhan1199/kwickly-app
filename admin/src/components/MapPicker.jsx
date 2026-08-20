import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, MapPin, Navigation, X, Crosshair, Check, Loader2 } from 'lucide-react'

// Fix default Leaflet icon assets missing in bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createCustomPinIcon = () => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="position:relative; width:36px; height:44px; display:flex; flex-direction:column; align-items:center;">
        <div style="
          width:32px;
          height:32px;
          background: linear-gradient(135deg, #00B4D8 0%, #0077B6 100%);
          border: 2.5px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(0, 180, 216, 0.45), 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="width:10px; height:10px; background:#ffffff; border-radius:50%; transform:rotate(45deg); box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
        </div>
        <div style="
          width: 16px;
          height: 6px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 50%;
          filter: blur(1.5px);
          margin-top: 4px;
        "></div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42]
  })
}

export default function MapPicker({ latitude, longitude, onChange, height = 300 }) {
  const mapContainerRef = useRef(null)
  const mapInstance = useRef(null)
  const markerRef = useRef(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locating, setLocating] = useState(false)
  const [manualLat, setManualLat] = useState(latitude || '')
  const [manualLng, setManualLng] = useState(longitude || '')
  const [copied, setCopied] = useState(false)
  const debounceTimerRef = useRef(null)
  const searchWrapperRef = useRef(null)

  const defaultLat = 23.0225 // Ahmedabad default
  const defaultLng = 72.5714

  // Keep manual inputs synced with external props
  useEffect(() => {
    setManualLat(latitude || '')
    setManualLng(longitude || '')
  }, [latitude, longitude])

  // Click outside suggestions dropdown listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstance.current) return

    const initialLat = latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : defaultLat
    const initialLng = longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : defaultLng

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: latitude && longitude ? 15 : 12,
      zoomControl: false,
      attributionControl: false
    })

    // Add standard sleek tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map)

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const pinIcon = createCustomPinIcon()

    // Add marker if initial coords exist
    if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
      const marker = L.marker([parseFloat(latitude), parseFloat(longitude)], {
        icon: pinIcon,
        draggable: true,
        autoPan: true
      }).addTo(map)

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng()
        handleLocationUpdate(lat, lng)
      })

      markerRef.current = marker
    }

    // Map click handler to set marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true
        }).addTo(map)

        newMarker.on('dragend', (ev) => {
          const pos = ev.target.getLatLng()
          handleLocationUpdate(pos.lat, pos.lng)
        })
        markerRef.current = newMarker
      }
      handleLocationUpdate(lat, lng)
    })

    mapInstance.current = map

    // Fix modal render size: invalidateSize multiple times & on resize
    const invalidate = () => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize()
      }
    }
    const t1 = setTimeout(invalidate, 100)
    const t2 = setTimeout(invalidate, 300)
    const t3 = setTimeout(invalidate, 600)

    let resizeObserver = null
    if (window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => invalidate())
      resizeObserver.observe(mapContainerRef.current)
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      if (resizeObserver) resizeObserver.disconnect()
      map.remove()
      mapInstance.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker position when external latitude/longitude change
  useEffect(() => {
    if (!mapInstance.current) return
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (!isNaN(lat) && !isNaN(lng)) {
      const pinIcon = createCustomPinIcon()
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true
        }).addTo(mapInstance.current)

        newMarker.on('dragend', (ev) => {
          const pos = ev.target.getLatLng()
          handleLocationUpdate(pos.lat, pos.lng)
        })
        markerRef.current = newMarker
      }
    }
  }, [latitude, longitude])

  const handleLocationUpdate = (lat, lng) => {
    const formattedLat = parseFloat(lat).toFixed(6)
    const formattedLng = parseFloat(lng).toFixed(6)
    setManualLat(formattedLat)
    setManualLng(formattedLng)
    if (onChange) {
      onChange({ latitude: formattedLat, longitude: formattedLng })
    }
  }

  // Live Auto-complete Search with Debounce
  const handleSearchInputChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}&addressdetails=1&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        if (Array.isArray(data)) {
          setSuggestions(data)
          setShowSuggestions(data.length > 0)
        }
      } catch (err) {
        console.warn('Location search error:', err)
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  // Select place from search suggestions
  const handleSelectSuggestion = (place) => {
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    setSearchQuery(place.display_name)
    setShowSuggestions(false)

    if (mapInstance.current) {
      mapInstance.current.flyTo([lat, lng], 16, { duration: 1.2 })
      const pinIcon = createCustomPinIcon()
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true
        }).addTo(mapInstance.current)
        newMarker.on('dragend', (ev) => {
          const pos = ev.target.getLatLng()
          handleLocationUpdate(pos.lat, pos.lng)
        })
        markerRef.current = newMarker
      }
    }
    handleLocationUpdate(lat, lng)
  }

  // Explicit Search submit (Enter key or Search button)
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        handleSelectSuggestion(data[0])
      }
    } catch (err) {
      console.warn('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  // Locate User via GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLocating(false)
        if (mapInstance.current) {
          mapInstance.current.flyTo([lat, lng], 16, { duration: 1.2 })
          const pinIcon = createCustomPinIcon()
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng])
          } else {
            const newMarker = L.marker([lat, lng], {
              icon: pinIcon,
              draggable: true,
              autoPan: true
            }).addTo(mapInstance.current)
            newMarker.on('dragend', (ev) => {
              const p = ev.target.getLatLng()
              handleLocationUpdate(p.lat, p.lng)
            })
            markerRef.current = newMarker
          }
        }
        handleLocationUpdate(lat, lng)
      },
      (err) => {
        setLocating(false)
        console.warn('Geolocation error:', err.message)
        alert('Could not retrieve current location. Please check your browser location permissions.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Manual Coordinates Apply
  const applyManualCoords = () => {
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (mapInstance.current) {
        mapInstance.current.flyTo([lat, lng], 16, { duration: 1.2 })
        const pinIcon = createCustomPinIcon()
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          const newMarker = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true,
            autoPan: true
          }).addTo(mapInstance.current)
          newMarker.on('dragend', (ev) => {
            const p = ev.target.getLatLng()
            handleLocationUpdate(p.lat, p.lng)
          })
          markerRef.current = newMarker
        }
      }
      handleLocationUpdate(lat, lng)
    }
  }

  // Clear Pin
  const handleClearLocation = () => {
    if (markerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    setManualLat('')
    setManualLng('')
    setSearchQuery('')
    if (onChange) {
      onChange({ latitude: '', longitude: '' })
    }
  }

  const hasCoords = manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {/* Search Bar with Autocomplete Dropdown */}
      <div ref={searchWrapperRef} style={{ position: 'relative', width: '100%', zIndex: 10 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, width: '100%' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--mid)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-control"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search area, landmark, street or city..."
              style={{
                fontSize: 13,
                paddingLeft: 32,
                paddingRight: searchQuery ? 28 : 10,
                height: 38,
                borderRadius: 8,
                background: 'var(--input-bg, #111827)',
                borderColor: 'var(--border, rgba(255,255,255,0.1))'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false) }}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--mid)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={searching || !searchQuery.trim()}
            style={{
              height: 38,
              padding: '0 14px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              borderRadius: 8
            }}
          >
            {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
            Search
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleLocateMe}
            disabled={locating}
            title="Use My Current GPS Location"
            style={{
              height: 38,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              borderRadius: 8
            }}
          >
            {locating ? <Loader2 size={14} className="spin" /> : <Crosshair size={14} color="#00B4D8" />}
            GPS
          </button>
        </form>

        {/* Live Search Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--card-bg, #1a2234)',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              maxHeight: 210,
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {suggestions.map((item, idx) => (
              <div
                key={item.place_id || idx}
                onClick={() => handleSelectSuggestion(item)}
                style={{
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  cursor: 'pointer',
                  borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border, rgba(255,255,255,0.06))' : 'none',
                  fontSize: 12,
                  color: 'var(--text, #e2e8f0)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 180, 216, 0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <MapPin size={14} color="#00B4D8" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ lineHeight: 1.4 }}>{item.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, rgba(255,255,255,0.12))' }}>
        <div
          ref={mapContainerRef}
          style={{
            height: `${height}px`,
            width: '100%',
            background: '#0d131f'
          }}
        />

        {/* Floating Instruction overlay */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            color: '#94a3b8',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            zIndex: 400
          }}
        >
          <Navigation size={12} color="#00B4D8" />
          Click on map or drag pin to position
        </div>
      </div>

      {/* Coordinates Status Bar & Fine-Tuning */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--input-bg, rgba(255,255,255,0.03))',
          borderRadius: 8,
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          fontSize: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--mid)', fontWeight: 600, fontSize: 11 }}>LAT:</span>
            <input
              type="text"
              value={manualLat}
              onChange={e => setManualLat(e.target.value)}
              onBlur={applyManualCoords}
              onKeyDown={e => e.key === 'Enter' && applyManualCoords()}
              placeholder="e.g. 23.0225"
              style={{
                width: 90,
                height: 26,
                padding: '0 6px',
                fontSize: 11,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--mid)', fontWeight: 600, fontSize: 11 }}>LNG:</span>
            <input
              type="text"
              value={manualLng}
              onChange={e => setManualLng(e.target.value)}
              onBlur={applyManualCoords}
              onKeyDown={e => e.key === 'Enter' && applyManualCoords()}
              placeholder="e.g. 72.5714"
              style={{
                width: 90,
                height: 26,
                padding: '0 6px',
                fontSize: 11,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)'
              }}
            />
          </div>

          {hasCoords && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: 11, fontWeight: 600 }}>
              <Check size={13} /> Pinned
            </span>
          )}
        </div>

        {hasCoords && (
          <button
            type="button"
            onClick={handleClearLocation}
            style={{
              background: 'none',
              border: 'none',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4
            }}
          >
            Clear Pin
          </button>
        )}
      </div>
    </div>
  )
}
