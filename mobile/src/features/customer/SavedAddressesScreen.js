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
  ActivityIndicator
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';

const SavedAddressesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const { user, fetchUser } = useAuth();
  const addresses = user?.addresses || [];
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editAddressId, setEditAddressId] = useState(null);
  
  const [newLabel, setNewLabel] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newLocation, setNewLocation] = useState(null);

  const handleSetPrimary = async (id) => {
    try {
      await customerService.setPrimaryAddress(id);
      await fetchUser();
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
    } catch (e) {
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  const handleEdit = (id) => {
    const addr = addresses.find(a => a._id === id);
    if (addr) {
      setNewLabel(addr.label || '');
      setNewStreet(addr.street || '');
      setNewCity(addr.city || '');
      setNewPincode(addr.pincode || '');
      setNewLocation(addr.location || null);
      setEditAddressId(id);
      setShowAddModal(true);
    }
  };

  const handleAdd = () => {
    setEditAddressId(null);
    setNewLabel(''); setNewStreet(''); setNewCity(''); setNewPincode(''); setNewLocation(null);
    setShowAddModal(true);
  };

  const fetchGPS = () => {
    setIsFetchingGPS(true);
    Geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setNewLocation({ coordinates: [lon, lat] });
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          if (data && data.address) {
            const street = data.address.road || data.address.suburb || data.display_name.split(',')[0];
            const city = data.address.city || data.address.town || data.address.state_district || '';
            const pincode = data.address.postcode || '';
            setNewStreet(street);
            setNewCity(city);
            setNewPincode(pincode);
            setNewLabel('Current Location');
          }
        } catch (e) {
          console.log("Reverse Geocoding failed", e);
        }
        
        setIsFetchingGPS(false);
        Alert.alert('GPS Fetched', 'Location coordinates and address populated!');
      },
      async err => {
        // Fallback for emulator if GPS fails
        setIsFetchingGPS(false);
        console.log("GPS Error:", err);
        Alert.alert('Emulator Fallback', 'Using mock location (Mumbai) because GPS failed.');
        const lat = 19.0760; const lon = 72.8777;
        setNewLocation({ coordinates: [lon, lat] });
        setNewStreet('Bandra West');
        setNewCity('Mumbai');
        setNewPincode('400050');
        setNewLabel('Mock Location');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const saveAddress = async () => {
    if (!newLabel || !newStreet) return Alert.alert('Error', 'Please enter a label and street');
    setIsSaving(true);
    try {
      const payload = {
        label: newLabel,
        street: newStreet,
        city: newCity,
        pincode: newPincode,
        location: newLocation,
        isPrimary: addresses.length === 0
      };

      if (editAddressId) {
        await customerService.updateAddress(editAddressId, payload);
      } else {
        await customerService.addAddress(payload);
      }
      
      await fetchUser();
      setShowAddModal(false);
      setEditAddressId(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Saved Addresses</Text>
          <Text style={styles.appBarSub}>{addresses.length} saved</Text>
        </View>
      </View>

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
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editAddressId ? 'Edit Address' : 'Add New Address'}</Text>
            
            <TouchableOpacity style={styles.gpsBtn} onPress={fetchGPS} disabled={isFetchingGPS}>
              {isFetchingGPS ? <ActivityIndicator color="#001016" /> : <Text style={styles.gpsBtnText}>🎯 Use GPS Location</Text>}
            </TouchableOpacity>
            {newLocation && <Text style={{color: theme.colors.primary, fontSize: 12, marginBottom: 10}}>✓ GPS Coordinates Saved</Text>}

            <TextInput style={styles.modalInput} placeholder="Label (e.g. Home, Office)" placeholderTextColor={theme.colors.textDim} value={newLabel} onChangeText={setNewLabel} />
            <TextInput style={styles.modalInput} placeholder="Street Address" placeholderTextColor={theme.colors.textDim} value={newStreet} onChangeText={setNewStreet} />
            <TextInput style={styles.modalInput} placeholder="City" placeholderTextColor={theme.colors.textDim} value={newCity} onChangeText={setNewCity} />
            <TextInput style={styles.modalInput} placeholder="Pincode" placeholderTextColor={theme.colors.textDim} value={newPincode} onChangeText={setNewPincode} keyboardType="number-pad" />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveAddress} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#001016" /> : <Text style={styles.modalSaveBtnText}>Save Address</Text>}
            </TouchableOpacity>
          </View>
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
    color: '#001016',
    fontSize: 15,
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
