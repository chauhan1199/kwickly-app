import React, { useState, useEffect, useCallback } from 'react';
import { formatStatus } from '../../utils/helpers';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { shopService } from '../../services/shopService';
import useSocket from '../../hooks/useSocket';
import {
  Check, Package, Truck, Bell,
  ChevronLeft, User, Phone, Plus
} from 'lucide-react-native';

const ShopOrderDetailScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, isDarkMode);

  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

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

  // Live updates (payment confirmed, customer cancelled, ...)
  useSocket({
    role: 'SHOP',
    onEvent: (event, data) => {
      if ((event === 'ORDER_STATUS' || event === 'NEW_ORDER') && (!data?.orderId || String(data.orderId) === String(orderId))) {
        fetchOrder();
      }
    }
  });

  const updateStatus = async (status, otp, note, deliveryStaffId) => {
    try {
      setUpdating(true);
      await shopService.updateOrderStatus(orderId, status, otp, note, deliveryStaffId);
      // Close the dialogs only on success, so a wrong OTP can be corrected in place.
      setShowOtpModal(false);
      setShowStaffModal(false);
      setOtpInput('');
      fetchOrder();
    } catch (e) {
      Alert.alert('Could not update order', e?.response?.data?.message || e?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const openStaffPicker = async () => {
    setSelectedStaffId(null);
    setShowStaffModal(true);
    setStaffLoading(true);
    try {
      const res = await shopService.getDeliveryStaff();
      setStaffList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      setStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleAddStaff = async () => {
    const name = newStaffName.trim();
    const phone = newStaffPhone.replace(/\D/g, '');
    if (!name) return Alert.alert('Name required', 'Enter the delivery person\'s name');
    if (phone && phone.length !== 10) return Alert.alert('Invalid phone', 'Enter a 10-digit mobile number');
    try {
      setAddingStaff(true);
      const res = await shopService.addDeliveryStaff({ name, phone: phone || undefined });
      const created = res.data?.data;
      if (created?._id) {
        setStaffList(prev => [...prev, created]);
        setSelectedStaffId(created._id);
      }
      setNewStaffName('');
      setNewStaffPhone('');
    } catch (e) {
      Alert.alert('Could not add', e?.response?.data?.message || e?.message || 'Failed to add delivery person');
    } finally {
      setAddingStaff(false);
    }
  };

  const confirmDispatch = () => {
    updateStatus('OUT_FOR_DELIVERY', undefined, undefined, selectedStaffId || undefined);
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
    if (action.status === 'OUT_FOR_DELIVERY') {
      openStaffPicker();
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

  // Direct-UPI orders can be accepted only after a bank match or admin approval marks them PAID.
  const payMethod = order?.payment?.method;
  const payStatus = order?.payment?.status;
  const isCash = payMethod === 'CASH' || payMethod === 'COD';
  const upiUnverified = payMethod === 'UPI' && payStatus !== 'PAID';
  const paymentLabel = payStatus === 'REFUNDED' ? 'Refunded'
    : payStatus === 'FAILED' ? 'Payment failed'
    : isCash ? (payStatus === 'PAID' ? 'Cash collected' : 'Cash on delivery')
    : payStatus === 'PAID' ? 'Paid'
    : 'Awaiting payment confirmation';
  const paymentColor = payStatus === 'PAID' ? '#10b981' : isCash ? '#0284C7' : (payStatus === 'FAILED' || payStatus === 'REFUNDED') ? '#EF4444' : '#F59E0B';

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
              <Text style={styles.appBarTitle} numberOfLines={1}>
                {`Order ${order.orderNumber || '#' + order._id?.slice(-6)}`}
              </Text>
              <Text style={styles.appBarSubtitle}>Order Details & Processing</Text>
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

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={styles.infoValue}>{isCash ? 'Cash on delivery' : payMethod || 'WALLET'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: paymentColor, fontWeight: '800' }]}>{paymentLabel}</Text>
          </View>
          {upiUnverified && order.status !== 'CANCELLED' ? (
            <Text style={[styles.infoLabel, { marginTop: 6 }]}>
              Waiting for payment confirmation. Kwickly confirms UPI payments from the bank or by admin review; you can accept the order once it shows Paid.
            </Text>
          ) : null}
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

        {order.deliveryStaffName ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Partner</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{order.deliveryStaffName}</Text>
            </View>
            {order.deliveryStaffPhone ? (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{order.deliveryStaffPhone}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Delivery Schedule & Slot */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Schedule</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Selected Slot</Text>
            <Text style={[styles.infoValue, { color: '#6C47FF', fontWeight: '800' }]}>
              {order.deliverySlot?.time || order.deliverySlot?.label || (typeof order.deliverySlot === 'string' ? order.deliverySlot : 'Standard Delivery')}
            </Text>
          </View>
          {order.deliverySlot?.date ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Date</Text>
              <Text style={styles.infoValue}>{order.deliverySlot.date}</Text>
            </View>
          ) : null}
          {order.deliverySlot?.notes ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Instructions</Text>
              <Text style={styles.infoValue}>{order.deliverySlot.notes}</Text>
            </View>
          ) : null}
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
          {order.platformFee > 0 && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Platform Fee (paid by customer)</Text>
              <Text style={styles.infoValue}>₹{Number(order.platformFee).toFixed(2)}</Text>
            </View>
          )}
          {order.gstAmount > 0 && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>GST on Fee (18%)</Text>
              <Text style={styles.infoValue}>₹{Number(order.gstAmount).toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Customer Paid</Text>
            <Text style={styles.totalValue}>₹{order.total}</Text>
          </View>
          {/* Same formula as settlementEngine: net product sales + delivery fee */}
          <View style={[styles.infoRow, { borderBottomWidth: 0, marginTop: 6 }]}>
            <Text style={[styles.infoLabel, { color: '#10b981', fontWeight: '700' }]}>You Receive</Text>
            <Text style={[styles.infoValue, { color: '#10b981', fontWeight: '700' }]}>
              ₹{(Number(order.netProductSales ?? ((order.subtotal || 0) - (order.promoDiscount || order.discount || 0))) + Number(order.deliveryFee || 0)).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Status History */}
        {order.statusHistory?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timeline</Text>
            {order.statusHistory.map((h, idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={[styles.historyDot, idx === order.statusHistory.length - 1 && styles.historyDotActive]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>{formatStatus(h.status)}</Text>
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
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {nextAction.allowCancel && (
            <TouchableOpacity
              style={[styles.cancelOrderBtn, updating && { opacity: 0.6 }]}
              disabled={updating}
              onPress={handleCancelOrder}
            >
              <Text style={styles.cancelOrderBtnText}>Reject / Cancel</Text>
            </TouchableOpacity>
          )}
          {upiUnverified ? (
            <View style={[styles.actionBtn, { backgroundColor: '#94A3B8', flex: nextAction.allowCancel ? 2 : 1 }]}>
              <Text style={styles.actionBtnText}>Awaiting payment confirmation</Text>
            </View>
          ) : (
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
          )}
        </View>
      )}


      {/* OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={() => setShowOtpModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowOtpModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Delivery OTP</Text>
            <Text style={styles.modalDesc}>Ask the customer for the 4-digit OTP shown in their app</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="----"
              placeholderTextColor={theme.colors.textDim}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
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
                {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Confirm Delivery</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Dispatch: choose who delivers */}
      <Modal visible={showStaffModal} transparent animationType="fade" onRequestClose={() => setShowStaffModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowStaffModal(false)} />
          <View style={[styles.modalContent, styles.staffModal]}>
            <Text style={styles.modalTitle}>Who is delivering?</Text>
            <Text style={styles.modalDesc}>The customer will see this name on their order</Text>
            <ScrollView style={styles.staffScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[styles.staffRow, selectedStaffId === null && styles.staffRowActive]}
                onPress={() => setSelectedStaffId(null)}
              >
                <Truck size={18} color={selectedStaffId === null ? theme.colors.primary : theme.colors.textDim} />
                <Text style={styles.staffName}>I'll deliver it myself</Text>
                {selectedStaffId === null && <Check size={18} color={theme.colors.primary} />}
              </TouchableOpacity>
              {staffLoading ? (
                <ActivityIndicator style={{ marginVertical: 12 }} color={theme.colors.primary} />
              ) : staffList.map(st => {
                const active = selectedStaffId === st._id;
                const busy = st.activeOrderId && st.activeOrderId !== order._id;
                return (
                  <TouchableOpacity
                    key={st._id}
                    style={[styles.staffRow, active && styles.staffRowActive]}
                    onPress={() => setSelectedStaffId(st._id)}
                  >
                    <User size={18} color={active ? theme.colors.primary : theme.colors.textDim} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName} numberOfLines={1}>{st.name}</Text>
                      <Text style={styles.staffMeta} numberOfLines={1}>
                        {[st.phone, busy ? 'On another delivery' : null].filter(Boolean).join(' · ') || 'No phone'}
                      </Text>
                    </View>
                    {active && <Check size={18} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              <View style={styles.addStaffBox}>
                <Text style={styles.addStaffTitle}>Add a delivery person</Text>
                <View style={styles.addStaffInputRow}>
                  <User size={16} color={theme.colors.textDim} />
                  <TextInput
                    style={styles.addStaffInput}
                    placeholder="Name"
                    placeholderTextColor={theme.colors.textDim}
                    value={newStaffName}
                    onChangeText={setNewStaffName}
                    maxLength={100}
                  />
                </View>
                <View style={styles.addStaffInputRow}>
                  <Phone size={16} color={theme.colors.textDim} />
                  <TextInput
                    style={styles.addStaffInput}
                    placeholder="Mobile (optional)"
                    placeholderTextColor={theme.colors.textDim}
                    value={newStaffPhone}
                    onChangeText={(t) => setNewStaffPhone(t.replace(/\D/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                <TouchableOpacity style={[styles.addStaffBtn, addingStaff && { opacity: 0.6 }]} disabled={addingStaff} onPress={handleAddStaff}>
                  {addingStaff ? <ActivityIndicator size="small" color={theme.colors.primary} /> : (
                    <>
                      <Plus size={16} color={theme.colors.primary} />
                      <Text style={styles.addStaffBtnText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowStaffModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#f59e0b' }, updating && { opacity: 0.6 }]}
                disabled={updating}
                onPress={confirmDispatch}
              >
                {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Send Out</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBackdrop: StyleSheet.absoluteFill,
  modalContent: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: theme.colors.border },
  staffModal:   { maxHeight: '85%' },
  staffScroll:  { flexGrow: 0 },
  staffRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  staffRowActive:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '12' },
  staffName:    { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.text },
  staffMeta:    { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  addStaffBox:  { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: theme.colors.background, gap: 8 },
  addStaffTitle:{ fontSize: 13, fontWeight: '800', color: theme.colors.text },
  addStaffInputRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, backgroundColor: theme.colors.surface },
  addStaffInput:{ flex: 1, minHeight: 44, fontSize: 14, color: theme.colors.text },
  addStaffBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.primary },
  addStaffBtnText:{ fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  modalDesc:    { fontSize: 13, color: theme.colors.textDim, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  otpInput:     { backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '800', color: theme.colors.text, textAlign: 'center', letterSpacing: 10, borderWidth: 1, borderColor: theme.colors.border },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn:{ flex: 1, padding: 14, minHeight: 48, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText:{ fontSize: 14, fontWeight: '700', color: theme.colors.textDim },
  modalConfirmBtn:{ flex: 1, padding: 14, minHeight: 48, justifyContent: 'center', borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' },
  modalConfirmText:{ fontSize: 14, fontWeight: '800', color: '#fff' },
});

export default ShopOrderDetailScreen;
