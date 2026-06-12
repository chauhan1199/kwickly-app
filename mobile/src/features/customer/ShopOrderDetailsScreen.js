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
  Alert,
  Linking
} from 'react-native';
import { WebView } from 'react-native-webview';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const ShopOrderDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  const styles = createStyles(theme, isDarkMode);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder(true);
    const interval = setInterval(() => fetchOrder(false), 3000);
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

  if (loading || !order) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const o = {
    id: order._id.slice(-6).toUpperCase(),
    shop: order.shopId?.name || 'Shop',
    s: order.status,
    amt: order.total,
    icon: '🏪',
    color: '#10b981'
  };



  const isActive = ['NEW', 'PACKING', 'OUT_FOR_DELIVERY'].includes(o.s);
  const isOutForDelivery = o.s === 'OUT_FOR_DELIVERY';
  const priceNum = o.amt;

  const items = order.items || [];
  const subtotal = order.subtotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const taxes = 0; // if applicable

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
        L.marker([lat, lng], {icon: homeIcon}).addTo(map).bindPopup("Delivery Location");

        const shopIcon = L.divIcon({
          html: '<div style="background-color: #0e9aa7; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([sLat, sLng], {icon: shopIcon}).addTo(map).bindPopup("Shop Owner").openPopup();
        
        map.fitBounds(L.latLngBounds([[lat, lng], [sLat, sLng]]), { padding: [30, 30] });
      </script>
    </body>
    </html>
  `;



  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Order Details</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Order #{o.id}</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: (isActive ? '#f5b300' : '#10b981') + '26' }]}>
              <Text style={{fontSize: 22}}>{o.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{o.shop}</Text>
              <Text style={styles.cardSub}>Today, 10:30 AM</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: (isActive ? '#f5b300' : '#10b981') + '26' }]}>
              <Text style={[styles.statusText, { color: isActive ? '#f5b300' : '#10b981' }]}>{o.s}</Text>
            </View>
          </View>
          
          {isActive && (
            <View style={styles.deliveryBox}>
              <Text style={styles.deliveryText}>🛵 Shop partner is processing your order.</Text>
            </View>
          )}
        </View>

        {(isOutForDelivery || showMap) && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Live Tracking</Text>
            <View style={{ height: 200, borderRadius: 16, overflow: 'hidden', marginTop: 12 }}>
              <WebView 
                source={{ html: mapHTML }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                scrollEnabled={false}
              />
            </View>
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary + '26', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>🚚</Text>
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text }}>Arriving soon</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textDim }}>ETA 15 mins</Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Address */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Delivery Address</Text>
          <View style={[styles.row, { marginTop: 10, alignItems: 'flex-start' }]}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>Saved Address</Text>
              <Text style={styles.addressText}>{order.deliveryAddress || 'Address not provided'}</Text>
            </View>
          </View>
        </View>

        {isActive && order.deliveryOtp && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Delivery OTP</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.primary, letterSpacing: 10, textAlign: 'center', marginTop: 16 }}>
              {order.deliveryOtp}
            </Text>
            <Text style={{ textAlign: 'center', color: theme.colors.textDim, marginTop: 8 }}>
              Share this OTP with the delivery partner
            </Text>
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Bill Details</Text>
          <View style={{ marginTop: 12 }}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyText}>{item.qty}x</Text>
                </View>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
            ))}
            
            <View style={styles.separator} />
            
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceText}>Item Total</Text>
              <Text style={styles.invoiceText}>₹{subtotal}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceText}>Delivery Fee</Text>
              <Text style={styles.invoiceText}>₹{deliveryFee}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceMuted}>Taxes & Charges</Text>
              <Text style={styles.invoiceMuted}>₹{taxes}</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.invoiceRow}>
              <Text style={styles.totalText}>Grand Total</Text>
              <Text style={styles.totalPrice}>₹{priceNum}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {isActive ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowMap(true)}>
            <Text style={styles.primaryBtnText}>📍 Track Order</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.primaryBtnText}>↺ Browse Shop</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.secondaryBtn} 
          onPress={() => {
            const url = `${api.defaults.baseURL}/shoporders/${orderId}/invoice`;
            Linking.openURL(url).catch(err => {
              console.error("Couldn't load invoice page", err);
              Alert.alert('Error', 'Unable to open invoice.');
            });
          }}
        >
          <Text style={styles.secondaryBtnText}>📄 Download Invoice</Text>
        </TouchableOpacity>

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
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deliveryBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  deliveryText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.textDim,
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
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    color: theme.colors.text,
    fontSize: 13,
  },
  invoiceMuted: {
    color: theme.colors.textDim,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  totalText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  totalPrice: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  }
});

export default ShopOrderDetailsScreen;
