import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar, FlatList, ActivityIndicator, Alert
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { Briefcase, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react-native';
import AppBar from '../../components/AppBar';
import { jobService } from '../../services/jobService';

const FILTERS = ['All', 'Pending', 'Accepted', 'Rejected'];

const STATUS_CONFIG = {
  ACCEPTED:  { label: 'Accepted', color: '#059669', bg: '#d1fae5', icon: CheckCircle },
  PENDING:   { label: 'Pending',  color: '#d97706', bg: '#fef3c7', icon: Clock       },
  REJECTED:  { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: XCircle      },
  WITHDRAWN: { label: 'Withdrawn',color: '#6b7280', bg: '#f3f4f6', icon: XCircle     },
};

const WorkerMyQuotesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await jobService.getWorkerQuotes();
      if (res.data.status === 'success') {
        setQuotes(res.data.data || []);
      }
    } catch (e) {
      console.log('Failed to fetch quotes:', e);
    } finally {
      setLoading(false);
    }
  };

  const withdrawQuote = async (id) => {
    try {
      const res = await jobService.withdrawQuote(id);
      if (res.data.status === 'success') {
        setQuotes(prev => prev.map(b => b._id === id ? { ...b, status: 'WITHDRAWN' } : b));
        Alert.alert('Success', 'Quote withdrawn successfully.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to withdraw quote.');
    }
  };

  const filterMap = { All: null, Pending: 'PENDING', Accepted: 'ACCEPTED', Rejected: 'REJECTED' };

  const filtered = quotes.filter(b => {
    const f = filterMap[activeFilter];
    return f ? b.status === f : true;
  });

  const stats = {
    total:    quotes.length,
    accepted: quotes.filter(b => b.status === 'ACCEPTED').length,
    pending:  quotes.filter(b => b.status === 'PENDING').length,
    rejected: quotes.filter(b => b.status === 'REJECTED').length,
  };

  const renderQuote = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    return (
      <TouchableOpacity 
        style={styles.quoteCard} 
        activeOpacity={0.8}
        onPress={() => {
          if (item.status === 'ACCEPTED' && item.jobId?._id) {
            navigation.navigate('WorkerNavigateJob', { jobId: item.jobId._id, job: item.jobId, quoteAmount: item.amount });
          }
        }}
      >
        <View style={styles.quoteTop}>
          <View style={styles.quoteLeft}>
            <View style={styles.categoryBadge}>
              <Briefcase size={14} color={theme.colors.primary} />
              <Text style={styles.categoryText}>{item.jobId?.category || 'Service'}</Text>
            </View>
            <Text style={styles.customerName}>{item.jobId?.customerId?.name || 'Customer'}</Text>
            <Text style={styles.addressText} numberOfLines={1}>📍 {item.jobId?.addressDetails || 'Address not provided'}</Text>
          </View>
          <View style={styles.quoteRight}>
            <Text style={styles.quoteAmount}>₹{item.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Icon size={11} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        {item.status === 'PENDING' && (
          <View style={styles.quoteActions}>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => withdrawQuote(item._id)}>
              <Text style={styles.withdrawBtnText}>Withdraw Quote</Text>
            </TouchableOpacity>
            <ChevronRight size={16} color={theme.colors.textDim} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title="My Quotes" subtitle={`${stats.total} total quotes`} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: '#d1fae5' }]}>
              <Text style={[styles.statNum, { color: '#059669' }]}>{stats.accepted}</Text>
              <Text style={styles.statLabel}>Accepted</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#fef3c7' }]}>
              <Text style={[styles.statNum, { color: '#d97706' }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#fee2e2' }]}>
              <Text style={[styles.statNum, { color: '#dc2626' }]}>{stats.rejected}</Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
            <View style={[styles.statBox, { borderColor: theme.colors.border }]}>
              <Text style={[styles.statNum, { color: theme.colors.text }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filtersRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filtered}
            keyExtractor={i => i._id}
            renderItem={renderQuote}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Briefcase size={40} color={theme.colors.textDim} />
                <Text style={styles.emptyText}>No quotes found</Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: theme.colors.background },
  statsRow:        { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 8, marginBottom: 4 },
  statBox:         { flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: 'center' },
  statNum:         { fontSize: 22, fontWeight: '900' },
  statLabel:       { fontSize: 11, color: theme.colors.textDim, fontWeight: '600', marginTop: 2 },
  filtersRow:      { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  filterTab:       { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterTabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText:      { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  filterTextActive:{ color: '#001016' },
  list:            { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  quoteCard:         { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  quoteTop:          { flexDirection: 'row', justifyContent: 'space-between' },
  quoteLeft:         { flex: 1 },
  quoteRight:        { alignItems: 'flex-end', gap: 6 },
  categoryBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  categoryText:    { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  customerName:    { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  addressText:     { fontSize: 12, color: theme.colors.textDim },
  quoteAmount:       { fontSize: 18, fontWeight: '900', color: theme.colors.text },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText:      { fontSize: 11, fontWeight: '800' },
  timeText:        { fontSize: 11, color: theme.colors.textDim },
  quoteActions:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  withdrawBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fee2e2' },
  withdrawBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  emptyState:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:       { fontSize: 15, color: theme.colors.textDim, fontWeight: '600' },
});

export default WorkerMyQuotesScreen;
