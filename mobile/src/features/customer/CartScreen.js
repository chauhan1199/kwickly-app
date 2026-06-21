import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, FlatList, Alert, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import api from '../../services/api';
import Razorpay from 'react-native-razorpay';
import {
  ShoppingCart, Minus, Plus, Trash2, MapPin, CreditCard,
  Tag, Clock, ChevronRight, Check, X, Truck, Zap, Shield, Smartphone
} from 'lucide-react-native';

const CartScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const {
    cart, loading, itemCount, subtotal, deliveryCharge, promoDiscount, promoCode, total,
    fetchCart, updateItem, removeItem, clearCart, validatePromo, removePromo
  } = useCart();
  const styles = createStyles(theme, isDarkMode);

  const [paymentMethod, setPaymentMethod] = useState('WALLET');
  const [upiId, setUpiId] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showSlotModal, setShowSlotModal] = useState(false);

  useEffect(() => { fetchCart(); }, []);

  useEffect(() => {
    if (cart?.shopId) {
      loadDeliverySlots();
    }
  }, [cart?.shopId]);

  const loadDeliverySlots = async () => {
    try {
      const shopId = typeof cart?.shopId === 'object' ? cart.shopId._id : cart?.shopId;
      if (!shopId) return;
      const res = await api.get(`/shops/${shopId}`);
      const shopData = res.data?.data;
      if (shopData?.deliveryConfig?.deliverySlots) {
        setSlots(shopData.deliveryConfig.deliverySlots);
      } else if (shopData?.delivery) {
        const d = shopData.delivery;
        if (d.estimatedMinutes) {
          const now = new Date();
          const eta = new Date(now.getTime() + d.estimatedMinutes * 60000);
          setSlots([{ label: `By ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, slotOpen: now.toISOString(), slotClose: eta.toISOString() }]);
        }
      }
    } catch (e) { console.log('Could not load delivery slots'); }
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    const result = await validatePromo(promoInput.trim(), subtotal);
    setPromoLoading(false);
    if (result.success) {
      Alert.alert('Promo Applied! 🎉', `You saved ₹${result.discount}`);
      setPromoInput('');
    } else {
      Alert.alert('Invalid Promo', result.message);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart || !cart.items?.length) return;
    const shopId = typeof cart.shopId === 'object' ? cart.shopId._id : cart.shopId;

    if (total < 1) {
      return Alert.alert('Minimum Order', 'Your order must be at least ₹1.');
    }

    const defaultAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
    if (!defaultAddress) {
      return Alert.alert('No Address', 'Please save a delivery address first.', [
        { text: 'Add Address', onPress: () => navigation.navigate('SavedAddresses') }
      ]);
    }

    if (paymentMethod === 'WALLET' && (user?.wallet?.balance || 0) < total) {
      return Alert.alert('Insufficient Balance', `Your wallet balance is ₹${user?.wallet?.balance || 0}. Please top up or use UPI.`);
    }

    setIsProcessing(true);
    try {
      // Step 1: Place order on backend
      const orderData = {
        shopId,
        items: cart.items.map(i => ({
          productId: typeof i.productId === 'object' ? i.productId._id : i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty
        })),
        deliveryAddress: `${defaultAddress.label || 'Home'}: ${defaultAddress.street || ''}, ${defaultAddress.city || ''}`,
        paymentMethod: paymentMethod === 'RAZORPAY' ? 'UPI' : paymentMethod,
        deliveryLocation: {
          type: 'Point',
          coordinates: defaultAddress.location?.coordinates || [0, 0]
        },
        deliverySlot: selectedSlot
      };

      const res = await api.post('/shoporders', orderData);
      if (res.data?.status !== 'success') {
        throw new Error(res.data?.message || 'Failed to place order');
      }

      const order = res.data.data;

      // Step 2: If Razorpay payment, create Razorpay order and open checkout
      if (paymentMethod === 'RAZORPAY') {
        try {
          const payRes = await api.post('/payments/create-order', {
            amount: total,
            orderId: order._id,
            purpose: 'order_payment'
          });

          if (payRes.data?.status === 'success') {
            const { razorpayOrderId, keyId, amount, paymentId } = payRes.data.data;

            // Open Razorpay checkout
            const options = {
              description: `Kwickly Order #${order.orderNumber || order._id?.slice(-6)}`,
              image: 'https://kwickly.in/logo.png',
              currency: 'INR',
              key: keyId,
              amount: amount,
              order_id: razorpayOrderId,
              name: 'Kwickly',
              prefill: {
                contact: user?.phone || '',
                email: user?.email || ''
              },
              theme: { color: '#0e9aa7' }
            };

            try {
              const razorpayResponse = await Razorpay.open(options);

              // Step 3: Verify payment on backend
              const verifyRes = await api.post('/payments/verify', {
                razorpayOrderId: razorpayResponse.razorpay_order_id,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpaySignature: razorpayResponse.razorpay_signature,
                orderId: order._id
              });

              if (verifyRes.data?.status === 'success') {
                await clearCart();
                if (fetchUser) await fetchUser();
                Alert.alert('Payment Successful! 🎉', `Order ${order.orderNumber || ''} confirmed.`, [
                  { text: 'Track Order', onPress: () => navigation.navigate('OrderTracking', { orderId: order._id }) }
                ]);
              } else {
                Alert.alert('Payment Verification Failed', 'Please contact support. Your payment will be verified shortly.');
                await clearCart();
                navigation.navigate('OrderTracking', { orderId: order._id });
              }
            } catch (razorpayError) {
              // User cancelled or payment failed
              if (razorpayError?.code === 0) {
                Alert.alert('Payment Cancelled', 'You cancelled the payment. Your order is still pending.', [
                  { text: 'Track Order', onPress: () => navigation.navigate('OrderTracking', { orderId: order._id }) },
                  { text: 'Continue Shopping', onPress: () => navigation.navigate('Shop') }
                ]);
              } else {
                Alert.alert('Payment Failed', razorpayError?.description || 'Payment failed. Please try again.', [
                  { text: 'Track Order', onPress: () => navigation.navigate('OrderTracking', { orderId: order._id }) }
                ]);
              }
            }
          }
        } catch (payError) {
          // Backend order was created but Razorpay order creation failed
          // Order exists with PENDING payment status
          Alert.alert('Payment Error', 'Could not initiate payment. Your order is pending.', [
            { text: 'Track Order', onPress: () => navigation.navigate('OrderTracking', { orderId: order._id }) }
          ]);
        }
      } else {
        // Wallet payment - order is already placed
        await clearCart();
        if (fetchUser) await fetchUser();
        Alert.alert('Order Placed! 🎉', `Order ${order.orderNumber || ''} has been placed successfully.`, [
          { text: 'Track Order', onPress: () => navigation.navigate('OrderTracking', { orderId: order._id }) },
          { text: 'Continue Shopping', onPress: () => navigation.navigate('Shop') }
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || e.message || 'Failed to place order');
    } finally {
      setIsProcessing(false);
    }
  };

  const defaultAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const deliveryAddressStr = defaultAddress
    ? `${defaultAddress.label || 'Home'}: ${defaultAddress.street || ''}, ${defaultAddress.city || ''}`
    : 'No address saved';

  const renderCartItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemEmoji}>
        <Text style={{ fontSize: 24 }}>{item.imageUrl || '📦'}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemPrice}>₹{item.price} × {item.qty}</Text>
      </View>
      <View style={styles.itemActions}>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateItem(item._id, item.qty - 1)}>
            <Minus size={14} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.qtyNum}>{item.qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateItem(item._id, item.qty + 1)}>
            <Plus size={14} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemSubtotal}>₹{item.price * item.qty}</Text>
        <TouchableOpacity onPress={() => removeItem(item._id)} style={styles.removeBtn}>
          <Trash2 size={14} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !cart) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title="My Cart" subtitle={`${itemCount} items`} packageRoute="CustomerShopOrders" />

      {!cart || !cart.items?.length ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={56} color={theme.colors.textDim} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDesc}>Add items from a nearby shop to get started</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation?.navigate('Shop')}>
            <Text style={styles.browseBtnText}>Browse Shops</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={i => i._id}
            renderItem={renderCartItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.shopBadge}>
                <Text style={styles.shopBadgeText}>
                  🏪 Ordering from: {typeof cart.shopId === 'object' ? cart.shopId.name : 'Shop'}
                </Text>
              </View>
            }
            ListFooterComponent={
              <View>
                {/* Delivery Slot */}
                {slots.length > 0 && (
                  <TouchableOpacity style={styles.slotCard} onPress={() => setShowSlotModal(true)}>
                    <Clock size={18} color={theme.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.slotLabel}>Delivery Slot</Text>
                      <Text style={styles.slotValue}>
                        {selectedSlot ? selectedSlot.label : 'Select delivery time'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={theme.colors.textDim} />
                  </TouchableOpacity>
                )}

                {/* Promo Code */}
                <View style={styles.promoCard}>
                  <Tag size={18} color={theme.colors.primary} />
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor={theme.colors.textDim}
                    value={promoInput}
                    onChangeText={setPromoInput}
                    autoCapitalize="characters"
                    editable={!promoCode}
                  />
                  {promoCode ? (
                    <TouchableOpacity onPress={removePromo} style={styles.promoRemove}>
                      <X size={16} color="#ef4444" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.promoApplyBtn, promoLoading && { opacity: 0.5 }]}
                      onPress={handleApplyPromo}
                      disabled={promoLoading}
                    >
                      <Text style={styles.promoApplyText}>
                        {promoLoading ? '...' : 'Apply'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {promoCode && (
                  <View style={styles.promoSuccess}>
                    <Check size={14} color="#059669" />
                    <Text style={styles.promoSuccessText}>
                      Code <Text style={{ fontWeight: '800' }}>{promoCode}</Text> applied! You save ₹{promoDiscount}
                    </Text>
                  </View>
                )}

                {/* Bill Details */}
                <View style={styles.billBox}>
                  <Text style={styles.billTitle}>Bill Details</Text>
                  {[
                    ['Items Total', `₹${subtotal}`],
                    ['Delivery Fee', deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`],
                    promoDiscount > 0 ? ['Promo Discount', `-₹${promoDiscount}`] : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <View key={k} style={styles.billRow}>
                      <Text style={styles.billKey}>{k}</Text>
                      <Text style={[styles.billVal, v.includes('FREE') && { color: '#059669' }]}>
                        {v}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.billRow, styles.billTotalRow]}>
                    <Text style={styles.billTotalKey}>To Pay</Text>
                    <Text style={styles.billTotalVal}>₹{total}</Text>
                  </View>
                </View>

                {/* Trust Badges */}
                <View style={styles.trustRow}>
                  <View style={styles.trustBadge}>
                    <Shield size={14} color="#059669" />
                    <Text style={styles.trustText}>Secure Payment</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Truck size={14} color="#059669" />
                    <Text style={styles.trustText}>Same Day Delivery</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Zap size={14} color="#059669" />
                    <Text style={styles.trustText}>Live Tracking</Text>
                  </View>
                </View>
              </View>
            }
          />

          {/* Address Bar */}
          <TouchableOpacity style={styles.addressBar} onPress={() => navigation.navigate('SavedAddresses')}>
            <MapPin size={16} color={theme.colors.primary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {defaultAddress ? `Delivering to: ${deliveryAddressStr}` : 'Add delivery address'}
            </Text>
            <ChevronRight size={16} color={theme.colors.textDim} />
          </TouchableOpacity>

          {/* Payment Method */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment</Text>
            <View style={styles.paymentRow}>
              {[
                { key: 'WALLET', icon: '💳', label: 'Wallet', sub: `₹${user?.wallet?.balance || 0}` },
                { key: 'RAZORPAY', icon: '📱', label: 'UPI / Card', sub: 'GPay, PhonePe, Card' },
              ].map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodCard, paymentMethod === m.key && styles.methodCardActive]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</Text>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Checkout Button */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.totalLabel}>To Pay</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing}
              onPress={handlePlaceOrder}
            >
              <CreditCard size={18} color="#001016" />
              <Text style={styles.checkoutText}>
                {isProcessing ? 'Processing...' : paymentMethod === 'RAZORPAY' ? `Pay ₹${total}` : `Place Order • ₹${total}`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Delivery Slot Modal */}
      <Modal visible={showSlotModal} transparent animationType="slide" onRequestClose={() => setShowSlotModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowSlotModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Delivery Slot</Text>
            <ScrollView>
              {slots.map((slot, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.slotOption, selectedSlot?.label === slot.label && styles.slotOptionActive]}
                  onPress={() => { setSelectedSlot(slot); setShowSlotModal(false); }}
                >
                  <Clock size={18} color={selectedSlot?.label === slot.label ? '#fff' : theme.colors.primary} />
                  <Text style={[styles.slotOptionText, selectedSlot?.label === slot.label && { color: '#fff' }]}>
                    {slot.label}
                  </Text>
                  {selectedSlot?.label === slot.label && <Check size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const { Pressable } = require('react-native');

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.colors.background },
  list:           { padding: 16, paddingBottom: 20 },
  shopBadge:      { backgroundColor: theme.colors.primary + '15', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.primary + '30' },
  shopBadgeText:  { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  itemCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  itemEmoji:      { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  itemInfo:       { flex: 1, marginLeft: 12 },
  itemName:       { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  itemPrice:      { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  itemActions:    { alignItems: 'flex-end', gap: 6 },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, overflow: 'hidden' },
  qtyBtn:         { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  qtyNum:         { paddingHorizontal: 10, fontSize: 14, fontWeight: '800', color: theme.colors.text },
  itemSubtotal:   { fontSize: 14, fontWeight: '900', color: theme.colors.text },
  removeBtn:      { padding: 4 },
  slotCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  slotLabel:      { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  slotValue:      { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  promoCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, gap: 10 },
  promoInput:     { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text, paddingVertical: 4 },
  promoApplyBtn:  { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  promoApplyText: { color: '#001016', fontSize: 13, fontWeight: '800' },
  promoRemove:    { padding: 6 },
  promoSuccess:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 4 },
  promoSuccessText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  billBox:        { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  billTitle:      { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  billRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  billKey:        { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  billVal:        { fontSize: 13, color: theme.colors.text, fontWeight: '700' },
  billTotalRow:   { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 10 },
  billTotalKey:   { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  billTotalVal:   { fontSize: 20, fontWeight: '900', color: theme.colors.text },
  trustRow:       { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, marginBottom: 8 },
  trustBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText:      { fontSize: 11, color: '#059669', fontWeight: '600' },
  addressBar:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  addressText:    { flex: 1, fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  paymentSection: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.surface },
  paymentTitle:   { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  paymentRow:     { flexDirection: 'row', gap: 10 },
  methodCard:     { flex: 1, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  methodCardActive: { borderColor: theme.colors.primary, backgroundColor: isDarkMode ? 'rgba(14,154,167,0.1)' : '#e0f2f1' },
  methodLabel:    { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  methodSub:      { fontSize: 11, color: theme.colors.textDim, marginTop: 2 },
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel:     { fontSize: 11, color: theme.colors.textDim, fontWeight: '600' },
  totalValue:     { fontSize: 22, fontWeight: '900', color: theme.colors.text },
  checkoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  checkoutText:   { fontSize: 15, fontWeight: '800', color: '#001016' },
  emptyState:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  emptyDesc:      { fontSize: 14, color: theme.colors.textDim, textAlign: 'center' },
  browseBtn:      { marginTop: 12, backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  browseBtnText:  { fontSize: 15, fontWeight: '800', color: '#001016' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdrop:  { flex: 1 },
  modalContent:   { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '50%' },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
  slotOption:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  slotOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  slotOptionText: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text },
});

export default CartScreen;
