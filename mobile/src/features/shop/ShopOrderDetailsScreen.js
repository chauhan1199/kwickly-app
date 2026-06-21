import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Bell, FileText, Phone, CheckCircle2, Box, Truck } from 'lucide-react-native';
import api from '../../services/api';

const ShopOrderDetailsScreen = ({ navigation, route }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    if (!orderId) return;
    fetchOrder(true);
    const interval = setInterval(() => fetchOrder(false), 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const res = await api.get(`/shoporders/${orderId}`);
      if (res.data?.status === 'success') {
        setOrder(res.data.data);
      }
    } catch (e) {
      console.log('Error fetching order', e);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const updateStatus = async (status, otp = null) => {
    try {
      setProcessing(true);
      const payload = { status };
      if (otp) payload.otp = otp;
      
      const res = await api.patch(`/shoporders/${orderId}/status`, payload);
      if (res.data?.status === 'success') {
        fetchOrder();
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update order status');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const o = {
    id: order._id.slice(-6).toUpperCase(),
    customer: order.customerId?.name || 'Customer',
    items: order.items?.length || 0,
    total: order.total,
    status: order.status.toLowerCase() // 'new', 'packing', 'out_for_delivery', 'delivered'
  };

  const mockItems = order.items || [];
  const subtotal = order.subtotal || 0;
  const deliveryFee = order.deliveryFee || 0;

  const statusToStep = {
    'new': 0,
    'packing': 1,
    'out_for_delivery': 2,
    'delivered': 3
  };
  const currentStepIndex = statusToStep[o.status] || 0;

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; border-radius: 16px; overflow: hidden; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const lat = 19.0760;
        const lng = 72.8777;
        const sLat = 19.0800;
        const sLng = 72.8800;

        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(map);

        const homeIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([lat, lng], {icon: homeIcon}).addTo(map).bindPopup("Customer Location");

        const shopIcon = L.divIcon({
          html: '<div style="background-color: #0e9aa7; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([sLat, sLng], {icon: shopIcon}).addTo(map).bindPopup("Your Location").openPopup();
        
        map.fitBounds(L.latLngBounds([[lat, lng], [sLat, sLng]]), { padding: [30, 30] });
      </script>
    </body>
    </html>
  `;

  const timelineSteps = [
    { key: 'new', label: 'New Order', icon: FileText },
    { key: 'packing', label: 'Packing', icon: Box },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  const renderTimeline = () => {
    return (
      <View style={styles.timelineContainer}>
        {timelineSteps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;
          
          let dotColor = '#CBD5E1'; // pending
          if (isActive) dotColor = '#0EA5E9'; // active brand color
          if (isPast) dotColor = '#10B981'; // completed green

          return (
            <View key={step.key} style={styles.timelineRow}>
              {/* Vertical line connecting dots */}
              {index !== timelineSteps.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: isPast ? '#10B981' : '#E2E8F0' }]} />
              )}
              
              <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                {isPast ? <CheckCircle2 size={12} color="#FFF" /> : null}
              </View>
              
              <View style={styles.timelineContent}>
                <Icon size={16} color={isActive ? theme.colors.text : theme.colors.textDim} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.timelineText, 
                  isActive && styles.timelineTextActive,
                  isPast && styles.timelineTextPast
                ]}>
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderActionButtons = () => {
    if (processing) {
      return (
        <TouchableOpacity style={styles.primaryBtn} disabled>
          <ActivityIndicator color="#001016" />
        </TouchableOpacity>
      );
    }
    
    if (o.status === 'new') {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus('PACKING')}>
            <Text style={styles.primaryBtnText}>Start Packing →</Text>
          </TouchableOpacity>
        </>
      );
    } else if (o.status === 'packing') {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus('OUT_FOR_DELIVERY')}>
            <Text style={styles.primaryBtnText}>Mark Out for Delivery →</Text>
          </TouchableOpacity>
        </>
      );
    } else if (o.status === 'out_for_delivery') {
      return (
        <View style={styles.otpContainer}>
          <Text style={styles.otpLabel}>Enter OTP from Customer</Text>
          <TextInput 
            style={styles.otpInput} 
            placeholder="Enter 4-digit OTP" 
            placeholderTextColor={theme.colors.textDim}
            keyboardType="numeric" 
            maxLength={4}
            value={otpInput}
            onChangeText={setOtpInput}
          />
          <TouchableOpacity 
            style={[styles.primaryBtn, { opacity: otpInput.length === 4 ? 1 : 0.5 }]} 
            onPress={() => otpInput.length === 4 && updateStatus('DELIVERED', otpInput)}
            disabled={otpInput.length !== 4}
          >
            <Text style={styles.primaryBtnText}>Verify & Mark Delivered</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null; // Delivered doesn't need these buttons usually
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.appBarTitle}>Order {o.id}</Text>
            <Text style={styles.appBarSubtitle}>{o.customer}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.appBarIconBtn}>
          <Bell size={20} color={theme.colors.text} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Timeline */}
        {renderTimeline()}

        {o.status === 'out_for_delivery' && (
          <View style={{ marginBottom: 32 }}>
            <Text style={styles.sectionTitle}>Customer Location</Text>
            <View style={{ height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
              <WebView 
                source={{ html: mapHTML }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                scrollEnabled={false}
              />
            </View>
          </View>
        )}

        {/* Customer Card */}
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>{o.customer.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{o.customer}</Text>
            <Text style={styles.customerRole}>Customer</Text>
          </View>
          <TouchableOpacity style={styles.phoneBtn}>
            <Phone size={18} color="#EC4899" />
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>Bill Details</Text>
        <View style={styles.itemsCard}>
          {mockItems.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.qtyBox}>
                <Text style={styles.qtyText}>{item.qty}x</Text>
              </View>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
          ))}
          
          <View style={styles.divider} />
          
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceText}>Item Total</Text>
            <Text style={styles.invoiceText}>₹{subtotal}</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceText}>Delivery Fee</Text>
            <Text style={styles.invoiceText}>₹{deliveryFee}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalAmount}>₹{o.total}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {renderActionButtons()}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  appBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444', // Red or primary
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  scrollContent: {
    padding: 20,
  },
  timelineContainer: {
    paddingLeft: 12,
    marginBottom: 32,
    paddingTop: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 7.5, // Center under the 16px dot
    top: 16,
    bottom: -24,
    width: 2,
    zIndex: 0,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  timelineText: {
    fontSize: 15,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  timelineTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  timelineTextPast: {
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  customerRole: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCE7F3', // Light pink background
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyBox: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 10,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    color: theme.colors.textDim,
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  otpContainer: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    color: theme.colors.primary,
    marginBottom: 16,
  }
});

export default ShopOrderDetailsScreen;
