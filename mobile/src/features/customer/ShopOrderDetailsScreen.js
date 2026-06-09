import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';

const ShopOrderDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { order } = route.params || {};

  // Mock data if no order is passed
  const o = order || {
    id: 'SO1040',
    shop: 'Sharma General Store',
    s: 'Delivered',
    amt: '758',
    icon: '🏪',
    color: '#10b981'
  };

  const isActive = o.s === 'Out for Delivery';
  const priceNum = parseInt(o.amt.toString().replace('₹', '')) || 758;

  // Mock items
  const items = [
    { name: 'Fortune Sunflower Oil 1L', qty: 2, price: 290 },
    { name: 'Aashirvaad Atta 5kg', qty: 1, price: 250 },
    { name: 'Amul Butter 100g', qty: 2, price: 110 },
    { name: 'Britannia Bread', qty: 1, price: 50 },
  ];

  const subtotal = 700;
  const deliveryFee = 35;
  const taxes = 23;

  const styles = createStyles(theme, isDarkMode);

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
              <Text style={styles.deliveryText}>🛵 Partner is on the way to deliver your order.</Text>
            </View>
          )}
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Delivery Address</Text>
          <View style={[styles.row, { marginTop: 10, alignItems: 'flex-start' }]}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>Home</Text>
              <Text style={styles.addressText}>A-12, Sector 21, Delhi 110085</Text>
            </View>
          </View>
        </View>

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
          <TouchableOpacity style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>📍 Track Order</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.primaryBtnText}>↺ Reorder Items</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.secondaryBtn}>
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
