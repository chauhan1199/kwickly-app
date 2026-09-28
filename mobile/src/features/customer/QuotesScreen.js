import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import { shopService } from '../../services/shopService';

const statusColor = {
  BROADCASTING: '#f59e0b',
  QUOTES_RECEIVED: '#6366f1',
  ALLOCATED: '#0ea5e9',
  ARRIVING: '#0ea5e9',
  IN_PROGRESS: '#10b981',
  COMPLETED: '#10b981',
  PAID: '#10b981',
  CANCELLED: '#ef4444',
  DELIVERED: '#10b981',
  OUT_FOR_DELIVERY: '#f59e0b',
  PENDING: '#f59e0b',
  ACCEPTED: '#0ea5e9',
};

const statusLabel = {
  BROADCASTING: 'Broadcasting',
  QUOTES_RECEIVED: 'Quotes In!',
  ALLOCATED: 'Assigned',
  ARRIVING: 'On the Way',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

const QuotesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { userToken } = useAuth();
  const [filter, setFilter] = useState('All');
  const [jobs, setJobs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filters = ['All', 'Active', 'Completed', 'Cancelled'];

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [jobsRes, ordersRes] = await Promise.allSettled([
        jobService.getMyJobs(),
        shopService.getCustomerOrders(),
      ]);

      if (jobsRes.status === 'fulfilled' && jobsRes.value.data?.status === 'success') {
        setJobs(jobsRes.value.data.data || []);
      }

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data?.status === 'success') {
        setOrders(ordersRes.value.data.data || []);
      }
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeStatuses = ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'];
  const completedStatuses = ['COMPLETED', 'PAID', 'CLOSED'];

  const filteredJobs = jobs.filter(j => {
    if (filter === 'All') return true;
    if (filter === 'Active') return activeStatuses.includes(j.status);
    if (filter === 'Completed') return completedStatuses.includes(j.status);
    if (filter === 'Cancelled') return j.status === 'CANCELLED';
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (filter === 'All') return true;
    if (filter === 'Active') return ['PENDING', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.status);
    if (filter === 'Completed') return o.status === 'DELIVERED';
    if (filter === 'Cancelled') return o.status === 'CANCELLED';
    return true;
  });

  const styles = createStyles(theme, isDarkMode);

  const getJobIcon = (category) => {
    const icons = { 'AC': '❄️', 'Plumbing': '🔧', 'Electrical': '⚡', 'Cleaning': '🧹', 'Painting': '🎨' };
    return Object.entries(icons).find(([k]) => category?.includes(k))?.[1] || '🔨';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle}>My Bookings</Text>
          <Text style={styles.appBarSub}>Services & shop orders</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ paddingHorizontal: 14 }}>
        {filters.map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.chipItem, isActive && styles.chipItemActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={theme.colors.primary} />}
        >
          {/* Service Jobs Section */}
          <Text style={styles.sectionHeader}>Service Bookings</Text>

          {filteredJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
              <Text style={styles.emptyText}>No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}service bookings</Text>
            </View>
          ) : filteredJobs.map((job) => {
            const color = statusColor[job.status] || theme.colors.primary;
            const hasQuotes = job.status === 'QUOTES_RECEIVED';
            return (
              <TouchableOpacity
                key={job._id}
                style={[styles.card, hasQuotes && styles.cardHighlight]}
                onPress={() => navigation.navigate('LiveBids', {
                  jobId: job._id,
                  category: { name: job.category || 'Service' },
                  subcategory: job.subcategory || '',
                  address: job.addressDetails || '',
                  timeSlot: job.timeSlot || 'ASAP',
                  budget: job.payment?.amount || 0
                })}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                    <Text style={{ fontSize: 22 }}>{getJobIcon(job.category)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{job.category}{job.subcategory ? ' · ' + job.subcategory : ''}</Text>
                    <Text style={styles.cardSub}>
                      {job.workerId?.name 
                        ? `👤 ${job.workerId.name}` 
                        : `📍 ${typeof job.addressDetails === 'string' ? job.addressDetails : (job.addressDetails?.fullAddress || job.addressDetails?.city || 'Location saved')}`}
                    </Text>
                    {job.payment?.amount > 0 && (
                      <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>₹{job.payment.amount}</Text>
                    )}
                  </View>
                  <View>
                    <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.statusText, { color }]}>{statusLabel[job.status] || job.status}</Text>
                    </View>
                    {hasQuotes && <Text style={styles.tapHint}>Tap to accept →</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Shop Orders Section */}
          <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Shop Orders</Text>

          {filteredOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
              <Text style={styles.emptyText}>No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}shop orders</Text>
            </View>
          ) : filteredOrders.map((order) => {
            const color = statusColor[order.status] || theme.colors.primary;
            return (
              <TouchableOpacity
                key={order._id}
                style={styles.card}
                onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order._id })}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#10b98120' }]}>
                    <Text style={{ fontSize: 22 }}>🏪</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{order.shopId?.name || 'Shop Order'}</Text>
                    <Text style={styles.cardSub}>
                      Order #{order._id?.slice(-6)} · {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>₹{order.total ?? order.totalAmount ?? 0}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.statusText, { color }]}>{order.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 50 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14
  },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  iconBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9'
  },
  chipsScroll: { maxHeight: 44, minHeight: 44, marginBottom: 16 },
  chipItem: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.surface, borderWidth: 1,
    borderColor: theme.colors.border, marginRight: 8, justifyContent: 'center'
  },
  chipItemActive: { backgroundColor: theme.colors.primary + '26', borderColor: theme.colors.primary },
  chipText: { color: theme.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: theme.colors.primary },
  content: { paddingHorizontal: 14 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: theme.colors.surface, borderRadius: 16, padding: 30,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border
  },
  emptyText: { color: theme.colors.textDim, fontSize: 14 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border
  },
  cardHighlight: {
    borderColor: '#6366f1', borderWidth: 1.5,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 3
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 2 },
  cardSub: { fontSize: 12, color: theme.colors.textDim, marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '800' },
  tapHint: { fontSize: 10, color: '#6366f1', marginTop: 4, textAlign: 'right', fontWeight: '700' }
});

export default QuotesScreen;
