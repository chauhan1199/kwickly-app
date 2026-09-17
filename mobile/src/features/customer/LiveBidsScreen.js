import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Animated, 
  Easing, 
  Alert, 
  Platform,
  Image,
  Modal
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useSocket from '../../hooks/useSocket';
import { jobService } from '../../services/jobService';
import { settingsService } from '../../services/settingsService';
import LinearGradient from 'react-native-linear-gradient';
import { SearchBar } from '../../components/ui/SearchBar';
import { Bell, ChevronLeft, Radio, MapPin, Calendar, Clock, Image as ImageIcon, X } from 'lucide-react-native';

const LiveBidsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const routeParams = route.params || {};
  const jobId = routeParams.jobId || (typeof routeParams.job === 'object' ? routeParams.job?._id : routeParams.job);

  const { user } = useAuth();
  const { socket } = useSocket({
    role: 'CUSTOMER',
    userId: user?._id
  });
  
  const [jobData, setJobData] = useState(typeof routeParams.job === 'object' ? routeParams.job : null);
  const [bids, setBids] = useState([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobStatus, setJobStatus] = useState(routeParams.job?.status || 'BROADCASTING');
  const [cancelReason, setCancelReason] = useState(routeParams.job?.cancelReason || '');
  const [currentRadius, setCurrentRadius] = useState(routeParams.job?.broadcast?.radiusKm || 25);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [anims] = useState(() => [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]);
  const [pulseAnim1, pulseAnim2, pulseAnim3] = anims;

  useEffect(() => {
    // Reset state when navigating to a new job using the same screen instance
    setJobStatus('BROADCASTING');
    setCancelReason('');
    setBids([]);
  }, [jobId]);

  useEffect(() => {
    // Continuous wave animation loop that resets smoothly and repeats indefinitely
    const animateWave = (anim, initialDelay) => {
      anim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

      let timer = null;
      if (initialDelay > 0) {
        timer = setTimeout(() => loop.start(), initialDelay);
      } else {
        loop.start();
      }

      return () => {
        if (timer) clearTimeout(timer);
        loop.stop();
        anim.stopAnimation();
      };
    };

    const c1 = animateWave(pulseAnim1, 0);
    const c2 = animateWave(pulseAnim2, 850);
    const c3 = animateWave(pulseAnim3, 1700);

    return () => {
      c1();
      c2();
      c3();
    };
  }, [pulseAnim1, pulseAnim2, pulseAnim3]);

  useEffect(() => {
    if (!jobId) return;

    // 1. Fetch full job details & public settings (for admin max radius)
    const fetchJobAndSettings = async () => {
      try {
        const [jobRes, setRes] = await Promise.all([
          jobService.getJobById(jobId).catch(() => null),
          settingsService.getPublicSettings().catch(() => null)
        ]);

        const fetchedJob = jobRes?.data?.data || jobRes?.data;
        const publicSettings = setRes?.data?.data || setRes?.data;

        if (fetchedJob) {
          setJobData(fetchedJob);
          setJobStatus(fetchedJob.status || 'BROADCASTING');
          if (fetchedJob.cancelReason) setCancelReason(fetchedJob.cancelReason);
          if (fetchedJob.broadcast?.radiusKm) {
            setCurrentRadius(fetchedJob.broadcast.radiusKm);
          } else if (publicSettings?.maxRadius) {
            setCurrentRadius(publicSettings.maxRadius);
          }
        } else if (publicSettings?.maxRadius) {
          setCurrentRadius(publicSettings.maxRadius);
        }
      } catch (err) {
        console.warn('Failed to fetch job/settings in LiveBidsScreen:', err);
      }
    };
    fetchJobAndSettings();

    // 2. Fetch any existing bids for this job
    const fetchBids = async () => {
      try {
        const res = await jobService.getQuotesForJob(jobId);
        if (res.data?.status === 'success') {
          setBids(res.data.data);
        }
      } catch (e) {
        console.warn('Failed to load bids');
      }
    };
    fetchBids();

    // 3. Listen for real-time bids and status changes
    if (socket) {
      const handleNewQuote = (newBid) => {
        if (newBid.jobId === jobId || newBid.job?._id === jobId) {
          setBids(prev => {
            const exists = prev.some(b => (b._id || b.quoteId) === (newBid._id || newBid.quoteId));
            if (exists) return prev;
            return [...prev, newBid];
          });
        }
      };

      const handleJobStatus = (data) => {
        if (data.jobId === jobId && data.status === 'CANCELLED') {
          setJobStatus('CANCELLED');
          setCancelReason(data.reason || 'No workers found nearby after expanding search radius.');
        }
      };

      const handleRadiusExpanded = (data) => {
        if (data.jobId === jobId && data.radiusKm) {
          setCurrentRadius(data.radiusKm);
        }
      };

      socket.on('NEW_QUOTE', handleNewQuote);
      socket.on('JOB_STATUS_CHANGED', handleJobStatus);
      socket.on('JOB_RADIUS_EXPANDED', handleRadiusExpanded);

      return () => {
        socket.off('NEW_QUOTE', handleNewQuote);
        socket.off('JOB_STATUS_CHANGED', handleJobStatus);
        socket.off('JOB_RADIUS_EXPANDED', handleRadiusExpanded);
      };
    }
  }, [jobId, socket]);

  const handleAccept = async (bid) => {
    setIsAccepting(true);
    try {
      const res = await jobService.acceptQuote(bid._id);
      if (res.data?.status === 'success') {
        const { job, quote } = res.data.data;
        navigation.navigate('LiveTracking', { 
          job, 
          worker: bid.workerId, 
          amount: quote.amount 
        });
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to accept quote');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancelJob = () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to stop searching and cancel this request?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await jobService.cancelJob(jobId);
              if (res.data?.status === 'success') {
                setJobStatus('CANCELLED');
                setCancelReason('Cancelled by you');
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to cancel job');
            }
          }
        }
      ]
    );
  };

  const styles = createStyles(theme, isDarkMode);

  const displayCategory = jobData?.category || (typeof routeParams.category === 'object' ? routeParams.category?.name : routeParams.category) || 'Service';
  const displaySubcategory = jobData?.subcategory || routeParams.subcategory || 'General';
  const displayBudget = (jobData?.budget || routeParams.budget) ? `Budget ₹${jobData?.budget || routeParams.budget}` : 'Open to Bids';
  const displayTimeSlot = jobData?.timeSlot || routeParams.timeSlot || 'ASAP';
  const displayAddress = jobData?.addressDetails?.fullAddress || jobData?.addressDetails?.address || (typeof jobData?.addressDetails === 'string' ? jobData.addressDetails : '') || routeParams.address || 'Address not provided';
  const displayDate = jobData?.preferredDate ? new Date(jobData.preferredDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  const displayDescription = jobData?.description || routeParams.description || '';
  const displayMedia = jobData?.media || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" translucent={true} />
      
      <LinearGradient colors={['#6C47FF', '#8B6FFF']} style={styles.headerGradient}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.appBarTitle, { color: '#fff' }]} numberOfLines={1}>Live Bids</Text>
            <Text style={[styles.appBarSub, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
              Job #{jobId ? String(jobId).slice(-8) : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Bell size={18} color="#fff" />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10, marginBottom: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search bids, workers..."
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Comprehensive Job Details Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{displayCategory} · {displaySubcategory}</Text>
              <Text style={styles.summaryDesc}>
                {displayBudget} · {displayTimeSlot}{displayDate ? ` · ${displayDate}` : ''}
              </Text>
            </View>
            <View style={styles.bidsChip}>
              <Text style={styles.bidsChipText}>{bids.length} {bids.length === 1 ? 'bid' : 'bids'}</Text>
            </View>
          </View>

          {/* Service Address */}
          <View style={styles.summaryAddressRow}>
            <MapPin size={13} color="#6C47FF" style={{ marginTop: 2 }} />
            <Text style={styles.summaryAddressText} numberOfLines={2}>{displayAddress}</Text>
          </View>

          {/* Description if provided */}
          {displayDescription ? (
            <View style={styles.summaryDescBox}>
              <Text style={styles.summaryDescQuote} numberOfLines={3}>"{displayDescription}"</Text>
            </View>
          ) : null}

          {/* Customer Media Thumbnails if attached */}
          {displayMedia.length > 0 && (
            <View style={styles.summaryMediaRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {displayMedia.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.summaryMediaThumbBox}
                    onPress={() => setSelectedPhoto(url)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: url }} style={styles.summaryMediaThumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {bids.length === 0 ? (
          <View style={styles.waitingCard}>
            {jobStatus === 'CANCELLED' ? (
              <>
                <View style={[styles.radarContainer, { backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}>
                  <Text style={styles.radarIcon}>❌</Text>
                </View>
                <Text style={styles.waitingTitle}>Job Cancelled</Text>
                <Text style={styles.waitingSub}>
                  {cancelReason || 'No workers found nearby after expanding search radius.'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
                  <TouchableOpacity 
                    style={styles.repostBtn}
                    onPress={() => navigation.navigate('DescribeJob', { 
                      category: displayCategory, 
                      subcategory: displaySubcategory,
                      address: displayAddress
                    })}
                  >
                    <Text style={styles.repostBtnText}>↺ Re-post Job</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.goBackBtn}
                    onPress={() => {
                      if (navigation.canGoBack()) navigation.goBack();
                      else navigation.navigate('HomeMain');
                    }}
                  >
                    <Text style={styles.goBackBtnText}>Dashboard</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.radarContainer}>
                  <Animated.View style={[
                    styles.pulseCircle,
                    {
                      transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 4] }) }],
                      opacity: pulseAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] })
                    }
                  ]} />
                  <Animated.View style={[
                    styles.pulseCircle,
                    {
                      transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.8, 4] }) }],
                      opacity: pulseAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] })
                    }
                  ]} />
                  <Animated.View style={[
                    styles.pulseCircle,
                    {
                      transform: [{ scale: pulseAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.8, 4] }) }],
                      opacity: pulseAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] })
                    }
                  ]} />
                  <View style={styles.radarCenter}>
                    <Text style={styles.radarIcon}>📡</Text>
                  </View>
                </View>
                <Text style={styles.waitingTitle}>Searching for Workers...</Text>
                <Text style={styles.waitingSub}>Checking in {currentRadius} km radius</Text>
                
                <TouchableOpacity 
                  style={{ marginTop: 30, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 100 }}
                  onPress={handleCancelJob}
                >
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cancel Request</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {bids.filter(bid => !searchQuery || bid.workerId?.name?.toLowerCase().includes(searchQuery.toLowerCase())).map((bid) => {
          const worker = bid.workerId;
          if (!worker) return null; // Handle unpopulated worker in realtime events vs API
          
          return (
            <View key={bid._id || bid.quoteId} style={styles.workerCard}>
              <View style={styles.row}>
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>{worker.name ? worker.name[0] : 'W'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={[styles.row, { gap: 6 }]}>
                    <Text style={styles.workerName}>{worker.name || 'Worker'}</Text>
                    {worker.kyc?.status === 'APPROVED' && (
                      <View style={styles.kycChip}>
                        <Text style={styles.kycChipText}>✓ KYC</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workerStars}>
                    <Text style={{ color: '#f5b300' }}>★★★★★</Text>
                    <Text style={styles.workerMuted}> {worker.rating?.average || '0.0'} · {worker.jobsCompleted || 0} jobs</Text>
                  </Text>
                  <Text style={styles.workerMuted}>📍 {bid.distanceKm ? bid.distanceKm + ' km' : 'Nearby'} · ⏱ {bid.timeToReach} min away</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.workerPrice}>₹{bid.customerPayable || bid.amount}</Text>
                  {bid.customerPayable && bid.customerPayable !== bid.amount && (
                    <Text style={{ fontSize: 10, color: theme.colors.textDim, marginBottom: 4 }}>
                      incl. ₹{bid.platformFee} fee + GST
                    </Text>
                  )}
                  <TouchableOpacity 
                    style={styles.acceptBtn}
                    onPress={() => handleAccept(bid)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? <ActivityIndicator color="#001016" size="small" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Photo Preview Modal */}
        <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.photoModalOverlay}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setSelectedPhoto(null)}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            {selectedPhoto && (
              <Image source={{ uri: selectedPhoto }} style={styles.photoModalImage} resizeMode="contain" />
            )}
          </View>
        </Modal>

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
  headerGradient: {
    paddingBottom: 36,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 12,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  appBarSub: {
    fontSize: 12,
    marginTop: 1,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  summaryDesc: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  summaryAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryAddressText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textDim,
    lineHeight: 16,
  },
  summaryDescBox: {
    marginTop: 8,
    backgroundColor: theme.colors.background,
    padding: 10,
    borderRadius: 10,
  },
  summaryDescQuote: {
    fontSize: 12,
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  summaryMediaRow: {
    marginTop: 10,
  },
  summaryMediaThumbBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryMediaThumb: {
    width: '100%',
    height: '100%',
  },
  bidsChip: {
    backgroundColor: '#6C47FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bidsChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  waitingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 6,
  },
  waitingSub: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  radarContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  radarCenter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 8,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  pulseCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(108, 71, 255, 0.5)',
    zIndex: 1,
  },
  radarIcon: {
    fontSize: 28,
  },
  repostBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 100,
  },
  repostBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  goBackBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  goBackBtnText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  workerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  workerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  workerName: {
    fontWeight: '800',
    fontSize: 14,
    color: theme.colors.text,
  },
  kycChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kycChipText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  workerStars: {
    fontSize: 12,
    marginVertical: 4,
  },
  workerMuted: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  workerPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  acceptBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#001016',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '90%',
    height: '80%',
  },
});

export default LiveBidsScreen;
