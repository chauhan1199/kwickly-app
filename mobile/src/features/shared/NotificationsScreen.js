import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, RefreshControl, Alert,
  Animated,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell, CheckCheck, Briefcase, ShoppingBag, Wallet,
  Star, Settings, Trash2, ChevronLeft, Info,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import notificationService from '../../services/notificationService';
import { useFocusEffect } from '@react-navigation/native';
import { SearchBar } from '../../components/ui/SearchBar';

// ─── Icon / colour mapping by entityType ─────────────────────────────────────
const TYPE_CONFIG = {
  JOB:       { icon: Briefcase,   color: '#0e9aa7', bg: '#e0f7fa', label: 'Job' },
  ORDER:     { icon: ShoppingBag, color: '#d97706', bg: '#fef3c7', label: 'Order' },
  WALLET:    { icon: Wallet,      color: '#059669', bg: '#d1fae5', label: 'Wallet' },
  RATING:    { icon: Star,        color: '#f59e0b', bg: '#fef9c3', label: 'Rating' },
  SETTINGS:  { icon: Settings,    color: '#8b5cf6', bg: '#ede9fe', label: 'System' },
  OTHER:     { icon: Info,        color: '#64748b', bg: '#f1f5f9', label: 'Other' },
};

// Map backend entityType → local config key
const mapType = (entityType, action) => {
  if (entityType === 'JOB')   return 'JOB';
  if (entityType === 'ORDER') return 'ORDER';
  if (entityType === 'WALLET') return 'WALLET';
  if (entityType === 'SETTINGS' || action === 'SYSTEM') return 'SETTINGS';
  return 'OTHER';
};

// Relative time formatter
const relativeTime = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Filter tabs
const FILTERS = [
  { key: 'ALL',    label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'JOB',    label: 'Jobs' },
  { key: 'ORDER',  label: 'Orders' },
  { key: 'WALLET', label: 'Wallet' },
  { key: 'OTHER',  label: 'System' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
const NotificationsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const styles = createStyles(theme, isDarkMode);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

const cleanNotificationText = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/â[\s\u0080-\u009F]*Œ|â\s*Œ|âŒ/g, '❌ ')
    .replace(/âœ…|âœ\.\.\.|âœ“|âœ/g, '✅ ')
    .replace(/ðŸ›Žï¸ |ðŸ›Ž|ðŸ›/g, '🛍️ ')
    .replace(/ðŸŽ‰/g, '🎉 ')
    .replace(/ðŸ’°|ðŸ’/g, '💰 ')
    .replace(/ðŸ””/g, '🔔 ')
    .replace(/ðŸšš/g, '🚚 ')
    .replace(/ðŸ‘‹/g, '👋 ')
    .replace(/ðŸ› ï¸ |ðŸ› /g, '🛠️ ')
    .replace(/âœ¨/g, '✨ ')
    .replace(/Â/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getMyNotifications();
      if (res.data?.status === 'success') {
        const userId = user?._id;
        const mapped = res.data.data.notifications.map(n => ({
          id:        n._id,
          title:     cleanNotificationText(n.title),
          body:      cleanNotificationText(n.message),
          typeKey:   mapType(n.entityType, n.action),
          action:    n.action,
          entityType: n.entityType,
          entityId:  n.entityId,
          time:      n.createdAt,
          read:      userId ? n.readBy?.some(id => String(id) === String(userId)) : false,
        }));
        setNotifications(mapped);
        refreshUnread();
      }
    } catch (e) {
      // Non-critical, notifications will show as empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const markRead = async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.read) return;
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      refreshUnread();
    } catch {}
  };

  const handleNotificationPress = (item) => {
    markRead(item.id);

    const isCustomer = user?.role === 'CUSTOMER';
    const isWorker = user?.role === 'WORKER';
    const isShop = user?.role === 'SHOP' || user?.role === 'SHOP_OWNER';

    try {
      if (item.entityType === 'ORDER' || item.typeKey === 'ORDER') {
        if (isCustomer) {
          if (item.entityId) {
            navigation.navigate('OrderTracking', { orderId: item.entityId });
          } else {
            navigation.navigate('CustomerShopOrders');
          }
        } else if (isShop || isWorker) {
          if (item.entityId) {
            navigation.navigate('ShopOrderDetails', { orderId: item.entityId });
          } else {
            navigation.navigate('CustomerShopOrders');
          }
        }
      } else if (item.entityType === 'JOB' || item.typeKey === 'JOB') {
        if (isCustomer) {
          if (item.action === 'QUOTE_RECEIVED' || item.action === 'NEW_QUOTE') {
            navigation.navigate('LiveBids', { jobId: item.entityId });
          } else if (item.action === 'WORKER_ARRIVED' || item.action === 'JOB_STARTED') {
            navigation.navigate('LiveTracking', { jobId: item.entityId });
          } else if (item.entityId) {
            navigation.navigate('PastJobDetails', { jobId: item.entityId });
          }
        } else if (isWorker) {
          if (item.entityId) {
            navigation.navigate('WorkerActiveJob', { jobId: item.entityId });
          }
        }
      } else if (item.entityType === 'WALLET' || item.typeKey === 'WALLET') {
        if (isCustomer) {
          navigation.navigate('WalletMain');
        } else if (isShop) {
          navigation.navigate('ShopWallet');
        } else if (isWorker) {
          navigation.navigate('WorkerEarnings');
        }
      } else if (item.entityType === 'KYC') {
        navigation.navigate('EditProfile');
      } else if (item.entityType === 'SUBSCRIPTION' || item.action === 'SUBSCRIPTION_EXPIRING' || item.action === 'SUBSCRIPTION_EXPIRED') {
        if (isShop) {
          navigation.navigate('ShopWallet');
        } else if (isWorker) {
          navigation.navigate('WorkerEarnings');
        }
      }
    } catch (err) {
      console.warn('[NotificationPress] Navigation error:', err.message);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      refreshUnread();
    } catch {}
  };

  const deleteNotif = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      refreshUnread();
    } catch {}
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Delete Notification',
      'Remove this notification from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteNotif(id) },
      ]
    );
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = notifications.filter(n => {
    let keep = true;
    if (activeFilter === 'UNREAD') keep = !n.read;
    else if (activeFilter === 'JOB') keep = n.typeKey === 'JOB';
    else if (activeFilter === 'ORDER') keep = n.typeKey === 'ORDER';
    else if (activeFilter === 'WALLET') keep = n.typeKey === 'WALLET';
    else if (activeFilter === 'OTHER') keep = ['SETTINGS', 'OTHER'].includes(n.typeKey);

    if (keep && searchQuery) {
      if (!n.title?.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !n.body?.toLowerCase().includes(searchQuery.toLowerCase())) {
        keep = false;
      }
    }
    return keep;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Render Item ──────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.typeKey] || TYPE_CONFIG.OTHER;
    const Icon = cfg.icon;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          !item.read && styles.cardUnread,
          { borderColor: !item.read ? theme.colors.primary + '40' : theme.colors.border }
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.85}
      >
        {/* Unread accent bar */}
        {!item.read && <View style={[styles.accentBar, { backgroundColor: theme.colors.primary }]} />}

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          <Icon size={20} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, !item.read && styles.cardTitleBold]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{relativeTime(item.time)}</Text>
          </View>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
          <View style={styles.cardFooter}>
            <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {!item.read && (
              <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
            )}
          </View>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => confirmDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={14} color={isDarkMode ? '#475569' : '#94a3b8'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ── Empty State ───────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <Bell size={52} color={theme.colors.textDim} strokeWidth={1.5} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {loading ? 'Loading...' : activeFilter === 'UNREAD' ? 'All Caught Up!' : 'No Notifications'}
      </Text>
      <Text style={[styles.emptyBody, { color: theme.colors.textDim }]}>
        {loading
          ? 'Fetching your activity...'
          : activeFilter === 'UNREAD'
          ? "You've read everything. You're all set!"
          : "Job updates, order alerts, and wallet activity\nwill appear here."}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar showBack title="Notifications" transparent={true} hideRightIcons />
        
        {/* Title row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)' }]}>
                {unreadCount} unread
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={[styles.markAllBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={markAllRead}>
              <CheckCheck size={15} color="#fff" />
              <Text style={[styles.markAllText, { color: '#fff' }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={f => f.key}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: f }) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  isActive && { backgroundColor: '#fff' },
                  !isActive && { backgroundColor: 'rgba(255,255,255,0.15)' }
                ]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text style={[
                  styles.filterTabText,
                  isActive && { color: '#6C47FF' },
                  !isActive && { color: '#fff' }
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10, marginBottom: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search notifications..."
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:     { flex: 1 },
  list:          { paddingHorizontal: 14, paddingBottom: 16 },

  headerRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 16 },
  headerTitle:   { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:     { fontSize: 13, fontWeight: '600', marginTop: 2 },
  markAllBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  markAllText:   { fontSize: 13, fontWeight: '700' },

  filterRow:     { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  filterTab:     { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  filterTabText: { fontSize: 13, fontWeight: '700' },

  // Notification card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
  },
  cardUnread:    { backgroundColor: theme.colors.primary + '06' },
  accentBar:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  iconWrap:      { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardContent:   { flex: 1 },
  cardHeader:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:     { fontSize: 14, fontWeight: '600', color: theme.colors.text, flex: 1, marginRight: 8 },
  cardTitleBold: { fontWeight: '800' },
  cardTime:      { fontSize: 11, color: theme.colors.textDim, fontWeight: '500', flexShrink: 0 },
  cardBody:      { fontSize: 13, color: theme.colors.textDim, lineHeight: 18, marginBottom: 8 },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typePillText:  { fontSize: 11, fontWeight: '700' },
  unreadDot:     { width: 8, height: 8, borderRadius: 4 },
  deleteBtn:     { padding: 4, marginLeft: 4, alignSelf: 'flex-start' },

  // Empty state
  emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptyBody:  { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default NotificationsScreen;
