import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapPicker({ latitude, longitude, onChange, height = 280 }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const lat = latitude ? parseFloat(latitude) : 23.0225
    const lng = longitude ? parseFloat(longitude) : 72.5714

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map)

    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="width:28px;height:28px;background:#00B4D8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;top:-14px;left:-14px;"></div>`,
      iconSize: [0, 0]
    })

    let marker = null
    if (latitude && longitude) {
      marker = L.marker([lat, lng], { icon }).addTo(map)
      markerRef.current = marker
    }

    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      if (marker) {
        marker.setLatLng([lat, lng])
      } else {
        marker = L.marker([lat, lng], { icon }).addTo(map)
        markerRef.current = marker
      }
      onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) })
    })

    mapInstance.current = map

    return () => { map.remove(); mapInstance.current = null }
  }, [])

  useEffect(() => {
    if (!mapInstance.current) return
    if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)
      if (isNaN(lat) || isNaN(lng)) return

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:28px;height:28px;background:#00B4D8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;top:-14px;left:-14px;"></div>`,
        iconSize: [0, 0]
      })

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
      }
      mapInstance.current.setView([lat, lng], mapInstance.current.getZoom())
    }
  }, [latitude, longitude])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`)
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        mapInstance.current.setView([parseFloat(lat), parseFloat(lon)], 15)
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width:28px;height:28px;background:#00B4D8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;top:-14px;left:-14px;"></div>`,
          iconSize: [0, 0]
        })
        if (markerRef.current) {
          markerRef.current.setLatLng([parseFloat(lat), parseFloat(lon)])
        } else {
          markerRef.current = L.marker([parseFloat(lat), parseFloat(lon)], { icon }).addTo(mapInstance.current)
        }
        onChange({ latitude: parseFloat(lat).toFixed(6), longitude: parseFloat(lon).toFixed(6) })
      }
    } catch {}
    setSearching(false)
  }

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        mapInstance.current.setView([lat, lng], 15)
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width:28px;height:28px;background:#00B4D8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;top:-14px;left:-14px;"></div>`,
          iconSize: [0, 0]
        })
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
        }
        onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) })
      },
      () => {}
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search location..."
            style={{ fontSize: 13, paddingRight: 32 }}
          />
          {searching && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--mid)' }}>...</span>}
        </div>
        <button type="button" className="btn-secondary" onClick={handleCurrentLocation} style={{ fontSize: 12, whiteSpace: 'nowrap', height: 36 }}>
          📍 Current
        </button>
      </div>
      <div ref={mapRef} style={{ height, borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }} />
      <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 6, fontFamily: 'var(--font-body)' }}>
        Click on the map to set location, or search above. (Optional)
      </div>
    </div>
  )
}
