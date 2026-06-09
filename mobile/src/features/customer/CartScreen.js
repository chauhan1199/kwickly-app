import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, FlatList, Alert
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ShoppingCart, Minus, Plus, Trash2, MapPin, CreditCard } from 'lucide-react-native';
import AppBar from '../../components/AppBar';

const CartScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  const [items, setItems] = useState([]); // Empty cart

  const updateQty = (id, delta) => {
    setItems(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0)
    );
  };

  const removeItem = (id) => {
    Alert.alert('Remove item?', 'Remove this item from cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setItems(prev => prev.filter(i => i.id !== id)) }
    ]);
  };

  const subtotal    = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFee = subtotal >= 1000 ? 0 : 40;
  const total       = subtotal + deliveryFee;

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemEmoji}>
        <Text style={{ fontSize: 28 }}>{item.imageEmoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemPrice}>₹{item.price}</Text>
      </View>
      <View style={styles.itemRight}>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
            <Minus size={14} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.qtyNum}>{item.qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
            <Plus size={14} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemSubtotal}>₹{item.price * item.qty}</Text>
        <TouchableOpacity onPress={() => removeItem(item.id)}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title="My Cart" subtitle={`${items.length} items`} />

      {items.length === 0 ? (
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
            data={items}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <View style={styles.billBox}>
                <Text style={styles.billTitle}>Bill Details</Text>
                {[
                  ['Subtotal', `₹${subtotal}`],
                  ['Delivery Fee', deliveryFee === 0 ? 'FREE 🎉' : `₹${deliveryFee}`],
                ].map(([k, v]) => (
                  <View key={k} style={styles.billRow}>
                    <Text style={styles.billKey}>{k}</Text>
                    <Text style={[styles.billVal, v === 'FREE 🎉' && { color: '#059669' }]}>{v}</Text>
                  </View>
                ))}
                <View style={[styles.billRow, styles.billTotalRow]}>
                  <Text style={styles.billTotalKey}>Total</Text>
                  <Text style={styles.billTotalVal}>₹{total}</Text>
                </View>
                {deliveryFee === 0 && (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>🎉 Free delivery applied (order ≥ ₹1000)</Text>
                  </View>
                )}
              </View>
            }
          />

          {/* Delivery Address */}
          <View style={styles.addressRow}>
            <MapPin size={16} color={theme.colors.primary} />
            <Text style={styles.addressText} numberOfLines={1}>Delivering to: Saved Address</Text>
            <TouchableOpacity>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Checkout */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.totalLabel}>To Pay</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => Alert.alert('Order Placed! 🎉', 'Your order has been placed successfully.\nTrack it in My Orders.')}
            >
              <CreditCard size={18} color="#001016" />
              <Text style={styles.checkoutText}>Proceed to Pay</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.colors.background },
  list:           { padding: 16, gap: 12 },
  itemCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
  itemEmoji:      { width: 52, height: 52, borderRadius: 14, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  itemName:       { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  itemPrice:      { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  itemRight:      { alignItems: 'flex-end', gap: 8 },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, overflow: 'hidden' },
  qtyBtn:         { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  qtyNum:         { paddingHorizontal: 12, fontSize: 15, fontWeight: '800', color: theme.colors.text },
  itemSubtotal:   { fontSize: 15, fontWeight: '900', color: theme.colors.text },
  billBox:        { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20, marginTop: 8, borderWidth: 1, borderColor: theme.colors.border },
  billTitle:      { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 14 },
  billRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  billKey:        { fontSize: 14, color: theme.colors.textDim, fontWeight: '600' },
  billVal:        { fontSize: 14, color: theme.colors.text, fontWeight: '700' },
  billTotalRow:   { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 12 },
  billTotalKey:   { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  billTotalVal:   { fontSize: 20, fontWeight: '900', color: theme.colors.text },
  freeBadge:      { backgroundColor: '#d1fae5', borderRadius: 10, padding: 10, marginTop: 12 },
  freeBadgeText:  { fontSize: 13, color: '#059669', fontWeight: '700', textAlign: 'center' },
  addressRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  addressText:    { flex: 1, fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  changeText:     { fontSize: 13, color: theme.colors.primary, fontWeight: '700' },
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel:     { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  totalValue:     { fontSize: 22, fontWeight: '900', color: theme.colors.text },
  checkoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 18 },
  checkoutText:   { fontSize: 16, fontWeight: '800', color: '#001016' },
  emptyState:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  emptyDesc:      { fontSize: 14, color: theme.colors.textDim, textAlign: 'center' },
  browseBtn:      { marginTop: 12, backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  browseBtnText:  { fontSize: 15, fontWeight: '800', color: '#001016' },
});

export default CartScreen;
