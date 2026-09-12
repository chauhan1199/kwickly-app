import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { jobService } from '../../services/jobService';
import { 
  ChevronLeft, 
  Bell, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Receipt, 
  RefreshCw, 
  FileText, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Radio,
  Share2
} from 'lucide-react-native';

const PastJobDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const { jobId, job } = route.params || {};
  const resolvedJobId = jobId || (typeof job === 'object' ? job?._id : job);

  const [jobData, setJobData] = useState(typeof job === 'object' && job?._id ? job : null);
  const [loading, setLoading] = useState(!jobData && !!resolvedJobId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (resolvedJobId) {
      fetchJobDetails();
    }
  }, [resolvedJobId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await jobService.getJobById(resolvedJobId);
      const fetched = res.data?.data || res.data;
      if (fetched) {
        setJobData(fetched);
      } else {
        throw new Error('Job details not found');
      }
    } catch (err) {
      console.warn('Error fetching job details:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Booking Details</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6C47FF" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !jobData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Booking Details</Text>
        </View>
        <View style={styles.centerBox}>
          <AlertCircle size={44} color="#EF4444" />
          <Text style={styles.errorTitle}>Booking Not Found</Text>
          <Text style={styles.errorSub}>{error || 'Unable to retrieve this booking summary.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchJobDetails}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryName = typeof jobData.category === 'object' ? jobData.category?.name : (jobData.category || 'Service');
  const subcategoryName = jobData.subcategory || 'General';
  const status = (jobData.status || 'PENDING').toUpperCase();
  const isCancelled = status === 'CANCELLED';
  const isCompleted = status === 'COMPLETED' || status === 'PAID' || status === 'CLOSED';
  const isBroadcasting = status === 'BROADCASTING' || status === 'QUOTES_RECEIVED';
  const isInProgress = status === 'IN_PROGRESS' || status === 'ALLOCATED' || status === 'ARRIVING';

  const dateStr = jobData.preferredDate 
    ? new Date(jobData.preferredDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : (jobData.createdAt ? new Date(jobData.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Today');

  const addressText = jobData.addressDetails?.fullAddress 
    || jobData.addressDetails?.address 
    || (typeof jobData.addressDetails === 'string' ? jobData.addressDetails : null) 
    || 'Address not provided';

  const worker = jobData.workerId;
  const workerName = worker?.name || 'Assigned Professional';
  const workerRating = worker?.rating?.average || 5;

  const totalAmount = jobData.payment?.amount || (jobData.budget ? Number(jobData.budget) : 0);
  const workerPayout = jobData.payment?.workerPayout || (totalAmount > 50 ? totalAmount - 50 : totalAmount);
  const taxesFees = jobData.payment?.platformFee ? (jobData.payment.platformFee + (jobData.payment.gst || 0)) : (totalAmount > 50 ? 50 : 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Booking Summary</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Job #{String(jobData._id || resolvedJobId).slice(-8)}</Text>
        </View>
        <TouchableOpacity style={styles.appBarActionBtn} onPress={() => navigation.navigate('Notifications')}>
          <Bell size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* ── Status Banner Card ── */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[
              styles.statusIconBox,
              isCancelled && styles.statusIconBoxCancelled,
              isCompleted && styles.statusIconBoxCompleted,
              isBroadcasting && styles.statusIconBoxBroadcasting,
              isInProgress && styles.statusIconBoxProgress
            ]}>
              {isCancelled ? (
                <XCircle size={24} color="#EF4444" />
              ) : isCompleted ? (
                <CheckCircle size={24} color="#10B981" />
              ) : isBroadcasting ? (
                <Radio size={24} color="#6C47FF" />
              ) : (
                <Clock size={24} color="#F59E0B" />
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>{categoryName} · {subcategoryName}</Text>
              <Text style={styles.cardSub}>Scheduled: {dateStr} • {jobData.timeSlot || 'Urgent'}</Text>
            </View>

            <View style={[
              styles.statusPill,
              isCancelled && styles.statusPillCancelled,
              isCompleted && styles.statusPillCompleted,
              isBroadcasting && styles.statusPillBroadcasting,
              isInProgress && styles.statusPillProgress
            ]}>
              <Text style={[
                styles.statusText,
                isCancelled && { color: '#EF4444' },
                isCompleted && { color: '#10B981' },
                isBroadcasting && { color: '#6C47FF' },
                isInProgress && { color: '#F59E0B' }
              ]}>
                {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : isBroadcasting ? 'Searching' : 'In Progress'}
              </Text>
            </View>
          </View>

          {/* Cancellation Notice */}
          {isCancelled && (
            <View style={styles.cancelNoticeBox}>
              <Text style={styles.cancelNoticeTitle}>Reason for Cancellation:</Text>
              <Text style={styles.cancelNoticeText}>
                {jobData.cancelReason || 'No workers found nearby after expanding search radius. You can re-post this request anytime.'}
              </Text>
            </View>
          )}

          {/* Active Broadcasting Link */}
          {isBroadcasting && (
            <TouchableOpacity 
              style={styles.actionBannerBtn}
              onPress={() => navigation.navigate('LiveBids', { jobId: jobData._id, job: jobData })}
            >
              <Radio size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBannerBtnText}>View Live Quotes & Radar →</Text>
            </TouchableOpacity>
          )}

          {/* In-Progress Live Tracking Link */}
          {isInProgress && (
            <TouchableOpacity 
              style={[styles.actionBannerBtn, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.navigate('LiveTracking', { jobId: jobData._id, job: jobData })}
            >
              <MapPin size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBannerBtnText}>Track Service Professional →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Service Request Details ── */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Service Details</Text>
          
          {/* Address */}
          <View style={styles.detailRow}>
            <MapPin size={16} color="#6C47FF" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.detailLabel}>Service Location</Text>
              <Text style={styles.detailValue}>{addressText}</Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={[styles.detailRow, { marginTop: 12 }]}>
            <Calendar size={16} color="#6C47FF" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.detailLabel}>Scheduled Date & Time Slot</Text>
              <Text style={styles.detailValue}>{dateStr} ({jobData.timeSlot || 'Urgent / ASAP'})</Text>
            </View>
          </View>

          {/* Problem Description */}
          {jobData.description ? (
            <View style={[styles.detailRow, { marginTop: 12 }]}>
              <FileText size={16} color="#6C47FF" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.detailLabel}>Problem Description</Text>
                <Text style={styles.detailValue}>"{jobData.description}"</Text>
              </View>
            </View>
          ) : null}

          {/* Budget */}
          {jobData.budget ? (
            <View style={[styles.detailRow, { marginTop: 12 }]}>
              <Receipt size={16} color="#6C47FF" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.detailLabel}>Estimated Budget</Text>
                <Text style={styles.detailValue}>₹{jobData.budget}</Text>
              </View>
            </View>
          ) : null}

          {/* Attached Media */}
          {jobData.media && jobData.media.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.detailLabel}>Customer Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {jobData.media.map((url, idx) => (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── Professional Info (if allocated/completed) ── */}
        {worker ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Service Professional</Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>{workerName[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.workerName}>{workerName}</Text>
                <Text style={styles.workerRating}>
                  <Text style={{ color: '#f5b300' }}>{'★'.repeat(Math.round(workerRating))}</Text>
                  <Text style={{ color: theme.colors.textDim }}>{'☆'.repeat(5 - Math.round(workerRating))}</Text>
                  <Text style={{ color: theme.colors.textDim, fontSize: 12 }}> ({workerRating})</Text>
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Payment Details (if completed or has payment) ── */}
        {isCompleted && totalAmount > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Payment Details</Text>
            <View style={{ marginTop: 12 }}>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceText}>Service Charge</Text>
                <Text style={styles.invoiceText}>₹{workerPayout}</Text>
              </View>
              {taxesFees > 0 && (
                <View style={styles.invoiceRow}>
                  <Text style={styles.invoiceMuted}>Platform Fee & GST</Text>
                  <Text style={styles.invoiceMuted}>₹{taxesFees}</Text>
                </View>
              )}
              
              <View style={styles.separator} />
              
              <View style={styles.invoiceRow}>
                <Text style={styles.totalText}>Total Paid</Text>
                <Text style={styles.totalPrice}>₹{totalAmount}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Action Buttons ── */}
        {isCancelled ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <TouchableOpacity 
              style={styles.rebookBtn}
              onPress={() => navigation.navigate('DescribeJob', { 
                category: categoryName, 
                subcategory: subcategoryName,
                address: addressText
              })}
            >
              <RefreshCw size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.rebookBtnText}>Re-post / Book Again</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.invoiceBtn}
              onPress={() => navigation.navigate('Home', { screen: 'HomeMain' })}
            >
              <Text style={styles.invoiceBtnText}>Browse Other Services</Text>
            </TouchableOpacity>
          </View>
        ) : isCompleted ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <TouchableOpacity 
              style={styles.rebookBtn}
              onPress={() => navigation.navigate('DescribeJob', { 
                category: categoryName, 
                subcategory: subcategoryName,
                address: addressText
              })}
            >
              <RefreshCw size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.rebookBtnText}>Rebook Service</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.invoiceBtn}
              onPress={() => {
                if (jobData.receipt?.invoiceUrl) {
                  Linking.openURL(jobData.receipt.invoiceUrl);
                } else {
                  Alert.alert('Invoice', 'Tax invoice is being generated and will be available shortly.');
                }
              }}
            >
              <FileText size={16} color={theme.colors.text} style={{ marginRight: 8 }} />
              <Text style={styles.invoiceBtnText}>Download Invoice</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 14,
  },
  errorSub: {
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  retryBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 1,
  },
  appBarActionBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconBoxCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusIconBoxCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusIconBoxBroadcasting: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
  },
  statusIconBoxProgress: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  statusPill: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusPillBroadcasting: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
  },
  statusPillProgress: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cancelNoticeBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  cancelNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 4,
  },
  cancelNoticeText: {
    fontSize: 12.5,
    color: theme.colors.text,
    lineHeight: 17,
  },
  actionBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C47FF',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  actionBannerBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 11.5,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13.5,
    color: theme.colors.text,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 18,
  },
  thumbWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6C47FF',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  workerRating: {
    fontSize: 13,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    color: theme.colors.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  invoiceMuted: {
    color: theme.colors.textDim,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  totalText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  totalPrice: {
    color: '#6C47FF',
    fontSize: 18,
    fontWeight: '900',
  },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C47FF',
    paddingVertical: 15,
    borderRadius: 14,
  },
  rebookBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    borderRadius: 14,
  },
  invoiceBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default PastJobDetailsScreen;
