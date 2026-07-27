import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function LeafletMapPicker({ latitude, longitude, onLocationSelect, style }) {
  const webViewRef = useRef(null);

  const initialLat = (latitude && Number(latitude) !== 0) ? Number(latitude) : 28.6139;
  const initialLng = (longitude && Number(longitude) !== 0) ? Number(longitude) : 77.2090;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body, html { margin:0; padding:0; height:100%; width:100%; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    #map { width:100%; height:100%; z-index: 1; }
    .search-box {
      position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000;
      display: flex; gap: 8px; background: rgba(255,255,255,0.95); padding: 6px 10px;
      border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); backdrop-filter: blur(8px);
    }
    .search-input {
      flex: 1; border: none; outline: none; font-size: 14px; padding: 6px 8px; background: transparent; color: #1e293b;
    }
    .search-btn {
      background: #6366F1; color: #fff; border: none; border-radius: 8px; padding: 6px 14px;
      font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .custom-marker {
      width: 26px; height: 26px; background: #6366F1; border: 3px solid #FFFFFF;
      border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div class="search-box">
    <input type="text" id="searchInput" class="search-input" placeholder="Search area, city, landmark..." />
    <button type="button" class="search-btn" onclick="doSearch()">Search</button>
  </div>
  <div id="map"></div>
  <script>
    var lat = ${initialLat};
    var lng = ${initialLng};

    var map = L.map('map', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    var customIcon = L.divIcon({
      className: 'custom-marker',
      html: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    var marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);

    function notifyParent(lLat, lLng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOCATION_SELECT',
          lat: parseFloat(lLat),
          lng: parseFloat(lLng)
        }));
      }
    }

    map.on('click', function(e) {
      var nLat = e.latlng.lat;
      var nLng = e.latlng.lng;
      marker.setLatLng([nLat, nLng]);
      notifyParent(nLat, nLng);
    });

    marker.on('dragend', function(e) {
      var pos = marker.getLatLng();
      notifyParent(pos.lat, pos.lng);
    });

    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        doSearch();
      }
    });

    function doSearch() {
      var query = document.getElementById('searchInput').value;
      if (!query || !query.trim()) return;
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query))
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && data.length > 0) {
            var nLat = parseFloat(data[0].lat);
            var nLng = parseFloat(data[0].lon);
            map.setView([nLat, nLng], 16);
            marker.setLatLng([nLat, nLng]);
            notifyParent(nLat, nLng);
          }
        })
        .catch(function(err) {});
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'LOCATION_SELECT' && onLocationSelect) {
              onLocationSelect({ lat: data.lat, lng: data.lng });
            }
          } catch (e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
