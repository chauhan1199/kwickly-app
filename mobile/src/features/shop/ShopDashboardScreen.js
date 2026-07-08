import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import api from '../../services/api';
import { getImageUrl } from '../../utils/helpers';
import {
  Store,
  Package,
  Box,
  Wallet,
  Bell,
  ShoppingBag,
  IndianRupee,
  Menu,
  MapPin,
  ChevronRight,
  ClipboardList,
  Plus,
  Moon,
  Sun
} from 'lucide-react-native';

const ShopDashboardScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount } = useNotifications();
  const [shopInfo, setShopInfo] = useState({ name: 'My Shop', address: '', logoUrl: null });
  const [shopExists, setShopExists] = useState(true);
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
      let exists = true;
      try {
        const shopRes = await api.get('/shops/my');
        if (shopRes.data?.status === 'success') {
          myShop = shopRes.data.data;
        }
      } catch (e) {
        if (e.response?.status === 404) {
          exists = false;
        } else throw e;
      }

      setShopExists(exists);

      if (!exists) {
        setLoading(false);
        return;
      }

      if (myShop) {
        setShopInfo({ name: myShop.name, address: myShop.address || '', logoUrl: myShop.logoUrl });
        setStats(prev => ({ ...prev, wallet: myShop.wallet?.balance || 0 }));
      }

      const orderRes = await api.get('/shoporders/shop');
      if (orderRes.data?.status === 'success') {
        const orders = orderRes.data.data.orders || orderRes.data.data;
        const mapped = orders.map(order => ({
          id: order._id.slice(-6).toUpperCase(),
          rawId: order._id,
          customer: order.customerId?.name || 'Customer',
          items: order.items?.length || 0,
          total: order.totalAmount || order.payment?.amount || 0,
          status: order.status.toLowerCase(),
          color: order.status === 'PENDING' ? '#0EA5E9' : order.status === 'PROCESSING' ? '#F59E0B' : '#10B981',
          bg: order.status === 'PENDING'
            ? (isDarkMode ? 'rgba(14,165,233,0.15)' : '#E0F2FE')
            : order.status === 'PROCESSING'
            ? (isDarkMode ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
            : (isDarkMode ? 'rgba(16,185,129,0.15)' : '#D1FAE5'),
        }));
        setPendingOrders(mapped.filter(o => o.status === 'new' || o.status === 'pending' || o.status === 'packing'));

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
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const s = createStyles(theme, isDarkMode);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

      {/* ── Header ── */}
      <View style={s.appBar}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View>
            <Text style={s.appBarTitle}>Dashboard</Text>
            <Text style={s.appBarSubtitle}>{shopInfo.name || 'Overview'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={s.appBarIconBtn} onPress={toggleTheme}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.appBarIconBtn}
            onPress={() => navigation.navigate('ShopNotifications')}
          >
            <Bell size={20} color={theme.colors.text} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── No shop state ── */}
        {!loading && !shopExists && (
          <View style={s.emptyState}>
            <View style={[s.emptyIcon, { backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#EDE9FE' }]}>
              <Store size={40} color="#6C47FF" />
            </View>
            <Text style={s.emptyTitle}>No Shop Found</Text>
            <Text style={s.emptyDesc}>
              You don't have a shop yet. Create one to start receiving orders.
            </Text>
            <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('CreateShop')}>
              <Plus size={16} color="#fff" />
              <Text style={s.createBtnText}>Create Shop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats Grid ── */}
        {shopExists && (
          <View style={s.statsGrid}>
            {/* Today's Orders */}
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Orders')}>
              <View style={[s.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.15)' : '#ECFDF5', borderColor: isDarkMode ? 'rgba(16,185,129,0.3)' : '#A7F3D0' }]}>
                <ShoppingBag size={22} color="#10B981" />
              </View>
              <View style={s.statInfo}>
                <Text style={s.statLabel}>Today's Orders</Text>
                <Text style={[s.statValue, { color: '#10B981' }]}>{stats.todayOrders}</Text>
                <Text style={[s.statSub, { color: '#10B981' }]}>Updated</Text>
              </View>
            </TouchableOpacity>

            {/* Revenue */}
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Wallet')}>
              <View style={[s.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : '#F5F3FF', borderColor: isDarkMode ? 'rgba(139,92,246,0.3)' : '#DDD6FE' }]}>
                <IndianRupee size={22} color="#8B5CF6" />
              </View>
              <View style={s.statInfo}>
                <Text style={s.statLabel}>Revenue</Text>
                <Text style={[s.statValue, { color: '#8B5CF6' }]}>₹{stats.revenue}</Text>
                <Text style={s.statSub}>Today</Text>
              </View>
            </TouchableOpacity>

            {/* Total Products */}
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Products')}>
              <View style={[s.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(14,165,233,0.15)' : '#E0F2FE', borderColor: isDarkMode ? 'rgba(14,165,233,0.3)' : '#BAE6FD' }]}>
                <Box size={22} color="#0EA5E9" />
              </View>
              <View style={s.statInfo}>
                <Text style={s.statLabel}>Total Products</Text>
                <Text style={[s.statValue, { color: '#0EA5E9' }]}>{stats.productsCount}</Text>
                <Text style={s.statSub}>In catalog</Text>
              </View>
            </TouchableOpacity>

            {/* Wallet */}
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Wallet')}>
              <View style={[s.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.15)' : '#FFEDD5', borderColor: isDarkMode ? 'rgba(249,115,22,0.3)' : '#FED7AA' }]}>
                <Wallet size={22} color="#F97316" />
              </View>
              <View style={s.statInfo}>
                <Text style={s.statLabel}>Wallet</Text>
                <Text style={[s.statValue, { color: '#F97316' }]}>₹{stats.wallet}</Text>
                <Text style={s.statSub}>Available</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending Orders ── */}
        {shopExists && (
          <>
            <View style={s.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <Text style={s.sectionTitle}>  Pending Orders</Text>
              </View>
              <TouchableOpacity
                style={s.viewAllBtn}
                onPress={() => navigation.navigate('Orders')}
              >
                <Text style={s.viewAllText}>View all</Text>
                <ChevronRight size={14} color="#6C47FF" />
              </TouchableOpacity>
            </View>

            <View style={s.ordersCard}>
              {pendingOrders.length === 0 && !loading ? (
                <View style={s.emptyOrders}>
                  <View style={[s.emptyOrdersIcon, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
                    <ClipboardList size={40} color={isDarkMode ? '#4B5563' : '#9CA3AF'} />
                  </View>
                  <Text style={s.emptyOrdersText}>No pending orders.</Text>
                </View>
              ) : (
                pendingOrders.map(order => (
                  <TouchableOpacity
                    key={order.rawId}
                    style={s.orderRow}
                    onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order.rawId })}
                  >
                    <View style={[s.orderIconBox, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : '#F3E8FF' }]}>
                      <Package size={18} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.orderId}>#{order.id}</Text>
                      <Text style={s.orderMeta}>{order.customer} · {order.items} items · ₹{order.total}</Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: order.bg }]}>
                      <Text style={[s.statusPillText, { color: order.color }]}>{order.status}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* ── Grow Your Business banner ── */}
            <View style={[s.growBanner, {
              backgroundColor: isDarkMode ? '#0D2818' : '#F0FDF4',
              borderColor: isDarkMode ? '#14532D' : '#BBF7D0',
            }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[s.growTitle, { color: isDarkMode ? '#4ADE80' : '#15803D' }]}>
                  Grow Your Business
                </Text>
                <Text style={[s.growDesc, { color: isDarkMode ? '#86EFAC' : '#166534' }]}>
                  Add more products and reach more customers today!
                </Text>
                <TouchableOpacity
                  style={[s.addProductsBtn, { backgroundColor: isDarkMode ? '#16A34A' : '#22C55E' }]}
                  onPress={() => navigation.navigate('Products')}
                >
                  <Text style={s.addProductsBtnText}>Add Products</Text>
                </TouchableOpacity>
              </View>
              {/* Decorative veg emoji illustration */}
              <Text style={{ fontSize: 64, lineHeight: 80 }}>🥬</Text>
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    /* ── Header ── */
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
    shopLogoWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#EDE9FE',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(108,71,255,0.3)' : '#DDD6FE',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      flexShrink: 0,
    },
    headerTextBlock: {
      flex: 1,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 2,
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#fff',
      fontSize: 8,
      fontWeight: '800',
    },

    /* ── Scroll ── */
    scroll: {
      padding: 16,
    },

    /* ── No shop empty state ── */
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 14,
      color: theme.colors.textDim,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#6C47FF',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 6,
    },
    createBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },

    /* ── Stats ── */
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      width: '47%',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    statIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    statInfo: {
      flex: 1,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textDim,
      marginBottom: 3,
      fontWeight: '500',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 2,
      lineHeight: 28,
    },
    statSub: {
      fontSize: 11,
      color: theme.colors.textDim,
      fontWeight: '500',
    },

    /* ── Section Header ── */
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#6C47FF',
      marginRight: 2,
    },

    /* ── Orders Card ── */
    ordersCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: 20,
    },
    emptyOrders: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 16,
    },
    emptyOrdersIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    emptyOrdersText: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontWeight: '500',
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    orderIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    orderId: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 2,
    },
    orderMeta: {
      fontSize: 12,
      color: theme.colors.textDim,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },

    /* ── Grow Your Business Banner ── */
    growBanner: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    growTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    growDesc: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 14,
    },
    addProductsBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderRadius: 20,
    },
    addProductsBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
  });

export default ShopDashboardScreen;
