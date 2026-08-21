import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { shopService } from '../../services/shopService';
import AppBar from '../../components/AppBar';
import {
  Check, Package, Truck, MapPin, Phone, Clock,
  ChevronRight, XCircle, Edit3, ChevronLeft, Sun, Moon, Bell
} from 'lucide-react-native';

const STATUS_FLOW = ['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const ShopOrderDetailScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await shopService.getOrderById(orderId);
      if (res.data?.status === 'success') setOrder(res.data.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const updateStatus = async (status, otp, note) => {
    try {
      setUpdating(true);
      await shopService.updateOrderStatus(orderId, status, otp, note);
      fetchOrder();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
      setShowOtpModal(false);
      setOtpInput('');
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? Reserved stock will automatically be returned to your inventory.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: () => updateStatus('CANCELLED', null, 'Cancelled by shop')
        }
      ]
    );
  };

  const getNextAction = () => {
    if (!order) return null;
    switch (order.status) {
      case 'NEW':
        return { label: 'Accept Order', status: 'CONFIRMED', color: '#10b981', icon: Check, allowCancel: true };
      case 'CONFIRMED':
        return { label: 'Start Packing', status: 'PACKING', color: '#6366f1', icon: Package, allowCancel: true };
      case 'PACKING':
        return { label: 'Mark Out for Delivery', status: 'OUT_FOR_DELIVERY', color: '#f59e0b', icon: Truck };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Mark Delivered', status: 'DELIVERED', color: '#10b981', icon: Check, needsOtp: true };
      default:
        return null;
    }
  };


  const handleNextAction = () => {
    const action = getNextAction();
    if (!action) return;

    if (action.needsOtp) {
      setShowOtpModal(true);
      return;
    }

    Alert.alert(action.label, `Mark order as "${action.status}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => updateStatus(action.status) }
    ]);
  };

  const handleConfirmDelivery = () => {
    if (!otpInput || otpInput.length !== 4) {
      return Alert.alert('Invalid OTP', 'Please enter the 4-digit delivery OTP');
    }
    updateStatus('DELIVERED', otpInput);
  };

  const nextAction = getNextAction();

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
        <Text style={{ color: theme.colors.textDim }}>Order not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* ── App Bar ── */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={[styles.appBarIconBtn, { marginRight: 12, borderWidth: 0, backgroundColor: 'transparent' }]} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.appBarTitle} numberOfLines={1}>
              {`Order ${order.orderNumber || '#' + order._id?.slice(-6)}`}
            </Text>
            <Text style={styles.appBarSubtitle}>Order Details</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={toggleTheme}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={() => navigation.navigate('ShopNotifications')}>
            <Bell size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>
            {order.status === 'DELIVERED' ? '✅' : order.status === 'CANCELLED' ? '❌' : '📦'}
          </Text>
          <Text style={styles.statusText}>{order.status.replace(/_/g, ' ')}</Text>
          <Text style={styles.statusTime}>
            Placed {new Date(order.createdAt).toLocaleString('en-IN', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{order.customerId?.name || 'Customer'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{order.customerId?.phone || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue} numberOfLines={2}>{order.deliveryAddress}</Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.items?.length || 0})</Text>
          {order.items?.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemQty}>×{item.qty}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
            </View>
          ))}
          <View style={[styles.infoRow, { marginTop: 10, borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Items Subtotal</Text>
            <Text style={styles.infoValue}>₹{order.subtotal || order.total}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Delivery Fee</Text>
            <Text style={styles.infoValue}>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee || 0}`}</Text>
          </View>
          {(order.discount > 0 || order.promoDiscount > 0) && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.infoLabel, { color: '#10b981' }]}>Discount</Text>
              <Text style={[styles.infoValue, { color: '#10b981' }]}>-₹{order.discount || order.promoDiscount}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Customer Paid</Text>
            <Text style={styles.totalValue}>₹{order.total}</Text>
          </View>
        </View>

        {/* Delivery OTP */}
        {order.deliveryOtp && order.status !== 'DELIVERED' && (
          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>Delivery OTP</Text>
            <Text style={styles.otpCode}>{order.deliveryOtp}</Text>
            <Text style={styles.otpHint}>Ask customer for this OTP on delivery</Text>
          </View>
        )}

        {/* Status History */}
        {order.statusHistory?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timeline</Text>
            {order.statusHistory.map((h, idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={[styles.historyDot, idx === order.statusHistory.length - 1 && styles.historyDotActive]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>{h.status}</Text>
                  <Text style={styles.historyTime}>
                    {new Date(h.timestamp).toLocaleString('en-IN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Button */}
      {nextAction && order.status !== 'CANCELLED' && (
        <View style={styles.actionBar}>
          {nextAction.allowCancel && (
            <TouchableOpacity
              style={[styles.cancelOrderBtn, updating && { opacity: 0.6 }]}
              disabled={updating}
              onPress={handleCancelOrder}
            >
              <Text style={styles.cancelOrderBtnText}>Reject / Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: nextAction.color, flex: nextAction.allowCancel ? 2 : 1 }, updating && { opacity: 0.6 }]}
            disabled={updating}
            onPress={handleNextAction}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <nextAction.icon size={20} color="#fff" />
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}


      {/* OTP Modal */}
      {showOtpModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOtpModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Delivery OTP</Text>
            <Text style={styles.modalDesc}>Ask the customer for the 4-digit OTP shown on their screen</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="Enter 4-digit OTP"
              placeholderTextColor={theme.colors.textDim}
              value={otpInput}
              onChangeText={setOtpInput}
              keyboardType="numeric"
              maxLength={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowOtpModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, updating && { opacity: 0.6 }]}
                disabled={updating}
                onPress={handleConfirmDelivery}
              >
                <Text style={styles.modalConfirmText}>Confirm Delivery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  appBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: theme.colors.background },
  appBarTitle:  { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSubtitle: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  appBarIconBtn:{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: 16 },
  statusCard:   { backgroundColor: theme.colors.primary, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  statusEmoji:  { fontSize: 40, marginBottom: 8 },
  statusText:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  statusTime:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card:         { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle:    { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoLabel:    { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  infoValue:    { fontSize: 13, color: theme.colors.text, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 20 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemName:     { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  itemQty:      { fontSize: 13, color: theme.colors.textDim, marginHorizontal: 12 },
  itemPrice:    { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  totalLabel:   { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  totalValue:   { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  otpCard:      { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#f59e0b' + '40', alignItems: 'center' },
  otpLabel:     { fontSize: 14, fontWeight: '700', color: theme.colors.textDim },
  otpCode:      { fontSize: 40, fontWeight: '900', color: '#f59e0b', letterSpacing: 10, marginVertical: 8 },
  otpHint:      { fontSize: 12, color: theme.colors.textDim },
  historyRow:   { flexDirection: 'row', marginBottom: 12 },
  historyDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.border, marginTop: 4, marginRight: 12 },
  historyDotActive:{ backgroundColor: theme.colors.primary },
  historyContent:{ flex: 1 },
  historyStatus:{ fontSize: 13, fontWeight: '700', color: theme.colors.text },
  historyTime:  { fontSize: 11, color: theme.colors.textDim, marginTop: 2 },
  actionBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', gap: 12 },
  cancelOrderBtn:{ flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444' + '10' },
  cancelOrderBtnText:{ fontSize: 14, fontWeight: '700', color: '#ef4444' },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },

  actionBtnText:{ fontSize: 16, fontWeight: '800', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: StyleSheet.absoluteFill,
  modalContent: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 24, width: '85%', borderWidth: 1, borderColor: theme.colors.border },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  modalDesc:    { fontSize: 13, color: theme.colors.textDim, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  otpInput:     { backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '800', color: theme.colors.text, textAlign: 'center', letterSpacing: 10, borderWidth: 1, borderColor: theme.colors.border },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn:{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText:{ fontSize: 14, fontWeight: '700', color: theme.colors.textDim },
  modalConfirmBtn:{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' },
  modalConfirmText:{ fontSize: 14, fontWeight: '800', color: '#fff' },
});

export default ShopOrderDetailScreen;
