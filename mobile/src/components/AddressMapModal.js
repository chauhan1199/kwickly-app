import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Dimensions,
  Animated,
  KeyboardAvoidingView
} from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {
  MapPin,
  Search,
  Crosshair,
  X,
  Check,
  Home,
  Briefcase,
  Building,
  Navigation,
  ChevronDown
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default initial location: Ahmedabad / Mumbai
const DEFAULT_LAT = 23.0225;
const DEFAULT_LNG = 72.5714;
const DEFAULT_DELTA = 0.006;

export const AddressMapModal = ({
  visible,
  onClose,
  onSave,
  initialData = null,
  theme,
  isDarkMode = false
}) => {
  const mapRef = useRef(null);
  const pinBounceAnim = useRef(new Animated.Value(0)).current;

  const [region, setRegion] = useState({
    latitude: initialData?.location?.coordinates?.[1] || DEFAULT_LAT,
    longitude: initialData?.location?.coordinates?.[0] || DEFAULT_LNG,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA
  });

  const [label, setLabel] = useState(initialData?.label || 'Home');
  const [customLabel, setCustomLabel] = useState('');
  const [flatBuilding, setFlatBuilding] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const geocodeTimeoutRef = useRef(null);

  // Initialize or reset form when opened
  useEffect(() => {
    if (visible) {
      if (initialData) {
        const initLabel = initialData.label || 'Home';
        if (['Home', 'Office', 'Work'].includes(initLabel)) {
          setLabel(initLabel === 'Work' ? 'Office' : initLabel);
          setCustomLabel('');
        } else {
          setLabel('Other');
          setCustomLabel(initLabel);
        }

        setFlatBuilding(initialData.street || '');
        setStreetArea(initialData.area || '');
        setCity(initialData.city || '');
        setPincode(initialData.pincode || '');

        const lat = initialData.location?.coordinates?.[1] || DEFAULT_LAT;
        const lng = initialData.location?.coordinates?.[0] || DEFAULT_LNG;
        const newReg = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA
        };
        setRegion(newReg);
        setTimeout(() => {
          mapRef.current?.animateToRegion(newReg, 600);
        }, 300);
      } else {
        setLabel('Home');
        setCustomLabel('');
        setFlatBuilding('');
        setStreetArea('');
        setCity('');
        setStateName('');
        setPincode('');
        setFormattedAddress('');
        // Automatically attempt GPS on fresh modal open
        fetchGPSLocation(false);
      }
    }
  }, [visible, initialData]);

  // Bounce animation for center pin
  const triggerPinBounce = () => {
    Animated.sequence([
      Animated.timing(pinBounceAnim, {
        toValue: -14,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(pinBounceAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true
      })
    ]).start();
  };

  // Reverse Geocoding with OpenStreetMap Nominatim
  const performReverseGeocode = async (lat, lon) => {
    setIsReverseGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'KwicklyApp/1.0 (support@kwickly.in)' }
      });
      const data = await res.json();

      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.residential || addr.street || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.subdistrict || '';
        const cityName = addr.city || addr.town || addr.village || addr.state_district || 'Ahmedabad';
        const st = addr.state || '';
        const pin = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '';

        const areaJoined = [road, suburb].filter(Boolean).join(', ');
        
        setStreetArea(areaJoined || data.name || '');
        setCity(cityName);
        setStateName(st);
        if (pin && pin.length === 6) setPincode(pin);

        setFormattedAddress(data.display_name || `${areaJoined}, ${cityName}, ${st} ${pin}`);
      }
    } catch (e) {
      console.log('[MapPicker] Reverse geocode error:', e.message);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Debounced region change handler
  const handleRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
    triggerPinBounce();

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(() => {
      performReverseGeocode(newRegion.latitude, newRegion.longitude);
    }, 600);
  };

  // Search places / localities in India
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(text.trim())}&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'KwicklyApp/1.0 (support@kwickly.in)' }
      });
      const list = await res.json();
      setSearchResults(list || []);
    } catch (e) {
      console.log('[MapPicker] Search error:', e.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Select place from search autocomplete
  const handleSelectSearchResult = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    const newReg = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA
    };

    setRegion(newReg);
    mapRef.current?.animateToRegion(newReg, 800);
    setSearchQuery(item.display_name.split(',')[0]);
    setShowSearchResults(false);

    // Extract address fields
    const addr = item.address || {};
    const road = addr.road || addr.suburb || addr.neighbourhood || '';
    const cityName = addr.city || addr.town || addr.village || addr.state_district || 'Ahmedabad';
    const pin = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '';

    if (road) setStreetArea(road);
    if (cityName) setCity(cityName);
    if (pin && pin.length === 6) setPincode(pin);
    setFormattedAddress(item.display_name);
  };

  // Request Android location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Kwickly needs GPS location to pinpoint your address accurately on the map.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel'
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  };

  // Fetch live GPS location
  const fetchGPSLocation = async (manualClick = false) => {
    setIsLocatingGPS(true);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission && Platform.OS === 'android') {
      setIsLocatingGPS(false);
      if (manualClick) {
        Alert.alert('Permission Required', 'Please grant location permission to find your current GPS position.');
      }
      return;
    }

    const onLocationSuccess = (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const newReg = {
        latitude: lat,
        longitude: lon,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA
      };
      setRegion(newReg);
      mapRef.current?.animateToRegion(newReg, 800);
      performReverseGeocode(lat, lon);
      setIsLocatingGPS(false);
    };

    const onLocationError = (err) => {
      // Fallback to low-accuracy network provider
      Geolocation.getCurrentPosition(
        onLocationSuccess,
        (err2) => {
          setIsLocatingGPS(false);
          console.log('[GPS] Location timeout/error:', err2?.message || err?.message);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
      );
    };

    Geolocation.getCurrentPosition(
      onLocationSuccess,
      onLocationError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  // Validate and submit address
  const handleSaveAddress = async () => {
    const finalLabel = label === 'Other' ? (customLabel.trim() || 'Other') : label;
    const finalFlat = flatBuilding.trim();
    const finalArea = streetArea.trim();
    const finalCity = city.trim();
    const finalPincode = pincode.replace(/\D/g, '').trim();

    if (!finalFlat || finalFlat.length < 2) {
      return Alert.alert('Missing Field', 'Please enter your House / Flat / Building number.');
    }
    if (!finalArea && !finalFlat) {
      return Alert.alert('Missing Field', 'Please enter your Street / Area / Landmark.');
    }
    if (!finalCity || finalCity.length < 2) {
      return Alert.alert('Missing Field', 'Please enter your City name.');
    }
    if (!finalPincode || finalPincode.length !== 6) {
      return Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit postal pincode.');
    }

    const streetCombined = finalFlat;
    const areaCombined = finalArea;

    setIsSaving(true);
    try {
      await onSave({
        label: finalLabel,
        street: streetCombined,
        area: areaCombined,
        city: finalCity,
        pincode: finalPincode,
        location: {
          type: 'Point',
          coordinates: [region.longitude, region.latitude]
        }
      });
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const dynamicStyles = createStyles(theme, isDarkMode);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dynamicStyles.container}>
        {/* Top Header */}
        <LinearGradient
          colors={['#6C47FF', '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.headerGradient}
        >
          <View style={dynamicStyles.headerRow}>
            <TouchableOpacity style={dynamicStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={dynamicStyles.headerTitle}>Select Delivery Location</Text>
              <Text style={dynamicStyles.headerSub} numberOfLines={1}>
                {isReverseGeocoding ? 'Detecting address...' : (city ? `${city} (${pincode || 'Select'})` : 'Drag map to pin exact door location')}
              </Text>
            </View>
          </View>

          {/* Search Box on Top */}
          <View style={dynamicStyles.searchContainer}>
            <Search size={18} color="#6C47FF" style={dynamicStyles.searchIcon} />
            <TextInput
              style={dynamicStyles.searchInput}
              placeholder="Search society, landmark, area..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#6C47FF" style={{ marginRight: 8 }} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => handleSearch('')} style={{ padding: 4 }}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={dynamicStyles.searchResultsOverlay}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={item.place_id || idx}
                  style={dynamicStyles.searchResultItem}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <MapPin size={18} color="#6C47FF" style={{ marginTop: 2, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.searchResultTitle} numberOfLines={1}>
                      {item.display_name.split(',')[0]}
                    </Text>
                    <Text style={dynamicStyles.searchResultSub} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Map Area */}
        <View style={dynamicStyles.mapWrapper}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={dynamicStyles.map}
            initialRegion={region}
            mapType={Platform.OS === 'android' ? 'none' : 'standard'}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
          >
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
              zIndex={-1}
              shouldReplaceMapContent={true}
            />
          </MapView>

          {/* Centered Uber/Urban Company Location Pin */}
          <View style={dynamicStyles.centerPinContainer} pointerEvents="none">
            <View style={dynamicStyles.pinTooltip}>
              <Text style={dynamicStyles.pinTooltipText}>📍 Order will be delivered here</Text>
            </View>
            <Animated.View style={[dynamicStyles.pinMarker, { transform: [{ translateY: pinBounceAnim }] }]}>
              <LinearGradient
                colors={['#FF3B30', '#E11D48']}
                style={dynamicStyles.pinCircle}
              >
                <View style={dynamicStyles.pinInnerDot} />
              </LinearGradient>
              <View style={dynamicStyles.pinStem} />
            </Animated.View>
            <View style={dynamicStyles.pinShadow} />
          </View>

          {/* Floating Locate Me GPS Button */}
          <TouchableOpacity
            style={dynamicStyles.gpsFloatingBtn}
            onPress={() => fetchGPSLocation(true)}
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

        {/* Bottom Address Details Form Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={dynamicStyles.bottomSheet}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.formScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Address Banner */}
            <View style={dynamicStyles.addressBanner}>
              <View style={dynamicStyles.bannerIcon}>
                <MapPin size={20} color="#6C47FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={dynamicStyles.bannerAreaTitle} numberOfLines={1}>
                  {streetArea || city || 'Pinned Location'}
                </Text>
                <Text style={dynamicStyles.bannerAddressSub} numberOfLines={2}>
                  {formattedAddress || (isReverseGeocoding ? 'Detecting address details...' : `${city ? city + ', ' : ''}${stateName} ${pincode}`)}
                </Text>
              </View>
            </View>

            {/* Tag / Category Chips */}
            <Text style={dynamicStyles.inputLabel}>SAVE ADDRESS AS</Text>
            <View style={dynamicStyles.tagRow}>
              {[
                { key: 'Home', icon: Home, label: 'Home' },
                { key: 'Office', icon: Briefcase, label: 'Work / Office' },
                { key: 'Other', icon: MapPin, label: 'Other' }
              ].map((item) => {
                const IconComponent = item.icon;
                const isSelected = label === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[dynamicStyles.tagChip, isSelected && dynamicStyles.tagChipActive]}
                    onPress={() => setLabel(item.key)}
                    activeOpacity={0.8}
                  >
                    <IconComponent size={16} color={isSelected ? '#fff' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[dynamicStyles.tagChipText, isSelected && dynamicStyles.tagChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Label Input if 'Other' selected */}
            {label === 'Other' && (
              <TextInput
                style={dynamicStyles.textInput}
                placeholder="Address Nickname (e.g. Mom's House, Gym)"
                placeholderTextColor="#94A3B8"
                value={customLabel}
                onChangeText={setCustomLabel}
              />
            )}

            {/* Flat / House / Building */}
            <Text style={dynamicStyles.inputLabel}>HOUSE / FLAT / BUILDING NO. *</Text>
            <TextInput
              style={dynamicStyles.textInput}
              placeholder="e.g. Flat 403, Olive Residency, Block B"
              placeholderTextColor="#94A3B8"
              value={flatBuilding}
              onChangeText={setFlatBuilding}
            />

            {/* Area / Landmark */}
            <Text style={dynamicStyles.inputLabel}>APARTMENT / ROAD / LANDMARK *</Text>
            <TextInput
              style={dynamicStyles.textInput}
              placeholder="e.g. Near DMart, IOC Road, Chandkheda"
              placeholderTextColor="#94A3B8"
              value={streetArea}
              onChangeText={setStreetArea}
            />

            {/* City & Pincode Row */}
            <View style={dynamicStyles.inputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={dynamicStyles.inputLabel}>CITY *</Text>
                <TextInput
                  style={dynamicStyles.textInput}
                  placeholder="City"
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={dynamicStyles.inputLabel}>PINCODE *</Text>
                <TextInput
                  style={dynamicStyles.textInput}
                  placeholder="6-digit Pincode"
                  placeholderTextColor="#94A3B8"
                  value={pincode}
                  onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            {/* Save Address Button */}
            <TouchableOpacity
              style={dynamicStyles.saveBtn}
              onPress={handleSaveAddress}
              disabled={isSaving}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={dynamicStyles.saveBtnGradient}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Check size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={dynamicStyles.saveBtnText}>
                      {initialData ? 'Update & Save Address' : 'Save Delivery Address'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC'
    },
    headerGradient: {
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      elevation: 6,
      zIndex: 20
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14
    },
    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#fff'
    },
    headerSub: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4
    },
    searchIcon: {
      marginRight: 8
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: '#1E293B',
      paddingVertical: 4
    },
    searchResultsOverlay: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 130 : 105,
      left: 16,
      right: 16,
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderRadius: 16,
      padding: 6,
      zIndex: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0'
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9'
    },
    searchResultTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    searchResultSub: {
      fontSize: 12,
      color: '#94A3B8',
      marginTop: 2
    },
    mapWrapper: {
      flex: 1,
      position: 'relative'
    },
    map: {
      ...StyleSheet.absoluteFillObject
    },
    centerPinContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -24,
      marginTop: -48,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10
    },
    pinTooltip: {
      backgroundColor: '#1E293B',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      marginBottom: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    pinTooltipText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700'
    },
    pinMarker: {
      alignItems: 'center'
    },
    pinCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6
    },
    pinInnerDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#fff'
    },
    pinStem: {
      width: 4,
      height: 10,
      backgroundColor: '#E11D48',
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2
    },
    pinShadow: {
      width: 16,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.3)',
      marginTop: 2
    },
    gpsFloatingBtn: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6,
      zIndex: 15
    },
    bottomSheet: {
      maxHeight: SCREEN_HEIGHT * 0.46,
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 12
    },
    formScroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24
    },
    addressBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      borderRadius: 14,
      padding: 12,
      marginBottom: 16
    },
    bannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#6C47FF1A',
      justifyContent: 'center',
      alignItems: 'center'
    },
    bannerAreaTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#0F172A'
    },
    bannerAddressSub: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: isDarkMode ? '#94A3B8' : '#64748B',
      letterSpacing: 0.5,
      marginBottom: 6,
      marginTop: 4
    },
    tagRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14
    },
    tagChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0'
    },
    tagChipActive: {
      backgroundColor: '#6C47FF',
      borderColor: '#6C47FF'
    },
    tagChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDarkMode ? '#CBD5E1' : '#475569'
    },
    tagChipTextActive: {
      color: '#fff',
      fontWeight: '800'
    },
    textInput: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 14,
      color: isDarkMode ? '#F8FAFC' : '#0F172A',
      marginBottom: 12
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    saveBtn: {
      borderRadius: 16,
      overflow: 'hidden',
      marginTop: 8,
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6
    },
    saveBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800'
    }
  });

export default AddressMapModal;
