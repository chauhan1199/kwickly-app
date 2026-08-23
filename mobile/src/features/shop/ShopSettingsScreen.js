import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Share,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { shopService } from '../../services/shopService';
import { getImageUrl, requestCameraPermission } from '../../utils/helpers';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  Store,
  Clock,
  Truck,
  ShieldCheck,
  CreditCard,
  BarChart2,
  Trash2,
  LogOut,
  ChevronRight,
  MapPin,
  Camera,
  X,
  Eye,
  Download,
  Share2,
  Sun,
  Moon,
  Bell,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  Layers,
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
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
            padding: 22,
            paddingBottom: Platform.OS === 'ios' ? 36 : 20,
            maxHeight: '92%',
          }}>
            {/* Handle */}
            <View style={{ width: 44, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '900', color: theme.colors.text }}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 6, backgroundColor: theme.colors.surface, borderRadius: 16 }}>
                <X size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 80 }}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const KYC_PRESETS = [
  { key: 'GST_CERTIFICATE', label: 'GST Registration Certificate', icon: '🏛️' },
  { key: 'SHOP_LICENSE', label: 'Shop & Establishment License (Gumasta)', icon: '📜' },
  { key: 'FSSAI_LICENSE', label: 'FSSAI Food License', icon: '🍲' },
  { key: 'PAN_CARD', label: 'Business PAN Card', icon: '💳' },
  { key: 'AADHAAR_CARD', label: 'Owner Aadhaar Card', icon: '🆔' },
  { key: 'TRADE_LICENSE', label: 'Trade / Municipal License', icon: '📑' },
  { key: 'OTHER', label: 'Other Business Document', icon: '📄' },
];

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */
const ShopSettingsScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const c = theme.colors;

  /* ── State ── */
  const [shop, setShop] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  // Sub-modal visibility
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Form states
  const [editDetails, setEditDetails] = useState({ name: '', description: '', phone: '' });
  const [editAddress, setEditAddress] = useState('');
  const [editLogo, setEditLogo] = useState(null);
  const [editLocation, setEditLocation] = useState({ lat: 28.6139, lng: 77.2090 });
  const [tempLocation, setTempLocation] = useState({ lat: 28.6139, lng: 77.2090 });
  const [showMap, setShowMap] = useState(false);

  const [editHours, setEditHours] = useState({
    monFri: '9:00 AM – 10:00 PM',
    sat: '9:00 AM – 10:00 PM',
    sun: 'Closed',
  });

  // KYC
  const [newDoc, setNewDoc] = useState({ name: 'GST Registration Certificate', docType: 'GST_CERTIFICATE', type: '', uri: null, base64: null });
  const [showDocForm, setShowDocForm] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState(null);
  const [docViewerVisible, setDocViewerVisible] = useState(false);

  // Payout
  const [accounts, setAccounts] = useState([]);
  const [newPayout, setNewPayout] = useState({ id: null, type: 'BANK', name: '', accountNumber: '', ifscCode: '', upiId: '' });
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  // Analytics
  const [analyticsFilter, setAnalyticsFilter] = useState('ALL');
  const [analyticsData, setAnalyticsData] = useState({ revenue: 0, orders: 0, rating: 5.0, repeatRate: '0%', topProducts: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  /* ════════════════════════════
     LOAD SHOP DATA
     ════════════════════════════ */
  const loadShop = useCallback(async () => {
    try {
      const res = await shopService.getMyShop();
      if (res.data?.status === 'success') {
        const s = res.data.data;
        setShop(s);
        setIsOnline(s.isOnline !== undefined ? s.isOnline : true);
        setEditDetails({
          name: s.name || '',
          description: s.description || '',
          phone: s.phone || '',
        });
        setEditAddress(s.address || '');
        if (s.logoUrl) setEditLogo({ uri: getImageUrl(s.logoUrl) });
        if (s.location?.coordinates?.length === 2 && (s.location.coordinates[0] !== 0 || s.location.coordinates[1] !== 0)) {
          setEditLocation({ lng: s.location.coordinates[0], lat: s.location.coordinates[1] });
        } else {
          setEditLocation({ lat: 28.6139, lng: 77.2090 });
        }
        setEditHours({
          monFri: s.businessHours?.monFri || '9:00 AM – 10:00 PM',
          sat: s.businessHours?.sat || '9:00 AM – 10:00 PM',
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
      // silently handle
    }
  }, []);

  useEffect(() => { loadShop(); }, [loadShop]);

  /* ════════════════════════════
     ANALYTICS (100% DYNAMIC)
     ════════════════════════════ */
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await shopService.getShopOrders();
      if (res.data?.status === 'success') {
        const list = res.data.data.orders || res.data.data;
        const orders = Array.isArray(list) ? list : [];
        const now = Date.now();

        // Filter valid orders by selected timeframe
        const filtered = orders.filter(o => {
          if (o.status && o.status.toUpperCase() === 'CANCELLED') return false;
          if (analyticsFilter === 'ALL') return true;
          const d = new Date(o.createdAt).getTime();
          if (analyticsFilter === 'WEEK') return now - d < 7 * 864e5;
          if (analyticsFilter === 'MONTH') return now - d < 30 * 864e5;
          return true;
        });

        // 1. Exact Dynamic Revenue
        const revenue = filtered.reduce((a, o) => a + (o.totalAmount || o.payment?.amount || o.total || 0), 0);

        // 2. Exact Dynamic Repeat Customer Rate
        const custMap = {};
        filtered.forEach(o => {
          const cid = o.customerId?._id || o.customerId?.id || o.customerId || o.customer;
          if (cid) custMap[cid] = (custMap[cid] || 0) + 1;
        });
        const totalUniqueCust = Object.keys(custMap).length;
        const repeatCust = Object.values(custMap).filter(c => c > 1).length;
        const repeatRate = totalUniqueCust > 0 ? `${Math.round((repeatCust / totalUniqueCust) * 100)}%` : '0%';

        // 3. Top Selling Products
        const counts = {};
        let totalUnitsSold = 0;
        filtered.forEach(o => (o.items || []).forEach(it => {
          const pName = it.name || it.productName || 'Item';
          const qty = it.quantity || it.qty || 1;
          counts[pName] = (counts[pName] || 0) + qty;
          totalUnitsSold += qty;
        }));

        const topProducts = Object.keys(counts)
          .map(name => ({
            name,
            qty: counts[name],
            percent: totalUnitsSold ? `${Math.round((counts[name] / totalUnitsSold) * 100)}%` : '0%'
          }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);

        if (!topProducts.length) {
          topProducts.push({ name: 'No sales recorded in this period', percent: '0%' });
        }

        setAnalyticsData({
          revenue,
          orders: filtered.length,
          rating: shop?.rating || 5.0,
          repeatRate,
          topProducts
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load live shop analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsFilter, shop?.rating]);

  useEffect(() => { 
    if (analyticsOpen) loadAnalytics(); 
  }, [analyticsOpen, analyticsFilter, loadAnalytics]);

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
    if (!editDetails.name.trim()) return Alert.alert('Error', 'Shop name is required');
    setSaving(true);
    try {
      const payload = {
        name: editDetails.name.trim(),
        description: editDetails.description.trim(),
        address: editAddress.trim(),
        location: { type: 'Point', coordinates: [editLocation.lng, editLocation.lat] },
      };
      if (editLogo?.base64) payload.logoBase64 = `data:${editLogo.type || 'image/jpeg'};base64,${editLogo.base64}`;
      await shopService.updateMyShop(payload);
      if (editDetails.phone.trim()) {
        try { await shopService.updateOwner({ name: editDetails.name.trim(), phone: editDetails.phone.trim() }); } catch {}
      }
      setDetailsOpen(false);
      loadShop();
      Alert.alert('Success 🎉', 'Shop details updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update shop details');
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      await shopService.updateMyShop({ businessHours: editHours });
      setHoursOpen(false);
      loadShop();
      Alert.alert('Success ✅', 'Business operating hours updated');
    } catch {
      Alert.alert('Error', 'Failed to update business hours');
    } finally {
      setSaving(false);
    }
  };

  // KYC Handlers
  const pickDocument = () => {
    Alert.alert(
      'Upload Document',
      'Select source for document photo',
      [
        {
          text: '📷 Take Photo',
          onPress: async () => {
            try {
              const hasPerm = await requestCameraPermission();
              if (!hasPerm) {
                Alert.alert('Permission Denied', 'Camera permission required.');
                return;
              }
              const r = await launchCamera({ mediaType: 'photo', quality: 0.8, includeBase64: true, saveToPhotos: true });
              if (!r.didCancel && r.assets?.length) {
                const a = r.assets[0];
                setNewDoc(prev => ({ ...prev, type: a.type || 'image/jpeg', uri: a.uri, base64: a.base64 }));
              }
            } catch (err) {
              Alert.alert('Error', 'Camera failed');
            }
          }
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            try {
              const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: true });
              if (!r.didCancel && r.assets?.length) {
                const a = r.assets[0];
                setNewDoc(prev => ({ ...prev, type: a.type || 'image/jpeg', uri: a.uri, base64: a.base64 }));
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to open gallery');
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const submitDoc = async () => {
    if (!newDoc.uri) {
      Alert.alert('Validation Error', 'Please select or capture a document image.');
      return;
    }
    if (!newDoc.name || !newDoc.name.trim()) {
      Alert.alert('Validation Error', 'Please specify a document name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        documentName: newDoc.name.trim(),
        documentType: newDoc.docType || 'OTHER',
        documentBase64: newDoc.base64 ? `data:${newDoc.type || 'image/jpeg'};base64,${newDoc.base64}` : undefined,
      };
      await shopService.uploadKycDocument(payload);
      Alert.alert('Success 🎉', `"${newDoc.name}" submitted for verification.`);
      setShowDocForm(false);
      setNewDoc({ name: 'GST Registration Certificate', docType: 'GST_CERTIFICATE', type: '', uri: null, base64: null });
      loadShop();
    } catch (e) {
      Alert.alert('Upload Failed', e?.response?.data?.message || 'Failed to upload KYC document');
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = (index) => {
    Alert.alert('Delete Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shopService.removeKycDocument(index);
            loadShop();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete document');
          }
        }
      }
    ]);
  };

  // Payout Handlers
  const addPayout = async () => {
    if (newPayout.type === 'BANK') {
      if (!newPayout.name.trim() || !newPayout.accountNumber.trim() || !newPayout.ifscCode.trim()) {
        return Alert.alert('Error', 'Please fill in all bank details');
      }
    } else {
      if (!newPayout.upiId.trim() || !newPayout.upiId.includes('@')) {
        return Alert.alert('Error', 'Please enter a valid UPI ID (e.g. name@bank)');
      }
    }

    setSaving(true);
    try {
      const payload = {
        type: newPayout.type,
        bankName: newPayout.type === 'BANK' ? newPayout.name.trim() : undefined,
        detail: newPayout.type === 'BANK' 
          ? `${newPayout.accountNumber.trim()} IFSC: ${newPayout.ifscCode.trim().toUpperCase()}` 
          : newPayout.upiId.trim(),
        isPrimary: accounts.length === 0,
      };

      if (newPayout.id) {
        await shopService.deletePayoutMethod(newPayout.id);
      }
      await shopService.addPayoutMethod(payload);

      setNewPayout({ id: null, type: 'BANK', name: '', accountNumber: '', ifscCode: '', upiId: '' });
      setShowPayoutForm(false);
      loadShop();
      Alert.alert('Success ✅', 'Payout method saved successfully');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save payout method');
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async (id) => {
    try {
      await shopService.setPrimaryPayout(id);
      loadShop();
    } catch {
      Alert.alert('Error', 'Failed to set primary method');
    }
  };

  const deletePayout = (id) => {
    Alert.alert('Delete Method', 'Are you sure you want to delete this payout method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shopService.deletePayoutMethod(id);
            loadShop();
          } catch {
            Alert.alert('Error', 'Failed to delete payout method');
          }
        },
      },
    ]);
  };

  const deleteShop = () => {
    Alert.alert(
      '⚠️ Delete Shop',
      'This will permanently delete your store, catalog items, and order history. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await shopService.deleteMyShop();
              signOut();
            } catch {
              Alert.alert('Error', 'Failed to delete shop');
            }
          },
        },
      ]
    );
  };

  const shareAnalyticsReport = async () => {
    try {
      const reportText = `📊 *Kwickly Store Analytics Report*\n` +
        `🏪 *Store:* ${shop?.name || 'My Shop'}\n` +
        `📅 *Period:* ${analyticsFilter === 'ALL' ? 'All Time' : analyticsFilter === 'WEEK' ? 'This Week' : 'This Month'}\n\n` +
        `💰 *Revenue:* ₹${analyticsData.revenue.toLocaleString('en-IN')}\n` +
        `📦 *Total Orders:* ${analyticsData.orders}\n` +
        `⭐ *Store Rating:* ${analyticsData.rating} ★\n` +
        `🔄 *Repeat Customer Rate:* ${analyticsData.repeatRate}\n\n` +
        `🔥 *Top Selling Products:*\n` +
        analyticsData.topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.percent})`).join('\n');

      await Share.share({ message: reportText });
    } catch (e) {}
  };

  const s = createStyles(theme, isDarkMode);

  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

        {/* ── App Header ── */}
        <View style={s.appBar}>
          <View>
            <Text style={s.appBarTitle}>Shop Settings</Text>
            <Text style={s.appBarSubtitle}>{shop?.name || 'Store Management'}</Text>
          </View>

          <View style={s.appBarActions}>
            <TouchableOpacity style={s.iconBtn} onPress={toggleTheme} activeOpacity={0.7}>
              {isDarkMode ? <Sun size={19} color={c.text} /> : <Moon size={19} color={c.text} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('ShopNotifications')} activeOpacity={0.7}>
              <Bell size={19} color={c.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

          {/* Profile Card */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.logoWrap}>
                {editLogo ? (
                  <Image source={{ uri: editLogo.uri }} style={s.logoImg} />
                ) : (
                  <Store size={26} color="#6C47FF" />
                )}
                <TouchableOpacity style={s.logoEditBadge} onPress={pickLogo}>
                  <Camera size={12} color="#FFF" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.shopName}>{shop?.name || 'My Shop'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  <MapPin size={12} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={s.shopSub} numberOfLines={1}>
                    {shop?.address || 'Address not configured'}
                  </Text>
                </View>
                <Text style={[s.shopSub, { marginTop: 3 }]}>📞 {shop?.phone || '+91 9876543210'}  ·  {shop?.totalOrders ?? 0} orders</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', marginVertical: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }}>Store Visibility</Text>
                <Text style={{ fontSize: 12, color: c.textDim }}>Accept live customer orders</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? '#10B981' : '#94A3B8' }} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: isOnline ? '#10B981' : '#94A3B8' }}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
                <Switch 
                  value={isOnline} 
                  onValueChange={toggleOnline}
                  trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                  thumbColor={isOnline ? '#6C47FF' : '#f4f3f4'} 
                />
              </View>
            </View>
          </View>

          {/* Group 1: Store Management */}
          <Text style={s.sectionHeaderTitle}>Store Management</Text>
          <View style={s.menuCard}>
            {[
              { icon: Store,       color: '#6C47FF', title: 'Shop Details & Address', sub: shop?.address || 'Name, description, map location', onPress: () => setDetailsOpen(true) },
              { icon: Clock,       color: '#7C3AED', title: 'Business Hours',        sub: shop?.businessHours?.monFri || '9:00 AM – 10:00 PM', onPress: () => setHoursOpen(true) },
              { icon: Truck,       color: '#8B5CF6', title: 'Delivery Configuration', sub: 'Radius, delivery fees, time slots', onPress: () => navigation.navigate('ShopDeliveryConfig') },
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

          {/* Group 2: Finance & Verification */}
          <Text style={s.sectionHeaderTitle}>Finance & Verification</Text>
          <View style={s.menuCard}>
            {[
              { icon: CreditCard,  color: '#059669', title: 'Payout Bank & UPI',      sub: accounts.length ? `${accounts.length} active payout method(s)` : 'Add Bank or UPI for withdrawals', onPress: () => setPayoutOpen(true) },
              { icon: ShieldCheck, color: '#9333EA', title: 'KYC & Documents',        sub: `Status: ${shop?.kyc?.status || 'PENDING'} (${shop?.kyc?.documents?.length || 0} uploaded)`, onPress: () => setKycOpen(true) },
              { icon: BarChart2,   color: '#0284C7', title: 'Live Shop Analytics',     sub: 'Live revenue, order volume, repeat rate', onPress: () => setAnalyticsOpen(true) },
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

          {/* Group 3: Preferences & Support */}
          <Text style={s.sectionHeaderTitle}>Preferences & Support</Text>
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
          <Text style={s.sectionHeaderTitle}>Account</Text>
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
                <Text style={s.menuSub}>Sign out of your shop account</Text>
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

        {/* ══════════════════════════════════════════════
            1. SHOP DETAILS & ADDRESS MODAL
            ══════════════════════════════════════════════ */}
        <BottomSheetModal visible={detailsOpen} onClose={() => setDetailsOpen(false)} title="Shop Details">
          <Text style={s.label}>Shop Name *</Text>
          <TextInput style={s.input} value={editDetails.name} onChangeText={t => setEditDetails(p => ({ ...p, name: t }))} placeholder="e.g. FreshMart Groceries" placeholderTextColor={c.textDim} />

          <Text style={s.label}>Business Contact Phone</Text>
          <TextInput style={s.input} keyboardType="phone-pad" value={editDetails.phone} onChangeText={t => setEditDetails(p => ({ ...p, phone: t }))} placeholder="e.g. 9876543210" placeholderTextColor={c.textDim} />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, s.inputTA]} multiline value={editDetails.description} onChangeText={t => setEditDetails(p => ({ ...p, description: t }))} placeholder="Brief store overview..." placeholderTextColor={c.textDim} />

          <Text style={s.label}>Store Complete Address</Text>
          <TextInput style={[s.input, s.inputTA]} multiline value={editAddress} onChangeText={setEditAddress} placeholder="Shop number, street, landmark, city, pincode..." placeholderTextColor={c.textDim} />

          <Text style={s.label}>GPS Map Location</Text>
          <TouchableOpacity 
            style={[s.outlineBtn, { marginBottom: 8 }]} 
            onPress={() => { 
              const initLat = (editLocation.lat && editLocation.lat !== 0) ? editLocation.lat : 28.6139;
              const initLng = (editLocation.lng && editLocation.lng !== 0) ? editLocation.lng : 77.2090;
              setTempLocation({ lat: initLat, lng: initLng }); 
              setShowMap(true); 
            }}
          >
            <Text style={s.outlineBtnText}>📍 Pin Exact Store Location on Map</Text>
          </TouchableOpacity>
          <Text style={{ color: c.textDim, fontSize: 12, marginBottom: 16 }}>
            Coordinates: {editLocation.lat.toFixed(4)}, {editLocation.lng.toFixed(4)}
          </Text>

          <TouchableOpacity style={s.primaryBtn} onPress={saveDetails} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>Save Shop Details ✅</Text>}
          </TouchableOpacity>
        </BottomSheetModal>

        {/* ══════════════════════════════════════════════
            2. BUSINESS HOURS MODAL (WITH QUICK PRESETS)
            ══════════════════════════════════════════════ */}
        <BottomSheetModal visible={hoursOpen} onClose={() => setHoursOpen(false)} title="Business Operating Hours">
          <Text style={{ fontSize: 12, color: c.textDim, marginBottom: 14 }}>
            Set standard operating times when your store accepts orders from customers.
          </Text>

          {/* Quick Presets */}
          <Text style={s.label}>Quick Presets for Mon – Sat</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {['8:00 AM – 10:00 PM', '9:00 AM – 9:00 PM', '10:00 AM – 11:00 PM', '24 Hours Open'].map(preset => (
              <TouchableOpacity
                key={preset}
                style={[s.presetChip, editHours.monFri === preset && s.presetChipActive]}
                onPress={() => setEditHours(prev => ({ ...prev, monFri: preset, sat: preset }))}
              >
                <Text style={[s.presetChipText, editHours.monFri === preset && s.presetChipTextActive]}>{preset}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {[
            { label: 'Mon – Fri', key: 'monFri' },
            { label: 'Saturday', key: 'sat' },
            { label: 'Sunday', key: 'sun' },
          ].map(({ label, key }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: c.text }}>{label}</Text>
                {key === 'sun' && (
                  <TouchableOpacity onPress={() => setEditHours(p => ({ ...p, sun: p.sun === 'Closed' ? '9:00 AM – 9:00 PM' : 'Closed' }))}>
                    <Text style={{ color: '#6C47FF', fontWeight: '800', fontSize: 12 }}>
                      {editHours.sun === 'Closed' ? 'Set Open' : 'Mark Closed'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={s.input}
                value={editHours[key]}
                onChangeText={t => setEditHours(p => ({ ...p, [key]: t }))}
                placeholder="e.g. 9:00 AM – 10:00 PM"
                placeholderTextColor={c.textDim}
              />
            </View>
          ))}

          <TouchableOpacity style={[s.primaryBtn, { marginTop: 10 }]} onPress={saveHours} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>Save Business Hours ✅</Text>}
          </TouchableOpacity>
        </BottomSheetModal>

        {/* ══════════════════════════════════════════════
            3. KYC & DOCUMENTS MODAL (UPGRADED DESIGN)
            ══════════════════════════════════════════════ */}
        <BottomSheetModal visible={kycOpen} onClose={() => setKycOpen(false)} title="KYC & Legal Documents">
          {/* Status Banner Card */}
          <View style={[
            s.kycStatusBanner,
            shop?.kyc?.status === 'APPROVED' ? s.kycStatusBannerApproved : shop?.kyc?.status === 'REJECTED' ? s.kycStatusBannerRejected : s.kycStatusBannerPending
          ]}>
            <View style={s.kycStatusIconWrap}>
              {shop?.kyc?.status === 'APPROVED' ? (
                <CheckCircle2 size={22} color="#15803D" />
              ) : shop?.kyc?.status === 'REJECTED' ? (
                <AlertCircle size={22} color="#DC2626" />
              ) : (
                <Clock size={22} color="#B45309" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[
                s.kycStatusTitle,
                { color: shop?.kyc?.status === 'APPROVED' ? '#15803D' : shop?.kyc?.status === 'REJECTED' ? '#DC2626' : '#B45309' }
              ]}>
                {shop?.kyc?.status === 'APPROVED' ? 'Verified Store Partner ✓' : shop?.kyc?.status === 'REJECTED' ? 'Verification Action Required ✕' : 'Verification Under Review ⏳'}
              </Text>
              <Text style={[
                s.kycStatusDesc,
                { color: shop?.kyc?.status === 'APPROVED' ? '#166534' : shop?.kyc?.status === 'REJECTED' ? '#991B1B' : '#92400E' }
              ]}>
                {shop?.kyc?.status === 'APPROVED'
                  ? 'All business credentials verified. Your store is active for customer orders.'
                  : shop?.kyc?.status === 'REJECTED'
                  ? (shop?.kyc?.rejectReason || 'Documents did not meet verification criteria. Please re-upload clear photos.')
                  : 'Your legal credentials have been submitted and are being reviewed by the admin.'}
              </Text>
            </View>
          </View>

          {/* List of uploaded documents */}
          {shop?.kyc?.documents?.length > 0 ? (
            <View style={{ gap: 12, marginBottom: 16 }}>
              {shop.kyc.documents.map((doc, i) => {
                const preset = KYC_PRESETS.find(p => p.key === doc.docType || p.label === doc.name) || { icon: '📄', category: 'Business Doc' };
                const formattedDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently Uploaded';

                return (
                  <View key={i} style={s.docCard}>
                    {/* Top Row: Icon + Name + Category */}
                    <View style={s.docCardTop}>
                      <View style={s.docIconBox}>
                        <Text style={{ fontSize: 22 }}>{preset.icon}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.docName}>{doc.name}</Text>
                        <View style={s.docMetaRow}>
                          <View style={s.docCategoryChip}>
                            <Text style={s.docCategoryText}>{preset.category || doc.docType || 'Document'}</Text>
                          </View>
                          <Text style={s.docDateText}>• {formattedDate}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={s.cardDivider} />

                    {/* Bottom Action Bar */}
                    <View style={s.docActionsRow}>
                      <TouchableOpacity 
                        style={s.docViewBtn} 
                        onPress={() => {
                          if (doc.url) {
                            setDocViewerUrl(getImageUrl(doc.url));
                            setDocViewerVisible(true);
                          } else {
                            Alert.alert('Error', 'No document preview available');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Eye size={15} color="#6C47FF" />
                        <Text style={s.docViewBtnText}>View Document</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={s.docDeleteBtn} 
                        onPress={() => deleteDoc(i)}
                        activeOpacity={0.8}
                      >
                        <Trash2 size={15} color="#EF4444" />
                        <Text style={s.docDeleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyDocState}>
              <View style={s.emptyDocIconBox}>
                <UploadCloud size={36} color="#6C47FF" />
              </View>
              <Text style={s.emptyDocText}>No legal documents uploaded yet</Text>
              <Text style={s.emptyDocSub}>Upload GST, FSSAI, or Shop License for fast approval.</Text>
            </View>
          )}

          {/* Upload Document Form */}
          {showDocForm ? (
            <View style={s.docUploadBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: c.text }}>Upload New Document</Text>
                <TouchableOpacity onPress={() => setShowDocForm(false)} style={{ padding: 4 }}>
                  <X size={18} color={c.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={s.label}>1. Select Document Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {KYC_PRESETS.map(preset => {
                  const isSelected = newDoc.docType === preset.key;
                  return (
                    <TouchableOpacity
                      key={preset.key}
                      style={[s.presetChip, isSelected && s.presetChipActive]}
                      onPress={() => setNewDoc(prev => ({ ...prev, docType: preset.key, name: preset.label }))}
                    >
                      <Text style={[s.presetChipText, isSelected && s.presetChipTextActive]}>
                        {preset.icon} {preset.label.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>2. Document Name / Label</Text>
              <TextInput 
                style={s.input} 
                value={newDoc.name} 
                onChangeText={t => setNewDoc(p => ({ ...p, name: t }))} 
                placeholder="e.g. GST Registration Certificate" 
                placeholderTextColor={c.textDim} 
              />

              <Text style={s.label}>3. Document Photo / File</Text>
              <TouchableOpacity style={s.dashedBtn} onPress={pickDocument} activeOpacity={0.8}>
                {newDoc.uri ? (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Image source={{ uri: newDoc.uri }} style={{ width: 100, height: 80, borderRadius: 10 }} resizeMode="cover" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={14} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13 }}>Document image selected</Text>
                    </View>
                    <Text style={{ color: c.textDim, fontSize: 11 }}>Tap to choose a different photo</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Camera size={26} color="#6C47FF" />
                    <Text style={{ color: '#6C47FF', fontWeight: '800', fontSize: 14 }}>+ Tap to Take Photo or Select File</Text>
                    <Text style={{ color: c.textDim, fontSize: 11 }}>JPG, PNG or PDF supported (Max 5MB)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={submitDoc} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>Upload & Submit ✅</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.outlineBtn, { marginTop: 0 }]} onPress={() => setShowDocForm(false)}>
                  <Text style={s.outlineBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.addDocBtn} onPress={() => setShowDocForm(true)} activeOpacity={0.88}>
              <UploadCloud size={18} color="#FFFFFF" />
              <Text style={s.addDocBtnText}>+ Upload New KYC Document</Text>
            </TouchableOpacity>
          )}
        </BottomSheetModal>

        {/* ══════════════════════════════════════════════
            4. PAYOUT METHODS MODAL
            ══════════════════════════════════════════════ */}
        <BottomSheetModal visible={payoutOpen} onClose={() => setPayoutOpen(false)} title="Payout Bank & UPI">
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
                  <TouchableOpacity style={[s.smallBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => deletePayout(acc.id)}>
                    <Text style={[s.smallBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {showPayoutForm ? (
            <View style={s.payoutFormBox}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {['BANK', 'UPI'].map(t => (
                  <TouchableOpacity 
                    key={t} 
                    style={[s.outlineBtn, { flex: 1 }, newPayout.type === t && { backgroundColor: '#6C47FF', borderColor: '#6C47FF' }]}
                    onPress={() => setNewPayout(p => ({ ...p, type: t }))}
                  >
                    <Text style={[s.outlineBtnText, newPayout.type === t && { color: '#FFF' }]}>
                      {t === 'BANK' ? '🏦 Bank Account' : '📱 UPI ID'}
                    </Text>
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
                  <TextInput style={s.input} value={newPayout.ifscCode} onChangeText={t => setNewPayout(p => ({ ...p, ifscCode: t.toUpperCase() }))} placeholder="HDFC0001234" placeholderTextColor={c.textDim} autoCapitalize="characters" />
                </>
              ) : (
                <>
                  <Text style={s.label}>UPI ID</Text>
                  <TextInput style={s.input} value={newPayout.upiId} onChangeText={t => setNewPayout(p => ({ ...p, upiId: t }))} placeholder="e.g. yourshop@oksbi" placeholderTextColor={c.textDim} autoCapitalize="none" />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={addPayout} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>Save Method ✅</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.outlineBtn, { marginTop: 0 }]} onPress={() => setShowPayoutForm(false)}>
                  <Text style={s.outlineBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[s.primaryBtn, { marginTop: 14 }]} onPress={() => setShowPayoutForm(true)}>
              <Text style={s.primaryBtnText}>+ Add Payout Method</Text>
            </TouchableOpacity>
          )}
        </BottomSheetModal>

        {/* ══════════════════════════════════════════════
            5. LIVE ANALYTICS MODAL (100% DYNAMIC)
            ══════════════════════════════════════════════ */}
        <BottomSheetModal visible={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Store Performance Analytics">
          {/* Time Filter Tabs */}
          <View style={s.analyticsTabRow}>
            {[{ key: 'ALL', label: 'All Time' }, { key: 'WEEK', label: 'This Week' }, { key: 'MONTH', label: 'This Month' }].map(({ key, label }) => (
              <TouchableOpacity 
                key={key}
                style={[s.analyticsTabBtn, analyticsFilter === key && s.analyticsTabBtnActive]}
                onPress={() => setAnalyticsFilter(key)}
              >
                <Text style={[s.analyticsTabText, analyticsFilter === key && s.analyticsTabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {analyticsLoading ? (
            <ActivityIndicator size="large" color="#6C47FF" style={{ marginVertical: 40 }} />
          ) : (
            <>
              {/* 4 Dynamic Metric Tiles */}
              <View style={s.analyticsGrid}>
                <View style={s.analyticsTile}>
                  <Text style={[s.analyticsTileVal, { color: '#10B981' }]}>₹{analyticsData.revenue.toLocaleString('en-IN')}</Text>
                  <Text style={s.analyticsTileLabel}>Gross Revenue</Text>
                </View>
                <View style={s.analyticsTile}>
                  <Text style={[s.analyticsTileVal, { color: '#F59E0B' }]}>{analyticsData.orders}</Text>
                  <Text style={s.analyticsTileLabel}>Orders Completed</Text>
                </View>
                <View style={s.analyticsTile}>
                  <Text style={[s.analyticsTileVal, { color: '#0284C7' }]}>{analyticsData.rating.toFixed(1)} ★</Text>
                  <Text style={s.analyticsTileLabel}>Average Rating</Text>
                </View>
                <View style={s.analyticsTile}>
                  <Text style={[s.analyticsTileVal, { color: '#8B5CF6' }]}>{analyticsData.repeatRate}</Text>
                  <Text style={s.analyticsTileLabel}>Repeat Customer Rate</Text>
                </View>
              </View>

              {/* Dynamic Top Selling Products */}
              <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 10 }}>Top Selling Products ({analyticsFilter === 'ALL' ? 'All Time' : analyticsFilter === 'WEEK' ? '7 Days' : '30 Days'})</Text>
              <View style={s.topProductsCard}>
                {analyticsData.topProducts.map((p, i) => (
                  <View 
                    key={i} 
                    style={[
                      s.topProductRow, 
                      i === analyticsData.topProducts.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.topProductName} numberOfLines={1}>{p.name}</Text>
                      {p.qty ? <Text style={s.topProductUnits}>{p.qty} unit(s) sold</Text> : null}
                    </View>
                    <Text style={s.topProductPercent}>{p.percent}</Text>
                  </View>
                ))}
              </View>

              {/* Share / Download Report */}
              <TouchableOpacity
                style={s.shareReportBtn}
                onPress={shareAnalyticsReport}
                activeOpacity={0.85}
              >
                <Share2 size={18} color="#6C47FF" style={{ marginRight: 8 }} />
                <Text style={s.shareReportBtnText}>Share Performance Summary</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetModal>

        {/* ══════════════════════════════════════════════
            DOCUMENT VIEWER MODAL
            ══════════════════════════════════════════════ */}
        <Modal visible={docViewerVisible} transparent animationType="fade" onRequestClose={() => setDocViewerVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, padding: 10, zIndex: 10 }} onPress={() => setDocViewerVisible(false)}>
              <X size={26} color="#FFF" />
            </TouchableOpacity>
            {docViewerUrl ? (
              <Image source={{ uri: docViewerUrl }} style={{ width: '100%', height: '70%', borderRadius: 12 }} resizeMode="contain" />
            ) : null}
          </View>
        </Modal>

        {/* ══════════════════════════════════════════════
            MAP PICKER MODAL
            ══════════════════════════════════════════════ */}
        <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <TouchableOpacity onPress={() => setShowMap(false)} style={{ padding: 4 }}>
                <Text style={{ color: '#6C47FF', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: c.text }}>Select Store Location</Text>
              <TouchableOpacity onPress={() => { setEditLocation(tempLocation); setShowMap(false); }} style={{ padding: 4 }}>
                <Text style={{ color: '#6C47FF', fontSize: 15, fontWeight: '800' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <LeafletMapPicker
              style={{ flex: 1 }}
              latitude={tempLocation.lat}
              longitude={tempLocation.lng}
              onLocationSelect={(lat, lng) => setTempLocation({ lat, lng })}
            />
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
    },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    appBarTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
    },
    appBarSubtitle: {
      fontSize: 12,
      color: theme.colors.textDim,
      marginTop: 2,
    },
    appBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
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

    card: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.25 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    logoWrap: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: isDarkMode ? '#0F172A' : '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    logoImg: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    logoEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#6C47FF',
      padding: 4,
      borderTopLeftRadius: 8,
    },
    shopName: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.colors.text,
    },
    shopSub: {
      fontSize: 12,
      color: theme.colors.textDim,
    },

    sectionHeaderTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textDim,
      marginBottom: 8,
      marginTop: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    menuCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
    },
    menuIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    menuSub: {
      fontSize: 12,
      color: theme.colors.textDim,
      marginTop: 2,
    },

    /* ── Form Inputs ── */
    label: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 6,
      marginTop: 8,
    },
    input: {
      backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputTA: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    primaryBtn: {
      backgroundColor: '#6C47FF',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    outlineBtn: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },

    /* ── Preset Chips ── */
    presetChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    },
    presetChipActive: {
      backgroundColor: '#6C47FF',
      borderColor: '#6C47FF',
    },
    presetChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text,
    },
    presetChipTextActive: {
      color: '#FFFFFF',
    },

    /* ── KYC Status Banner ── */
    kycStatusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      marginBottom: 16,
      gap: 12,
    },
    kycStatusBannerApproved: {
      backgroundColor: isDarkMode ? 'rgba(21, 128, 61, 0.15)' : '#DCFCE7',
      borderColor: isDarkMode ? '#15803D' : '#86EFAC',
    },
    kycStatusBannerPending: {
      backgroundColor: isDarkMode ? 'rgba(180, 83, 9, 0.15)' : '#FEF3C7',
      borderColor: isDarkMode ? '#B45309' : '#FDE68A',
    },
    kycStatusBannerRejected: {
      backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
      borderColor: isDarkMode ? '#DC2626' : '#FCA5A5',
    },
    kycStatusIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    kycStatusTitle: {
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 2,
    },
    kycStatusDesc: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },

    /* ── KYC Document Cards ── */
    docCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      padding: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    docCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    docIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
    },
    docName: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    docMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    docCategoryChip: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    },
    docCategoryText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#6C47FF',
    },
    docDateText: {
      fontSize: 11,
      color: theme.colors.textDim,
    },
    cardDivider: {
      height: 1,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
      marginVertical: 12,
    },
    docActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    docViewBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      paddingVertical: 9,
      borderRadius: 12,
      gap: 6,
    },
    docViewBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#6C47FF',
    },
    docDeleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
      gap: 6,
    },
    docDeleteBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#EF4444',
    },

    /* ── Empty State ── */
    emptyDocState: {
      alignItems: 'center',
      paddingVertical: 28,
      gap: 4,
    },
    emptyDocIconBox: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    emptyDocText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    emptyDocSub: {
      fontSize: 12,
      color: theme.colors.textDim,
      textAlign: 'center',
      marginTop: 2,
    },

    /* ── Upload Form ── */
    docUploadBox: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      marginTop: 10,
    },
    dashedBtn: {
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: 18,
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    addDocBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#6C47FF',
      paddingVertical: 14,
      borderRadius: 16,
      gap: 8,
      marginTop: 10,
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 3,
    },
    addDocBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    /* ── Payouts ── */
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      marginBottom: 10,
    },
    accountCardPrimary: {
      borderColor: '#10B981',
    },
    smallBtn: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    smallBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text,
    },
    payoutFormBox: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      marginTop: 10,
    },

    /* ── Analytics ── */
    analyticsTabRow: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
      borderRadius: 12,
      padding: 4,
      marginBottom: 18,
    },
    analyticsTabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 9,
      alignItems: 'center',
    },
    analyticsTabBtnActive: {
      backgroundColor: '#6C47FF',
    },
    analyticsTabText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textDim,
    },
    analyticsTabTextActive: {
      color: '#FFFFFF',
    },
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 18,
    },
    analyticsTile: {
      width: '48%',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
    },
    analyticsTileVal: {
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 3,
    },
    analyticsTileLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textDim,
      textAlign: 'center',
    },
    topProductsCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      padding: 14,
      marginBottom: 16,
    },
    topProductRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
    },
    topProductName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    topProductUnits: {
      fontSize: 11,
      color: theme.colors.textDim,
      marginTop: 1,
    },
    topProductPercent: {
      fontSize: 14,
      fontWeight: '900',
      color: '#6C47FF',
    },
    shareReportBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 14,
      borderWidth: 1.5,
      borderColor: '#6C47FF',
      borderRadius: 14,
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    },
    shareReportBtnText: {
      color: '#6C47FF',
      fontSize: 14,
      fontWeight: '800',
    },
  });

export default ShopSettingsScreen;
