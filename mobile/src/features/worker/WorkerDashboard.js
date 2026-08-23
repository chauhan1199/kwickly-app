import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  DeviceEventEmitter,
  ActivityIndicator
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
import { 
  Briefcase, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ChevronRight, 
  Settings, 
  Radio, 
  Sparkles, 
  ArrowRight,
  Layers,
  MapPin,
  Calendar
} from 'lucide-react-native';
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
  const [searchQuery, setSearchQuery] = useState(undefined); // Undefined means no search bar on Home
  const [allCategories, setAllCategories] = useState([]);
  const [workerServices, setWorkerServices] = useState(user?.services || []);

  const styles = createStyles(theme, isDarkMode);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg('');
      
      const [jobsRes, userRes, statsRes, catRes] = await Promise.allSettled([
        jobService.getAvailableJobsForWorker(),
        authService.getProfile(),
        workerService.getStats(),
        jobService.getCategories()
      ]);

      if (jobsRes.status === 'fulfilled' && jobsRes.value?.data?.status === 'success') {
        setAvailableJobs(jobsRes.value.data.data || []);
      } else if (jobsRes.status === 'fulfilled' && (jobsRes.value?.response?.status === 403 || jobsRes.value?.response?.status === 402)) {
        setAvailableJobs([]);
        setErrorMsg(jobsRes.value.response?.data?.message || 'Subscription required to view incoming jobs.');
      }

      if (userRes.status === 'fulfilled' && userRes.value?.data?.data) {
        const uProfile = userRes.value.data.data;
        if (uProfile.wallet) setWalletBalance(uProfile.wallet.balance || 0);
        if (uProfile.services) setWorkerServices(uProfile.services);
        if (uProfile.isOnline !== undefined) setIsOnline(uProfile.isOnline);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.data?.status === 'success') {
        setStats(statsRes.value.data.data || { todayJobs: 0, completed: 0, inProgress: 0, cancelled: 0 });
      }

      if (catRes.status === 'fulfilled' && catRes.value?.data?.status === 'success') {
        setAllCategories(catRes.value.data.data || []);
      }

    } catch (e) {
      setErrorMsg('Failed to load dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleToggleOnline = useCallback(async (value) => {
    if (value) {
      // Client-side instant check for KYC
      const kycStatus = user?.kyc?.status || 'PENDING';
      if (kycStatus !== 'APPROVED') {
        Alert.alert(
          'KYC Verification Required',
          kycStatus === 'REJECTED'
            ? `Your KYC was rejected (${user?.kyc?.rejectReason || 'Invalid documents'}). Please re-upload in Profile > KYC.`
            : 'Your KYC documents are under admin review. You can go online once approved.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open KYC', onPress: () => navigation.navigate('Profile') }
          ]
        );
        return;
      }
    }

    setIsOnline(value);
    try {
      const res = await workerService.setOnlineStatus(value);
      if (fetchUser) fetchUser('WORKER');
      if (value) {
        fetchData();
      } else {
        setAvailableJobs([]);
        setErrorMsg('');
      }
    } catch (e) {
      setIsOnline(!value);
      const errMsg = e.response?.data?.message || e.message || 'Could not update online status';
      
      if (errMsg.includes('Subscription Expired') || errMsg.includes('subscription') || errMsg.includes('trial')) {
        Alert.alert('Subscription Required', errMsg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => navigation.navigate('Earnings') }
        ]);
      } else if (errMsg.includes('Minimum Wallet') || errMsg.includes('balance')) {
        Alert.alert('Low Wallet Balance', errMsg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Money', onPress: () => navigation.navigate('Earnings') }
        ]);
      } else if (errMsg.includes('services') || errMsg.includes('subcategories')) {
        Alert.alert('Services Incomplete', errMsg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup Services', onPress: () => navigation.navigate('Services') }
        ]);
      } else if (errMsg.includes('Bank') || errMsg.includes('UPI')) {
        Alert.alert('Payout Setup Required', errMsg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Bank / UPI', onPress: () => navigation.navigate('Profile') }
        ]);
      } else {
        Alert.alert('Duty Status Alert', errMsg);
      }
    }
  }, [fetchData, fetchUser, user, navigation]);

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
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (socket) {
      const handleNewJob = (jobAlert) => {
        if (!isOnline) return;
        setAvailableJobs(prev => {
          if (prev.find(j => j._id === jobAlert.jobId)) return prev;
          return [jobAlert, ...prev];
        });
      };

      socket.on('NEW_JOB_BROADCAST', handleNewJob);
      socket.on('JOB_ACCEPTED', (data) => {
        setAvailableJobs(prev => prev.filter(j => j._id !== data.jobId));
      });

      return () => {
        socket.off('NEW_JOB_BROADCAST', handleNewJob);
        socket.off('JOB_ACCEPTED');
      };
    }
  }, [socket, isOnline]);

  // Derive active categories with populated titles from workerServices state
  const activeCategories = useMemo(() => {
    const rawServices = workerServices?.length > 0 ? workerServices : (user?.services || []);
    return rawServices.map(s => {
      const catId = s.category?._id || s.category;
      const fullCat = allCategories.find(c => c._id === catId);
      return {
        ...s,
        resolvedName: s.categoryName || fullCat?.name || s.category?.name || 'Service Category',
        resolvedImage: fullCat?.imageUrl || s.category?.imageUrl || null,
        subCount: s.subcategories?.length || 0,
      };
    });
  }, [workerServices, user?.services, allCategories]);

  // Subscription calculation (30 days admin free trial)
  const registrationDate = user?.createdAt ? new Date(user.createdAt) : new Date();
  const trialDays = 30;
  const trialEndDate = new Date(registrationDate.getTime() + trialDays * 86400000);
  const trialDiffTime = trialEndDate.getTime() - new Date().getTime();
  const trialDaysLeft = Math.ceil(trialDiffTime / (1000 * 60 * 60 * 24));
  const isTrialActive = trialDaysLeft > 0;

  const expiryDate = user?.subscription?.expiryDate;
  const paidDiffTime = expiryDate ? new Date(expiryDate).getTime() - new Date().getTime() : 0;
  const paidDaysLeft = Math.ceil(paidDiffTime / (1000 * 60 * 60 * 24));
  const isPaidActive = paidDaysLeft > 0;

  const isSubscriptionValid = isTrialActive || isPaidActive;
  const activeDaysRemaining = isPaidActive ? paidDaysLeft : (isTrialActive ? trialDaysLeft : 0);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} colors={['#6C47FF']} tintColor="#6C47FF" />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ═══════════════════════════════════════
            DUTY STATUS ROW
        ═══════════════════════════════════════ */}
        <View style={styles.dutyCard}>
          <View style={styles.dutyLeft}>
            <View style={[styles.dutyStatusPill, isOnline ? styles.dutyPillOnline : styles.dutyPillOffline]}>
              <View style={[styles.dutyPulseDot, { backgroundColor: isOnline ? '#10B981' : '#94A3B8' }]} />
              <Text style={[styles.dutyPillText, { color: isOnline ? '#059669' : '#64748B' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <Text style={styles.dutySubText}>
              {isOnline ? 'Ready & receiving customer job alerts' : 'Turn on duty to start receiving jobs'}
            </Text>
          </View>

          <View style={styles.dutyRight}>
            <Switch
              trackColor={{ false: isDarkMode ? '#334155' : '#E2E8F0', true: '#6C47FF' }}
              thumbColor={'#FFFFFF'}
              onValueChange={handleToggleOnline}
              value={isOnline}
            />
          </View>
        </View>

        {/* ═══════════════════════════════════════
            4-ITEM STATS GRID (FIXED TYPOGRAPHY)
        ═══════════════════════════════════════ */}
        <View style={styles.statsGrid}>
          {/* Today's Jobs */}
          <View style={[styles.statCard, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
              <Briefcase size={18} color="#6C47FF" />
            </View>
            <Text style={styles.statValue}>{stats.todayJobs || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Today</Text>
          </View>
          
          {/* Completed */}
          <View style={[styles.statCard, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <CheckCircle size={18} color="#10B981" />
            </View>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.completed || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Completed</Text>
          </View>
          
          {/* In Progress */}
          <View style={[styles.statCard, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.inProgress || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>In Progress</Text>
          </View>
          
          {/* Cancelled */}
          <View style={[styles.statCard, { borderColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <XCircle size={18} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.cancelled || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Cancelled</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════
            PREMIUM PLAN STATUS BANNER
        ═══════════════════════════════════════ */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Earnings')}>
          <LinearGradient
            colors={
              isPaidActive 
                ? ['#6C47FF', '#8B6FFF'] 
                : isTrialActive 
                ? ['#0D9488', '#14B8A6'] 
                : ['#EF4444', '#DC2626']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBanner}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.premiumHeaderTag}>
                <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.premiumHeaderTagText}>
                  {isPaidActive ? 'PRO Plan Active' : isTrialActive ? 'Free Trial Active' : 'Subscription Expired ⚠️'}
                </Text>
              </View>
              <Text style={styles.premiumTitle}>
                {isPaidActive 
                  ? `${paidDaysLeft} Days Remaining` 
                  : isTrialActive 
                  ? `${trialDaysLeft} Days Remaining in Free Trial` 
                  : 'View-Only Mode (Plan Required)'}
              </Text>
              <Text style={styles.premiumSub}>
                {isPaidActive 
                  ? 'Priority access to instant customer job requests.' 
                  : isTrialActive 
                  ? 'Free trial active from registration. ₹100 freeze balance required after trial.' 
                  : 'Subscription expired. Tap to activate plan & go online to accept jobs.'}
              </Text>
            </View>

            <View style={styles.premiumActionCircle}>
              <ArrowRight size={18} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ═══════════════════════════════════════
            ACTIVE CATEGORIES LIST
        ═══════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Layers size={18} color="#6C47FF" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Active Categories</Text>
          </View>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center' }} 
            onPress={() => navigation.navigate('Services')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>Manage</Text>
            <ChevronRight size={16} color="#6C47FF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoriesSlider}
        >
          {activeCategories.length > 0 ? (
            activeCategories.map((cat, i) => {
              const imageUri = cat.resolvedImage ? getImageUrl(cat.resolvedImage) : null;
              
              return (
                <TouchableOpacity 
                  key={i} 
                  style={styles.categoryCard}
                  onPress={() => navigation.navigate('Services')}
                  activeOpacity={0.8}
                >
                  <View style={styles.categoryCardTop}>
                    <View style={styles.catThumbnailBox}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.catThumbnail} resizeMode="cover" />
                      ) : (
                        <Sparkles size={20} color="#6C47FF" />
                      )}
                    </View>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{cat.subCount} Subcategories</Text>
                    </View>
                  </View>

                  <Text style={styles.catName} numberOfLines={2}>{cat.resolvedName}</Text>
                  
                  <View style={styles.catFooter}>
                    <View style={[styles.catStatusDot, { backgroundColor: cat.isActive !== false ? '#10B981' : '#94A3B8' }]} />
                    <Text style={styles.catStatusText}>{cat.isActive !== false ? 'Active' : 'Disabled'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity 
              style={[styles.categoryCard, styles.emptyCategoryCard]}
              onPress={() => navigation.navigate('Services')}
              activeOpacity={0.8}
            >
              <View style={styles.emptyCatIconBox}>
                <Settings size={22} color="#6C47FF" />
              </View>
              <Text style={styles.emptyCatTitle}>Add Your Services</Text>
              <Text style={styles.emptyCatSub}>Tap to configure skills & radius</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ═══════════════════════════════════════
            RECENT INCOMING JOBS
        ═══════════════════════════════════════ */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Radio size={18} color="#6C47FF" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Incoming Jobs</Text>
          </View>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center' }} 
            onPress={() => navigation.navigate('Quotes')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>View Quotes</Text>
            <ChevronRight size={16} color="#6C47FF" />
          </TouchableOpacity>
        </View>

        {isOnline && availableJobs.length > 0 ? (
          availableJobs.map(job => (
            <TouchableOpacity 
              key={job._id} 
              style={styles.jobCard}
              onPress={() => navigation.navigate('WorkerJobDetails', { job })}
              activeOpacity={0.88}
            >
              <View style={styles.jobCardTop}>
                <View style={styles.jobBadgeRow}>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW JOB</Text>
                  </View>
                  <Text style={styles.jobTimeText}>Today • {job.timeSlot || 'Flexible'}</Text>
                </View>
                
                <Text style={styles.jobTitle} numberOfLines={1}>{job.category}</Text>
                <Text style={styles.jobDesc} numberOfLines={2}>
                  {job.description || 'Customer has requested service at their location.'}
                </Text>
              </View>

              <View style={styles.jobCardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MapPin size={14} color="#6C47FF" style={{ marginRight: 4 }} />
                  <Text style={styles.jobLocationText} numberOfLines={1}>
                    {job.addressDetails?.city || job.location?.addressDetails?.city || 'Local Area'}
                  </Text>
                </View>

                <View style={styles.jobAcceptPill}>
                  <Text style={styles.jobAcceptText}>View & Quote →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.listeningRadarCard}>
            <View style={styles.radarIconWrapper}>
              <Radio size={32} color="#6C47FF" />
            </View>
            <Text style={styles.radarTitle}>
              {errorMsg ? 'Action Required' : (!isOnline ? 'You Are Currently Offline' : 'Listening for Nearby Jobs...')}
            </Text>
            <Text style={styles.radarSub}>
              {errorMsg || (!isOnline 
                ? 'Turn on duty status at the top to start receiving real-time job alerts from nearby customers.' 
                : 'Customer job requests within your service broadcast radius will appear here instantly.')}
            </Text>

            {!isOnline ? (
              <TouchableOpacity style={styles.radarActionBtn} onPress={() => handleToggleOnline(true)} activeOpacity={0.8}>
                <Text style={styles.radarActionBtnText}>Go Online</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.radarActionBtn} onPress={() => navigation.navigate('Services')} activeOpacity={0.8}>
                <Text style={styles.radarActionBtnText}>Adjust Service Radius</Text>
              </TouchableOpacity>
            )}
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
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // Duty Status Card
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  dutyLeft: {
    flex: 1,
    paddingRight: 12,
  },
  dutyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  dutyPillOnline: {
    backgroundColor: '#ECFDF5',
  },
  dutyPillOffline: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
  },
  dutyPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dutyPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  dutySubText: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  dutyRight: {
    paddingLeft: 8,
  },

  // 4-Item Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
  },

  // Premium Banner
  premiumBanner: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  premiumHeaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  premiumHeaderTagText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  premiumSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  premiumActionCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  },

  // Categories Horizontal Slider
  categoriesSlider: {
    gap: 12,
    paddingRight: 16,
  },
  categoryCard: {
    width: 170,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  catThumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catThumbnail: {
    width: '100%',
    height: '100%',
  },
  catBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  catName: {
    fontSize: 14,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 8,
    minHeight: 36,
  },
  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  catStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },

  emptyCategoryCard: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  emptyCatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyCatTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
    textAlign: 'center',
  },
  emptyCatSub: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },

  // Job Cards
  jobCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobCardTop: {
    marginBottom: 12,
  },
  jobBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  newBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  jobTimeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 4,
  },
  jobDesc: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    lineHeight: 18,
  },
  jobCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  jobLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? '#CBD5E1' : '#475569',
    flex: 1,
  },
  jobAcceptPill: {
    backgroundColor: '#6C47FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  jobAcceptText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Empty State / Radar Card
  listeningRadarCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  radarIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  radarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  radarSub: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  radarActionBtn: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.25)',
  },
  radarActionBtnText: {
    color: '#6C47FF',
    fontSize: 13,
    fontWeight: '800',
  }
});

export default WorkerDashboard;
