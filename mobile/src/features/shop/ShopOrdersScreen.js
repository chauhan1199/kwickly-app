import React, { useState } from 'react';
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
import { Bell, Package, RefreshCw, Moon, Sun } from 'lucide-react-native';
import api from '../../services/api';

const ShopOrdersScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [activeFilter, setActiveFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const filters = ['All', 'New', 'Packing', 'Out', 'Delivered'];

  React.useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shoporders/shop');
      if (res.data?.status === 'success') {
        const mapped = res.data.data.map(order => {
          let st = order.status.toLowerCase();
          if (st === 'pending') st = 'new';
          if (st === 'out_for_delivery') st = 'out';
          
          return {
            id: order._id.slice(-6).toUpperCase(),
            rawId: order._id,
            customer: order.customerId?.name || 'Customer',
            items: order.items?.length || 0,
            total: order.totalAmount || order.payment?.amount || 0,
            status: st,
            color: st === 'new' ? '#0EA5E9' : st === 'packing' ? '#F59E0B' : st === 'delivered' ? '#64748B' : '#10B981',
            bg: st === 'new' ? '#E0F2FE' : st === 'packing' ? '#FEF3C7' : st === 'delivered' ? '#F1F5F9' : '#D1FAE5',
            originalOrder: order
          };
        });
        setOrders(mapped);
      }
    } catch (e) {
      console.log('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'All') return true;
    return order.status.toLowerCase() === activeFilter.toLowerCase();
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View>
          <Text style={styles.appBarTitle}>Orders</Text>
          <Text style={styles.appBarSubtitle}>All customer orders</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={toggleTheme}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={fetchOrders}>
            <RefreshCw size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((order) => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.orderCard} 
                onPress={() => navigation.navigate('ShopOrderDetails', { order: order.originalOrder || order })}
              >
                <View style={[styles.orderIconBox, { backgroundColor: order.bg }]}>
                  <Package size={20} color={order.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.orderId}>{order.id}</Text>
                  <Text style={styles.orderDetails}>{order.customer} · {order.items} items · ₹{order.total}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: order.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: order.color }]}>{order.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.background,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  filtersContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  filterTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  ordersList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  orderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  orderDetails: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textDim,
  }
});

export default ShopOrdersScreen;
