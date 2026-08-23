import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import { getImageUrl, requestCameraPermission } from '../../utils/helpers';
import {
  Bell, Store, Clock, Truck, ShieldCheck,
  CreditCard, BarChart2, LogOut, ChevronRight,
  Eye, Download, Moon, Sun, Trash2, Menu, Leaf, MapPin, X, MessageCircle
} from 'lucide-react-native';

/* ─────────────────────────────────────────────────────────────
   BOTTOM SHEET MODAL COMPONENT
   ───────────────────────────────────────────────────────────── */
const BottomSheetModal = ({ visible, onClose, title, children }) => {
  const { theme } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          {/* Close on backdrop tap */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          {/* Sheet panel */}
          <View style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            maxHeight: '90%',
          }}>
            {/* Handle */}
            <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.text }}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 4, backgroundColor: theme.colors.surface, borderRadius: 16 }}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ═════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═════════════════════════════════════════════════════════════ */
export default function ShopSettingsScreen({ navigation }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { signOut } = useAuth();

  // ── Data State ──
  const [shop, setShop] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [accounts, setAccounts] = useState([]);

  // ── Modal visibility ──
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Form State ──
  const [editDetails, setEditDetails] = useState({ name: '', description: '', ownerName: '' });
  const [editCategory, setEditCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLocation, setEditLocation] = useState({ lat: 0, lng: 0 });
  const [editLogo, setEditLogo] = useState(null);
  const [editHours, setEditHours] = useState({ monFri: '9 AM – 10 PM', sat: '9 AM – 10 PM', sun: 'Closed' });

  // ── KYC Form ──
  const [showDocForm, setShowDocForm] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', type: '', uri: '' });
  const [docViewerVisible, setDocViewerVisible] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState(null);

  // ── Payout Form ──
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [newPayout, setNewPayout] = useState({ id: null, type: 'BANK', name: '', accountNumber: '', ifscCode: '', upiId: '' });

  // ── Analytics ──
  const [analyticsFilter, setAnalyticsFilter] = useState('ALL');
  const [analyticsData, setAnalyticsData] = useState({ revenue: 0, orders: 0, rating: 0, categories: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Saving state ──
  const [saving, setSaving] = useState(false);

  // ── Map State ──
  const [showMap, setShowMap] = useState(false);
  const [tempLocation, setTempLocation] = useState({ lat: 19.0760, lng: 72.8777 });

  /* ════════════════════════════
     FETCH SHOP DATA
     ════════════════════════════ */
  const loadShop = useCallback(async () => {
    try {
      const res = await shopService.getMyShop();
      if (res.data?.status === 'success') {
        const s = res.data.data;
        setShop(s);
        setIsOnline(!!s.isOnline);
        setEditDetails({ name: s.name || '', description: s.description || '', ownerName: s.ownerId?.name || '' });
        setEditCategory(s.category || 'General');
        setEditAddress(s.address || '');
        if (s.logoUrl) setEditLogo({ uri: getImageUrl(s.logoUrl) });
        if (s.location?.coordinates?.length === 2 && (s.location.coordinates[0] !== 0 || s.location.coordinates[1] !== 0)) {
          setEditLocation({ lng: s.location.coordinates[0], lat: s.location.coordinates[1] });
        } else {
          setEditLocation({ lat: 28.6139, lng: 77.2090 });
        }
        setEditHours({
          monFri: s.businessHours?.monFri || '9 AM – 10 PM',
          sat: s.businessHours?.sat || '9 AM – 10 PM',
          sun: s.businessHours?.sun || 'Closed',
        });
        if (Array.isArray(s.payoutMethods)) {
          setAccounts(s.payoutMethods.map((m, i) => ({
            id: m._id || String(i),
            type: m.type === 'UPI' ? 'upi' : 'bank',
            name: m.type === 'UPI' ? 'UPI Account' : (m.bankName || 'Bank Account'),
            detail: m.detail || '',
            isPrimary: !!m.isPrimary,
            original: m,
          })));
        }
      }
    } catch (err) {
      // silently handle shop load error
    }
  }, []);

  useEffect(() => { loadShop(); }, [loadShop]);

  /* ════════════════════════════
     ANALYTICS
     ════════════════════════════ */
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await shopService.getShopOrders();
      if (res.data?.status === 'success') {
        const list = res.data.data.orders || res.data.data;
        const orders = Array.isArray(list) ? list : [];
        const now = Date.now();
        const filtered = orders.filter(o => {
          if (analyticsFilter === 'ALL') return true;
          const d = new Date(o.createdAt).getTime();
          if (analyticsFilter === 'WEEK') return now - d < 7 * 864e5;
          if (analyticsFilter === 'MONTH') return now - d < 30 * 864e5;
          return true;
        });
        const revenue = filtered.reduce((a, o) => a + (o.total || 0), 0);
        const counts = {};
        let total = 0;
        filtered.forEach(o => (o.items || []).forEach(it => {
          counts[it.name] = (counts[it.name] || 0) + (it.qty || 1);
          total += (it.qty || 1);
        }));
        const categories = Object.keys(counts)
          .map(name => ({ name, qty: counts[name], percent: total ? `${Math.round(counts[name] / total * 100)}%` : '0%' }))
          .sort((a, b) => b.qty - a.qty).slice(0, 5);
        if (!categories.length) categories.push({ name: 'No sales yet', percent: '—' });
        setAnalyticsData({ revenue, orders: filtered.length, rating: shop?.rating || 0, categories });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsFilter, shop?.rating]);

  useEffect(() => { if (analyticsOpen) loadAnalytics(); }, [analyticsOpen, analyticsFilter, loadAnalytics]);

  /* ════════════════════════════
     HANDLERS
     ════════════════════════════ */
  const toggleOnline = async (val) => {
    setIsOnline(val);
    try { await shopService.updateMyShop({ isOnline: val }); }
    catch { setIsOnline(!val); Alert.alert('Error', 'Failed to update visibility'); }
  };

  const pickLogo = () => {
    Alert.alert(
      'Upload Logo',
      'Choose an option to upload shop logo',
      [
        {
          text: '📷 Take Photo (Camera)',
          onPress: async () => {
            try {
              const hasPerm = await requestCameraPermission();
              if (!hasPerm) {
                Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
                return;
              }
              const r = await launchCamera({ mediaType: 'photo', quality: 0.8, includeBase64: true, saveToPhotos: true });
              if (!r.didCancel && r.assets?.length) setEditLogo(r.assets[0]);
            } catch (err) {
              Alert.alert('Error', 'Camera unavailable or failed');
            }
          },
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            try {
              const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: true });
              if (!r.didCancel && r.assets?.length) setEditLogo(r.assets[0]);
            } catch (err) {
              Alert.alert('Error', 'Failed to open gallery');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const saveDetails = async () => {
    if (!editDetails.name || editDetails.name.trim().length < 3) {
      Alert.alert('Validation Error', 'Shop name must be at least 3 characters');
      return;
    }
    try {
      setSaving(true);

      if (editDetails.ownerName?.trim()) {
        try {
          await shopService.updateOwnerName(editDetails.ownerName.trim());
        } catch (e) {
          // silently handle owner name update
        }
      }

      const payload = {
        name: editDetails.name.trim(),
        category: editCategory?.trim() || 'General',
        description: editDetails.description?.trim() || '',
        address: editAddress?.trim() || '',
        location: {
          type: 'Point',
          coordinates: [
            (editLocation?.lng && editLocation.lng !== 0) ? editLocation.lng : 77.2090,
            (editLocation?.lat && editLocation.lat !== 0) ? editLocation.lat : 28.6139,
          ],
        },
      };

      if (editLogo?.base64) {
        payload.logoBase64 = editLogo.base64.startsWith('data:')
          ? editLogo.base64
          : `data:${editLogo.type || 'image/jpeg'};base64,${editLogo.base64}`;
      }

      const res = await shopService.updateMyShop(payload);

      if (res.data?.status === 'success') { 
        setShop(res.data.data); 
        setDetailsOpen(false); 
        Alert.alert('✓ Saved', 'Shop details updated successfully'); 
        loadShop();
      }
    } catch (e) {
      let errMsg = e?.response?.data?.message || e?.message || 'Failed to save details';
      if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
      Alert.alert('Error', String(errMsg));
    }
    finally { setSaving(false); }
  };

  const saveHours = async () => {
    try {
      setSaving(true);
      const res = await shopService.updateMyShop({ businessHours: editHours });
      if (res.data?.status === 'success') { setShop(res.data.data); setHoursOpen(false); Alert.alert('✓ Saved', 'Business hours updated'); }
    } catch { Alert.alert('Error', 'Failed to save hours'); }
    finally { setSaving(false); }
  };

  const pickDocument = async () => {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: true });
    if (!r.didCancel && r.assets?.length) {
      const a = r.assets[0];
      setNewDoc({ name: newDoc.name || a.fileName || 'Document', type: a.type || 'image/jpeg', uri: a.uri, base64: a.base64 });
    }
  };

  const submitDoc = async () => {
    if (!newDoc.name.trim()) return Alert.alert('Error', 'Enter a document label');
    if (!newDoc.uri) return Alert.alert('Error', 'Select a file first');
    if (!newDoc.base64) return Alert.alert('Error', 'Invalid file format. Please select an image.');
    try {
      setSaving(true);
      
      const uploadRes = await shopService.uploadBase64({
        base64: `data:${newDoc.type};base64,${newDoc.base64}`,
        mimeType: newDoc.type,
        fileName: newDoc.name
      });
      
      const remoteUrl = uploadRes.data?.data?.url;
      if (!remoteUrl) throw new Error('Upload failed');

      const docs = [...(shop?.kyc?.documents || []), { name: newDoc.name, type: newDoc.type, url: remoteUrl }];
      const res = await shopService.updateMyShop({ kyc: { ...shop?.kyc, status: 'PENDING', documents: docs } });
      if (res.data?.status === 'success') {
        setShop(res.data.data);
        setNewDoc({ name: '', type: '', uri: '', base64: '' });
        setShowDocForm(false);
        Alert.alert('✓ Submitted', 'Document sent for admin review');
      }
    } catch (e) { Alert.alert('Error', 'Failed to upload document'); }
    finally { setSaving(false); }
  };

  const deleteDoc = (index) => {
    Alert.alert('Delete', 'Remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const docs = (shop?.kyc?.documents || []).filter((_, i) => i !== index);
          const res = await shopService.updateMyShop({ kyc: { ...shop?.kyc, documents: docs } });
          if (res.data?.status === 'success') setShop(res.data.data);
        } catch { Alert.alert('Error', 'Failed to delete document'); }
      }},
    ]);
  };

  const addPayout = async () => {
    const payload = { type: newPayout.type };
    if (newPayout.type === 'BANK') {
      if (!newPayout.name || !newPayout.accountNumber || !newPayout.ifscCode)
        return Alert.alert('Error', 'Fill all bank fields');
      payload.label = newPayout.name;
      payload.detail = `${newPayout.accountNumber} IFSC: ${newPayout.ifscCode}`;
    } else {
      if (!newPayout.upiId) return Alert.alert('Error', 'Enter UPI ID');
      payload.detail = newPayout.upiId;
    }
    try {
      setSaving(true);
      if (newPayout.id) {
        const r = await shopService.addPayoutMethod(payload);
        if (r.data?.status === 'success') await shopService.deletePayoutMethod(newPayout.id);
      } else {
        await shopService.addPayoutMethod(payload);
      }
      await loadShop();
      setNewPayout({ id: null, type: 'BANK', name: '', accountNumber: '', ifscCode: '', upiId: '' });
      setShowPayoutForm(false);
    } catch { Alert.alert('Error', 'Failed to save payout method'); }
    finally { setSaving(false); }
  };

  const setPrimary = async (id) => {
    try { await shopService.setPrimaryPayoutMethod(id); await loadShop(); }
    catch { Alert.alert('Error', 'Failed to set primary'); }
  };

  const deletePayout = (id) => {
    Alert.alert('Delete', 'Remove this account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await shopService.deletePayoutMethod(id); await loadShop(); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  const deleteShop = () => {
    Alert.alert(
      'Delete Shop',
      'Are you sure you want to permanently delete your shop? All products and data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const res = await shopService.deleteMyShop();
              if (res.data?.status === 'success') {
                Alert.alert('Shop Deleted', 'Your shop has been deleted.');
                signOut();
              }
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to delete shop');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  /* ════════════════════════════
     STYLES (inline for simplicity)
     ════════════════════════════ */
  const c = theme.colors;
  const s = createStyles(theme, isDarkMode);

  /* ════════════════════════════
     RENDER
     ════════════════════════════ */
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={c.background} />

        {/* App Bar */}
        <View style={s.appBar}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View>
              <Text style={s.appBarTitle}>Shop Settings</Text>
              <Text style={s.appBarSubtitle}>{shop?.name || 'Manage settings'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={s.appBarIconBtn} onPress={toggleTheme}>
              {isDarkMode ? <Sun size={20} color={c.text} /> : <Moon size={20} color={c.text} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.appBarIconBtn} onPress={() => navigation.navigate('ShopNotifications')}>
              <Bell size={20} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>

          {/* Profile Card */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.logo, { backgroundColor: '#10B981' }]}>
                {editLogo ? (
                  <Image source={{ uri: editLogo.uri }} style={{ width: 52, height: 52, borderRadius: 12 }} />
                ) : (
                  <Leaf size={28} color="#FFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.shopName}>{shop?.name || 'My Shop'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <MapPin size={12} color={theme.colors.error} style={{ marginRight: 4 }} />
                  <Text style={s.shopSub}>
                    {shop?.address || 'Address not set'}
                  </Text>
                </View>
                <Text style={[s.shopSub, { marginTop: 4 }]}>📞 +91 9876543210  ·  {shop?.totalOrders ?? 0} orders</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Store Visibility</Text>
                <Text style={{ fontSize: 12, color: c.textDim }}>Allow customers to place orders</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOnline ? '#6C47FF' : '#9CA3AF' }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isOnline ? '#6C47FF' : '#9CA3AF' }}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
                <Switch value={isOnline} onValueChange={toggleOnline}
                  trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                  thumbColor={isOnline ? '#6C47FF' : '#f4f3f4'} />
              </View>
            </View>
          </View>

          {/* Group 1: Store Management */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.textDim, marginBottom: 8, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Store Management
          </Text>
          <View style={s.menuCard}>
            {[
              { icon: Store,       color: '#6C47FF', title: 'Shop Details & Address', sub: shop?.address || 'Name, description, location', onPress: () => setDetailsOpen(true) },
              { icon: Clock,       color: '#7C3AED', title: 'Business Hours',        sub: shop?.businessHours?.monFri || '9 AM – 10 PM', onPress: () => setHoursOpen(true) },
              { icon: Truck,       color: '#8B5CF6', title: 'Delivery Configuration', sub: 'Slots, delivery fees, radius', onPress: () => navigation.navigate('ShopDeliveryConfig') },
            ].map(({ icon: Icon, color, title, sub, onPress }, i, arr) => (
              <Pressable
                key={title}
                style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={onPress}
              >
                <View style={[s.menuIcon, { backgroundColor: color + '18' }]}>
                  <Icon size={19} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.menuTitle}>{title}</Text>
                  <Text style={s.menuSub} numberOfLines={1}>{sub}</Text>
                </View>
                <ChevronRight size={18} color={c.border} />
              </Pressable>
            ))}
          </View>

          {/* Group 2: Finance & Compliance */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.textDim, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Finance & Verification
          </Text>
          <View style={s.menuCard}>
            {[
              { icon: CreditCard,  color: '#059669', title: 'Payout Bank & UPI',      sub: accounts.length ? `${accounts.length} active payout method(s)` : 'Add Bank or UPI for withdrawals', onPress: () => setPayoutOpen(true) },
              { icon: ShieldCheck, color: '#9333EA', title: 'KYC & GST Documents',    sub: `Status: ${shop?.kyc?.status || 'PENDING'}`, onPress: () => setKycOpen(true) },
              { icon: BarChart2,   color: '#0284C7', title: 'Analytics & Insights',  sub: 'Revenue, order statistics, PDF reports', onPress: () => setAnalyticsOpen(true) },
            ].map(({ icon: Icon, color, title, sub, onPress }, i, arr) => (
              <Pressable
                key={title}
                style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={onPress}
              >
                <View style={[s.menuIcon, { backgroundColor: color + '18' }]}>
                  <Icon size={19} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.menuTitle}>{title}</Text>
                  <Text style={s.menuSub} numberOfLines={1}>{sub}</Text>
                </View>
                <ChevronRight size={18} color={c.border} />
              </Pressable>
            ))}
          </View>

          {/* Group 3: Preferences & Display */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.textDim, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Preferences & Support
          </Text>
          <View style={s.menuCard}>
            <View style={[s.menuItem, { paddingVertical: 14 }]}>
              <View style={[s.menuIcon, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : 'rgba(245, 158, 11, 0.15)' }]}>
                {isDarkMode ? <Moon size={19} color="#8B6FFF" /> : <Sun size={19} color="#F59E0B" />}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.menuTitle}>Dark Theme</Text>
                <Text style={s.menuSub}>{isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: '#6C47FF' }}
                thumbColor={'#FFFFFF'}
              />
            </View>

            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('HelpSupport')}
            >
              <View style={[s.menuIcon, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
                <MessageCircle size={19} color="#7C3AED" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.menuTitle}>Help & Support</Text>
                <Text style={s.menuSub}>Chat with customer support, FAQs</Text>
              </View>
              <ChevronRight size={18} color={c.border} />
            </Pressable>
          </View>

          {/* Group 4: Account Actions */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.textDim, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Account
          </Text>
          <View style={s.menuCard}>
            {/* Log Out */}
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }]}
              onPress={signOut}
            >
              <View style={[s.menuIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <LogOut size={19} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.menuTitle, { color: '#EF4444' }]}>Log Out</Text>
                <Text style={s.menuSub}>Sign out of your shop session</Text>
              </View>
              <ChevronRight size={18} color={c.border} />
            </Pressable>

            {/* Delete Shop */}
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.65 }, { borderBottomWidth: 0 }]}
              onPress={deleteShop}
            >
              <View style={[s.menuIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Trash2 size={19} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.menuTitle, { color: '#EF4444' }]}>Delete Store</Text>
                <Text style={s.menuSub}>Permanently delete shop and catalog</Text>
              </View>
              <ChevronRight size={18} color={c.border} />
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ══════════════════════════════════════════════
          1. SHOP DETAILS & ADDRESS
          ══════════════════════════════════════════════ */}
      <BottomSheetModal visible={detailsOpen} onClose={() => setDetailsOpen(false)} title="Shop Details & Address">
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity style={s.logoBox} onPress={pickLogo}>
            {editLogo ? (
              <Image source={{ uri: editLogo.uri }} style={{ width: 90, height: 90, borderRadius: 22 }} />
            ) : (
              <Store size={38} color="#FFF" />
            )}
          </TouchableOpacity>
          <Text style={{ color: c.primary, fontSize: 12, marginTop: 6, fontWeight: '600' }}>Tap to change logo</Text>
        </View>

        <Text style={s.label}>Shop Name *</Text>
        <TextInput style={s.input} value={editDetails.name} onChangeText={t => setEditDetails(p => ({ ...p, name: t }))} placeholder="e.g. Hardware Shop" placeholderTextColor={c.textDim} />

        <Text style={s.label}>Category</Text>
        <TextInput style={s.input} value={editCategory} onChangeText={setEditCategory} placeholder="e.g. Stationary, Grocery" placeholderTextColor={c.textDim} />

        <Text style={s.label}>Owner Name</Text>
        <TextInput style={s.input} value={editDetails.ownerName} onChangeText={t => setEditDetails(p => ({ ...p, ownerName: t }))} placeholder="e.g. John Doe" placeholderTextColor={c.textDim} />

        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, s.inputTA]} multiline value={editDetails.description} onChangeText={t => setEditDetails(p => ({ ...p, description: t }))} placeholder="Brief description..." placeholderTextColor={c.textDim} />

        <Text style={s.label}>Complete Address</Text>
        <TextInput style={[s.input, s.inputTA]} multiline value={editAddress} onChangeText={setEditAddress} placeholder="Street, area, city, pincode..." placeholderTextColor={c.textDim} />

        <Text style={s.label}>GPS Location</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TouchableOpacity style={[s.outlineBtn, { flex: 1 }]} onPress={() => { 
            const initLat = (editLocation.lat && editLocation.lat !== 0) ? editLocation.lat : 28.6139;
            const initLng = (editLocation.lng && editLocation.lng !== 0) ? editLocation.lng : 77.2090;
            setTempLocation({ lat: initLat, lng: initLng }); 
            setShowMap(true); 
          }}>
            <Text style={s.outlineBtnText}>📍 Choose on Map</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: c.textDim, fontSize: 12, marginBottom: 16 }}>
          Lat: {editLocation.lat.toFixed(4)}, Lng: {editLocation.lng.toFixed(4)}
        </Text>

        <TouchableOpacity style={s.primaryBtn} onPress={saveDetails} disabled={saving}>
          {saving ? <ActivityIndicator color="#001016" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </BottomSheetModal>

      {/* ══════════════════════════════════════════════
          2. BUSINESS HOURS
          ══════════════════════════════════════════════ */}
      <BottomSheetModal visible={hoursOpen} onClose={() => setHoursOpen(false)} title="Business Hours">
        {[
          { label: 'Mon – Fri', key: 'monFri' },
          { label: 'Saturday', key: 'sat' },
          { label: 'Sunday', key: 'sun' },
        ].map(({ label, key }) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ width: 85, fontSize: 14, fontWeight: '700', color: c.text }}>{label}</Text>
            <TextInput
              style={[s.input, { flex: 1, height: 44, marginBottom: 0 }]}
              value={editHours[key]}
              onChangeText={t => setEditHours(p => ({ ...p, [key]: t }))}
              placeholder="e.g. 9 AM – 9 PM"
              placeholderTextColor={c.textDim}
            />
          </View>
        ))}
        <TouchableOpacity style={[s.primaryBtn, { marginTop: 8 }]} onPress={saveHours} disabled={saving}>
          {saving ? <ActivityIndicator color="#001016" /> : <Text style={s.primaryBtnText}>Save Hours</Text>}
        </TouchableOpacity>
      </BottomSheetModal>

      {/* ══════════════════════════════════════════════
          4. KYC / GST
          ══════════════════════════════════════════════ */}
      <BottomSheetModal visible={kycOpen} onClose={() => setKycOpen(false)} title="KYC & Documents">
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ color: '#065F46', fontWeight: '800', fontSize: 13 }}>
            KYC Status: {shop?.kyc?.status || 'PENDING'}
          </Text>
        </View>

        {shop?.kyc?.documents?.length > 0 ? shop.kyc.documents.map((doc, i) => (
          <View key={i} style={s.docCard}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{doc.name}</Text>
              <Text style={{ fontSize: 12, color: c.textDim }}>{doc.type}</Text>
            </View>
            <TouchableOpacity style={s.docBtn} onPress={() => {
              if (doc.url) {
                setDocViewerUrl(getImageUrl(doc.url));
                setDocViewerVisible(true);
              } else {
                Alert.alert('Error', 'No document URL found');
              }
            }}>
              <Eye size={13} color={c.primary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary, marginLeft: 4 }}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.docBtn, { backgroundColor: '#FEF2F2', marginLeft: 6 }]} onPress={() => deleteDoc(i)}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )) : (
          <Text style={{ color: c.textDim, textAlign: 'center', marginVertical: 20 }}>No documents uploaded yet.</Text>
        )}

        {showDocForm ? (
          <View style={{ backgroundColor: c.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, marginTop: 12 }}>
            <Text style={s.label}>Document Label</Text>
            <TextInput style={s.input} value={newDoc.name} onChangeText={t => setNewDoc(p => ({ ...p, name: t }))} placeholder="e.g. GST Certificate" placeholderTextColor={c.textDim} />

            <Text style={s.label}>File</Text>
            <TouchableOpacity style={s.dashedBtn} onPress={pickDocument}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>{newDoc.uri ? `✓ File selected (${newDoc.type})` : '+ Select Image / File'}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={submitDoc} disabled={saving}>
                {saving ? <ActivityIndicator color="#001016" /> : <Text style={s.primaryBtnText}>Upload & Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.outlineBtn, { marginTop: 0 }]} onPress={() => setShowDocForm(false)}>
                <Text style={s.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[s.dashedBtn, { marginTop: 12 }]} onPress={() => setShowDocForm(true)}>
            <Text style={{ color: c.primary, fontWeight: '700', fontSize: 14 }}>+ Upload New Document</Text>
          </TouchableOpacity>
        )}
      </BottomSheetModal>

      {/* ══════════════════════════════════════════════
          5. PAYOUT METHODS
          ══════════════════════════════════════════════ */}
      <BottomSheetModal visible={payoutOpen} onClose={() => setPayoutOpen(false)} title="Payout Methods">
        {accounts.map(acc => (
          <View key={acc.id} style={[s.accountCard, acc.isPrimary && s.accountCardPrimary]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>{acc.type === 'upi' ? '📱' : '🏦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }}>{acc.name}</Text>
                <Text style={{ fontSize: 12, color: c.textDim, marginTop: 2 }}>{acc.detail}</Text>
              </View>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              {acc.isPrimary ? (
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: '#059669', fontSize: 11, fontWeight: '800' }}>Primary</Text>
                </View>
              ) : (
                <TouchableOpacity style={s.smallBtn} onPress={() => setPrimary(acc.id)}>
                  <Text style={s.smallBtnText}>Set Primary</Text>
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={[s.smallBtn, { backgroundColor: c.primary + '18' }]} onPress={() => {
                  const o = acc.original;
                  if (o.type === 'UPI') setNewPayout({ id: acc.id, type: 'UPI', name: '', accountNumber: '', ifscCode: '', upiId: o.detail });
                  else {
                    const [acct, ifsc] = o.detail?.includes('IFSC:') ? o.detail.split(' IFSC: ') : [o.detail, ''];
                    setNewPayout({ id: acc.id, type: 'BANK', name: o.bankName || '', accountNumber: acct?.trim() || '', ifscCode: ifsc?.trim() || '', upiId: '' });
                  }
                  setShowPayoutForm(true);
                }}>
                  <Text style={[s.smallBtnText, { color: c.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.smallBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => deletePayout(acc.id)}>
                  <Text style={[s.smallBtnText, { color: '#DC2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {showPayoutForm ? (
          <View style={{ backgroundColor: c.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {['BANK', 'UPI'].map(t => (
                <TouchableOpacity key={t} style={[s.outlineBtn, { flex: 1 }, newPayout.type === t && { backgroundColor: c.primary, borderColor: c.primary }]}
                  onPress={() => setNewPayout(p => ({ ...p, type: t }))}>
                  <Text style={[s.outlineBtnText, newPayout.type === t && { color: '#FFF' }]}>{t === 'BANK' ? '🏦 Bank' : '📱 UPI'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {newPayout.type === 'BANK' ? (
              <>
                <Text style={s.label}>Bank Name</Text>
                <TextInput style={s.input} value={newPayout.name} onChangeText={t => setNewPayout(p => ({ ...p, name: t }))} placeholder="e.g. HDFC Bank" placeholderTextColor={c.textDim} />
                <Text style={s.label}>Account Number</Text>
                <TextInput style={s.input} keyboardType="numeric" value={newPayout.accountNumber} onChangeText={t => setNewPayout(p => ({ ...p, accountNumber: t }))} placeholder="12345678901234" placeholderTextColor={c.textDim} />
                <Text style={s.label}>IFSC Code</Text>
                <TextInput style={s.input} value={newPayout.ifscCode} onChangeText={t => setNewPayout(p => ({ ...p, ifscCode: t }))} placeholder="HDFC0001234" placeholderTextColor={c.textDim} />
              </>
            ) : (
              <>
                <Text style={s.label}>UPI ID</Text>
                <TextInput style={s.input} value={newPayout.upiId} onChangeText={t => setNewPayout(p => ({ ...p, upiId: t }))} placeholder="yourshop@upi" placeholderTextColor={c.textDim} />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={addPayout} disabled={saving}>
                {saving ? <ActivityIndicator color="#001016" /> : <Text style={s.primaryBtnText}>{newPayout.id ? 'Save Changes' : 'Add Method'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.outlineBtn, { marginTop: 0 }]} onPress={() => { setShowPayoutForm(false); setNewPayout({ id: null, type: 'BANK', name: '', accountNumber: '', ifscCode: '', upiId: '' }); }}>
                <Text style={s.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[s.primaryBtn, { marginTop: 14 }]} onPress={() => setShowPayoutForm(true)}>
            <Text style={s.primaryBtnText}>+ Add New Method</Text>
          </TouchableOpacity>
        )}
      </BottomSheetModal>

      {/* ══════════════════════════════════════════════
          6. ANALYTICS & REPORTS
          ══════════════════════════════════════════════ */}
      <BottomSheetModal visible={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Shop Analytics">
        {/* Filter tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: c.border, marginBottom: 20 }}>
          {[{ key: 'ALL', label: 'All Time' }, { key: 'WEEK', label: 'This Week' }, { key: 'MONTH', label: 'This Month' }].map(({ key, label }) => (
            <TouchableOpacity key={key}
              style={[{ flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' }, analyticsFilter === key && { backgroundColor: c.primary }]}
              onPress={() => setAnalyticsFilter(key)}>
              <Text style={[{ fontSize: 12, fontWeight: '700', color: c.textDim }, analyticsFilter === key && { color: '#FFF' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {analyticsLoading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Metrics */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
              {[
                { label: 'Revenue', value: `₹${analyticsData.revenue.toLocaleString()}`, color: '#0D9488' },
                { label: 'Orders', value: String(analyticsData.orders), color: '#F59E0B' },
                { label: 'Rating', value: `${analyticsData.rating} ★`, color: '#3B82F6' },
                { label: 'Repeat', value: '—', color: '#8B5CF6' },
              ].map(({ label, value, color }) => (
                <View key={label} style={{ width: '47%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color, marginBottom: 4 }}>{value}</Text>
                  <Text style={{ fontSize: 13, color: c.textDim, fontWeight: '600' }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Top Selling */}
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 10 }}>Top Selling Products</Text>
            <View style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 20 }}>
              {analyticsData.categories.map((cat, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < analyticsData.categories.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{cat.name}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: c.primary }}>{cat.percent}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderWidth: 1.5, borderColor: c.primary, borderRadius: 14, backgroundColor: c.surface }}
              onPress={() => Alert.alert('Report', 'PDF report download coming soon!')}>
              <Download size={18} color={c.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: c.primary, fontSize: 15, fontWeight: '800' }}>Download PDF Report</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetModal>

      {/* ══════════════════════════════════════════════
          MAP PICKER MODAL
          ══════════════════════════════════════════════ */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <TouchableOpacity onPress={() => setShowMap(false)} style={{ padding: 4 }}>
              <Text style={{ color: c.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: c.text }}>Select Location</Text>
            <TouchableOpacity onPress={() => { setEditLocation(tempLocation); setShowMap(false); }} style={{ padding: 4 }}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: 'bold' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <LeafletMapPicker
            style={{ flex: 1 }}
            latitude={tempLocation.lat}
            longitude={tempLocation.lng}
            onLocationSelect={(coords) => setTempLocation(coords)}
          />
          <View style={{ padding: 20, backgroundColor: c.card }}>
            <Text style={{ color: c.textDim, textAlign: 'center', marginBottom: 12 }}>Tap anywhere on the map or drag the marker to set your shop's location.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => { setEditLocation(tempLocation); setShowMap(false); }}>
              <Text style={s.primaryBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════
          DOCUMENT VIEWER MODAL
          ══════════════════════════════════════════════ */}
      <Modal visible={docViewerVisible} transparent animationType="fade" onRequestClose={() => setDocViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
            onPress={() => setDocViewerVisible(false)}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          {docViewerUrl && (
            <Image 
              source={{ uri: docViewerUrl }} 
              style={{ width: '90%', height: '80%' }} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

    </View>
  );
}

/* ════════════════════════════
   STYLES
   ════════════════════════════ */
const createStyles = (theme, isDark) => {
  const c = theme.colors;
  return StyleSheet.create({
    appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
    appBarTitle: { fontSize: 22, fontWeight: '800', color: c.text },
    appBarSubtitle: { fontSize: 13, color: c.textDim, marginTop: 1 },
    appBarIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative'
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: 'bold',
    },

    card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 20, elevation: 2 },
    logo: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', marginRight: 14, overflow: 'hidden' },
    shopName: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 3 },
    shopSub: { fontSize: 12, color: c.textDim, marginBottom: 2 },

    menuCard: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    menuTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    menuSub: { fontSize: 12, color: c.textDim },

    label: { fontSize: 13, fontWeight: '600', color: c.textDim, marginBottom: 6, marginTop: 14 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, color: c.text, backgroundColor: c.surface, marginBottom: 2 },
    inputTA: { height: 80, textAlignVertical: 'top', paddingTop: 12 },

    primaryBtn: { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
    primaryBtnText: { color: '#001016', fontSize: 15, fontWeight: '800' },
    outlineBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center' },
    outlineBtnText: { color: c.text, fontSize: 13, fontWeight: '700' },
    dashedBtn: { paddingVertical: 16, borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', backgroundColor: c.surface },

    logoBox: { width: 90, height: 90, borderRadius: 22, backgroundColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

    docCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginBottom: 10 },
    docBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.primary + '18' },

    accountCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, padding: 14, borderRadius: 14, marginBottom: 10 },
    accountCardPrimary: { borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
    smallBtn: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    smallBtnText: { color: c.text, fontSize: 11, fontWeight: '700' },
  });
};
