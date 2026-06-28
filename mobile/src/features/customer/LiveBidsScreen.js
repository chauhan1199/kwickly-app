import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
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

  useEffect(() => {
    // 1. Fetch any existing bids for this job
    const fetchBids = async () => {
      try {
        const res = await jobService.getQuotesForJob(jobId);
        if (res.data?.status === 'success') {
          setBids(res.data.data);
        }
      } catch (e) {
        console.log('Failed to fetch existing bids', e);
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

      socket.on('NEW_QUOTE', handleNewQuote);

      return () => {
        socket.off('NEW_QUOTE', handleNewQuote);
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
      console.log('Accept bid error:', e);
    } finally {
      setIsAccepting(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
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
            <Text style={styles.radarIcon}>📡</Text>
            <Text style={styles.waitingTitle}>Waiting for bids...</Text>
            <Text style={styles.waitingSub}>Nearby pros are being notified</Text>
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
    paddingTop: 10,
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
  radarIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  waitingSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 4,
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
