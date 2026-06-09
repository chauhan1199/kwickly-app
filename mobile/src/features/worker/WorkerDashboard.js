import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Switch,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import api from '../../services/api';
import AppBar from '../../components/AppBar';
import { Bell, Moon, Sun } from 'lucide-react-native';

const WorkerDashboard = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { user, socket, signOut, fetchUser } = useAuth();
  const isOnline = user?.isOnline ?? true;
  const [refreshing, setRefreshing] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    fetchData();

    if (socket) {
      // Listen for new jobs globally broadcasted
      const handleNewJob = (jobAlert) => {
        if (!isOnline) return;
        setAvailableJobs(prev => {
          // Prevent duplicates
          if (prev.find(j => j._id === jobAlert.jobId)) return prev;
          // Map alert format to available job format
          return [{
            _id: jobAlert.jobId,
            category: jobAlert.category,
            description: jobAlert.description,
            location: jobAlert.location,
            addressDetails: jobAlert.location?.addressDetails, // rough map
            preferredDate: jobAlert.preferredDate,
            timeSlot: jobAlert.timeSlot,
            createdAt: new Date()
          }, ...prev];
        });
      };

      // Listen for when a quote placed by this worker is accepted!
      const handleQuoteAccepted = (data) => {
        Alert.alert(
          '🎉 Quote Accepted!',
          `You've been hired for Job #${data.jobId.slice(-4)}!\nAmount: ₹${data.amount}\nArrival OTP: ${data.arrivalOtp}`,
          [{ text: 'View Job', onPress: () => {
             fetchData();
             navigation.navigate('WorkerActiveJob', { jobId: data.jobId });
          }}]
        );
      };

      socket.on('NEW_JOB_ALERT', handleNewJob);
      socket.on('QUOTE_ACCEPTED', handleQuoteAccepted);

      return () => {
        socket.off('NEW_JOB_ALERT', handleNewJob);
        socket.off('QUOTE_ACCEPTED', handleQuoteAccepted);
      };
    }
  }, [socket, isOnline]);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // Fetch available broadcasted jobs
      // We will just use api.get directly for now.
      const jobsRes = await api.get('/jobs/available');
      if (jobsRes.data?.status === 'success') {
        setAvailableJobs(jobsRes.data.data);
      }

      // Fetch wallet (user profile)
      const userRes = await api.get('/auth/me'); // Assuming there's a me endpoint or we use the context user.
      if (userRes.data?.data?.wallet) {
         setWalletBalance(userRes.data.data.wallet.balance || 0);
      } else if (user?.wallet) {
         setWalletBalance(user.wallet.balance || 0);
      }
    } catch (e) {
      if (e.response?.status === 403 || e.response?.status === 402) {
        // Expected error when KYC is pending, wallet is low, or worker is offline
        setAvailableJobs([]);
      } else {
        console.log('Fetching worker data failed:', e.message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchData();
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <AppBar title="Jobs" showBack={false} rightActions={true} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={{fontSize: 24}}>👨‍🔧</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.workerName}>{user?.name || 'Worker'}</Text>
              <Text style={styles.workerStats}>★ 4.8 · {user?.jobsCompleted || 0} jobs done</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.todaysJobs || 0}</Text>
              <Text style={styles.statLabel}>Today's Jobs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₹{user?.totalEarned || 0}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₹{walletBalance}</Text>
              <Text style={styles.statLabel}>Wallet</Text>
            </View>
          </View>
        </View>

        {/* New Job Alerts */}
        {isOnline && availableJobs.length > 0 && (
          <View style={styles.alertSection}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertTitle}>🔔 New Job Alerts ({availableJobs.length})</Text>
            </View>

            {availableJobs.map(job => (
              <View key={job._id} style={[styles.jobCard, { marginBottom: 12 }]}>
                <View style={styles.jobHeaderRow}>
                  <Text style={styles.jobTitle}>{job.category} · {job.description?.slice(0, 20)}...</Text>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                </View>
                
                <Text style={styles.jobDistance}>{job.location?.coordinates ? 'Within your city' : 'Location hidden'}</Text>
                
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>📍 {job.addressDetails?.city || 'Local Area'}</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.skipBtn} onPress={() => {
                    setAvailableJobs(prev => prev.filter(j => j._id !== job._id));
                  }}>
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bidBtn} onPress={() => navigation.navigate('WorkerJobDetails', { job })}>
                    <Text style={styles.bidBtnText}>View & Quote →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {isOnline && availableJobs.length === 0 && (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>📡</Text>
            <Text style={{ color: theme.colors.textDim }}>Looking for jobs near you...</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 30,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  workerStats: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  profileStats: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
  },
  alertSection: {
    marginTop: 10,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  jobCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 10,
  },
  newBadge: {
    backgroundColor: theme.colors.primary + '1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  jobDistance: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 4,
    marginBottom: 12,
  },
  jobNote: {
    fontSize: 14,
    color: '#f59e0b',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  bidBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bidBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#001016',
  },
  
  
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textDim,
  }
});

export default WorkerDashboard;
