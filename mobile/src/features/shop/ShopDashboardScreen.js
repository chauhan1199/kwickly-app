import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { shopService } from '../../services/shopService';
import { getImageUrl } from '../../utils/helpers';
import LinearGradient from 'react-native-linear-gradient';
import {
  Store,
  Package,
  Box,
  Wallet,
  Bell,
  ShoppingBag,
  IndianRupee,
  ChevronRight,
  ClipboardList,
  Plus,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Power
} from 'lucide-react-native';

const ShopDashboardScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [shopInfo, setShopInfo] = useState({ name: 'My Shop', address: '', logoUrl: null, isOnline: true });
  const [shopExists, setShopExists] = useState(true);
  const [stats, setStats] = useState({ todayOrders: 0, revenue: 0, productsCount: 0, wallet: 0 });
  const hasLoadedOnceRef = React.useRef(false);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground && !hasLoadedOnceRef.current) {
        setLoading(true);
      }

      // Fetch all 3 endpoints concurrently for 3x faster loading speed
      const [shopResult, ordersResult, productsResult] = await Promise.allSettled([
        shopService.getMyShop(),
        shopService.getShopOrders(),
        shopService.getShopProducts()
      ]);

      // 1. Process Shop Details
      let exists = true;
      if (shopResult.status === 'fulfilled') {
        const myShop = shopResult.value.data?.data;
        if (myShop) {
          setShopInfo({ 
            name: myShop.name || 'My Shop', 
            address: myShop.address || '', 
            logoUrl: myShop.logoUrl,
            isOnline: myShop.isOnline !== undefined ? myShop.isOnline : true
          });
          setStats(prev => ({ ...prev, wallet: myShop.wallet?.balance || 0 }));
        }
      } else if (shopResult.reason?.response?.status === 404) {
        exists = false;
      }
      setShopExists(exists);
      if (!exists) {
        setLoading(false);
        hasLoadedOnceRef.current = true;
        return;
      }

      // 2. Process Orders
      if (ordersResult.status === 'fulfilled' && ordersResult.value.data?.status === 'success') {
        const orders = ordersResult.value.data.data.orders || ordersResult.value.data.data || [];
        const mapped = orders.map(order => {
          const st = order.status ? order.status.toUpperCase() : 'NEW';
          const isPending = ['NEW', 'PENDING', 'CONFIRMED', 'PACKING'].includes(st);
          let color = '#6C47FF';
          let bg = isDarkMode ? 'rgba(108,71,255,0.15)' : '#EDE9FE';

          if (st === 'PACKING' || st === 'CONFIRMED') {
            color = '#F59E0B';
            bg = isDarkMode ? 'rgba(245,158,11,0.15)' : '#FEF3C7';
          } else if (st === 'OUT_FOR_DELIVERY') {
            color = '#0284C7';
            bg = isDarkMode ? 'rgba(2,132,199,0.15)' : '#E0F2FE';
          } else if (st === 'DELIVERED') {
            color = '#10B981';
            bg = isDarkMode ? 'rgba(16,185,129,0.15)' : '#DCFCE7';
          } else if (st === 'CANCELLED') {
            color = '#EF4444';
            bg = isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEE2E2';
          }

          return {
            id: order._id.slice(-6).toUpperCase(),
            rawId: order._id,
            customer: order.customerId?.name || 'Customer',
            items: order.items?.length || 0,
            total: order.totalAmount || order.payment?.amount || 0,
            status: st,
            color,
            bg,
            isPending
          };
        });

        setPendingOrders(mapped.filter(o => o.isPending));

        const today = new Date();
        const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today.toDateString());
        const revenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || o.payment?.amount || 0), 0);
        setStats(prev => ({ ...prev, todayOrders: todayOrders.length, revenue }));
      }

      // 3. Process Products Count
      if (productsResult.status === 'fulfilled' && productsResult.value.data?.status === 'success') {
        const prods = productsResult.value.data.data || [];
        setStats(prev => ({ ...prev, productsCount: prods.length }));
      }

      hasLoadedOnceRef.current = true;
    } catch (e) {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDarkMode]);

  const toggleStoreOnline = async () => {
    const nextState = !shopInfo.isOnline;
    setShopInfo(prev => ({ ...prev, isOnline: nextState }));
    try {
      await shopService.updateMyShop({ isOnline: nextState });
    } catch {
      setShopInfo(prev => ({ ...prev, isOnline: !nextState }));
      Alert.alert('Error', 'Failed to update store visibility');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData(true);
  }, [fetchDashboardData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData(hasLoadedOnceRef.current);
    }, [fetchDashboardData])
  );

  const s = createStyles(theme, isDarkMode);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5830E0" translucent={false} />
      
      {/* ── Modern Rounded Gradient Hero Header ── */}
      <LinearGradient 
        colors={['#5830E0', '#7447FF', '#8F66FF']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={[s.heroGradient, { paddingTop: Math.max(insets.top, 12) + 6 }]}
      >
        <View style={s.blob1} />
        <View style={s.blob2} />

        <View style={s.heroInner}>
          {/* Top Row: Location + Quick Wallet + Bell */}
          <View style={s.heroTopRow}>
          <TouchableOpacity 
            style={s.locationPill} 
            activeOpacity={0.85} 
            onPress={() => navigation.navigate('Settings')}
          >
            <MapPin size={12} color="#FFFFFF" />
            <Text style={s.locationText} numberOfLines={1}>
              {shopInfo.address ? shopInfo.address.split(',')[0] : 'Set Store Location'}
            </Text>
            <Text style={s.locationCaret}>▾</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              style={s.walletPill} 
              activeOpacity={0.85} 
              onPress={() => navigation.navigate('Wallet')}
            >
              <Wallet size={13} color="#A7F3D0" />
              <Text style={s.walletPillText}>₹{Math.round(stats.wallet || 0).toLocaleString('en-IN')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => navigation.navigate('ShopNotifications')}
              activeOpacity={0.85}
            >
              <Bell size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Store Identity Row: Logo + Store Name + Live Switch */}
        <View style={s.heroStoreRow}>
          <TouchableOpacity 
            style={s.storeIdentityLeft} 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={s.shopAvatarWrapper}>
              {shopInfo.logoUrl && !avatarError ? (
                <Image 
                  source={{ uri: getImageUrl(shopInfo.logoUrl) }} 
                  style={s.shopAvatar} 
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={s.shopAvatarGradient}>
                  <Store size={22} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={s.appBarTitle} numberOfLines={1}>{shopInfo.name || 'My Shop'}</Text>
              <View style={s.liveStatusRow}>
                <View style={[s.liveDot, { backgroundColor: shopInfo.isOnline ? '#10B981' : '#E2E8F0' }]} />
                <Text style={[s.liveStatusText, { color: shopInfo.isOnline ? '#A7F3D0' : 'rgba(255,255,255,0.75)' }]}>
                  {shopInfo.isOnline ? 'Store Accepting Orders' : 'Store is Offline'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              s.onlineToggleBtn, 
              { backgroundColor: shopInfo.isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.16)' }
            ]}
            onPress={toggleStoreOnline}
            activeOpacity={0.8}
          >
            <Power size={13} color={shopInfo.isOnline ? '#34D399' : '#FFFFFF'} />
            <Text style={[s.onlineToggleText, { color: shopInfo.isOnline ? '#34D399' : '#FFFFFF' }]}>
              {shopInfo.isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6C47FF']}
              tintColor="#6C47FF"
            />
          }
        >
          {/* ── No shop state ── */}
          {!loading && !shopExists && (
            <View style={s.emptyState}>
              <View style={s.emptyIconBox}>
                <Store size={36} color="#6C47FF" />
              </View>
              <Text style={s.emptyTitle}>Setup Your Store</Text>
              <Text style={s.emptyDesc}>
                Register your business profile to start adding catalog items and receiving customer orders.
              </Text>
              <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('CreateShop')} activeOpacity={0.85}>
                <Plus size={18} color="#fff" />
                <Text style={s.createBtnText}>Create Shop Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {shopExists && (
            <>
              {/* ── 4 Modern Stats Grid ── */}
              <View style={s.statsGrid}>
                
                {/* 1. Today's Orders */}
                <TouchableOpacity 
                  style={s.statCard} 
                  onPress={() => navigation.navigate('Orders')}
                  activeOpacity={0.82}
                >
                  <View style={s.statCardHeader}>
                    <View style={[s.statIconBox, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                      <ShoppingBag size={20} color="#6C47FF" />
                    </View>
                    <View style={s.statTrendBox}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                      <Text style={s.statTrendText}>Live</Text>
                    </View>
                  </View>
                  <Text style={s.statValue}>{stats.todayOrders}</Text>
                  <Text style={s.statLabel}>Today's Orders</Text>
                </TouchableOpacity>

                {/* 2. Today's Revenue */}
                <TouchableOpacity 
                  style={s.statCard} 
                  onPress={() => navigation.navigate('Wallet')}
                  activeOpacity={0.82}
                >
                  <View style={s.statCardHeader}>
                    <View style={[s.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                      <IndianRupee size={20} color="#10B981" />
                    </View>
                    <View style={[s.statTrendBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={[s.statTrendText, { color: '#10B981' }]}>Today</Text>
                    </View>
                  </View>
                  <Text style={[s.statValue, { color: '#10B981' }]}>₹{stats.revenue.toLocaleString('en-IN')}</Text>
                  <Text style={s.statLabel}>Revenue Earned</Text>
                </TouchableOpacity>

                {/* 3. Catalog Products */}
                <TouchableOpacity 
                  style={s.statCard} 
                  onPress={() => navigation.navigate('Products')}
                  activeOpacity={0.82}
                >
                  <View style={s.statCardHeader}>
                    <View style={[s.statIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                      <Box size={20} color="#0284C7" />
                    </View>
                    <View style={[s.statTrendBox, { backgroundColor: 'rgba(2, 132, 199, 0.1)' }]}>
                      <Text style={[s.statTrendText, { color: '#0284C7' }]}>Catalog</Text>
                    </View>
                  </View>
                  <Text style={s.statValue}>{stats.productsCount}</Text>
                  <Text style={s.statLabel}>Total Products</Text>
                </TouchableOpacity>

                {/* 4. Wallet Balance */}
                <TouchableOpacity 
                  style={s.statCard} 
                  onPress={() => navigation.navigate('Wallet')}
                  activeOpacity={0.82}
                >
                  <View style={s.statCardHeader}>
                    <View style={[s.statIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                      <Wallet size={20} color="#F59E0B" />
                    </View>
                    <View style={[s.statTrendBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                      <Text style={[s.statTrendText, { color: '#F59E0B' }]}>Payout ›</Text>
                    </View>
                  </View>
                  <Text style={[s.statValue, { color: '#6C47FF' }]}>₹{stats.wallet.toLocaleString('en-IN')}</Text>
                  <Text style={s.statLabel}>Wallet Balance</Text>
                </TouchableOpacity>

              </View>

              {/* ── Quick Shortcut Chips ── */}
              <View style={s.quickActionsRow}>
                <TouchableOpacity 
                  style={s.quickActionBtn} 
                  onPress={() => navigation.navigate('Products')}
                  activeOpacity={0.82}
                >
                  <View style={[s.quickActionIconWrap, { backgroundColor: '#EDE9FE' }]}>
                    <Plus size={15} color="#6C47FF" />
                  </View>
                  <Text style={s.quickActionText}>Add Item</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={s.quickActionBtn} 
                  onPress={() => navigation.navigate('Orders')}
                  activeOpacity={0.82}
                >
                  <View style={[s.quickActionIconWrap, { backgroundColor: '#EDE9FE' }]}>
                    <Package size={15} color="#6C47FF" />
                  </View>
                  <Text style={s.quickActionText}>Orders</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={s.quickActionBtn} 
                  onPress={() => navigation.navigate('Wallet')}
                  activeOpacity={0.82}
                >
                  <View style={[s.quickActionIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Wallet size={15} color="#10B981" />
                  </View>
                  <Text style={s.quickActionText}>Withdraw</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={s.quickActionBtn} 
                  onPress={() => navigation.navigate('Settings')}
                  activeOpacity={0.82}
                >
                  <View style={[s.quickActionIconWrap, { backgroundColor: '#F3E8FF' }]}>
                    <Store size={15} color="#9333EA" />
                  </View>
                  <Text style={s.quickActionText}>Settings</Text>
                </TouchableOpacity>
              </View>

              {/* ── Pending Orders Section ── */}
              <View style={s.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 18 }}>🔥</Text>
                  <Text style={s.sectionTitle}>Pending Orders</Text>
                  {pendingOrders.length > 0 && (
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>{pendingOrders.length}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={s.viewAllBtn}
                  onPress={() => navigation.navigate('Orders')}
                  activeOpacity={0.7}
                >
                  <Text style={s.viewAllText}>View all</Text>
                  <ChevronRight size={14} color="#6C47FF" />
                </TouchableOpacity>
              </View>

              <View style={s.ordersCard}>
                {loading && pendingOrders.length === 0 ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#6C47FF" />
                    <Text style={{ color: theme.colors.textDim, fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                      Checking live incoming orders...
                    </Text>
                  </View>
                ) : pendingOrders.length === 0 ? (
                  <View style={s.emptyOrders}>
                    <View style={s.emptyOrdersIcon}>
                      <ClipboardList size={34} color="#6C47FF" />
                    </View>
                    <Text style={s.emptyOrdersTitle}>No pending orders right now</Text>
                    <Text style={s.emptyOrdersText}>
                      Store is active! New customer orders will automatically ring and show up here.
                    </Text>
                  </View>
                ) : (
                  pendingOrders.map(order => (
                    <TouchableOpacity
                      key={order.rawId}
                      style={s.orderRow}
                      onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order.rawId })}
                      activeOpacity={0.75}
                    >
                      <View style={[s.orderIconBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                        <Package size={20} color="#6C47FF" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.orderId}>#{order.id}</Text>
                        <Text style={s.orderMeta}>{order.customer} · {order.items} item(s) · ₹{order.total}</Text>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: order.bg }]}>
                        <Text style={[s.statusPillText, { color: order.color }]}>{order.status}</Text>
                      </View>
                      <ChevronRight size={16} color={theme.colors.textDim} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* ── Grow Your Business Banner ── */}
              <LinearGradient
                colors={isDarkMode ? ['#1E1B4B', '#312E81'] : ['#EDE9FE', '#DDD6FE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.growBanner}
              >
                <View style={{ flex: 1 }}>
                  <View style={s.sparklePill}>
                    <Sparkles size={12} color="#F59E0B" />
                    <Text style={s.sparkleText}>PRO GROWTH</Text>
                  </View>
                  <Text style={s.growTitle}>
                    Grow Your Store Online
                  </Text>
                  <Text style={s.growDesc}>
                    List new product varieties and offer fast doorstep delivery to expand sales!
                  </Text>
                  <TouchableOpacity
                    style={s.addProductsBtn}
                    onPress={() => navigation.navigate('Products')}
                    activeOpacity={0.85}
                  >
                    <Text style={s.addProductsBtnText}>+ Add Products</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 52, marginLeft: 12 }}>🛍️</Text>
              </LinearGradient>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
    },

    /* ── Header ── */
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
    heroInner: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      maxWidth: '56%',
      gap: 5,
    },
    locationText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    locationCaret: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11,
      fontWeight: '800',
    },
    walletPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 5,
    },
    walletPillText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    bellBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#EF4444',
      borderRadius: 10,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: '#5830E0',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
    },

    heroStoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    storeIdentityLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginRight: 10,
    },
    shopAvatarWrapper: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      elevation: 2,
    },
    shopAvatar: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    shopAvatarGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    appBarTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    liveStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 3,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    liveStatusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    onlineToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      gap: 5,
    },
    onlineToggleText: {
      fontSize: 10.5,
      fontWeight: '900',
      letterSpacing: 0.4,
    },

    /* ── Scroll ── */
    scroll: {
      padding: 16,
      paddingBottom: 16,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },

    /* ── Stats ── */
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flexBasis: '47%',
      flexGrow: 1,
      maxWidth: '49%',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.2 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    statCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    statIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statTrendBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 4,
    },
    statTrendText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#10B981',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 2,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textDim,
    },

    /* ── Quick Action Chips ── */
    quickActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    quickActionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDarkMode ? 0.15 : 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    quickActionIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 5,
    },
    quickActionText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.text,
    },

    /* ── Pending Orders ── */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    pendingBadge: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
    },
    pendingBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '900',
    },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#6C47FF',
    },
    ordersCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      padding: 16,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.2 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    emptyOrders: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 12,
    },
    emptyOrdersIcon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : 'rgba(108, 71, 255, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    emptyOrdersTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },
    emptyOrdersText: {
      fontSize: 12,
      color: theme.colors.textDim,
      textAlign: 'center',
      lineHeight: 17,
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
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
    },
    orderMeta: {
      fontSize: 12,
      color: theme.colors.textDim,
      marginTop: 2,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
    },

    /* ── Grow Banner ── */
    growBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? '#3730A3' : '#C4B5FD',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 3,
    },
    sparklePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.7)',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      gap: 4,
      marginBottom: 8,
    },
    sparkleText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#F59E0B',
      letterSpacing: 0.5,
    },
    growTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: isDarkMode ? '#FFFFFF' : '#312E81',
      marginBottom: 4,
    },
    growDesc: {
      fontSize: 12,
      lineHeight: 17,
      color: isDarkMode ? '#C7D2FE' : '#4C1D95',
      marginBottom: 14,
    },
    addProductsBtn: {
      backgroundColor: '#6C47FF',
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    addProductsBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },

    /* ── No shop state ── */
    emptyState: {
      alignItems: 'center',
      paddingTop: 40,
      paddingHorizontal: 20,
    },
    emptyIconBox: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: 'rgba(108, 71, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 13,
      color: theme.colors.textDim,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 20,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#6C47FF',
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 14,
      gap: 8,
    },
    createBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
  });

export default ShopDashboardScreen;

