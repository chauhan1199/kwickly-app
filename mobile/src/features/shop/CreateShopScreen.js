import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { Store, MapPin } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

export default function CreateShopScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const c = theme.colors;
  const s = createStyles(theme);

  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [tempLocation, setTempLocation] = useState({ lat: 19.0760, lng: 72.8777 });

  const [form, setForm] = useState({
    name: '',
    category: 'General',
    address: '',
    description: '',
    logo: null,
  });
  const [location, setLocation] = useState({ lat: 19.0760, lng: 72.8777 });
  const [hours, setHours] = useState({ monFri: '9 AM – 10 PM', sat: '9 AM – 10 PM', sun: 'Closed' });
  const [delivery, setDelivery] = useState({ radiusKm: '3', fee: '40', freeAbove: '1000' });

  const pickLogo = async () => {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (!r.didCancel && r.assets?.length) setForm(p => ({ ...p, logo: r.assets[0] }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Shop name is required');
    if (!form.category.trim()) return Alert.alert('Error', 'Category is required');
    if (!form.address.trim()) return Alert.alert('Error', 'Address is required');
    if (!form.description.trim()) return Alert.alert('Error', 'Description is required');

    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('category', form.category.trim() || 'General');
      fd.append('address', form.address.trim());
      fd.append('description', form.description.trim());
      fd.append('location', JSON.stringify({ type: 'Point', coordinates: [location.lng, location.lat] }));
      fd.append('businessHours', JSON.stringify(hours));
      fd.append('delivery', JSON.stringify({
        radiusKm: Number(delivery.radiusKm) || 3,
        fee: Number(delivery.fee) || 40,
        freeAbove: Number(delivery.freeAbove) || 1000,
      }));
      if (form.logo?.uri) {
        fd.append('logo', { uri: form.logo.uri, type: form.logo.type, name: form.logo.fileName || 'logo.jpg' });
      }

      const res = await api.post('/shops', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.status === 'success') {
        Alert.alert('Shop Created', 'Your shop has been created successfully!', [
          { text: 'OK', onPress: () => navigation.replace('ShopApp') },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to create shop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: c.text }}>Create Your Shop</Text>
              <Text style={{ fontSize: 14, color: c.textDim, marginTop: 4 }}>Set up your shop to start receiving orders</Text>
            </View>

            {/* Logo */}
            <TouchableOpacity style={s.logoBox} onPress={pickLogo}>
              {form.logo ? (
                <Image source={{ uri: form.logo.uri }} style={{ width: 80, height: 80, borderRadius: 20 }} />
              ) : (
                <Store size={32} color="#FFF" />
              )}
            </TouchableOpacity>
            <Text style={{ color: c.primary, fontSize: 12, marginTop: 6, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>
              Tap to add shop logo
            </Text>

            {/* Shop Name */}
            <Text style={s.label}>Shop Name *</Text>
            <TextInput style={s.input} value={form.name} onChangeText={t => setForm(p => ({ ...p, name: t }))} placeholder="e.g. Sharma Grocery Store" placeholderTextColor={c.textDim} />

            {/* Category & Address row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Category *</Text>
                <TextInput style={s.input} value={form.category} onChangeText={t => setForm(p => ({ ...p, category: t }))} placeholder="e.g. Grocery" placeholderTextColor={c.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Address *</Text>
                <TextInput style={s.input} value={form.address} onChangeText={t => setForm(p => ({ ...p, address: t }))} placeholder="e.g. Sector 5, Noida" placeholderTextColor={c.textDim} />
              </View>
            </View>

            {/* Description */}
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline value={form.description} onChangeText={t => setForm(p => ({ ...p, description: t }))} placeholder="Brief description of your shop..." placeholderTextColor={c.textDim} />

            {/* Location */}
            <Text style={s.label}>GPS Location</Text>
            <TouchableOpacity style={s.outlineBtn} onPress={() => { setTempLocation(location); setShowMap(true); }}>
              <MapPin size={16} color={c.primary} />
              <Text style={[s.outlineBtnText, { marginLeft: 8 }]}>Choose on Map</Text>
            </TouchableOpacity>
            <Text style={{ color: c.textDim, fontSize: 12, marginTop: 4, marginBottom: 4 }}>
              Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
            </Text>

            {/* Business Hours */}
            <Text style={[s.label, { marginTop: 16 }]}>Business Hours</Text>
            {[
              { label: 'Mon – Fri', key: 'monFri' },
              { label: 'Saturday', key: 'sat' },
              { label: 'Sunday', key: 'sun' },
            ].map(({ label, key }) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ width: 80, fontSize: 13, fontWeight: '700', color: c.text }}>{label}</Text>
                <TextInput style={[s.input, { flex: 1, height: 40, marginBottom: 0 }]} value={hours[key]} onChangeText={t => setHours(p => ({ ...p, [key]: t }))} placeholder="e.g. 9 AM – 9 PM" placeholderTextColor={c.textDim} />
              </View>
            ))}

            {/* Delivery */}
            <Text style={[s.label, { marginTop: 16 }]}>Delivery Settings</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Radius (km)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={delivery.radiusKm} onChangeText={t => setDelivery(p => ({ ...p, radiusKm: t }))} placeholder="3" placeholderTextColor={c.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Fee (₹)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={delivery.fee} onChangeText={t => setDelivery(p => ({ ...p, fee: t }))} placeholder="40" placeholderTextColor={c.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Free Above (₹)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={delivery.freeAbove} onChangeText={t => setDelivery(p => ({ ...p, freeAbove: t }))} placeholder="1000" placeholderTextColor={c.textDim} />
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity style={[s.primaryBtn, { marginTop: 24 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#001016" /> : <Text style={s.primaryBtnText}>Create Shop</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Map Picker */}
        {showMap && (
          <View style={StyleSheet.absoluteFill}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.8)' }}>
                <TouchableOpacity onPress={() => setShowMap(false)}>
                  <Text style={{ color: c.primary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFF' }}>Select Location</Text>
                <TouchableOpacity onPress={() => { setLocation(tempLocation); setShowMap(false); }}>
                  <Text style={{ color: c.primary, fontSize: 16, fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{ latitude: tempLocation.lat, longitude: tempLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                onPress={(e) => setTempLocation({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
              >
                <Marker coordinate={{ latitude: tempLocation.lat, longitude: tempLocation.lng }} draggable onDragEnd={(e) => setTempLocation({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })} />
              </MapView>
            </SafeAreaView>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  logoBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', overflow: 'hidden' },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.surface, marginBottom: 2 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  outlineBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  primaryBtn: { backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#001016', fontSize: 15, fontWeight: '800' },
});
