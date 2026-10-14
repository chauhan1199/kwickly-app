import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity, 
  StatusBar, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  RefreshControl
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  FileText, 
  MapPin, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react-native';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import { jobService } from '../../services/jobService';

const FILTERS = ['All', 'Pending', 'Accepted', 'Rejected'];

const STATUS_CONFIG = {
  ACCEPTED:  { label: 'Accepted', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
  PENDING:   { label: 'Pending',  color: '#F59E0B', bg: '#FFFBEB', icon: Clock        },
  REJECTED:  { label: 'Rejected', color: '#EF4444', bg: '#FEF2F2', icon: XCircle      },
  WITHDRAWN: { label: 'Withdrawn',color: '#64748B', bg: '#F1F5F9', icon: XCircle      },
};

const WorkerMyQuotesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQuotes = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await jobService.getWorkerQuotes();
      if (res.data?.status === 'success') {
        setQuotes(res.data.data || []);
      }
    } catch (e) {
      // Silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const withdrawQuote = (id) => {
    Alert.alert(
      'Withdraw Quote',
      'Are you sure you want to withdraw your quote for this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await jobService.withdrawQuote(id);
              if (res.data?.status === 'success') {
                setQuotes(prev => prev.map(b => b._id === id ? { ...b, status: 'WITHDRAWN' } : b));
                Alert.alert('Withdrawn', 'Quote withdrawn successfully.');
              }
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to withdraw quote.');
            }
          }
        }
      ]
    );
  };

  const filterMap = { All: null, Pending: 'PENDING', Accepted: 'ACCEPTED', Rejected: 'REJECTED' };

  const filtered = useMemo(() => {
    return quotes.filter(b => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cat = b.jobId?.category?.toLowerCase() || '';
        const cust = b.jobId?.customerId?.name?.toLowerCase() || '';
        if (!cat.includes(q) && !cust.includes(q)) return false;
      }
      const f = filterMap[activeFilter];
      return f ? b.status === f : true;
    });
  }, [quotes, searchQuery, activeFilter]);

  const stats = useMemo(() => ({
    total:    quotes.length,
    accepted: quotes.filter(b => b.status === 'ACCEPTED').length,
    pending:  quotes.filter(b => b.status === 'PENDING').length,
    rejected: quotes.filter(b => b.status === 'REJECTED').length,
  }), [quotes]);

  const renderQuote = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    const isAccepted = item.status === 'ACCEPTED';
    const isPending = item.status === 'PENDING';

    const getAddressText = () => {
      const addr = item.jobId?.addressDetails;
      if (typeof addr === 'string' && addr.trim()) return addr.trim();
      if (typeof addr === 'object' && addr) {
        return addr.fullAddress || addr.address || addr.city || item.jobId?.location?.addressDetails?.city || 'Local Area';
      }
      if (item.jobId?.location?.addressDetails?.city) return item.jobId.location.addressDetails.city;
      return 'Local Area';
    };

    return (
      <TouchableOpacity 
        style={[styles.quoteCard, isAccepted && styles.quoteCardAccepted]} 
        activeOpacity={0.88}
        onPress={() => {
          if (isAccepted && item.jobId?._id) {
            navigation.navigate('WorkerActiveJob', { jobId: item.jobId._id, job: item.jobId, quoteAmount: item.amount });
          }
        }}
      >
        <View style={styles.quoteTop}>
          <View style={styles.quoteLeft}>
            <View style={styles.categoryBadge}>
              <Briefcase size={13} color="#6C47FF" style={{ marginRight: 4 }} />
              <Text style={styles.categoryText} numberOfLines={1}>{item.jobId?.category || 'Service'}</Text>
            </View>
            <Text style={styles.customerName}>{item.jobId?.customerId?.name || 'Customer'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MapPin size={12} color={isDarkMode ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
              <Text style={styles.addressText} numberOfLines={1}>
                {getAddressText()}
              </Text>
            </View>
          </View>

          <View style={styles.quoteRight}>
            <Text style={styles.quoteAmount}>₹{item.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Icon size={12} color={cfg.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
          </View>
        </View>

        {isPending && (
          <View style={styles.quoteActions}>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => withdrawQuote(item._id)} activeOpacity={0.8}>
              <Text style={styles.withdrawBtnText}>Withdraw Quote</Text>
            </TouchableOpacity>
            <Text style={styles.pendingTipText}>Waiting for customer to accept</Text>
          </View>
        )}

        {isAccepted && (
          <View style={[styles.quoteActions, { borderTopColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Sparkles size={14} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.hiredText}>Hired for this job!</Text>
            </View>
            <View style={styles.viewJobBtn}>
              <Text style={styles.viewJobBtnText}>Open Job →</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      <WorkerHeroHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6C47FF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderQuote}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchQuotes} colors={['#6C47FF']} tintColor="#6C47FF" />
          }
          ListHeaderComponent={
            <>
              {/* 4-Item Stats Row (Fixed Wrapping) */}
              <View style={styles.statsRow}>
                {/* Total */}
                <View style={[styles.statBox, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                  <Text style={[styles.statNum, { color: '#6C47FF' }]}>{stats.total}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Total</Text>
                </View>

                {/* Pending */}
                <View style={[styles.statBox, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                  <Text style={[styles.statNum, { color: '#F59E0B' }]}>{stats.pending}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Pending</Text>
                </View>

                {/* Accepted */}
                <View style={[styles.statBox, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                  <Text style={[styles.statNum, { color: '#10B981' }]}>{stats.accepted}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Accepted</Text>
                </View>

                {/* Rejected */}
                <View style={[styles.statBox, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                  <Text style={[styles.statNum, { color: '#EF4444' }]}>{stats.rejected}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Rejected</Text>
                </View>
              </View>

              {/* Filter Tabs */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.filtersRow}
              >
                {FILTERS.map(f => {
                  const isActive = activeFilter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.filterTab, 
                        isActive && styles.filterTabActive
                      ]}
                      onPress={() => setActiveFilter(f)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.filterText, 
                        isActive && styles.filterTextActive
                      ]}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <FileText size={38} color="#6C47FF" />
              </View>
              <Text style={styles.emptyTitle}>No Quotes Found</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? `No quotes matching "${searchQuery}".` 
                  : `You don't have any ${activeFilter !== 'All' ? activeFilter.toLowerCase() : ''} quotes right now.`}
              </Text>

              <TouchableOpacity style={styles.refreshBtn} onPress={fetchQuotes} activeOpacity={0.8}>
                <RotateCcw size={14} color="#6C47FF" style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' 
  },
  statsRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 14, 
    marginBottom: 12,
    paddingHorizontal: 4
  },
  statBox: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', 
    borderWidth: 1.2, 
    borderRadius: 16, 
    paddingVertical: 12, 
    paddingHorizontal: 4, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statNum: { 
    fontSize: 20, 
    fontWeight: '900',
    marginBottom: 2
  },
  statLabel: { 
    fontSize: 10.5, 
    color: isDarkMode ? '#94A3B8' : '#64748B', 
    fontWeight: '700', 
    textAlign: 'center',
  },
  filtersRow: { 
    paddingVertical: 8, 
    gap: 8,
    marginBottom: 8
  },
  filterTab: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 12, 
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', 
    borderWidth: 1.2, 
    borderColor: isDarkMode ? '#334155' : '#E2E8F0' 
  },
  filterTabActive: { 
    backgroundColor: '#6C47FF', 
    borderColor: '#6C47FF' 
  },
  filterText: { 
    fontSize: 12.5, 
    fontWeight: '700', 
    color: isDarkMode ? '#94A3B8' : '#64748B' 
  },
  filterTextActive: { 
    color: '#FFFFFF',
    fontWeight: '800' 
  },
  list: { 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 12 
  },
  quoteCard: { 
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1.2, 
    borderColor: isDarkMode ? '#334155' : '#EEF2F6', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2 
  },
  quoteCardAccepted: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: isDarkMode ? '#132A24' : '#F7FEFA',
  },
  quoteTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  quoteLeft: { 
    flex: 1,
    paddingRight: 10
  },
  quoteRight: { 
    alignItems: 'flex-end', 
    gap: 4 
  },
  categoryBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(108, 71, 255, 0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8, 
    alignSelf: 'flex-start', 
    marginBottom: 6 
  },
  categoryText: { 
    fontSize: 11.5, 
    fontWeight: '800', 
    color: '#6C47FF' 
  },
  customerName: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B', 
    marginBottom: 4 
  },
  addressText: { 
    fontSize: 12, 
    color: isDarkMode ? '#94A3B8' : '#64748B' 
  },
  quoteAmount: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B' 
  },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8 
  },
  statusText: { 
    fontSize: 11, 
    fontWeight: '800' 
  },
  timeText: { 
    fontSize: 11, 
    color: isDarkMode ? '#94A3B8' : '#64748B' 
  },
  quoteActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9' 
  },
  withdrawBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(239, 68, 68, 0.3)', 
    backgroundColor: 'rgba(239, 68, 68, 0.08)' 
  },
  withdrawBtnText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#EF4444' 
  },
  pendingTipText: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  hiredText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#10B981',
  },
  viewJobBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  viewJobBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyState: { 
    alignItems: 'center', 
    paddingTop: 48, 
    paddingHorizontal: 32 
  },
  emptyIconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 24, 
    backgroundColor: 'rgba(108, 71, 255, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyTitle: { 
    fontSize: 17, 
    fontWeight: '800', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B', 
    marginBottom: 6 
  },
  emptyText: { 
    fontSize: 13, 
    color: isDarkMode ? '#94A3B8' : '#64748B', 
    fontWeight: '500', 
    textAlign: 'center', 
    lineHeight: 18,
    marginBottom: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.25)',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  }
});

export default WorkerMyQuotesScreen;
