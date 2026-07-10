import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import api from '../../services/api';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../../config/env';
import {
  Check, Clock, Package, Truck, MapPin, Phone,
  Copy, FileText, MessageCircle, ChevronRight, XCircle
} from 'lucide-react-native';

const STATUS_STEPS = [
  { key: 'NEW',            label: 'Order Placed',     icon: Package,    description: 'Your order has been received' },
  { key: 'CONFIRMED',      label: 'Confirmed',        icon: Check,      description: 'Shop accepted your order' },
  { key: 'PACKING',        label: 'Being Prepared',   icon: Package,    description: 'Shop is packing your items' },
  { key: 'OUT_FOR_DELIVERY', label: 'On the Way',     icon: Truck,      description: 'Delivery is on the way' },
  { key: 'DELIVERED',      label: 'Delivered',        icon: Check,      description: 'Order delivered successfully' },
];

const STATUS_MESSAGES = {
  NEW: 'Waiting for shop to confirm...',
  CONFIRMED: 'Shop is confirming your order',
  PACKING: 'Your items are being prepared',
  OUT_FOR_DELIVERY: 'Your order is on the way!',
  DELIVERED: 'Order delivered! Thank you!',
  CANCELLED: 'Order was cancelled',
};

const OrderTrackingScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchOrder();
    connectSocket();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [orderId]);

  const connectSocket = () => {
    try {
      const socket = io(SOCKET_URL, { transports: ['websocket'] });
      socket.on('connect', () => {
        socket.emit('join', `customer_${user?._id}`);
      });
      socket.on('ORDER_STATUS', (data) => {
        if (data.orderId === orderId) {
          fetchOrder();
        }
      });
      socketRef.current = socket;
    } catch (e) { console.log('Socket connection failed'); }
  };

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/shoporders/${orderId}`);
      if (res.data?.status === 'success') {
        setOrder(res.data.data);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const copyOtp = () => {
    if (order?.deliveryOtp) {
      const Clipboard = require('@react-native-clipboard/clipboard');
      Clipboard.default?.setString(order.deliveryOtp) || Clipboard.setString?.(order.deliveryOtp);
      Alert.alert('Copied!', `OTP ${order.deliveryOtp} copied to clipboard`);
    }
  };

  const getStepIndex = (status) => {
    return STATUS_STEPS.findIndex(s => s.key === status);
  };

  const currentStep = getStepIndex(order?.status || 'NEW');
  const isCancelled = order?.status === 'CANCELLED';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.primary, marginTop: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title={`Order ${order.orderNumber || '#' + order._id?.slice(-6)}`} packageRoute="CustomerShopOrders" showBack={true} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Hero */}
        <View style={[styles.heroCard, isCancelled && styles.heroCancelled]}>
          <Text style={styles.heroEmoji}>
            {isCancelled ? '❌' : order.status === 'DELIVERED' ? '✅' : '📦'}
          </Text>
          <Text style={styles.heroStatus}>
            {isCancelled ? 'Order Cancelled' : STATUS_MESSAGES[order.status] || order.status}
          </Text>
          <Text style={styles.heroTime}>
            Placed {new Date(order.createdAt).toLocaleString('en-IN', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Progress Steps */}
        {!isCancelled && (
          <View style={styles.progressCard}>
            {STATUS_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.stepDot, isCompleted && styles.stepDotActive, isCurrent && styles.stepDotCurrent]}>
                      {isCompleted ? <Check size={12} color="#fff" /> : <StepIcon size={12} color={theme.colors.textDim} />}
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View style={[styles.stepLine, idx < currentStep && styles.stepLineActive]} />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive]}>
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.stepDesc}>{step.description}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Delivery OTP */}
        {order.status === 'OUT_FOR_DELIVERY' && order.deliveryOtp && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>Delivery OTP</Text>
              <Text style={styles.otpSub}>Share this with the delivery person</Text>
            </View>
            <View style={styles.otpDisplay}>
              <Text style={styles.otpCode}>{order.deliveryOtp}</Text>
              <TouchableOpacity style={styles.otpCopyBtn} onPress={copyOtp}>
                <Copy size={18} color="#fff" />
                <Text style={styles.otpCopyText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Delivery Staff Info */}
        {order.deliveryStaffName && (
          <View style={styles.staffCard}>
            <View style={styles.staffAvatar}>
              <Text style={{ fontSize: 24 }}>🧑</Text>
            </View>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{order.deliveryStaffName}</Text>
              <Text style={styles.staffRole}>Delivery Partner</Text>
            </View>
            {order.deliveryStaffPhone && (
              <TouchableOpacity style={styles.callBtn}>
                <Phone size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items?.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemEmoji}>{item.imageUrl || '📦'}</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemQty}>Qty: {item.qty}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          {[
            ['Items Total', `₹${order.subtotal}`],
            ['Delivery Fee', order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`],
            order.promoDiscount > 0 ? ['Promo Discount', `-₹${order.promoDiscount}`] : null,
          ].filter(Boolean).map(([k, v]) => (
            <View key={k} style={styles.billRow}>
              <Text style={styles.billKey}>{k}</Text>
              <Text style={[styles.billVal, v === 'FREE' && { color: '#059669' }]}>{v}</Text>
            </View>
          ))}
          <View style={[styles.billRow, styles.billTotalRow]}>
            <Text style={styles.billTotalKey}>Total Paid</Text>
            <Text style={styles.billTotalVal}>₹{order.total}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>
              💳 {order.payment?.method || 'WALLET'} · {order.payment?.status === 'PAID' ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressCard}>
          <MapPin size={18} color={theme.colors.primary} />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>Delivery Address</Text>
            <Text style={styles.addressText}>{order.deliveryAddress}</Text>
          </View>
        </View>

        {/* Status History */}
        {order.statusHistory?.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Order Timeline</Text>
            {order.statusHistory.map((h, idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={[styles.historyDot, idx === 0 && styles.historyDotActive]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>{h.status}</Text>
                  <Text style={styles.historyTime}>
                    {new Date(h.timestamp).toLocaleString('en-IN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                  {h.note && <Text style={styles.historyNote}>{h.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {order.status === 'NEW' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                Alert.alert('Cancel Order?', 'Are you sure you want to cancel?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, Cancel', style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.patch(`/shoporders/${orderId}/status`, { status: 'CANCELLED' });
                        fetchOrder();
                      } catch (e) {
                        Alert.alert('Error', e?.response?.data?.message || 'Failed to cancel');
                      }
                    }
                  }
                ]);
              }}
            >
              <XCircle size={18} color="#ef4444" />
              <Text style={styles.cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <MessageCircle size={18} color={theme.colors.primary} />
            <Text style={styles.helpBtnText}>Need Help?</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  content:      { padding: 16 },
  emptyText:    { fontSize: 16, color: theme.colors.textDim },
  heroCard:     { backgroundColor: theme.colors.primary, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroCancelled:{ backgroundColor: '#ef4444' },
  heroEmoji:    { fontSize: 48, marginBottom: 12 },
  heroStatus:   { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  heroTime:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  progressCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  stepRow:      { flexDirection: 'row', minHeight: 48 },
  stepLeft:     { alignItems: 'center', width: 32 },
  stepDot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  stepDotActive:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  stepDotCurrent:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  stepLine:     { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  stepLineActive:{ backgroundColor: theme.colors.primary },
  stepContent:  { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  stepLabel:    { fontSize: 14, fontWeight: '700', color: theme.colors.textDim },
  stepLabelActive:{ color: theme.colors.text },
  stepDesc:     { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  otpCard:      { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: theme.colors.primary + '40' },
  otpHeader:    { marginBottom: 12 },
  otpTitle:     { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  otpSub:       { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  otpDisplay:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.background, borderRadius: 12, padding: 16 },
  otpCode:      { fontSize: 36, fontWeight: '900', color: theme.colors.primary, letterSpacing: 8 },
  otpCopyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  otpCopyText:  { color: '#001016', fontSize: 13, fontWeight: '700' },
  staffCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  staffAvatar:  { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  staffInfo:    { flex: 1, marginLeft: 12 },
  staffName:    { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  staffRole:    { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  callBtn:      { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  itemsCard:    { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemEmoji:    { fontSize: 20, marginRight: 12 },
  itemInfo:     { flex: 1 },
  itemName:     { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  itemQty:      { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  itemPrice:    { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  billCard:     { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  billKey:      { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  billVal:      { fontSize: 13, color: theme.colors.text, fontWeight: '700' },
  billTotalRow: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 10 },
  billTotalKey: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  billTotalVal: { fontSize: 18, fontWeight: '900', color: theme.colors.text },
  paymentBadge: { marginTop: 10, backgroundColor: theme.colors.background, borderRadius: 8, padding: 10, alignItems: 'center' },
  paymentText:  { fontSize: 13, fontWeight: '600', color: theme.colors.textDim },
  addressCard:  { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  addressInfo:  { flex: 1 },
  addressLabel: { fontSize: 12, color: theme.colors.textDim, fontWeight: '600', marginBottom: 4 },
  addressText:  { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  historyCard:  { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  historyRow:   { flexDirection: 'row', marginBottom: 12 },
  historyDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.border, marginTop: 4, marginRight: 12 },
  historyDotActive:{ backgroundColor: theme.colors.primary },
  historyContent:{ flex: 1 },
  historyStatus:{ fontSize: 13, fontWeight: '700', color: theme.colors.text },
  historyTime:  { fontSize: 11, color: theme.colors.textDim, marginTop: 2 },
  historyNote:  { fontSize: 12, color: theme.colors.textDim, fontStyle: 'italic', marginTop: 4 },
  actionsRow:   { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444', backgroundColor: '#ef444415' },
  cancelBtnText:{ fontSize: 14, fontWeight: '700', color: '#ef4444' },
  helpBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  helpBtnText:  { fontSize: 14, fontWeight: '700', color: theme.colors.text },
});

export default OrderTrackingScreen;
