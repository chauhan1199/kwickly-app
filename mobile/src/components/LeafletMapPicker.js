import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Platform, 
  PermissionsAndroid, 
  TouchableOpacity, 
  Text, 
  TextInput, 
  ActivityIndicator, 
  Animated, 
  ScrollView 
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import { Search, MapPin, Crosshair, X, Check } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

export default function LeafletMapPicker({ 
  latitude, 
  longitude, 
  initialCoordinate, 
  onLocationSelect, 
  height = 280, 
  style 
}) {
  const webViewRef = useRef(null);
  const pinBounceAnim = useRef(new Animated.Value(0)).current;
  const geocodeTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Normalize initial coordinates
  const initialLat = Number(initialCoordinate?.latitude ?? initialCoordinate?.lat ?? latitude) || 23.0225;
  const initialLng = Number(initialCoordinate?.longitude ?? initialCoordinate?.lng ?? longitude) || 72.5714;

  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [addressDetails, setAddressDetails] = useState({
    street: '',
    area: '',
    city: 'Ahmedabad',
    pincode: '',
    displayName: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Trigger bounce animation when pin moves
  const triggerPinBounce = () => {
    Animated.sequence([
      Animated.timing(pinBounceAnim, { toValue: -14, duration: 150, useNativeDriver: true }),
      Animated.timing(pinBounceAnim, { toValue: 0, duration: 180, useNativeDriver: true })
    ]).start();
  };

  // Perform reverse geocode
  const reverseGeocode = useCallback(async (cLat, cLng) => {
    setIsGeocoding(true);
    try {
      // 1. Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${cLat}&lon=${cLng}&addressdetails=1`,
        { headers: { 'User-Agent': 'KwicklyApp/1.0 (support@kwickly.in)' } }
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.building || addr.house_number || '';
        const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.state_district || 'Ahmedabad';
        const pincode = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '';
        const details = {
          street,
          area,
          city,
          pincode,
          displayName: data.display_name || `${street ? street + ', ' : ''}${area}, ${city}`
        };
        setAddressDetails(details);
        if (onLocationSelect) {
          onLocationSelect({
            latitude: cLat,
            longitude: cLng,
            lat: cLat,
            lng: cLng,
            details
          }, cLng);
        }
        return;
      }

      // 2. Photon fallback
      const pRes = await fetch(`https://photon.komoot.io/reverse?lat=${cLat}&lon=${cLng}`);
      const pData = await pRes.json();
      if (pData?.features?.length > 0) {
        const props = pData.features[0].properties || {};
        const details = {
          street: props.street || props.name || '',
          area: props.district || props.locality || '',
          city: props.city || 'Ahmedabad',
          pincode: (props.postcode || '').replace(/\D/g, '').slice(0, 6),
          displayName: [props.name, props.street, props.district, props.city].filter(Boolean).join(', ')
        };
        setAddressDetails(details);
        if (onLocationSelect) {
          onLocationSelect({
            latitude: cLat,
            longitude: cLng,
            lat: cLat,
            lng: cLng,
            details
          }, cLng);
        }
      }
    } catch (err) {
      if (onLocationSelect) {
        onLocationSelect({
          latitude: cLat,
          longitude: cLng,
          lat: cLat,
          lng: cLng,
          details: addressDetails
        }, cLng);
      }
    } finally {
      setIsGeocoding(false);
    }
  }, [onLocationSelect, addressDetails]);

  // Handle center change from Leaflet
  const handleRegionChange = (newLat, newLng) => {
    setCoords({ lat: newLat, lng: newLng });
    triggerPinBounce();

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }
    geocodeTimeoutRef.current = setTimeout(() => {
      reverseGeocode(newLat, newLng);
    }, 450);
  };

  // Perform search
  const executeSearch = async (text) => {
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const query = text.trim();
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const results = [];
      const seen = new Set();

      // Photon geocoder
      try {
        const pRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${coords.lat}&lon=${coords.lng}&limit=5`,
          { headers: { 'User-Agent': 'KwicklyApp/1.0' } }
        );
        const pData = await pRes.json();
        if (pData && Array.isArray(pData.features)) {
          pData.features.forEach((f, idx) => {
            const props = f.properties || {};
            const gCoords = f.geometry?.coordinates;
            if (gCoords && gCoords.length === 2) {
              const title = props.name || [props.street, props.district].filter(Boolean).join(', ') || props.city || 'Location';
              if (!seen.has(title.toLowerCase())) {
                seen.add(title.toLowerCase());
                results.push({
                  id: `photon_${idx}`,
                  lat: gCoords[1],
                  lon: gCoords[0],
                  title,
                  subtitle: [props.street, props.district, props.city].filter(Boolean).join(', '),
                  displayName: [props.name, props.street, props.district, props.city, props.state].filter(Boolean).join(', ')
                });
              }
            }
          });
        }
      } catch (_) {}

      // Nominatim search fallback if needed
      if (results.length < 3) {
        try {
          const nRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(query)}&limit=4`,
            { headers: { 'User-Agent': 'KwicklyApp/1.0 (support@kwickly.in)' } }
          );
          const nData = await nRes.json();
          if (Array.isArray(nData)) {
            nData.forEach((item, idx) => {
              const title = item.display_name.split(',')[0];
              if (!seen.has(title.toLowerCase())) {
                seen.add(title.toLowerCase());
                results.push({
                  id: `nom_${idx}`,
                  lat: parseFloat(item.lat),
                  lon: parseFloat(item.lon),
                  title,
                  subtitle: item.display_name.split(',').slice(1, 3).join(',').trim(),
                  displayName: item.display_name
                });
              }
            });
          }
        } catch (_) {}
      }

      setSearchResults(results);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(text);
    }, 350);
  };

  const selectSearchResult = (item) => {
    const sLat = parseFloat(item.lat);
    const sLng = parseFloat(item.lon);
    setCoords({ lat: sLat, lng: sLng });
    setSearchQuery(item.title);
    setShowSearchResults(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.centerToCoords) { window.centerToCoords(${sLat}, ${sLng}); } true;`);
    }
    triggerPinBounce();
    reverseGeocode(sLat, sLng);
  };

  // Device GPS Locate Me
  const fetchDeviceGPS = async () => {
    setIsLocatingGPS(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Kwickly needs access to your GPS to locate your store precisely.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel'
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setIsLocatingGPS(false);
          return;
        }
      }

      const applyGPS = (pos) => {
        const curLat = pos.coords.latitude;
        const curLng = pos.coords.longitude;
        setCoords({ lat: curLat, lng: curLng });
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`if (window.centerToCoords) { window.centerToCoords(${curLat}, ${curLng}); } true;`);
        }
        triggerPinBounce();
        reverseGeocode(curLat, curLng);
        setIsLocatingGPS(false);
      };

      Geolocation.getCurrentPosition(
        applyGPS,
        () => {
          Geolocation.getCurrentPosition(
            applyGPS,
            () => { setIsLocatingGPS(false); },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } catch (_) {
      setIsLocatingGPS(false);
    }
  };

  // Keep map centered if external coordinate prop updates
  useEffect(() => {
    if (latitude && longitude && webViewRef.current) {
      const nLat = Number(latitude);
      const nLng = Number(longitude);
      if (!isNaN(nLat) && !isNaN(nLng) && (nLat !== coords.lat || nLng !== coords.lng)) {
        setCoords({ lat: nLat, lng: nLng });
        webViewRef.current.injectJavaScript(`if (window.centerToCoords) { window.centerToCoords(${nLat}, ${nLng}); } true;`);
      }
    }
  }, [latitude, longitude]);

  // Leaflet HTML Canvas
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        * { box-sizing: border-box; }
        body { padding: 0; margin: 0; background: #e2e8f0; overflow: hidden; width: 100vw; height: 100vh; }
        #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 1; }
        .leaflet-control-attribution { display: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false, 
          attributionControl: false 
        }).setView([${coords.lat}, ${coords.lng}], 16);
        window.map = map;

        // Primary: CartoDB Voyager tiles (100% reliable, fast global CDN, no rate limit blocks)
        var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        });

        // Fallback: Standard OpenStreetMap
        var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        });

        cartoLayer.on('tileerror', function() {
          if (!map.hasLayer(osmLayer)) {
            map.removeLayer(cartoLayer);
            osmLayer.addTo(map);
          }
        });

        cartoLayer.addTo(map);

        function fixMapLayout() {
          if (map) { 
            map.invalidateSize(); 
          }
        }
        setTimeout(fixMapLayout, 150);
        setTimeout(fixMapLayout, 450);
        setTimeout(fixMapLayout, 1000);
        window.addEventListener('resize', fixMapLayout);

        map.on('movestart', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MOVE_START' }));
          }
        });

        map.on('moveend', function() {
          var center = map.getCenter();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'REGION_CHANGE',
              lat: center.lat,
              lng: center.lng
            }));
          }
        });

        window.centerToCoords = function(tLat, tLng) {
          if (map) {
            map.setView([tLat, tLng], 17, { animate: true });
          }
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, height && !style?.flex ? { height } : { flex: 1 }, style]}>
      {/* Search Input Bar (Native Overlay) */}
      <View style={styles.searchOverlay}>
        <View style={styles.searchBox}>
          <Search size={18} color="#6C47FF" style={{ marginLeft: 6, marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search society, landmark, area, city..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => executeSearch(searchQuery)}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {isSearching ? (
            <ActivityIndicator size="small" color="#6C47FF" style={{ marginRight: 6 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearchChange('')} style={{ padding: 4, marginRight: 4 }}>
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search Results Autocomplete Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.dropdown}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.dropdownItem}
                  onPress={() => selectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <MapPin size={16} color="#6C47FF" style={{ marginTop: 2, marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownTitle} numberOfLines={1}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={styles.dropdownSub} numberOfLines={1}>{item.subtitle}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Map WebView Area */}
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHTML }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={false}
          scrollEnabled={false}
          bounces={false}
          mixedContentMode="always"
          androidLayerType="hardware"
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'MOVE_START') {
                triggerPinBounce();
              } else if (data.type === 'REGION_CHANGE') {
                handleRegionChange(data.lat, data.lng);
              }
            } catch (_) {}
          }}
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript('if(window.map){ map.invalidateSize(); } true;');
          }}
        />

        {/* Uber/Urban Company Centered Location Pin Overlay */}
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.pinTooltip}>
            <Text style={styles.pinTooltipText}>📍 Drag map to pin exact spot</Text>
          </View>
          <Animated.View style={[styles.pinMarker, { transform: [{ translateY: pinBounceAnim }] }]}>
            <LinearGradient
              colors={['#6C47FF', '#8B5CF6']}
              style={styles.pinCircle}
            >
              <View style={styles.pinInnerDot} />
            </LinearGradient>
            <View style={styles.pinStem} />
          </Animated.View>
          <View style={styles.pinShadow} />
        </View>

        {/* Floating GPS Button */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={fetchDeviceGPS}
          disabled={isLocatingGPS}
          activeOpacity={0.85}
        >
          {isLocatingGPS ? (
            <ActivityIndicator size="small" color="#6C47FF" />
          ) : (
            <Crosshair size={22} color="#6C47FF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Pinned Coordinates Card */}
      <View style={styles.bottomCard}>
        <View style={styles.bottomCardRow}>
          <View style={styles.bottomIconWrap}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#6C47FF" />
            ) : (
              <MapPin size={18} color="#6C47FF" />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bottomTitle} numberOfLines={1}>
              {isGeocoding ? 'Detecting address...' : addressDetails.displayName || 'Pinned Store Location'}
            </Text>
            <Text style={styles.bottomCoords}>
              Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </Text>
          </View>
          <View style={styles.confirmedBadge}>
            <Check size={14} color="#10B981" />
            <Text style={styles.confirmedText}>Active</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  searchOverlay: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 71, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 6,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  dropdownSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  mapWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -46,
    alignItems: 'center',
    zIndex: 50,
  },
  pinTooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  pinTooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pinMarker: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pinInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  pinStem: {
    width: 3,
    height: 10,
    backgroundColor: '#6C47FF',
    marginTop: -1,
  },
  pinShadow: {
    width: 16,
    height: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginTop: 1,
  },
  gpsButton: {
    position: 'absolute',
    bottom: 84,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 80,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 90,
  },
  bottomCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomCoords: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
});
