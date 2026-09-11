import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, FlatList, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal, Image, Linking, AppState
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomInset } from '../../utils/safeInsets';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import CustomAlert from '../../components/ui/CustomAlert';
import { shopService } from '../../services/shopService';
import { walletService } from '../../services/walletService';
import {
  GooglePayIcon, PhonePeIcon, PaytmIcon, BhimIcon, CredIcon
} from '../../components/ui/UpiBrandIcons';
import {
  ShoppingCart, Minus, Plus, Trash2, MapPin, CreditCard,
  Tag, Clock, ChevronRight, Check, X, Truck, Zap, Shield, Smartphone, QrCode, ArrowRight, ExternalLink, Copy, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';
import { isValidUtr, utrValidationError } from '../../utils/upiValidation';
import { nativeUpiService } from '../../services/nativeUpiService';
import UpiPaymentWaitingModal from '../../components/UpiPaymentWaitingModal';

const CartScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const safeBottomInset = getSafeBottomInset(insets);
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const {
    cart, loading, itemCount, subtotal, deliveryCharge, promoDiscount, promoCode,
    platformFee, gstAmount, total,
    shopConfig, freeDeliveryAbove, minOrderAmount,
    fetchCart, updateItem, removeItem, clearCart, validatePromo, removePromo
  } = useCart();
  const styles = createStyles(theme, isDarkMode);

  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);

  // CustomAlert Modal State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false })),
    onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
  });

  const showAlert = ({
    type = 'info',
    title = '',
    message = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
    onConfirm = null,
    onCancel = null
  }) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      showCancel,
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onCancel) onCancel();
      }
    });
  };

  // UPI Modal State
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [customUpiId, setCustomUpiId] = useState('');
  const [upiVerifying, setUpiVerifying] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [upiTxnId, setUpiTxnId] = useState('');

  const [selectedDate, setSelectedDate] = useState(0); // 0 = Today, 1 = Tomorrow, 2 = Day After

  const isSlotPassed = useCallback((slot, dayOffset = selectedDate) => {
    if (dayOffset > 0) return false;
    if (!slot.slotClose) return false;
    const [h, m] = slot.slotClose.split(':').map(Number);
    if (isNaN(h)) return false;
    const now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) >= (h * 60 + (m || 0));
  }, [selectedDate]);

  const getDateLabel = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (offset === 0) return `Today (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
    if (offset === 1) return `Tomorrow (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getFullDateString = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const loadDeliverySlots = useCallback(async () => {
    try {
      const shopId = typeof cart?.shopId === 'object' ? (cart.shopId._id || cart.shopId.id) : cart?.shopId;
      if (!shopId) return;
      const res = await shopService.getShopById(shopId);
      const shopData = res.data?.data || res.data;
      const rawSlots = shopData?.deliveryConfig?.deliverySlots || shopData?.deliverySlots || [];
      if (Array.isArray(rawSlots) && rawSlots.length > 0) {
        const formatted = rawSlots.map(s => {
          const slotLabel = (s.label || '').trim();
          const timeRange = s.slotOpen && s.slotClose ? `${s.slotOpen} - ${s.slotClose}` : '';
          const display = slotLabel && timeRange ? `${slotLabel} (${timeRange})` : (slotLabel || timeRange || 'Standard');
          return {
            label: display,
            slotOpen: s.slotOpen,
            slotClose: s.slotClose,
            time: display
          };
        });
        setSlots(formatted);
        
        // Pick first slot that hasn't passed today
        const firstAvailable = formatted.find(s => !isSlotPassed(s, 0));
        if (firstAvailable) {
          setSelectedSlot(firstAvailable);
          setSelectedDate(0);
        } else {
          // If all slots passed today, default to tomorrow
          setSelectedDate(1);
          setSelectedSlot(formatted[0]);
        }
      } else {
        const now = new Date();
        const eta = new Date(now.getTime() + 45 * 60000);
        const fallbackSlots = [
          { label: `Instant Delivery (By ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`, time: 'Instant Delivery' },
          { label: 'Morning Slot (10:00 AM - 1:00 PM)', slotClose: '13:00', time: 'Morning (10:00 - 13:00)' },
          { label: 'Evening Slot (5:00 PM - 8:00 PM)', slotClose: '20:00', time: 'Evening (17:00 - 20:00)' }
        ];
        setSlots(fallbackSlots);
        const firstAvailable = fallbackSlots.find(s => !isSlotPassed(s, 0));
        if (firstAvailable) {
          setSelectedSlot(firstAvailable);
          setSelectedDate(0);
        } else {
          setSelectedDate(1);
          setSelectedSlot(fallbackSlots[0]);
        }
      }
    } catch (e) {
      console.warn('Could not load delivery slots:', e);
    }
  }, [cart?.shopId, isSlotPassed]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  useEffect(() => {
    if (cart?.shopId) {
      loadDeliverySlots();
    }
  }, [cart?.shopId, loadDeliverySlots]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    const result = await validatePromo(promoInput.trim(), subtotal);
    setPromoLoading(false);
    if (result.success) {
      showAlert({
        type: 'success',
        title: 'Promo Applied! 🎉',
        message: `You saved ₹${result.discount} with coupon code ${promoInput.trim().toUpperCase()}.`
      });
      setPromoInput('');
    } else {
      showAlert({
        type: 'error',
        title: 'Invalid Promo',
        message: result.message || 'The promo code entered is invalid or expired.'
      });
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart || !cart.items?.length) return;
    const shopId = typeof cart.shopId === 'object' ? (cart.shopId._id || cart.shopId.id) : cart.shopId;

    if (total < 1) {
      return showAlert({
        type: 'warning',
        title: 'Minimum Order',
        message: 'Your order must be at least ₹1.'
      });
    }

    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      return showAlert({
        type: 'warning',
        title: 'Minimum Order Required',
        message: `The minimum order amount for this shop is ₹${minOrderAmount}. Please add items worth ₹${minOrderAmount - subtotal} more to checkout.`,
        confirmText: 'Add More Items',
        onConfirm: () => navigation?.navigate('Shop', { screen: 'ShopMain' })
      });
    }

    const defaultAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
    if (!defaultAddress) {
      return showAlert({
        type: 'warning',
        title: 'Delivery Address Required',
        message: 'Please add or select a delivery address to place your order.',
        confirmText: 'Add Address',
        showCancel: true,
        cancelText: 'Cancel',
        onConfirm: () => navigation.navigate('SavedAddresses')
      });
    }

    if (paymentMethod === 'WALLET' && (user?.wallet?.balance || 0) < total) {
      return showAlert({
        type: 'warning',
        title: 'Insufficient Balance',
        message: `Your wallet balance is ₹${user?.wallet?.balance || 0}. Please top up your wallet or pay via UPI.`,
        confirmText: 'Top Up Wallet',
        showCancel: true,
        cancelText: 'Pay via UPI',
        onConfirm: () => navigation.navigate('WalletTopup'),
        onCancel: () => setPaymentMethod('UPI')
      });
    }

    if (selectedSlot && isSlotPassed(selectedSlot, selectedDate)) {
      return showAlert({
        type: 'warning',
        title: 'Slot Unavailable',
        message: `The slot "${selectedSlot.label}" has already passed for today. Please select an upcoming slot or choose Tomorrow.`,
        confirmText: 'Select Slot',
        onConfirm: () => setShowSlotModal(true)
      });
    }

    setIsProcessing(true);
    try {
      // Extract valid coordinates with fallback
      const rawCoords = defaultAddress.location?.coordinates;
      const validCoords = Array.isArray(rawCoords) && rawCoords.length === 2 && !isNaN(Number(rawCoords[0])) && !isNaN(Number(rawCoords[1]))
        ? [Number(rawCoords[0]), Number(rawCoords[1])]
        : [72.5714, 23.0225];

      const fullAddressStr = `${defaultAddress.label || 'Home'}: ${defaultAddress.street || defaultAddress.address || ''}, ${defaultAddress.city || 'Ahmedabad'}`.trim();

      // Step 1: Place order on backend
      const orderData = {
        shopId,
        items: cart.items.map(i => ({
          productId: typeof i.productId === 'object' ? (i.productId._id || i.productId.id) : (i.productId || i._id),
          name: i.name || 'Product',
          price: Number(i.price) || 0,
          qty: Number(i.qty) || 1
        })),
        deliveryAddress: fullAddressStr,
        paymentMethod: paymentMethod === 'WALLET' ? 'WALLET' : 'UPI',
        deliveryLocation: {
          type: 'Point',
          coordinates: validCoords
        },
        deliverySlot: {
          date: getFullDateString(selectedDate),
          time: selectedSlot?.label || selectedSlot?.time || 'Standard Delivery',
          label: `${getDateLabel(selectedDate)}: ${selectedSlot?.label || 'Standard'}`
        }
      };

      const res = await shopService.placeOrder(orderData);
      if (res.data?.status !== 'success') {
        throw new Error(res.data?.message || 'Failed to place order');
      }

      const order = res.data.data;
      setCurrentOrder(order);

      // Step 2: If Wallet payment -> complete immediately
      if (paymentMethod === 'WALLET') {
        await clearCart();
        if (fetchUser) await fetchUser();
        setOrderSuccessModal({
          orderNumber: order.orderNumber || `#${order._id?.slice(-6).toUpperCase()}`,
          orderId: order._id,
          total: Number(total).toFixed(2),
          method: 'Wallet',
          isPaid: true,
          utr: null,
          slot: selectedSlot?.label || (typeof selectedSlot === 'string' ? selectedSlot : 'Standard Delivery')
        });
        return;
      }

      // Step 3: If UPI payment -> create payment session and open UPI modal
      const payRes = await walletService.createPaymentOrder({
        amount: total,
        orderId: order._id,
        purpose: 'order_payment',
        paymentMethod: 'UPI'
      });
      const payData = payRes?.data?.data || {};
      const platformUpi = (payData.upiVpa || '').trim();
      const platformPayee = (payData.payeeName || 'Kwickly Admin').trim().replace(/\s+/g, ' ');
      const orderId = payData.razorpayOrderId || payData.upiOrderId || `upi_${Date.now()}`;
      const amtStr = Number(total).toFixed(2);
      const shortTr = `KWIK${String(order._id || Date.now()).slice(-6)}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);

      if (!platformUpi) {
        throw new Error('Admin UPI ID is currently not configured. Please choose Cash on Delivery or contact support.');
      }

      setUpiOrderData({
        razorpayOrderId: orderId,
        upiOrderId: orderId,
        upiVpa: platformUpi,
        payeeName: platformPayee,
        upiIntentUri: payData.upiIntentUri || `upi://pay?pa=${platformUpi}&pn=${encodeURIComponent(platformPayee)}&am=${amtStr}&cu=INR&tn=${encodeURIComponent('Order Payment')}&tr=${shortTr}`,
        amount: total
      });
      setShowUpiModal(true);

    } catch (e) {
      showAlert({
        type: 'error',
        title: 'Order Error',
        message: e?.response?.data?.message || e.message || 'Failed to place order. Please check your connection and try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualUtrVerification = async (utr, extraMeta = {}) => {
    if (!currentOrder?._id && !upiOrderData?.razorpayOrderId) {
      throw new Error('No active order session found');
    }
    const cleanUtr = (utr || '').trim();
    if (!cleanUtr || !isValidUtr(cleanUtr)) {
      throw new Error('Please enter the valid 12-digit UPI Reference Number.');
    }

    setUpiVerifying(true);
    try {
      const verifyRes = await walletService.verifyPayment({
        razorpayOrderId: upiOrderData?.razorpayOrderId || `upi_${Date.now()}`,
        upiTransactionId: cleanUtr,
        utrNumber: cleanUtr,
        orderId: currentOrder?._id,
        amount: total,
        purpose: 'order_payment',
        ...extraMeta
      });

      const isSuccess = verifyRes?.data?.status === 'success' ||
                        verifyRes?.status === 'success' ||
                        verifyRes?.data?.data?.status === 'PENDING_VERIFICATION' ||
                        verifyRes?.data?.data?.status === 'COMPLETED';

      if (isSuccess) {
        await handlePaymentSuccess(cleanUtr);
        return { verified: true, data: verifyRes?.data?.data || verifyRes?.data };
      }
      return verifyRes?.data || verifyRes;
    } finally {
      setUpiVerifying(false);
    }
  };

  const handlePaymentSuccess = async (detectedUtr = null) => {
    setShowUpiModal(false);
    setShowWaitingModal(false);
    setUpiTxnId('');
    await clearCart();
    if (fetchUser) await fetchUser();

    setOrderSuccessModal({
      orderNumber: currentOrder?.orderNumber || `#${currentOrder?._id?.slice(-6).toUpperCase()}`,
      orderId: currentOrder?._id,
      total: Number(total).toFixed(2),
      method: 'UPI',
      isPaid: true,
      utr: detectedUtr || 'Auto Verified',
      slot: selectedSlot?.label || (typeof selectedSlot === 'string' ? selectedSlot : 'Standard Delivery')
    });
  };

  const handleOpenUpiApp = async (appScheme = null) => {
    const chosen = appScheme || selectedUpiApp || 'gpay';
    setSelectedUpiApp(chosen);
    setShowUpiModal(false);

    try {
      const result = await nativeUpiService.startUpiPayment({
        vpa: upiOrderData?.upiVpa,
        name: upiOrderData?.payeeName || 'Kwickly Admin',
        amount: upiOrderData?.amount || total,
        txnRef: upiOrderData?.razorpayOrderId,
        note: `Order #${currentOrder?.orderNumber || ''}`,
        appKey: chosen,
      });

      console.log('[CartUPI] Native result:', JSON.stringify(result));

      // 1. If native intent captured UTR directly
      const utr = (result?.approvalRefNo || '').trim();
      if (utr && /^\d{12}$/.test(utr) && isValidUtr(utr)) {
        try {
          const verifyData = await handleManualUtrVerification(utr, {
            isIntentVerified: true,
            intentStatus: result?.status || 'SUCCESS',
            responseCode: result?.responseCode || '00',
            rawResponse: result?.rawResponse || '',
            txnId: result?.txnId || ''
          });
          if (verifyData?.verified) return;
        } catch (e) {
          console.warn('[CartUPI] Direct intent verify error:', e);
        }
      }

      // 2. Open Waiting Modal for automated real-time SMS / clipboard detection
      setShowWaitingModal(true);
    } catch (err) {
      console.warn('[CartUPI] Launch notice:', err?.message);
      setShowWaitingModal(true);
    }
  };

  const handleCopyVpa = () => {
    if (upiOrderData?.upiVpa) {
      Clipboard.setString(upiOrderData.upiVpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2500);
    }
  };

  const defaultAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const deliveryAddressStr = defaultAddress
    ? `${defaultAddress.label || 'Home'}: ${defaultAddress.street || ''}, ${defaultAddress.city || ''}`
    : 'No address saved';

  const renderCartItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemEmoji}>
        {item.imageUrl && getImageUrl(item.imageUrl) ? (
          <Image 
            source={{ uri: getImageUrl(item.imageUrl) }} 
            style={{ width: '100%', height: '100%', borderRadius: 12 }} 
            resizeMode="contain" 
          />
        ) : (
          <Text style={{ fontSize: 24 }}>📦</Text>
        )}
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* CUSTOM HEADER */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, position: 'relative', overflow: 'hidden' }}
      >
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          showBack={true} 
          title="My Cart" 
          subtitle={`${itemCount} items`} 
          transparent={true} 
          showLogo={false} 
        />
      </LinearGradient>

      {!cart || !cart.items?.length ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={56} color={theme.colors.textDim} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDesc}>Add items from a nearby shop to get started</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation?.navigate('Shop', { screen: 'ShopMain' })}>
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
                {/* Free Delivery Progress Banner */}
                {freeDeliveryAbove > 0 && (
                  subtotal < freeDeliveryAbove ? (
                    <View style={styles.deliveryProgressCard}>
                      <View style={styles.deliveryProgressHeader}>
                        <Truck size={16} color={theme.colors.primary} />
                        <Text style={styles.deliveryProgressText}>
                          Add <Text style={{ fontWeight: '800', color: theme.colors.primary }}>₹{freeDeliveryAbove - subtotal}</Text> more for <Text style={{ fontWeight: '800', color: '#059669' }}>FREE Delivery</Text>
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((subtotal / freeDeliveryAbove) * 100))}%` }]} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.freeDeliveryUnlockedCard}>
                      <Check size={16} color="#059669" />
                      <Text style={styles.freeDeliveryUnlockedText}>
                        🎉 Congratulations! You unlocked <Text style={{ fontWeight: '800' }}>FREE Delivery</Text>
                      </Text>
                    </View>
                  )
                )}

                {/* Min Order Notice */}
                {minOrderAmount > 0 && subtotal < minOrderAmount && (
                  <View style={styles.minOrderNoticeCard}>
                    <Text style={styles.minOrderNoticeEmoji}>ℹ️</Text>
                    <Text style={styles.minOrderNoticeText}>
                      Min order for this shop is <Text style={{ fontWeight: '800' }}>₹{minOrderAmount}</Text>. Add ₹{minOrderAmount - subtotal} more to checkout.
                    </Text>
                  </View>
                )}

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
                  <View style={styles.billRow}>
                    <Text style={styles.billKey}>Items Total</Text>
                    <Text style={styles.billVal}>₹{subtotal}</Text>
                  </View>
                  {promoDiscount > 0 && (
                    <View style={styles.billRow}>
                      <Text style={styles.billKey}>Promo / Shop Discount</Text>
                      <Text style={[styles.billVal, { color: '#059669' }]}>-₹{promoDiscount}</Text>
                    </View>
                  )}
                  <View style={styles.billRow}>
                    <Text style={styles.billKey}>Delivery Fee</Text>
                    <Text style={[styles.billVal, deliveryCharge === 0 && { color: '#059669' }]}>
                      {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                    </Text>
                  </View>
                  {platformFee > 0 && (
                    <View style={styles.billRow}>
                      <Text style={styles.billKey}>Kwickly Platform Fee (5%)</Text>
                      <Text style={styles.billVal}>₹{platformFee.toFixed(2)}</Text>
                    </View>
                  )}
                  {gstAmount > 0 && (
                    <View style={styles.billRow}>
                      <Text style={styles.billKey}>GST on Platform Fee (18%)</Text>
                      <Text style={styles.billVal}>₹{gstAmount.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.billRow, styles.billTotalRow]}>
                    <Text style={styles.billTotalKey}>To Pay</Text>
                    <Text style={styles.billTotalVal}>₹{total.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Trust Badges */}
                <View style={styles.trustRow}>
                  <View style={styles.trustBadge}>
                    <Shield size={14} color="#059669" />
                    <Text style={styles.trustText}>Secure UPI Payment</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Truck size={14} color="#059669" />
                    <Text style={styles.trustText}>Fast Delivery</Text>
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

          {/* Payment Method - UPI Focused */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Select Payment Method</Text>
            <View style={styles.paymentRow}>
              {[
                { key: 'UPI', icon: '⚡', label: 'UPI Payment', sub: 'GPay, PhonePe, Paytm, BHIM' },
                { key: 'WALLET', icon: '💳', label: 'Wallet', sub: `Balance: ₹${user?.wallet?.balance || 0}` },
              ].map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodCard, paymentMethod === m.key && styles.methodCardActive]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</Text>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub} numberOfLines={1}>{m.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Checkout Button */}
          <View style={[styles.footer, { paddingBottom: safeBottomInset }]}>
            <View>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing}
              onPress={handlePlaceOrder}
            >
              {paymentMethod === 'UPI' ? <Zap size={18} color="#001016" /> : <CreditCard size={18} color="#001016" />}
              <Text style={styles.checkoutText}>
                {isProcessing ? 'Processing...' : paymentMethod === 'UPI' ? `Pay ₹${total} with UPI` : `Pay ₹${total} via Wallet`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* UPI App Selection Modal */}
      <Modal visible={showUpiModal} transparent animationType="slide" onRequestClose={() => setShowUpiModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowUpiModal(false)} />
          <View style={styles.upiModalContent}>
            <View style={styles.upiModalHeader}>
              <View style={styles.upiBadge}>
                <Zap size={22} color="#6C47FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upiModalTitle}>Pay via Direct UPI</Text>
                <Text style={styles.upiModalSub}>Order #{currentOrder?.orderNumber || ''} • ₹{total}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUpiModal(false)} style={styles.modalCloseBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Quick UPI Apps Grid */}
            <Text style={styles.upiAppsTitle}>Select Your UPI App:</Text>
            <View style={styles.upiAppsGrid}>
              {[
                { key: 'gpay', name: 'Google Pay', icon: GooglePayIcon },
                { key: 'phonepe', name: 'PhonePe', icon: PhonePeIcon },
                { key: 'paytm', name: 'Paytm', icon: PaytmIcon },
                { key: 'bhim', name: 'BHIM', icon: BhimIcon },
                { key: 'cred', name: 'CRED', icon: CredIcon },
              ].map((app) => {
                const IconComponent = app.icon;
                const isSelected = selectedUpiApp === app.key;
                return (
                  <TouchableOpacity
                    key={app.key}
                    style={[styles.upiAppBtn, isSelected && styles.upiAppBtnSelected]}
                    onPress={() => handleOpenUpiApp(app.key)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.upiAppIconBox}>
                      <IconComponent size={36} />
                    </View>
                    <Text style={[styles.upiAppName, isSelected && styles.upiAppNameSelected]}>
                      {app.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.upiAppCheckBadge}>
                        <Check size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payee VPA Info */}
            <View style={styles.vpaBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vpaLabel}>Admin UPI ID (Official Escrow)</Text>
                <Text style={styles.vpaValue}>{upiOrderData?.upiVpa || 'UPI Payment'}</Text>
              </View>
              <TouchableOpacity style={styles.copyVpaBtn} onPress={handleCopyVpa}>
                {copiedVpa ? <CheckCircle2 size={16} color="#10B981" /> : <Copy size={16} color="#6C47FF" />}
                <Text style={[styles.copyVpaText, copiedVpa && { color: '#10B981' }]}>
                  {copiedVpa ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={styles.openAppPrimaryBtn}
              onPress={() => handleOpenUpiApp(selectedUpiApp || 'gpay')}
              activeOpacity={0.85}
            >
              <Zap size={18} color="#001016" />
              <Text style={styles.openAppPrimaryText}>
                Pay ₹{total} via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : 'UPI App'}
              </Text>
              <ArrowRight size={18} color="#001016" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelUpiBtn} onPress={() => {
              setShowUpiModal(false);
              if (currentOrder?._id) {
                navigation.navigate('OrderTracking', { orderId: currentOrder._id });
              }
            }}>
              <Text style={styles.cancelUpiText}>Pay Later / View Pending Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Real-time Automated Bank Verification Waiting Modal */}
      {showWaitingModal && (
        <UpiPaymentWaitingModal
          visible={showWaitingModal}
          onClose={() => {
            setShowWaitingModal(false);
            if (currentOrder?._id) {
              navigation.navigate('OrderTracking', { orderId: currentOrder._id });
            }
          }}
          onSuccess={(data) => handlePaymentSuccess(data?.utr || data?.approvalRefNo)}
          amount={total}
          orderId={upiOrderData?.razorpayOrderId}
          payeeName={upiOrderData?.payeeName}
          upiVpa={upiOrderData?.upiVpa}
          purpose="shop_order"
          onSubmitManualUtr={handleManualUtrVerification}
        />
      )}

      {/* Delivery Slot Modal */}
      <Modal visible={showSlotModal} transparent animationType="slide" onRequestClose={() => setShowSlotModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSlotModal(false)} />
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Delivery Schedule</Text>
              <TouchableOpacity onPress={() => setShowSlotModal(false)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Date Selection Pills */}
            <View style={styles.dateTabsRow}>
              {[0, 1, 2].map(offset => (
                <TouchableOpacity
                  key={offset}
                  style={[styles.dateTabPill, selectedDate === offset && styles.dateTabPillActive]}
                  onPress={() => {
                    setSelectedDate(offset);
                    const firstAvail = slots.find(s => !isSlotPassed(s, offset)) || slots[0];
                    if (firstAvail) setSelectedSlot(firstAvail);
                  }}
                >
                  <Text style={[styles.dateTabPillText, selectedDate === offset && styles.dateTabPillTextActive]}>
                    {offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : getDateLabel(offset).split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {slots.map((slot, idx) => {
                const passed = isSlotPassed(slot, selectedDate);
                const isSelected = selectedSlot?.label === slot.label && !passed;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.slotOption,
                      isSelected && styles.slotOptionActive,
                      passed && { opacity: 0.45, backgroundColor: theme.colors.surface }
                    ]}
                    disabled={passed}
                    onPress={() => {
                      if (!passed) {
                        setSelectedSlot(slot);
                        setShowSlotModal(false);
                      }
                    }}
                  >
                    <Clock size={18} color={isSelected ? '#fff' : passed ? '#94a3b8' : theme.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.slotOptionText, isSelected && { color: '#fff' }, passed && { color: '#94a3b8' }]}>
                        {slot.label}
                      </Text>
                      {passed && (
                        <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '700', marginTop: 2 }}>
                          ❌ Passed for today
                        </Text>
                      )}
                    </View>
                    {isSelected && <Check size={18} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Order Placed Success Modal */}
      <Modal visible={Boolean(orderSuccessModal)} transparent animationType="fade" onRequestClose={() => setOrderSuccessModal(null)}>
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalCard, { position: 'relative' }]}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 6 }}
              onPress={() => setOrderSuccessModal(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={theme.colors.textDim} />
            </TouchableOpacity>

            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.successBadgeCircle}
            >
              <Check size={36} color="#FFFFFF" strokeWidth={3} />
            </LinearGradient>

            <Text style={styles.successModalTitle}>Order Placed! 🎉</Text>
            <Text style={styles.successModalSub}>
              Order <Text style={{ fontWeight: '900', color: theme.colors.text }}>{orderSuccessModal?.orderNumber}</Text> has been created successfully.
            </Text>

            <View style={styles.successDetailsBox}>
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailKey}>Order Total</Text>
                <Text style={[styles.successDetailVal, { fontSize: 15, fontWeight: '900', color: theme.colors.primary }]}>
                  ₹{orderSuccessModal?.total}
                </Text>
              </View>

              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailKey}>Payment Method</Text>
                <View style={styles.paymentMethodPill}>
                  <Text style={styles.paymentMethodPillText}>
                    {orderSuccessModal?.method === 'Wallet' ? '💳 Kwickly Wallet' : '⚡ Direct UPI'}
                  </Text>
                </View>
              </View>

              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailKey}>Payment Status</Text>
                <View style={[
                  styles.paymentStatusBadge,
                  orderSuccessModal?.isPaid ? styles.statusBadgePaid : styles.statusBadgePending
                ]}>
                  <Text style={[
                    styles.paymentStatusBadgeText,
                    orderSuccessModal?.isPaid ? styles.statusTextPaid : styles.statusTextPending
                  ]}>
                    {orderSuccessModal?.isPaid ? '✓ Paid Instantly' : '⏳ Pending Verification'}
                  </Text>
                </View>
              </View>

              {orderSuccessModal?.utr ? (
                <View style={[styles.successDetailRow, { alignItems: 'flex-start', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.successDetailKey, { marginTop: 4 }]}>UTR Ref</Text>
                  <View style={styles.utrBadgeBox}>
                    <Text style={styles.utrBadgeText}>{orderSuccessModal.utr}</Text>
                  </View>
                </View>
              ) : null}

              {orderSuccessModal?.slot ? (
                <View style={[styles.successDetailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 6 }]}>
                  <Text style={styles.successDetailKey}>Delivery Slot</Text>
                  <Text style={[styles.successDetailVal, { color: '#6C47FF', maxWidth: '60%', textAlign: 'right' }]} numberOfLines={1}>
                    {orderSuccessModal.slot}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.trackOrderBtn}
              activeOpacity={0.85}
              onPress={() => {
                const oid = orderSuccessModal?.orderId;
                setOrderSuccessModal(null);
                navigation.navigate('ShopOrderDetails', { orderId: oid });
              }}
            >
              <Text style={styles.trackOrderBtnText}>📍 Track Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueShopBtn}
              activeOpacity={0.8}
              onPress={() => {
                setOrderSuccessModal(null);
                navigation.navigate('Shop', { screen: 'ShopMain' });
              }}
            >
              <Text style={styles.continueShopBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rich CustomAlert Dialog */}
      <CustomAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        onRequestClose={alertConfig.onCancel}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.colors.background },
  list:           { padding: 16, paddingBottom: 20 },
  shopBadge:      { backgroundColor: theme.colors.primary + '15', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.primary + '30' },
  shopBadgeText:  { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  deliveryProgressCard: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  deliveryProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  deliveryProgressText: { fontSize: 13, color: theme.colors.text, fontWeight: '600', flex: 1 },
  progressBarTrack: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  freeDeliveryUnlockedCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#05966915', borderWidth: 1, borderColor: '#05966930', borderRadius: 14, padding: 12, marginBottom: 12 },
  freeDeliveryUnlockedText: { fontSize: 13, color: '#059669', fontWeight: '700', flex: 1 },
  minOrderNoticeCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f59e0b15', borderWidth: 1, borderColor: '#f59e0b40', borderRadius: 14, padding: 12, marginBottom: 12 },
  minOrderNoticeEmoji: { fontSize: 16 },
  minOrderNoticeText: { fontSize: 13, color: isDarkMode ? '#fbbf24' : '#b45309', fontWeight: '700', flex: 1 },
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
  paymentSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  paymentTitle:   { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  paymentRow:     { flexDirection: 'row', gap: 10 },
  methodCard:     { flex: 1, backgroundColor: theme.colors.background, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  methodCardActive: { borderColor: theme.colors.primary, backgroundColor: isDarkMode ? 'rgba(108,71,255,0.12)' : '#EDE9FE' },
  methodLabel:    { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  methodSub:      { fontSize: 11, color: theme.colors.textDim, marginTop: 3, textAlign: 'center' },
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel:     { fontSize: 11, color: theme.colors.textDim, fontWeight: '600' },
  totalValue:     { fontSize: 22, fontWeight: '900', color: theme.colors.text },
  checkoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14 },
  checkoutText:   { fontSize: 15, fontWeight: '800', color: '#001016' },
  emptyState:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  emptyDesc:      { fontSize: 14, color: theme.colors.textDim, textAlign: 'center' },
  browseBtn:      { marginTop: 12, backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  browseBtnText:  { fontSize: 15, fontWeight: '800', color: '#001016' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBackdrop:  { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  modalContent:   { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  dateTabsRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dateTabPill:    { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center' },
  dateTabPillActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '18' },
  dateTabPillText: { fontSize: 12, fontWeight: '700', color: theme.colors.textDim },
  dateTabPillTextActive: { color: theme.colors.primary, fontWeight: '900' },
  slotOption:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  slotOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  slotOptionText: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text },
  
  // UPI Modal Styles
  upiModalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
  upiModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  upiBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6C47FF18', justifyContent: 'center', alignItems: 'center' },
  upiModalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  upiModalSub: { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  modalCloseBtn: { padding: 8 },
  upiAppsTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textDim, marginBottom: 12 },
  upiAppsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  upiAppBtn: { width: '31%', alignItems: 'center', paddingVertical: 12, backgroundColor: theme.colors.background, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.border, position: 'relative' },
  upiAppBtnSelected: { borderColor: '#6C47FF', backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#F5F3FF' },
  upiAppIconBox: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  upiAppName: { fontSize: 11, fontWeight: '700', color: theme.colors.text },
  upiAppNameSelected: { color: '#6C47FF', fontWeight: '900' },
  upiAppCheckBadge: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#6C47FF', justifyContent: 'center', alignItems: 'center' },
  
  paymentActiveBanner: { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ECFDF5', borderWidth: 1, borderColor: '#10B98140', borderRadius: 16, padding: 14, marginBottom: 16 },
  paymentActiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  paymentActiveTitle: { fontSize: 13, fontWeight: '800', color: '#10B981' },
  paymentActiveText: { fontSize: 12, color: isDarkMode ? '#D1FAE5' : '#065F46', lineHeight: 17, marginBottom: 10 },
  utrInputBox: { backgroundColor: theme.colors.background, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#10B981', marginTop: 4 },
  utrInputLabel: { fontSize: 11, fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  utrInput: { fontSize: 15, fontWeight: '800', color: theme.colors.text, paddingVertical: 2, letterSpacing: 1 },
  utrHelpText: { fontSize: 11, color: theme.colors.textDim, marginTop: 4, lineHeight: 14 },

  vpaBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  vpaLabel: { fontSize: 11, color: theme.colors.textDim, fontWeight: '600' },
  vpaValue: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  copyVpaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#6C47FF12' },
  copyVpaText: { fontSize: 12, fontWeight: '800', color: '#6C47FF' },
  
  openAppPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 16, marginBottom: 10 },
  openAppPrimaryText: { fontSize: 15, fontWeight: '900', color: '#001016' },

  confirmUpiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 16, marginBottom: 10 },
  confirmUpiBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },

  upiSecondaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 10, paddingHorizontal: 10 },
  upiSecondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  upiSecondaryText: { fontSize: 12, fontWeight: '700', color: '#6C47FF' },

  cancelUpiBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelUpiText: { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },

  // Order Success Modal Styles
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successModalCard: { width: '100%', maxWidth: 360, backgroundColor: theme.colors.surface, borderRadius: 28, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  successBadgeCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 14, elevation: 4 },
  successModalTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 6, textAlign: 'center' },
  successModalSub: { fontSize: 13, color: theme.colors.textDim, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  successDetailsBox: { width: '100%', backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: theme.colors.border },
  successDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  successDetailKey: { fontSize: 12, color: theme.colors.textDim, fontWeight: '700' },
  successDetailVal: { fontSize: 13, color: theme.colors.text, fontWeight: '800' },
  paymentMethodPill: { backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  paymentMethodPillText: { fontSize: 12, fontWeight: '800', color: theme.colors.text },
  paymentStatusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusBadgePaid: { backgroundColor: '#10B98118' },
  statusBadgePending: { backgroundColor: '#F59E0B18' },
  paymentStatusBadgeText: { fontSize: 11.5, fontWeight: '900' },
  statusTextPaid: { color: '#10B981' },
  statusTextPending: { color: '#D97706' },
  utrBadgeBox: { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.12)' : '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B40' },
  utrBadgeText: { fontSize: 12, fontWeight: '900', color: isDarkMode ? '#FDE68A' : '#B45309', letterSpacing: 0.8 },
  trackOrderBtn: { width: '100%', backgroundColor: theme.colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  trackOrderBtnText: { fontSize: 15, fontWeight: '900', color: '#001016' },
  continueShopBtn: { width: '100%', backgroundColor: theme.colors.background, paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  continueShopBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
});

export default CartScreen;
