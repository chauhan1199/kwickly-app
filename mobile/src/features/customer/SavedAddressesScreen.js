import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Alert, 
  Modal, 
  TextInput, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  PermissionsAndroid
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

const SavedAddressesScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUnread } = useNotifications();

  const { user, fetchUser } = useAuth();
  const addresses = user?.addresses || [];
  const fromBooking = route.params?.fromBooking === true;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editAddressId, setEditAddressId] = useState(null);
  
  const [newLabel, setNewLabel] = useState('Home');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newLocation, setNewLocation] = useState({ coordinates: [72.8777, 19.0760] });

  const handleSetPrimary = async (id) => {
    try {
      await customerService.setPrimaryAddress(id);
      await fetchUser();
      refreshUnread();
    } catch (e) {
      Alert.alert('Error', 'Failed to set primary address');
    }
  };

  const handleDelete = async (id) => {
    const addr = addresses.find(a => a._id === id);
    if (addr?.isPrimary && addresses.length > 1) {
      Alert.alert('Error', 'Please set another address as primary before deleting this one.');
      return;
    }
    try {
      await customerService.deleteAddress(id);
      await fetchUser();
      refreshUnread();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  const handleEdit = (id) => {
    const addr = addresses.find(a => a._id === id);
    if (addr) {
      setNewLabel(addr.label || 'Home');
      setNewStreet(addr.street || '');
      setNewCity(addr.city || '');
      setNewPincode(addr.pincode || '');
      setNewLocation(addr.location || { coordinates: [72.8777, 19.0760] });
      setEditAddressId(id);
      setShowAddModal(true);
    }
  };

  const handleAdd = () => {
    setEditAddressId(null);
    setNewLabel('Home');
    setNewStreet('');
    setNewCity('');
    setNewPincode('');
    setNewLocation({ coordinates: [72.8777, 19.0760] });
    setShowAddModal(true);
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Kwickly needs access to your GPS to pinpoint your delivery and service address.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
        headers: { 'User-Agent': 'KwicklyMobile/1.0 (support@kwickly.in)' }
      });
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.suburb || data.address.neighbourhood || data.display_name.split(',')[0] || '';
        const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || 'Mumbai';
        const pincode = data.address.postcode ? data.address.postcode.replace(/\D/g, '').slice(0, 6) : '';
        
        if (road) setNewStreet(road);
        if (city) setNewCity(city);
        if (pincode && pincode.length === 6) setNewPincode(pincode);
      }
    } catch (e) {
      console.log('[GPS] Reverse geocode error:', e.message);
    }
  };

  const fetchGPS = async () => {
    setIsFetchingGPS(true);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission && Platform.OS === 'android') {
      setIsFetchingGPS(false);
      Alert.alert('Permission Required', 'Location permission is needed to automatically fetch your GPS position. You can also type your address manually below.');
      return;
    }

    const onLocationSuccess = async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setNewLocation({ coordinates: [lon, lat] });
      await reverseGeocode(lat, lon);
      setIsFetchingGPS(false);
      Alert.alert('Location Detected', 'Your GPS location coordinates and area have been updated.');
    };

    const onLocationError = () => {
      // Try low-accuracy wifi/cellular fallback
      Geolocation.getCurrentPosition(
        onLocationSuccess,
        () => {
          setIsFetchingGPS(false);
          Alert.alert('GPS Notice', 'Could not detect exact GPS coordinates. Please ensure Location is enabled in phone settings, or enter your address details manually.');
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

  const saveAddress = async () => {
    const label = (newLabel || 'Home').trim();
    const street = (newStreet || '').trim();
    const city = (newCity || '').trim();
    const pincode = (newPincode || '').replace(/\D/g, '').trim();

    if (!label) return Alert.alert('Missing Field', 'Please provide an address label (e.g. Home, Office)');
    if (!street || street.length < 3) return Alert.alert('Missing Field', 'Please enter your street / building address (min 3 characters)');
    if (!city || city.length < 2) return Alert.alert('Missing Field', 'Please enter your city');
    if (!pincode || pincode.length !== 6) return Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit postal pincode');
    
    const coords = (newLocation && Array.isArray(newLocation.coordinates) && newLocation.coordinates.length === 2)
      ? [Number(newLocation.coordinates[0]), Number(newLocation.coordinates[1])]
      : [72.8777, 19.0760];

    setIsSaving(true);
    try {
      const payload = {
        label,
        street,
        city,
        pincode,
        location: {
          type: 'Point',
          coordinates: coords
        },
        isPrimary: addresses.length === 0
      };

      if (editAddressId) {
        await customerService.updateAddress(editAddressId, payload);
      } else {
        await customerService.addAddress(payload);
      }
      
      await fetchUser();
      refreshUnread();
      setShowAddModal(false);
      setEditAddressId(null);
      Alert.alert('Success', editAddressId ? 'Address updated successfully!' : 'Address saved successfully!');
    } catch (e) {
      Alert.alert('Save Failed', e?.response?.data?.message || e.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title={fromBooking ? 'Select Address' : 'Saved Addresses'} 
          subtitle={fromBooking ? 'Tap an address to use it for booking' : `${addresses.length} saved`}
          showBack={true}
          transparent={true} 
          showLogo={false} 
          showProfile={false}
          showCart={false}
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {addresses.map(addr => (
          <View key={addr._id} style={[styles.card, addr.isPrimary && styles.cardPrimary]}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Text style={{fontSize: 20}}>{addr.label === 'Home' ? '🏠' : addr.label === 'Office' ? '🏢' : '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.addrType}>{addr.label}</Text>
                  {addr.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>★ PRIMARY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addrText}>{addr.street}, {addr.city} {addr.pincode}</Text>
              </View>
            </View>
            
            {/* Use this address button — only shown when coming from booking */}
            {fromBooking && (
              <TouchableOpacity
                style={styles.useAddressBtn}
                onPress={() => navigation.navigate({ name: 'DescribeJob', params: { selectedAddress: addr }, merge: true })}
                activeOpacity={0.85}
              >
                <Text style={styles.useAddressBtnText}>📍 Use this address</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, addr.isPrimary && styles.actionBtnActive]}
                onPress={() => handleSetPrimary(addr._id)}
                disabled={addr.isPrimary}
              >
                <Text style={[styles.actionBtnText, addr.isPrimary && styles.actionBtnTextActive]}>
                  {addr.isPrimary ? '★ Primary address' : '★ Set Primary'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(addr._id)}>
                <Text style={styles.actionBtnText}>🖊 Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(addr._id)}>
                <Text style={styles.deleteBtnText}>🗑 Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>📍 Add New Address</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Address Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1, width: '100%' }} activeOpacity={1} onPress={() => setShowAddModal(false)} />
          <KeyboardAvoidingView 
            style={[styles.modalContent, { maxHeight: '90%' }]} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }} 
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>{editAddressId ? 'Edit Address' : 'Add New Address'}</Text>
              
              <TouchableOpacity style={styles.gpsBtn} onPress={fetchGPS} disabled={isFetchingGPS}>
                {isFetchingGPS ? <ActivityIndicator color="#001016" /> : <Text style={styles.gpsBtnText}>🎯 Use GPS Location</Text>}
              </TouchableOpacity>

              <TextInput style={styles.modalInput} placeholder="Label (e.g. Home, Office) *" placeholderTextColor={theme.colors.textDim} value={newLabel} onChangeText={setNewLabel} />
              <TextInput style={styles.modalInput} placeholder="Street Address *" placeholderTextColor={theme.colors.textDim} value={newStreet} onChangeText={setNewStreet} />
              <TextInput style={styles.modalInput} placeholder="City *" placeholderTextColor={theme.colors.textDim} value={newCity} onChangeText={setNewCity} />
              <TextInput style={styles.modalInput} placeholder="Pincode *" placeholderTextColor={theme.colors.textDim} value={newPincode} onChangeText={setNewPincode} keyboardType="number-pad" />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveAddress} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalSaveBtnText}>Save Address</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPrimary: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addrType: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  primaryBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#001016',
  },
  addrText: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 4,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  actionBtnTextActive: {
    color: theme.colors.primary,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  useAddressBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  useAddressBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
  },
  gpsBtn: {
    backgroundColor: theme.colors.primary + '33', // 20% opacity
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  gpsBtnText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 12,
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSaveBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  }
});

export default SavedAddressesScreen;
