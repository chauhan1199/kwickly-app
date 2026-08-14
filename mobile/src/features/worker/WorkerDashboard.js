import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Alert,
  Image,
  DeviceEventEmitter
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useSocket from '../../hooks/useSocket';
import { workerService } from '../../services/workerService';
import { jobService } from '../../services/jobService';
import { authService } from '../../services/authService';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import WorkerBalanceCard from '../../components/WorkerBalanceCard';
import { getImageUrl } from '../../utils/helpers';
import { Briefcase, CheckCircle, Clock, XCircle, ChevronRight, Settings } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const WorkerDashboard = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { user, fetchUser } = useAuth();
  const [isOnline, setIsOnline] = useState(user?.isOnline ?? false);
  const [refreshing, setRefreshing] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [stats, setStats] = useState({ todayJobs: 0, completed: 0, inProgress: 0, cancelled: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState(undefined); // undefined means no search bar on Home

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg('');
      
      const [jobsRes, userRes, statsRes] = await Promise.all([
        jobService.getAvailableJobsForWorker().catch(() => null),
        authService.getProfile().catch(() => null),
        workerService.getStats().catch(() => null)
      ]);

      if (jobsRes?.data?.status === 'success') {
        setAvailableJobs(jobsRes.data.data);
      } else {
         if (jobsRes?.response?.status === 403 || jobsRes?.response?.status === 402) {
           setAvailableJobs([]);
           setErrorMsg(jobsRes.response?.data?.message || 'Action restricted.');
         }
      }

      if (userRes?.data?.data?.wallet) {
         setWalletBalance(userRes.data.data.wallet.balance || 0);
      }

      if (statsRes?.data?.status === 'success') {
         setStats(statsRes.data.data);
      }

    } catch (e) {
      Alert.alert('Error', 'Failed to load data.');
      setErrorMsg('Failed to load data.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleToggleOnline = useCallback(async (value) => {
    setIsOnline(value);
    try {
      await workerService.setOnlineStatus(value);
      if (fetchUser) fetchUser('WORKER');
      if (value) {
        fetchData();
      } else {
        setAvailableJobs([]);
        setErrorMsg('');
      }
    } catch (e) {
      setIsOnline(!value);
      Alert.alert('Error', 'Could not update online status');
    }
  }, [fetchData, fetchUser]);

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('toggleDutyStatus', () => {
      handleToggleOnline(!isOnline);
    });
    return () => listener.remove();
  }, [isOnline, handleToggleOnline]);

  const { socket } = useSocket({
    role: 'WORKER',
    userId: user?._id
  });

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );



  useEffect(() => {
    if (socket) {
      const handleNewJob = (jobAlert) => {
        if (!isOnline) return;
        setAvailableJobs(prev => {
          if (prev.find(j => j._id === jobAlert.jobId)) return prev;
          return [{
            _id: jobAlert.jobId,
            category: jobAlert.category,
            description: jobAlert.description,
            location: jobAlert.location,
            addressDetails: jobAlert.location?.addressDetails,
            preferredDate: jobAlert.preferredDate,
            timeSlot: jobAlert.timeSlot,
            customerId: jobAlert.customerId,
            createdAt: new Date()
          }, ...prev];
        });
      };

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
  }, [socket, isOnline, fetchData, navigation]);

  const styles = createStyles(theme, isDarkMode);

  // Derive active categories
  const activeCategories = user?.services?.length > 0 ? user.services : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      <WorkerHeroHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      <WorkerBalanceCard 
         balance={walletBalance} 
         onTopUp={() => navigation.navigate('Earnings')} 
         onWithdraw={() => navigation.navigate('Earnings')} 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Duty Status & Dark Mode Toggle */}
        <View style={styles.dutyStatusRow}>
          <View>
            <Text style={styles.sectionTitle}>Duty Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : theme.colors.textDim }]} />
              <Text style={[styles.statusText, { color: isOnline ? '#10b981' : theme.colors.textDim }]}>
                {isOnline ? 'You are Online' : 'You are Offline'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginRight: 8, fontWeight: '500' }}>Dark Mode</Text>
            <Switch
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={'#ffffff'}
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
          </View>
        </View>

        {/* 4-Item Stats Grid */}
        <View style={styles.statsGrid}>
           <View style={styles.statCard}>
              <View style={[styles.statIconWrapper, { backgroundColor: '#6C47FF15' }]}>
                <Briefcase size={20} color="#6C47FF" />
              </View>
              <Text style={styles.statValue}>{stats.todayJobs}</Text>
              <Text style={styles.statLabel}>Today's Jobs</Text>
           </View>
           
           <View style={styles.statCard}>
              <View style={[styles.statIconWrapper, { backgroundColor: '#10b98115' }]}>
                <CheckCircle size={20} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
           </View>
           
           <View style={styles.statCard}>
              <View style={[styles.statIconWrapper, { backgroundColor: '#f59e0b15' }]}>
                <Clock size={20} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
           </View>
           
           <View style={styles.statCard}>
              <View style={[styles.statIconWrapper, { backgroundColor: '#ef444415' }]}>
                <XCircle size={20} color="#ef4444" />
              </View>
              <Text style={styles.statValue}>{stats.cancelled}</Text>
              <Text style={styles.statLabel}>Cancelled</Text>
           </View>
        </View>

        {/* Premium Banner */}
        {(() => {
          const expiryDate = user?.subscription?.expiryDate;
          const diffTime = expiryDate ? new Date(expiryDate).getTime() - new Date().getTime() : 0;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isPremium = diffDays > 0;

          if (isPremium) {
            return (
              <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Earnings')}>
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.premiumBanner}
                >
                   <View style={{ flex: 1 }}>
                      <Text style={styles.premiumTitle}>Premium Active 🌟</Text>
                      <Text style={styles.premiumSub}>You are getting priority job alerts.</Text>
                      <View style={[styles.premiumBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                         <Text style={styles.premiumBtnText}>{diffDays} Days Remaining</Text>
                      </View>
                   </View>
                   <Text style={{ fontSize: 60, alignSelf: 'flex-end', marginLeft: 10 }}>🎉</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <LinearGradient
              colors={['#6C47FF', '#8B6FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBanner}
            >
               <View style={{ flex: 1 }}>
                  <Text style={styles.premiumTitle}>Boost Your Earnings</Text>
                  <Text style={styles.premiumSub}>Go Premium and get more job opportunities</Text>
                  <TouchableOpacity style={styles.premiumBtn} onPress={() => navigation.navigate('Earnings')}>
                     <Text style={styles.premiumBtnText}>Upgrade Now</Text>
                  </TouchableOpacity>
               </View>
               <Text style={{ fontSize: 60, alignSelf: 'flex-end', marginLeft: 10 }}>🚀</Text>
            </LinearGradient>
          );
        })()}

        {/* Active Categories */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Active Categories</Text>
           <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => navigation.navigate('Services')}>
              <Text style={styles.linkText}>Manage</Text>
              <ChevronRight size={16} color="#6C47FF" />
           </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
           {activeCategories.length > 0 ? (
             activeCategories.map((cat, i) => {
                const categoryObj = cat.category || {};
                const name = categoryObj.name || cat.categoryName || 'Category';
                const imageUri = categoryObj.imageUrl ? getImageUrl(categoryObj.imageUrl) : null;
                
                return (
                 <View key={i} style={styles.categoryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                       {imageUri ? (
                          <Image source={{ uri: imageUri }} style={{ width: 36, height: 36, marginRight: 12, borderRadius: 8 }} />
                       ) : (
                          <Text style={{ fontSize: 24, marginRight: 12 }}>🔧</Text>
                       )}
                       <View>
                          <Text style={styles.catName}>{name}</Text>
                          <Text style={styles.catSub}>{cat.subcategories?.length || 0} Subcategories</Text>
                       </View>
                    </View>
                 </View>
                );
             })
           ) : (
             <View style={styles.categoryCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                   <Settings size={24} color={theme.colors.primary} style={{ marginRight: 12 }} />
                   <View>
                      <Text style={styles.catName}>No Categories</Text>
                      <Text style={styles.catSub}>Tap manage to add</Text>
                   </View>
                </View>
             </View>
           )}
           <View style={{ width: 40 }} />
        </ScrollView>

        {/* Recent Jobs */}
        <View style={[styles.sectionHeader, { marginTop: 30 }]}>
           <Text style={styles.sectionTitle}>Recent Jobs</Text>
           <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => navigation.navigate('Quotes')}>
              <Text style={styles.linkText}>View All</Text>
              <ChevronRight size={16} color="#6C47FF" />
           </TouchableOpacity>
        </View>

        {isOnline && availableJobs.length > 0 ? (
          availableJobs.map(job => (
            <View key={job._id} style={styles.jobCard}>
              <View style={styles.jobHeaderRow}>
                 <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                 </View>
                 <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{job.category}</Text>
                    <Text style={styles.jobLocation} numberOfLines={1}>
                       📍 {job.addressDetails?.city || 'Local Area'}
                    </Text>
                 </View>
              </View>
              <View style={styles.jobFooter}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={styles.jobTime}>⏱️ Today, {job.timeSlot}</Text>
                    <Text style={styles.jobTime}>💰 ₹{job.description?.match(/\d+/) ? job.description.match(/\d+/)[0] : 'Offer'}</Text>
                 </View>
                 <TouchableOpacity style={styles.acceptBtn} onPress={() => navigation.navigate('WorkerJobDetails', { job })}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                 </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>{errorMsg ? '⚠️' : '📡'}</Text>
            <Text style={styles.emptyStateText}>
              {errorMsg || (!isOnline ? 'Go online to receive jobs.' : 'Waiting for new jobs near you...')}
            </Text>
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
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  dutyStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    width: '23%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textDim,
    textAlign: 'center',
  },
  premiumBanner: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  premiumSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  premiumBtn: {
    backgroundColor: '#3D2C7D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  premiumBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkText: {
    color: '#6C47FF',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  categoryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  catSub: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  jobCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  newBadge: {
    backgroundColor: '#10b98115',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  jobLocation: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  acceptBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateText: {
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  }
});

export default WorkerDashboard;
