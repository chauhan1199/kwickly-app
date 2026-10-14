import React, { useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useFocusEffect } from '@react-navigation/native';
import { 
  Bell, 
  Package, 
  ChevronRight, 
  Clock, 
  Truck, 
  CheckCircle2, 
  XCircle,
  ShoppingBag,
  User,
  Search,
  X
} from 'lucide-react-native';
import { shopService } from '../../services/shopService';
import useSocket from '../../hooks/useSocket';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ShopOrdersScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, isDarkMode);

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filters = ['All', 'New', 'Packing', 'Out', 'Delivered', 'Cancelled'];

  const fetchOrders = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await shopService.getShopOrders();
      if (res.data?.status === 'success') {
        const list = res.data.data.orders || res.data.data;
        const mapped = list.map(order => {
          let st = (order.status || 'NEW').toUpperCase();
          let filterKey = 'New';
          let color = '#6C47FF';
          let bg = isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE';
          let label = 'New Order';

          if (st === 'NEW' || st === 'PENDING') {
            filterKey = 'New';
            color = '#6C47FF';
            bg = isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE';
            label = '✨ New';
          } else if (st === 'CONFIRMED' || st === 'PACKING') {
            filterKey = 'Packing';
            color = '#F59E0B';
            bg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7';
            label = '📦 Packing';
          } else if (st === 'OUT_FOR_DELIVERY') {
            filterKey = 'Out';
            color = '#0284C7';
            bg = isDarkMode ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE';
            label = '🚚 On the way';
          } else if (st === 'DELIVERED') {
            filterKey = 'Delivered';
            color = '#10B981';
            bg = isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7';
            label = '✓ Delivered';
          } else if (st === 'CANCELLED') {
            filterKey = 'Cancelled';
            color = '#EF4444';
            bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2';
            label = '✕ Cancelled';
          }

          const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });

          return {
            id: order.orderNumber || `#${order._id.slice(-6).toUpperCase()}`,
            rawId: order._id,
            customer: order.customerId?.name || 'Customer',
            phone: order.customerId?.phone || '',
            itemsCount: (order.items || []).reduce((sum, it) => sum + (it.qty || 1), 0),
            itemsSummary: (order.items || []).map(i => i.name).slice(0, 2).join(', ') + ((order.items || []).length > 2 ? '...' : ''),
            total: order.totalAmount || order.payment?.amount || 0,
            status: st,
            filterKey,
            color,
            bg,
            label,
            time: dateStr,
            slot: order.deliverySlot?.time || order.deliverySlot?.label || (typeof order.deliverySlot === 'string' ? order.deliverySlot : ''),
            originalOrder: order
          };
        });
        setOrders(mapped);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDarkMode]);

  // Refetch on every focus; only the very first load shows the full-screen spinner
  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      fetchOrders(hasLoaded.current);
      hasLoaded.current = true;
    }, [fetchOrders])
  );

  // Live updates: a new order or any status/payment change refreshes the list
  useSocket({
    role: 'SHOP',
    onEvent: (event) => {
      if (event === 'NEW_ORDER' || event === 'ORDER_STATUS') fetchOrders(true);
    }
  });

  const getFilterCount = (filter) => {
    if (filter === 'All') return orders.length;
    return orders.filter(o => o.filterKey.toLowerCase() === filter.toLowerCase()).length;
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter !== 'All' && order.filterKey.toLowerCase() !== activeFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const idMatch = (order.id || '').toLowerCase().includes(q) || (order.rawId || '').toLowerCase().includes(q);
      const custMatch = (order.customer || '').toLowerCase().includes(q);
      const phoneMatch = (order.phone || '').toLowerCase().includes(q);
      const summaryMatch = (order.itemsSummary || '').toLowerCase().includes(q);
      const itemMatch = (order.originalOrder?.items || []).some(it => (it.name || '').toLowerCase().includes(q));
      return idMatch || custMatch || phoneMatch || summaryMatch || itemMatch;
    }
    return true;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(true);
    setRefreshing(false);
  }, [fetchOrders]);

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
          <View style={{ flex: 1 }}>
            <Text style={styles.appBarTitle}>Customer Orders</Text>
            <Text style={styles.appBarSubtitle}>
              {orders.length} total orders · {orders.filter(o => o.filterKey === 'New' || o.filterKey === 'Packing').length} active
            </Text>
          </View>

          <View style={styles.appBarActions}>
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={() => navigation.navigate('ShopNotifications')} 
              activeOpacity={0.8}
            >
              <Bell size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' }}>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color="#6C47FF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by Order ID (#...), Customer, Item..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')} 
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <X size={16} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips with Count Badges */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            {filters.map((filter) => {
              const isActive = activeFilter === filter;
              const count = getFilterCount(filter);
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveFilter(filter)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {filter}
                  </Text>
                  <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                    <Text style={[styles.countText, isActive && styles.countTextActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Order List */}
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6C47FF']}
              tintColor="#6C47FF"
            />
          }
        >
          {loading && orders.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C47FF" />
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Package size={36} color="#6C47FF" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'No Matching Orders' : 'No Orders Found'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim() 
                  ? `No orders match "${searchQuery.trim()}". Try searching another Order ID, customer, or product.` 
                  : `There are no orders matching the "${activeFilter}" filter.`}
              </Text>
              {searchQuery.trim() ? (
                <TouchableOpacity 
                  style={styles.clearSearchBtn} 
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearSearchBtnText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.ordersList}>
              {filteredOrders.map((order) => (
                <TouchableOpacity 
                  key={order.rawId} 
                  style={styles.orderCard}
                  onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order.rawId })}
                  activeOpacity={0.82}
                >
                  {/* Card Header */}
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderIdGroup}>
                      <View style={styles.orderIconWrap}>
                        <ShoppingBag size={17} color="#6C47FF" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.orderId} numberOfLines={1}>{order.id}</Text>
                        </View>
                        <Text style={styles.orderTime}>{order.time}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: order.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: order.color }]}>{order.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Card Body */}
                  <View style={styles.orderCardBody}>
                    <View style={styles.customerRow}>
                      <View style={styles.customerAvatar}>
                        <User size={13} color="#6C47FF" />
                      </View>
                      <Text style={styles.customerName}>{order.customer}</Text>
                      <Text style={styles.itemCountText}>· {order.itemsCount} item(s)</Text>
                    </View>
                    {order.itemsSummary ? (
                      <Text style={styles.itemsSummary} numberOfLines={1}>
                        📦 {order.itemsSummary}
                      </Text>
                    ) : null}
                    {order.slot ? (
                      <View style={styles.slotBadge}>
                        <Clock size={12} color="#6C47FF" style={{ marginRight: 4 }} />
                        <Text style={styles.slotText}>{order.slot}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Card Footer */}
                  <View style={styles.orderCardFooter}>
                    <View>
                      <Text style={styles.totalLabel}>ORDER AMOUNT</Text>
                      <Text style={styles.totalAmount}>₹{order.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.actionPill}>
                      <Text style={styles.actionPillText}>View Details</Text>
                      <ChevronRight size={14} color="#6C47FF" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
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
  appBarTitle: {
    fontSize: 20,
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#5830E0',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* ── Search Bar ── */
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDarkMode ? 0.2 : 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  clearBtn: {
    padding: 6,
    borderRadius: 12,
  },
  clearSearchBtn: {
    marginTop: 16,
    backgroundColor: '#6C47FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  clearSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* ── Filter Chips ── */
  filtersContainer: {
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  filterChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: theme.colors.textDim,
  },
  countTextActive: {
    color: '#FFFFFF',
  },

  /* ── Scroll ── */
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* ── Order Card ── */
  ordersList: {
    gap: 14,
  },
  orderCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.25 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : 'rgba(108, 71, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.text,
  },
  orderTime: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 1,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
    marginVertical: 12,
  },
  orderCardBody: {
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  customerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: theme.colors.text,
  },
  itemCountText: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  itemsSummary: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 3,
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(108, 71, 255, 0.09)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  slotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6C47FF',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : '#F8FAFC',
    marginHorizontal: -16,
    marginBottom: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textDim,
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 1,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    gap: 4,
    elevation: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  }
});

export default ShopOrdersScreen;

