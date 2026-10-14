import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import AppBar from '../../components/AppBar';
import { jobService } from '../../services/jobService';
import { formatStatus } from '../../utils/helpers';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];
const ACTIVE = ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'];
const DONE = ['PAID', 'CLOSED'];

const statusStyle = (status) => {
  if (status === 'COMPLETED') return { bg: '#FEF3C7', text: '#B45309', label: 'Payment due' };
  if (DONE.includes(status)) return { bg: '#D1FAE5', text: '#047857', label: 'Paid' };
  if (status === 'CANCELLED') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Cancelled' };
  if (status === 'DISPUTED') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Disputed' };
  return { bg: '#E0E7FF', text: '#4338CA', label: formatStatus(status) };
};

// What the customer should do next for a job, shown under its card
const nextStep = (job) => {
  if (job.status === 'COMPLETED') return 'Enter the completion PIN and pay';
  if (DONE.includes(job.status) && !job.rating?.score) return 'Rate your worker';
  if (job.status === 'QUOTES_RECEIVED') return 'Quotes are waiting for you';
  return null;
};

const MyBookingsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, isDarkMode, insets.bottom);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await jobService.getMyJobs();
      setJobs(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load your bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the screen comes back into view (after paying or rating)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = jobs.filter(j => {
    if (filter === 'active') return ACTIVE.includes(j.status);
    if (filter === 'done') return DONE.includes(j.status);
    if (filter === 'cancelled') return j.status === 'CANCELLED';
    return true;
  });

  const openJob = (job) => {
    if (job.status === 'COMPLETED') {
      navigation.navigate('WorkCompleted', { job, worker: job.workerId });
    } else if (DONE.includes(job.status) && !job.rating?.score) {
      navigation.navigate('RateExperience', { job, jobId: job._id });
    } else {
      navigation.navigate('PastJobDetails', { jobId: job._id, job });
    }
  };

  const renderItem = ({ item }) => {
    const st = statusStyle(item.status);
    const amount = item.payment?.amount || item.payment?.quotedAmount || item.budget;
    const hint = nextStep(item);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openJob(item)}>
        <View style={styles.iconWrap}>
          <Wrench size={18} color="#6C47FF" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.title} numberOfLines={1}>{item.category || 'Service'}</Text>
            {amount ? <Text style={styles.amount}>₹{Number(amount).toFixed(2).replace(/\.00$/, '')}</Text> : null}
          </View>
          {item.subcategory ? <Text style={styles.sub} numberOfLines={1}>{item.subcategory}</Text> : null}
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <View style={[styles.badge, { backgroundColor: st.bg }]}>
              <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
            </View>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          {item.workerId?.name ? <Text style={styles.worker} numberOfLines={1}>Worker: {item.workerId.name}</Text> : null}
          {hint ? <Text style={styles.hint}>{hint} →</Text> : null}
        </View>
        <ChevronRight size={18} color={theme.colors.textDim} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AppBar
        title="My Bookings"
        subtitle={`${jobs.length} service ${jobs.length === 1 ? 'booking' : 'bookings'}`}
        showBack
        onBackPress={() => navigation.goBack()}
        showNotifications={false}
      />

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6C47FF" size="large" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{error || 'No bookings here yet'}</Text>
              {!error ? <Text style={styles.emptySub}>Services you book will show up here.</Text> : null}
            </View>
          }
        />
      )}
    </View>
  );
};

const createStyles = (theme, isDarkMode, safeBottom) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
  },
  filterChipOn: { backgroundColor: '#6C47FF' },
  filterText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  filterTextOn: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingBottom: safeBottom + 110 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, marginRight: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.1)', alignItems: 'center', justifyContent: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text, marginRight: 8 },
  amount: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.textDim, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, color: theme.colors.textDim },
  worker: { fontSize: 12, color: theme.colors.textDim, marginTop: 6 },
  hint: { fontSize: 12, fontWeight: '700', color: '#6C47FF', marginTop: 6 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: theme.colors.textDim, marginTop: 6 },
});

export default MyBookingsScreen;
