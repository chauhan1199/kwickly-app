import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';

export default function LeafletMapPicker({ 
  latitude, 
  longitude, 
  initialCoordinate, 
  onLocationSelect, 
  height = 240, 
  style 
}) {
  const webViewRef = useRef(null);

  const lat = (initialCoordinate?.latitude || latitude) ? Number(initialCoordinate?.latitude || latitude) : 23.0225;
  const lng = (initialCoordinate?.longitude || longitude) ? Number(initialCoordinate?.longitude || longitude) : 72.5714;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body, html { margin:0; padding:0; height:100%; width:100%; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    #map { width:100%; height:100%; z-index: 1; }
    
    /* Top Floating Search Bar */
    .search-box {
      position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000;
      display: flex; gap: 6px; background: rgba(255,255,255,0.95); padding: 6px 8px;
      border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); backdrop-filter: blur(8px);
      border: 1px solid rgba(108, 71, 255, 0.2);
    }
    .search-input {
      flex: 1; border: none; outline: none; font-size: 13px; padding: 4px 8px; background: transparent; color: #1e293b; font-weight: 600;
    }
    .search-btn {
      background: #6C47FF; color: #fff; border: none; border-radius: 8px; padding: 6px 12px;
      font-size: 12px; font-weight: 800; cursor: pointer;
    }
    
    /* Uber-like Fixed Center Pin */
    .center-pin-container {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -100%);
      z-index: 999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .center-pin {
      width: 38px;
      height: 38px;
      background: #6C47FF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(108, 71, 255, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .center-pin-dot {
      width: 12px;
      height: 12px;
      background: #FFFFFF;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .center-pin-shadow {
      width: 14px;
      height: 6px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 50%;
      margin-top: 2px;
      filter: blur(1px);
    }

    /* Floating GPS Button */
    .gps-btn {
      position: absolute; bottom: 12px; right: 12px; z-index: 1000;
      width: 40px; height: 40px; border-radius: 20px;
      background: #FFFFFF; border: 1.5px solid #6C47FF;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .gps-icon {
      width: 18px; height: 18px; fill: #6C47FF;
    }
  </style>
</head>
<body>
  <div class="search-box">
    <input type="text" id="searchInput" class="search-input" placeholder="Search area, city, landmark..." />
    <button type="button" class="search-btn" onclick="doSearch()">Search</button>
  </div>

  <div class="center-pin-container">
    <div class="center-pin">
      <div class="center-pin-dot"></div>
    </div>
    <div class="center-pin-shadow"></div>
  </div>

  <button class="gps-btn" onclick="requestDeviceGps()" title="Locate Me">
    <svg class="gps-icon" viewBox="0 0 24 24">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </svg>
  </button>

  <div id="map"></div>

  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    var geocodeTimeout = null;

    function notifyParent(nLat, nLng, details) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOCATION_SELECT',
          latitude: parseFloat(nLat),
          longitude: parseFloat(nLng),
          lat: parseFloat(nLat),
          lng: parseFloat(nLng),
          details: details || {}
        }));
      }
    }

    function reverseGeocode(cLat, cLng) {
      clearTimeout(geocodeTimeout);
      geocodeTimeout = setTimeout(function() {
        fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + cLat + '&lon=' + cLng)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            var addr = data.address || {};
            var street = addr.road || addr.building || addr.neighbourhood || '';
            var area = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential || '';
            var city = addr.city || addr.town || addr.village || addr.state_district || 'Ahmedabad';
            var pincode = addr.postcode || '';
            
            notifyParent(cLat, cLng, {
              street: street,
              area: area,
              city: city,
              pincode: pincode,
              displayName: data.display_name || ''
            });
          })
          .catch(function(e) {
            notifyParent(cLat, cLng, {});
          });
      }, 500);
    }

    map.on('moveend', function() {
      var center = map.getCenter();
      reverseGeocode(center.lat, center.lng);
    });

    function requestDeviceGps() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_GPS' }));
      }
    }

    window.centerToCoords = function(tLat, tLng) {
      map.flyTo([tLat, tLng], 17, { animate: true, duration: 1 });
      reverseGeocode(tLat, tLng);
    };

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
            map.flyTo([nLat, nLng], 17, { animate: true, duration: 1 });
          }
        })
        .catch(function(err) {});
    }

    // Initial reverse geocode
    reverseGeocode(${lat}, ${lng});
  </script>
</body>
</html>
  `;

  const handleDeviceGps = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Kwickly needs access to your location to accurately set your address.',
            buttonPositive: 'Allow'
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }
      }

      // Try high-accuracy first, fallback to standard
      Geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: curLat, longitude: curLng } = pos.coords;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`window.centerToCoords(${curLat}, ${curLng}); true;`);
          }
        },
        (err) => {
          Geolocation.getCurrentPosition(
            (fallbackPos) => {
              const { latitude: fLat, longitude: fLng } = fallbackPos.coords;
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`window.centerToCoords(${fLat}, ${fLng}); true;`);
              }
            },
            () => {},
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } catch (_) {}
  };

  return (
    <View style={[styles.container, { height }, style]}>
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
              onLocationSelect({
                latitude: data.latitude || data.lat,
                longitude: data.longitude || data.lng,
                lat: data.latitude || data.lat,
                lng: data.longitude || data.lng,
                details: data.details || {}
              });
            } else if (data.type === 'REQUEST_GPS') {
              handleDeviceGps();
            }
          } catch (e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
});
