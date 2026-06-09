import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  Switch
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { Store, ChevronRight, Package, Box, TrendingUp, Wallet, Star, MessageSquare, Clock, Repeat, Bell, Moon, Sun } from 'lucide-react-native';

const ShopDashboardScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shopInfo, setShopInfo] = useState({ name: 'Loading...', address: 'Loading...' });
  const [stats, setStats] = useState({ todayOrders: 0, revenue: 0, productsCount: 0, wallet: 0 });

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      let myShop;
      try {
        const shopRes = await api.get('/shops/my');
        if (shopRes.data?.status === 'success') {
          myShop = shopRes.data.data;
        }
      } catch (e) {
        if (e.response?.status === 404) {
          // Auto-create shop profile to unblock flow
          const createRes = await api.post('/shops', {
            name: "My Awesome Shop",
            address: "Local Market",
            isOnline: true
          });
          myShop = createRes.data.data;
        } else throw e;
      }

      if (myShop) {
        setShopInfo({ name: myShop.name, address: myShop.address || 'Unknown' });
        setStats(prev => ({ ...prev, wallet: myShop.wallet?.balance || 0 }));
      }

      const orderRes = await api.get('/shoporders/shop');
      if (orderRes.data?.status === 'success') {
        const orders = orderRes.data.data;
        const mapped = orders.map(order => ({
          id: order._id.slice(-6).toUpperCase(),
          rawId: order._id,
          customer: order.customerId?.name || 'Customer',
          items: order.items?.length || 0,
          total: order.totalAmount || order.payment?.amount || 0,
          status: order.status.toLowerCase(),
          color: order.status === 'PENDING' ? '#0EA5E9' : order.status === 'PROCESSING' ? '#F59E0B' : '#10B981',
          bg: order.status === 'PENDING' ? '#E0F2FE' : order.status === 'PROCESSING' ? '#FEF3C7' : '#D1FAE5'
        }));
        setPendingOrders(mapped.filter(o => o.status === 'pending' || o.status === 'processing'));

        const today = new Date();
        const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today.toDateString());
        const revenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || o.payment?.amount || 0), 0);
        setStats(prev => ({ ...prev, todayOrders: todayOrders.length, revenue }));
      }

      try {
        const prodRes = await api.get('/products/shop');
        if (prodRes.data?.status === 'success') {
          setStats(prev => ({ ...prev, productsCount: prodRes.data.data.length }));
        }
      } catch (e) { console.log('Products fetch failed', e.message); }

      try {
        const notifRes = await api.get('/notifications/my');
        if (notifRes.data?.status === 'success') {
          setUnreadCount(notifRes.data.data.unreadCount || 0);
        }
      } catch (e) { console.log('Notifications fetch failed', e.message); }
    } catch (e) {
      console.error('Error fetching shop orders:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.storeInfoContainer}>
          <View style={styles.storeLogo}>
            <Store size={20} color="#001016" />
          </View>
          <View>
            <Text style={styles.storeName}>{shopInfo.name}</Text>
            <Text style={styles.storeLocation}>📍 {shopInfo.address}</Text>
          </View>
        </View>
        <View style={styles.appBarActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.appBarBtn}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ShopNotifications')} style={styles.appBarBtn}>
            <Bell size={20} color={theme.colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.statLabel}>Today's Orders</Text>
            <Text style={styles.statValue}>{stats.todayOrders}</Text>
            <Text style={styles.statSubTextSuccess}>Updated</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Wallet')}>
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={styles.statValue}>₹{stats.revenue}</Text>
            <Text style={styles.statSubText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Products')}>
            <Text style={styles.statLabel}>Total Products</Text>
            <Text style={styles.statValue}>{stats.productsCount}</Text>
            <Text style={styles.statSubText}>In catalog</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Wallet')}>
            <Text style={styles.statLabel}>Wallet</Text>
            <Text style={styles.statValue}>₹{stats.wallet}</Text>
            <Text style={styles.statSubText}>Available</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Orders */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>🔥</Text>
            <Text style={styles.sectionTitle}>Pending Orders</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ShopOrders')}>
            <Text style={styles.viewAllText}>View all ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ordersList}>
          {pendingOrders.map((order) => (
            <TouchableOpacity 
              key={order.rawId} 
              style={styles.orderCard} 
              onPress={() => navigation.navigate('ShopOrderDetails', { order })}
            >
              <View style={styles.orderIconBox}>
                <Package size={20} color="#8B5CF6" />
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
          {pendingOrders.length === 0 && !loading && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textDim }}>No pending orders.</Text>
            </View>
          )}
        </View>



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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F43F5E',
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  scrollContent: {
    padding: 16,
  },
  storeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  storeLocation: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  onlineToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statSubText: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  statSubTextSuccess: {
    fontSize: 12,
    color: theme.colors.success || '#10B981',
    fontWeight: '600'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  ordersList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  orderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
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
    fontSize: 12,
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
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
  }
});

export default ShopDashboardScreen;
