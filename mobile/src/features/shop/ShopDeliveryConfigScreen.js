import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Switch, TouchableOpacity, Alert, StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { shopService } from '../../services/shopService';
import {
  Truck, DollarSign, MapPin, Clock, Tag, Save, ChevronRight, Plus, X,
  ChevronLeft, Bell
} from 'lucide-react-native';

const ShopDeliveryConfigScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState(null);

  const [config, setConfig] = useState({
    deliveryRadiusKm: 5,
    minOrderAmount: 100,
    freeDeliveryAbove: 500,
    deliveryCharge: 40,
    discountEnabled: false,
    discountAbove: 1000,
    discountType: 'flat',
    discountValue: 100,
    discountPct: 10,
    maxDiscountCap: 200,
    sameDayDelivery: true,
    deliverySlots: []
  });

  const [newSlot, setNewSlot] = useState({ label: '', slotOpen: '10:00', slotClose: '13:00' });
  const [showAddSlot, setShowAddSlot] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const shopRes = await shopService.getMyShop();
      if (shopRes.data?.status === 'success' && shopRes.data.data) {
        const shop = shopRes.data.data;
        setShopId(shop._id);
        if (shop.deliveryConfig) {
          setConfig(prev => ({ ...prev, ...shop.deliveryConfig }));
        } else if (shop.delivery) {
          setConfig(prev => ({
            ...prev,
            deliveryRadiusKm: shop.delivery.radiusKm || 5,
            deliveryCharge: shop.delivery.fee || 0,
            freeDeliveryAbove: shop.delivery.freeAbove || 0,
          }));
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load shop configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!shopId) return;
    
    let finalConfig = { ...config };
    if (showAddSlot && newSlot.label.trim()) {
      finalConfig.deliverySlots = [...(finalConfig.deliverySlots || []), { ...newSlot }];
      setConfig(finalConfig);
      setNewSlot({ label: '', slotOpen: '10:00', slotClose: '13:00' });
      setShowAddSlot(false);
    }

    try {
      setSaving(true);
      await shopService.updateDeliveryConfig(shopId, finalConfig);
      Alert.alert('Saved! ✅', 'Delivery configuration updated successfully');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addSlot = () => {
    if (!newSlot.label.trim()) {
      return Alert.alert('Missing Label', 'Please enter a label for this slot');
    }
    setConfig(prev => ({
      ...prev,
      deliverySlots: [...prev.deliverySlots, { ...newSlot }]
    }));
    setNewSlot({ label: '', slotOpen: '10:00', slotClose: '13:00' });
    setShowAddSlot(false);
  };

  const removeSlot = (index) => {
    setConfig(prev => ({
      ...prev,
      deliverySlots: prev.deliverySlots.filter((_, i) => i !== index)
    }));
  };

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5830E0" translucent={false} />
      
      {/* ── Modern Rounded Gradient Hero Header ── */}
      <LinearGradient 
        colors={['#5830E0', '#7447FF', '#8F66FF']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={[styles.heroGradient, { paddingTop: Math.max(insets.top, 12) + 6 }]}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <View style={styles.appBar}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.appBarTitle} numberOfLines={1}>Delivery Config</Text>
              <Text style={styles.appBarSubtitle}>Manage fees, radius & slots</Text>
            </View>
          </View>
          <View style={styles.appBarActions}>
            <TouchableOpacity 
              style={styles.appBarIconBtn} 
              onPress={() => navigation.navigate('ShopNotifications')}
              activeOpacity={0.8}
            >
              <Bell size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery Radius */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Delivery Radius</Text>
          </View>
          <Text style={styles.sectionDesc}>How far from your shop you deliver</Text>
          <View style={styles.sliderRow}>
            <TextInput
              style={styles.numberInput}
              value={String(config.deliveryRadiusKm)}
              onChangeText={v => update('deliveryRadiusKm', parseFloat(v) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.unit}>km</Text>
          </View>
          <View style={styles.radiusChips}>
            {[3, 5, 8, 10, 15, 20].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, config.deliveryRadiusKm === r && styles.chipActive]}
                onPress={() => update('deliveryRadiusKm', r)}
              >
                <Text style={[styles.chipText, config.deliveryRadiusKm === r && styles.chipTextActive]}>{r} km</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Minimum Order */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Minimum Order Amount</Text>
          </View>
          <View style={styles.sliderRow}>
            <TextInput
              style={styles.numberInput}
              value={String(config.minOrderAmount)}
              onChangeText={v => update('minOrderAmount', parseFloat(v) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.unit}>₹</Text>
          </View>
        </View>

        {/* Delivery Charge */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Truck size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Delivery Charge</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Charge (₹)</Text>
              <TextInput
                style={styles.input}
                value={String(config.deliveryCharge)}
                onChangeText={v => update('deliveryCharge', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Free above (₹)</Text>
              <TextInput
                style={styles.input}
                value={config.freeDeliveryAbove ? String(config.freeDeliveryAbove) : ''}
                onChangeText={v => update('freeDeliveryAbove', parseFloat(v) || null)}
                keyboardType="numeric"
                placeholder="No limit"
                placeholderTextColor={theme.colors.textDim}
              />
            </View>
          </View>
        </View>

        {/* Discount Config */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Tag size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Discount Settings</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={config.discountEnabled}
              onValueChange={v => update('discountEnabled', v)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
              thumbColor={config.discountEnabled ? theme.colors.primary : theme.colors.textDim}
            />
          </View>

          {config.discountEnabled && (
            <>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Min order (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(config.discountAbove || '')}
                    onChangeText={v => update('discountAbove', parseFloat(v) || 0)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.typeRow}>
                    <TouchableOpacity
                      style={[styles.typeBtn, config.discountType === 'flat' && styles.typeBtnActive]}
                      onPress={() => update('discountType', 'flat')}
                    >
                      <Text style={[styles.typeText, config.discountType === 'flat' && styles.typeTextActive]}>₹ Flat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeBtn, config.discountType === 'percentage' && styles.typeBtnActive]}
                      onPress={() => update('discountType', 'percentage')}
                    >
                      <Text style={[styles.typeText, config.discountType === 'percentage' && styles.typeTextActive]}>% %</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>{config.discountType === 'flat' ? 'Discount (₹)' : 'Discount (%)'}</Text>
                  <TextInput
                    style={styles.input}
                    value={config.discountType === 'flat' ? String(config.discountValue) : String(config.discountPct)}
                    onChangeText={v => {
                      const val = parseFloat(v) || 0;
                      if (config.discountType === 'flat') update('discountValue', val);
                      else update('discountPct', val);
                    }}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Max cap (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={config.maxDiscountCap ? String(config.maxDiscountCap) : ''}
                    onChangeText={v => update('maxDiscountCap', parseFloat(v) || null)}
                    keyboardType="numeric"
                    placeholder="No cap"
                    placeholderTextColor={theme.colors.textDim}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Same Day Delivery */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Same Day Delivery</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={config.sameDayDelivery}
              onValueChange={v => update('sameDayDelivery', v)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
              thumbColor={config.sameDayDelivery ? theme.colors.primary : theme.colors.textDim}
            />
          </View>
        </View>

        {/* Delivery Slots */}
        {config.sameDayDelivery && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={18} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Delivery Slots</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowAddSlot(true)} style={styles.addSlotBtn}>
                <Plus size={16} color="#001016" />
                <Text style={styles.addSlotText}>Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionDesc}>Time windows for delivery</Text>

            {config.deliverySlots.map((slot, idx) => (
              <View key={idx} style={styles.slotItem}>
                <Clock size={16} color={theme.colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  <Text style={styles.slotTime}>{slot.slotOpen} – {slot.slotClose}</Text>
                </View>
                <TouchableOpacity onPress={() => removeSlot(idx)}>
                  <X size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}

            {showAddSlot && (
              <View style={styles.addSlotForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Slot label (e.g. 10AM-1PM)"
                  placeholderTextColor={theme.colors.textDim}
                  value={newSlot.label}
                  onChangeText={v => setNewSlot(prev => ({ ...prev, label: v }))}
                />
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={styles.label}>Open</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10:00"
                      placeholderTextColor={theme.colors.textDim}
                      value={newSlot.slotOpen}
                      onChangeText={v => setNewSlot(prev => ({ ...prev, slotOpen: v }))}
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.label}>Close</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="13:00"
                      placeholderTextColor={theme.colors.textDim}
                      value={newSlot.slotClose}
                      onChangeText={v => setNewSlot(prev => ({ ...prev, slotClose: v }))}
                    />
                  </View>
                </View>
                <View style={styles.slotFormActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddSlot(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={addSlot}>
                    <Text style={styles.confirmText}>Add Slot</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={handleSave}
        >
          <Save size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Configuration'}</Text>
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' },
  heroGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  blob1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blob2: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 52,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  appBarSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content:      { padding: 16 },
  section:      { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, flex: 1 },
  sectionDesc:  { fontSize: 12, color: theme.colors.textDim, marginTop: 4, marginBottom: 12 },
  sliderRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberInput:  { flex: 1, backgroundColor: theme.colors.background, borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '700', color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border, textAlign: 'center' },
  unit:         { fontSize: 14, fontWeight: '700', color: theme.colors.textDim },
  radiusChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  chipActive:   { borderColor: '#6C47FF', backgroundColor: '#F3F0FF' },
  chipText:     { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },
  chipTextActive:{ color: '#6C47FF' },
  row:          { flexDirection: 'row', gap: 12, marginTop: 10 },
  halfField:    { flex: 1 },
  label:        { fontSize: 12, fontWeight: '600', color: theme.colors.textDim, marginBottom: 6 },
  input:        { backgroundColor: theme.colors.background, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: '600', color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  typeRow:      { flexDirection: 'row', gap: 8 },
  typeBtn:      { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background, alignItems: 'center' },
  typeBtnActive:{ borderColor: '#6C47FF', backgroundColor: '#F3F0FF' },
  typeText:     { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },
  typeTextActive:{ color: '#6C47FF' },
  addSlotBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6C47FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addSlotText:  { fontSize: 12, fontWeight: '800', color: '#FFF' },
  slotItem:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  slotLabel:    { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  slotTime:     { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  addSlotForm:  { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', backgroundColor: '#F3F0FF' },
  slotFormActions:{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cancelText:   { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },
  confirmBtn:   { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#6C47FF' },
  confirmText:  { fontSize: 13, fontWeight: '800', color: '#FFF' },
  saveBar:      { padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6C47FF', paddingVertical: 16, borderRadius: 14 },
  saveBtnText:  { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

export default ShopDeliveryConfigScreen;
