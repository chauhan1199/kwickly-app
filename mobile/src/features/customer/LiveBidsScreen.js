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
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useSocket from '../../hooks/useSocket';
import { jobService } from '../../services/jobService';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { SearchBar } from '../../components/ui/SearchBar';

const LiveBidsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { 
    category = { name: 'Cleaning' }, 
    subcategory = 'Home Cleaning',
    address = '',
    budget = '499',
    timeSlot = 'ASAP',
    jobId = 'BK' + Math.floor(1000 + Math.random() * 9000)
  } = route.params || {};

  const { user } = useAuth();
  const { socket } = useSocket({
    role: 'CUSTOMER',
    userId: user?._id
  });
  
  const [bids, setBids] = useState([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobStatus, setJobStatus] = useState('BROADCASTING');
  const [cancelReason, setCancelReason] = useState('');
  const [currentRadius, setCurrentRadius] = useState(15); // Start with default 15

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
    setCurrentRadius(15);
    setBids([]);
  }, [jobId]);

  useEffect(() => {
    const createPulse = (anim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );
    };

    createPulse(pulseAnim1, 0).start();
    createPulse(pulseAnim2, 1000).start();
    createPulse(pulseAnim3, 2000).start();
  }, [pulseAnim1, pulseAnim2, pulseAnim3]);

  useEffect(() => {
    // 1. Fetch any existing bids for this job
    const fetchBids = async () => {
      try {
        const res = await jobService.getQuotesForJob(jobId);
        if (res.data?.status === 'success') {
          setBids(res.data.data);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load bids');
      }
    };
    fetchBids();

    // 2. Listen for real-time bids
    if (socket) {
      // The socket is already in the 'customer_customerId' room
      // We listen for 'NEW_QUOTE'
      const handleNewQuote = (newBid) => {
        // Only add if it's for this specific job
        if (newBid.jobId === jobId) {
          setBids(prev => [...prev, newBid]);
        }
      };

      const handleJobStatus = (data) => {
        if (data.jobId === jobId && data.status === 'CANCELLED') {
          setJobStatus('CANCELLED');
          setCancelReason(data.reason || 'Job auto-cancelled');
        }
      };

      const handleRadiusExpanded = (data) => {
        if (data.jobId === jobId) {
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
        // Navigate to Live Tracking with the real worker data
        navigation.navigate('LiveTracking', { 
          job, 
          worker: bid.workerId, 
          amount: quote.amount 
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to accept quote');
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" translucent={true} />
      
      <LinearGradient colors={['#6C47FF', '#8B6FFF']} style={styles.headerGradient}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.appBarTitle, { color: '#fff' }]} numberOfLines={1}>Live Bids</Text>
            <Text style={[styles.appBarSub, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>Job #{jobId}</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
            <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bellBtn}>
            <Text style={{fontSize: 16}}>🔔</Text>
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
        
        <View style={styles.summaryCard}>
          <View style={styles.row}>
            <View style={{flex: 1}}>
              <Text style={styles.summaryTitle}>{category.name} · {subcategory}</Text>
              <Text style={styles.summaryDesc}>Budget ₹{budget} · {timeSlot} · {address}</Text>
            </View>
            <View style={styles.bidsChip}>
              <Text style={styles.bidsChipText}>{bids.length} bids</Text>
            </View>
          </View>
        </View>

        {bids.length === 0 ? (
          <View style={styles.waitingCard}>
            {jobStatus === 'CANCELLED' ? (
              <>
                <View style={[styles.radarContainer, { backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}>
                  <Text style={styles.radarIcon}>❌</Text>
                </View>
                <Text style={styles.waitingTitle}>Job Cancelled</Text>
                <Text style={styles.waitingSub}>{cancelReason}</Text>
                <TouchableOpacity 
                  style={{ marginTop: 20, backgroundColor: '#6C47FF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100 }}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
                </TouchableOpacity>
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
                  <Text style={styles.workerPrice}>₹{bid.amount}</Text>
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
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backBtnText: {
    fontSize: 24,
    color: '#fff',
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#001016',
    fontWeight: '800',
    fontSize: 15,
  },
  summaryDesc: {
    color: 'rgba(0, 16, 22, 0.7)',
    fontSize: 11,
    marginTop: 4,
  },
  bidsChip: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
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
  }
});

export default LiveBidsScreen;
