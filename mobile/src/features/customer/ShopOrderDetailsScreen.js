import React, { useState, useEffect, useCallback } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import { API_BASE_URL } from '../../config/env';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { 
  Clock, CheckCircle2, XCircle, AlertTriangle, 
  Package, MapPin, FileText, ArrowLeft, RefreshCw, Wallet, RotateCcw 
} from 'lucide-react-native';

const ShopOrderDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { fetchUser } = useAuth();

  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const styles = createStyles(theme, isDarkMode);

  const fetchOrder = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const res = await shopService.getOrderById(orderId);
      if (res.data?.status === 'success') {
        setOrder(res.data.data);
      }
    } catch (e) {
      console.warn('[ShopOrderDetails] fetch error:', e?.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder(true);
    const interval = setInterval(() => fetchOrder(false), 10000);
    return () => clearInterval(interval);
  }, [orderId, fetchOrder]);

  const handleCancelOrder = () => {
    if (!order) return;
    const isPaid = order.payment?.status === 'PAID' || order.payment?.method === 'WALLET';
    const isUpiPending = order.payment?.status === 'PENDING_VERIFICATION';

    let refundMsg = 'Are you sure you want to cancel this order?';
    if (isPaid) {
      refundMsg = `Are you sure you want to cancel this order? The paid amount of ₹${order.total || 0} will be immediately refunded back to your Kwickly Wallet.`;
    } else if (isUpiPending) {
      refundMsg = `Are you sure you want to cancel this order? If your UPI payment was deducted by your bank, our support will credit your wallet upon verification.`;
    }

    Alert.alert(
      'Cancel Order?',
      refundMsg,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              const res = await shopService.cancelOrder(orderId);
              if (res.data?.status === 'success') {
                if (fetchUser) await fetchUser();
                Alert.alert(
                  'Order Cancelled',
                  isPaid 
                    ? `Order #${order.orderNumber || orderId?.slice(-6)?.toUpperCase()} has been cancelled and ₹${order.total || 0} has been refunded to your Kwickly Wallet.`
                    : `Order #${order.orderNumber || orderId?.slice(-6)?.toUpperCase()} has been cancelled successfully.`,
                  [{ text: 'OK', onPress: () => fetchOrder(true) }]
                );
              }
            } catch (err) {
              Alert.alert(
                'Cancellation Failed', 
                err.response?.data?.message || err.message || 'Unable to cancel this order in its current status.'
              );
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const o = {
    id: order.orderNumber || `#${order._id.slice(-6).toUpperCase()}`,
    shop: order.shopId?.name || 'Shop',
    s: order.status,
    amt: Number(order.total ?? order.payment?.amount ?? 0).toFixed(2),
    icon: '🏪',
    color: '#10b981'
  };

  const isCancelled = o.s === 'CANCELLED';
  const isDelivered = o.s === 'DELIVERED';
  const isActive = ['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY'].includes(o.s);
  const canCancel = ['NEW', 'CONFIRMED', 'PACKING'].includes(o.s);
  const isOutForDelivery = o.s === 'OUT_FOR_DELIVERY';
  const priceNum = o.amt;

  const isUpiVerification = order.payment?.status === 'PENDING_VERIFICATION' && !isCancelled;
  const isWalletPaid = order.payment?.status === 'PAID' || order.payment?.method === 'WALLET';
  const isRefunded = order.payment?.status === 'REFUNDED' || (isCancelled && isWalletPaid);

  const items = order.items || [];
  const subtotal = order.subtotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const platformFee = order.platformFee || 0;
  const gstAmount = order.gstAmount || 0;

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
        const lat = ${Number(order.deliveryLocation?.coordinates?.[1]) || 23.0225};
        const lng = ${Number(order.deliveryLocation?.coordinates?.[0]) || 72.5714};
        const sLat = ${Number(order.shopId?.location?.coordinates?.[1]) || ((Number(order.deliveryLocation?.coordinates?.[1]) || 23.0225) + 0.005)};
        const sLng = ${Number(order.shopId?.location?.coordinates?.[0]) || ((Number(order.deliveryLocation?.coordinates?.[0]) || 72.5714) + 0.005)};

        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc'
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
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* App Bar - Themed */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 16, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, position: 'relative', overflow: 'hidden' }}
      >
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          showBack={true} 
          title="Order Details" 
          subtitle={o.id} 
          transparent={true} 
          showLogo={false} 
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.cancelledIconBox}>
                <XCircle size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelledTitle}>Order Cancelled</Text>
                <Text style={styles.cancelledSub}>
                  {isRefunded 
                    ? `₹${priceNum} has been refunded to your Kwickly Wallet.` 
                    : 'This order was cancelled and items have been released.'}
                </Text>
              </View>
            </View>
            {isRefunded && (
              <TouchableOpacity 
                style={styles.walletShortcutBtn}
                onPress={() => navigation.navigate('Wallet')}
                activeOpacity={0.8}
              >
                <Wallet size={14} color="#059669" />
                <Text style={styles.walletShortcutText}>View Wallet Balance</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* UPI Verification Pending Notice */}
        {isUpiVerification && (
          <View style={styles.upiPendingBanner}>
            <Clock size={20} color="#D97706" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.upiPendingTitle}>Payment Under Shop Verification</Text>
              <Text style={styles.upiPendingText}>
                UTR: <Text style={{ fontWeight: '900', color: '#B45309' }}>{order.payment?.utrNumber}</Text>
              </Text>
              <Text style={styles.upiPendingSub}>
                The shop owner will verify the bank credit and prepare your delivery shortly.
              </Text>
            </View>
          </View>
        )}

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: isCancelled ? '#ef444418' : (isActive ? '#6C47FF18' : '#10b98118') }]}>
              <Text style={{fontSize: 22}}>{isCancelled ? '❌' : o.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{o.shop}</Text>
              <Text style={styles.cardSub}>
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today'}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: isCancelled ? '#ef444418' : (isActive ? '#6C47FF18' : '#10b98118') }]}>
              <Text style={[styles.statusText, { color: isCancelled ? '#ef4444' : (isActive ? '#6C47FF' : '#10b981') }]}>
                {o.s}
              </Text>
            </View>
          </View>
          
          {/* Order Tracking Timeline (Hide if cancelled) */}
          {!isCancelled && (
            <View style={styles.timelineBox}>
              <Text style={styles.sectionHeader}>Order Tracking</Text>
              <View style={{ marginTop: 16 }}>
                {[
                  { key: 'NEW', label: 'Order Placed', icon: '📝', sub: 'Waiting for shop to accept' },
                  { key: 'PACKING', label: 'Processing & Packing', icon: '📦', sub: 'Shop is preparing your items' },
                  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🛵', sub: 'Assigning delivery partner' },
                  { key: 'DELIVERED', label: 'Delivered', icon: '🎉', sub: 'Order completed' }
                ].map((step, idx, arr) => {
                  const statusOrder = ['NEW', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
                  const currentIndex = statusOrder.indexOf(o.s);
                  const stepIndex = statusOrder.indexOf(step.key);
                  
                  const isCompleted = stepIndex < currentIndex;
                  const isCurrent = stepIndex === currentIndex;

                  let iconColor = isCompleted ? '#10b981' : isCurrent ? '#6C47FF' : theme.colors.border;
                  let textColor = (isCompleted || isCurrent) ? theme.colors.text : theme.colors.textDim;

                  return (
                    <View key={step.key} style={{ flexDirection: 'row', marginBottom: idx === arr.length - 1 ? 0 : 20 }}>
                      <View style={{ alignItems: 'center', marginRight: 12 }}>
                        <View style={[styles.timelineDot, { backgroundColor: isCompleted || isCurrent ? iconColor + '20' : theme.colors.background, borderColor: iconColor, borderWidth: 2 }]}>
                          {isCompleted ? <Text style={{fontSize: 14}}>✓</Text> : <Text style={{fontSize: 12}}>{step.icon}</Text>}
                        </View>
                        {idx !== arr.length - 1 && (
                          <View style={[styles.timelineLine, { backgroundColor: isCompleted ? '#10b981' : theme.colors.border }]} />
                        )}
                      </View>
                      <View style={{ flex: 1, paddingTop: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: isCurrent ? '800' : '600', color: textColor }}>{step.label}</Text>
                        <Text style={{ fontSize: 13, color: theme.colors.textDim, marginTop: 2 }}>{step.sub}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {(isOutForDelivery || showMap) && !isCancelled && (
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

        {isActive && order.deliveryOtp && !isCancelled && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Delivery OTP</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.primary, letterSpacing: 10, textAlign: 'center', marginTop: 16 }}>
              {order.deliveryOtp}
            </Text>
            <Text style={{ textAlign: 'center', color: theme.colors.textDim, marginTop: 8 }}>
              Share this OTP with the delivery partner upon arrival
            </Text>
          </View>
        )}

        {/* Items & Bill Details */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Bill Details</Text>
          <View style={{ marginTop: 12 }}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyText}>{item.qty}x</Text>
                </View>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
              </View>
            ))}
            
            <View style={styles.separator} />
            
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceText}>Item Total</Text>
              <Text style={styles.invoiceText}>₹{subtotal}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceText}>Delivery Fee</Text>
              <Text style={styles.invoiceText}>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</Text>
            </View>
            {(order.discount > 0 || order.promoDiscount > 0) && (
              <View style={styles.invoiceRow}>
                <Text style={[styles.invoiceText, { color: '#10b981' }]}>Discount Applied</Text>
                <Text style={[styles.invoiceText, { color: '#10b981' }]}>-₹{order.discount || order.promoDiscount}</Text>
              </View>
            )}
            {platformFee > 0 && (
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceMuted}>Platform Fee (5%)</Text>
                <Text style={styles.invoiceMuted}>₹{platformFee.toFixed(2)}</Text>
              </View>
            )}
            {gstAmount > 0 && (
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceMuted}>GST on Fee (18%)</Text>
                <Text style={styles.invoiceMuted}>₹{gstAmount.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.separator} />
            
            <View style={styles.invoiceRow}>
              <Text style={styles.totalText}>Grand Total</Text>
              <Text style={styles.totalPrice}>₹{priceNum}</Text>
            </View>

            <View style={[styles.invoiceRow, { marginTop: 4 }]}>
              <Text style={styles.paymentMethodLabel}>Payment Method</Text>
              <Text style={[styles.paymentMethodVal, { color: isWalletPaid ? '#10B981' : '#6C47FF' }]}>
                {order.payment?.method === 'WALLET' ? 'Kwickly Wallet' : 'Direct UPI'}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {isActive && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowMap(true)}>
            <Text style={styles.primaryBtnText}>📍 Live Map Tracking</Text>
          </TouchableOpacity>
        )}

        {/* Cancel Order Action */}
        {canCancel && (
          <TouchableOpacity 
            style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]} 
            onPress={handleCancelOrder}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <XCircle size={18} color="#EF4444" />
                <Text style={styles.cancelBtnText}>Cancel Order & Refund</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCancelled && (
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => navigation.navigate('Shop', { screen: 'ShopMain' })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>🛍️ Browse Shops Again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.secondaryBtn} 
          onPress={() => {
            const url = `${API_BASE_URL.replace('/api/v1', '')}/api/v1/shoporders/${orderId}/invoice`;
            Linking.openURL(url).catch(() => {
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
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  cancelledBanner: {
    backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF444440',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  cancelledIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelledTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EF4444',
  },
  cancelledSub: {
    fontSize: 12.5,
    color: isDarkMode ? '#FCA5A5' : '#991B1B',
    marginTop: 2,
    lineHeight: 16,
  },
  walletShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#10B98118',
    borderWidth: 1,
    borderColor: '#10B98140',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 12,
  },
  walletShortcutText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  upiPendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B40',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  upiPendingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: isDarkMode ? '#FDE68A' : '#B45309',
  },
  upiPendingText: {
    fontSize: 12.5,
    color: theme.colors.text,
    marginTop: 2,
  },
  upiPendingSub: {
    fontSize: 11.5,
    color: theme.colors.textDim,
    marginTop: 2,
    lineHeight: 15,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
    borderRadius: 6,
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
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '700',
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
    fontSize: 12,
  },
  paymentMethodLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  paymentMethodVal: {
    fontSize: 12,
    fontWeight: '800',
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
    fontWeight: '900',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF444450',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  timelineBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    height: 36,
    position: 'absolute',
    top: 28,
    zIndex: 1,
  }
});

export default ShopOrderDetailsScreen;
