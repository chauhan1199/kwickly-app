import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, TextInput, Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import AppBar from '../../components/AppBar';
import { shopService } from '../../services/shopService';
import { Package, ChevronRight, Clock, Search } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SearchBar } from '../../components/ui/SearchBar';

const STATUS_COLORS = {
  NEW: { bg: '#FEF3C7', text: '#D97706', label: 'New' },
  CONFIRMED: { bg: '#DBEAFE', text: '#2563EB', label: 'Confirmed' },
  PACKING: { bg: '#E0E7FF', text: '#4F46E5', label: 'Packing' },
  OUT_FOR_DELIVERY: { bg: '#D1FAE5', text: '#059669', label: 'On the Way' },
  DELIVERED: { bg: '#D1FAE5', text: '#059669', label: 'Delivered' },
  CANCELLED: { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelled' },
};

const OrderHistoryScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await shopService.getCustomerOrders();
      const data = res.data?.data;
      const list = data?.orders || (Array.isArray(data) ? data : []);
      setOrders(list);
    } catch (e) {
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'all' || o.status === filter;
    const matchesSearch = o.shopId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const renderOrder = ({ item }) => {
    const status = STATUS_COLORS[item.status] || STATUS_COLORS.NEW;
    const orderDate = new Date(item.createdAt).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderMeta}>
            <Text style={styles.orderNumber}>{item.orderNumber || '#' + item._id?.slice(-6)}</Text>
            <Text style={styles.orderDate}>{orderDate}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.shopRow}>
          <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
            {item.shopId?.name || 'Shop'}
          </Text>
          <Text style={styles.orderTotal}>₹{item.total}</Text>
        </View>

        <View style={styles.itemsPreview}>
          {item.items?.slice(0, 3).map((itm, idx) => (
            <Text key={idx} style={styles.itemPreview} numberOfLines={1}>
              {itm.name} × {itm.qty}
            </Text>
          ))}
          {item.items?.length > 3 && (
            <Text style={styles.moreItems}>+{item.items.length - 3} more</Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.paymentInfo}>
            {item.payment?.method || 'WALLET'} · {item.payment?.status === 'PAID' ? '✅ Paid' : '⏳ Pending'}
          </Text>
          <ChevronRight size={16} color={theme.colors.textDim} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, position: 'relative', overflow: 'hidden' }}
      >
        {/* Dynamic background shapes */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Order History" 
          subtitle={`${orders.length} orders`} 
          hideRightIcons={false} 
          transparent={true} 
          showLogo={false} 
          showBack={true} 
          showProfile={false}
          showCart={false}
          onBackPress={() => navigation.goBack()} 
        />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View pointerEvents="box-none" style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10, marginBottom: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search by shop or order number..."
        />
      </View>

      {/* Filter Tabs */}
      <View style={{ marginBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'NEW', 'OUT_FOR_DELIVERY', 'DELIVERED'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : STATUS_COLORS[f]?.label || f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={item => item._id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Package size={48} color={theme.colors.textDim} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search or filter</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  filterRow:    { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingVertical: 6, paddingRight: 24 },
  filterTab:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterTabActive:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  filterText:   { fontSize: 12, fontWeight: '700', color: theme.colors.textDim },
  filterTextActive:{ color: theme.colors.primary },
  list:         { padding: 16, gap: 12 },
  orderCard:    { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  orderHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderMeta:    { flex: 1 },
  orderNumber:  { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  orderDate:    { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  shopRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 },
  shopName:     { fontSize: 14, fontWeight: '600', color: theme.colors.text, flex: 1, minWidth: 0 },
  orderTotal:   { fontSize: 15, fontWeight: '800', color: theme.colors.text, flexShrink: 0 },
  itemsPreview: { marginBottom: 10 },
  itemPreview:  { fontSize: 12, color: theme.colors.textDim, marginBottom: 2 },
  moreItems:    { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  orderFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  paymentInfo:  { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  emptyState:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  emptyDesc:    { fontSize: 14, color: theme.colors.textDim, textAlign: 'center' },
});

export default OrderHistoryScreen;
