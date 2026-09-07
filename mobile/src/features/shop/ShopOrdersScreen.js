import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  RefreshControl
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
  User
} from 'lucide-react-native';
import { shopService } from '../../services/shopService';
import { SafeAreaView } from 'react-native-safe-area-context';

const ShopOrdersScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { unreadCount } = useNotifications();
  const styles = createStyles(theme, isDarkMode);

  const [activeFilter, setActiveFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filters = ['All', 'New', 'Packing', 'Out', 'Delivered', 'Cancelled'];

  useFocusEffect(
    React.useCallback(() => {
      fetchOrders();
    }, [])
  );

  const fetchOrders = async () => {
    try {
      setLoading(true);
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
            id: order._id.slice(-6).toUpperCase(),
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
    }
  };

  const getFilterCount = (filter) => {
    if (filter === 'All') return orders.length;
    return orders.filter(o => o.filterKey.toLowerCase() === filter.toLowerCase()).length;
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'All') return true;
    return order.filterKey.toLowerCase() === activeFilter.toLowerCase();
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
        {/* App Bar */}
        <View style={styles.appBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appBarTitle}>Customer Orders</Text>
            <Text style={styles.appBarSubtitle}>{orders.length} total orders recorded</Text>
          </View>

          <View style={styles.appBarActions}>
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={() => navigation.navigate('ShopNotifications')} 
              activeOpacity={0.7}
            >
              <Bell size={20} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
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
                  activeOpacity={0.8}
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C47FF" />
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Package size={36} color="#6C47FF" />
              </View>
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptyText}>There are no orders matching the "{activeFilter}" filter.</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {filteredOrders.map((order) => (
                <TouchableOpacity 
                  key={order.rawId} 
                  style={styles.orderCard}
                  onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order.rawId })}
                  activeOpacity={0.8}
                >
                  {/* Card Header */}
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderIdGroup}>
                      <View style={styles.orderIconWrap}>
                        <ShoppingBag size={16} color="#6C47FF" />
                      </View>
                      <View>
                        <Text style={styles.orderId}>#{order.id}</Text>
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
                        <User size={14} color="#6C47FF" />
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#6C47FF12', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6C47FF' }}>🕒 {order.slot}</Text>
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
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 68,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  appBarSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: theme.colors.textDim,
    marginTop: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
  },

  /* ── Filter Chips ── */
  filtersContainer: {
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
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
  },

  /* ── Order Card ── */
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.25 : 0.04,
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
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  itemCountText: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  itemsSummary: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    gap: 4,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  }
});

export default ShopOrdersScreen;
