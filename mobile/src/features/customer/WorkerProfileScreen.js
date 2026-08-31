import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Image,
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { 
  ChevronLeft, 
  Star, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Briefcase, 
  CheckCircle2, 
  Wrench, 
  Sparkles,
  Phone,
  MessageSquare,
  Award,
  Zap,
  Info
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';

const { width } = Dimensions.get('window');

const WorkerProfileScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { worker } = route.params || {};

  // If no worker data passed, go back
  if (!worker) {
    navigation.goBack();
    return null;
  }

  const [workerData, setWorkerData] = useState(worker);
  const [isLoading, setIsLoading] = useState(false);

  const workerId = worker.id || worker._id;

  // Fetch full live worker profile & reviews from backend
  useEffect(() => {
    let isMounted = true;
    if (workerId) {
      setIsLoading(true);
      customerService.getWorkerProfile(workerId)
        .then(res => {
          if (isMounted && res.data?.status === 'success' && res.data?.data) {
            setWorkerData(prev => ({
              ...prev,
              ...res.data.data,
              // retain distance and eta calculated on client if not in API response
              dist: prev.dist || `${res.data.data.distanceKm || '2.5'} km`,
              eta: prev.eta || 15
            }));
          }
        })
        .catch(err => {
          console.log('[WorkerProfile] Fetch error:', err?.message);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [workerId]);

  const w = workerData;

  // Extract structured dynamic services
  const servicesList = (w.services || [])
    .filter(s => s && s.isActive !== false)
    .map(s => {
      const catName = s.categoryName || s.category?.name || (typeof s === 'string' ? s : 'General Service');
      const catIcon = s.category?.icon || '⚡';
      const subs = Array.isArray(s.subcategories) ? s.subcategories : [];
      const basePrice = s.category?.basePrice || w.price || 299;
      const desc = s.category?.description || '';
      return { catName, catIcon, subs, basePrice, desc };
    });

  const primaryService = servicesList[0] || {
    catName: w.cat || 'Professional Services',
    catIcon: '🛠️',
    subs: ['General Maintenance', 'Inspection', 'Repairs'],
    basePrice: w.price || 299
  };

  const startingPrice = servicesList.length > 0 
    ? Math.min(...servicesList.map(s => s.basePrice || 299)) 
    : (w.price || 299);

  const ratingAvg = typeof w.rating === 'object' ? (w.rating?.average || 5.0) : (Number(w.rating) || 5.0);
  const ratingCount = typeof w.rating === 'object' ? (w.rating?.count || (w.jobs > 0 ? w.jobs : 0)) : (w.jobs || 0);
  const totalJobs = w.completedJobs !== undefined ? w.completedJobs : (w.jobs || 0);

  const reviewsList = Array.isArray(w.reviews) ? w.reviews : [];

  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* Top Gradient Header with Safe Camera Notch Area */}
      <LinearGradient
        colors={['#5535d4', '#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Dynamic ambient shapes */}
        <View style={styles.ambientCircle1} />
        <View style={styles.ambientCircle2} />

        {/* App Bar */}
        <SafeAreaView style={styles.safeAppBarArea}>
          <View style={styles.appBar}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.appBarTitle} numberOfLines={1}>
              Professional Profile
            </Text>

            <TouchableOpacity 
              onPress={toggleTheme} 
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>{isDarkMode ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Hero Card Overview */}
        <View style={styles.heroProfile}>
          <View style={styles.avatarWrapper}>
            {w.profileImage ? (
              <Image source={{ uri: w.profileImage }} style={styles.avatarImg} />
            ) : (
              <LinearGradient
                colors={['#8B6FFF', '#6C47FF']}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarInitial}>
                  {w.name ? w.name.trim().charAt(0).toUpperCase() : 'P'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
            </View>
          </View>

          <Text style={styles.workerName}>{w.name || 'Verified Professional'}</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.primaryCatBadge}>
              <Text style={styles.primaryCatBadgeText}>
                {primaryService.catIcon} {primaryService.catName}
              </Text>
            </View>

            {(w.verified !== false) && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={13} color="#10b981" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedBadgeText}>KYC Verified</Text>
              </View>
            )}
          </View>

          {w.city && (
            <View style={styles.cityRow}>
              <MapPin size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.cityText}>
                Based in {w.city} · Service Radius: {w.serviceRadius || 10} km
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Main Content Body */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.content}
      >
        {/* 4-Stat Metric Box */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrap}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
            </View>
            <Text style={styles.statValue}>
              {ratingAvg > 0 ? ratingAvg.toFixed(1) : '5.0'}
            </Text>
            <Text style={styles.statLabel}>
              {ratingCount > 0 ? `${ratingCount} reviews` : 'New Pro'}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(108,71,255,0.1)' }]}>
              <Briefcase size={16} color="#6C47FF" />
            </View>
            <Text style={styles.statValue}>{totalJobs}</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <MapPin size={16} color="#10b981" />
            </View>
            <Text style={styles.statValue}>{w.dist || '2.5 km'}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Clock size={16} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>~{w.eta || 15}m</Text>
            <Text style={styles.statLabel}>Est. Arrival</Text>
          </View>
        </View>

        {/* Specialized Services Offered Section (Crucial) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Wrench size={18} color="#6C47FF" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Services & Specializations</Text>
            </View>
            <Text style={styles.sectionSubtitleBadge}>
              {servicesList.length} {servicesList.length === 1 ? 'Service' : 'Services'}
            </Text>
          </View>

          {servicesList.length === 0 ? (
            <View style={styles.serviceItemCard}>
              <View style={styles.serviceItemTop}>
                <View style={styles.serviceIconCircle}>
                  <Text style={{ fontSize: 20 }}>🛠️</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.serviceItemName}>{w.cat || 'General Home Service'}</Text>
                  <Text style={styles.serviceItemRate}>Base fee ₹{startingPrice}</Text>
                </View>
              </View>
              <View style={styles.subPillsRow}>
                {['Inspection & Diagnostics', 'Quick Fix', 'General Maintenance'].map((sub, i) => (
                  <View key={i} style={styles.subPill}>
                    <CheckCircle2 size={12} color="#6C47FF" style={{ marginRight: 4 }} />
                    <Text style={styles.subPillText}>{sub}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            servicesList.map((srv, idx) => (
              <View key={idx} style={styles.serviceItemCard}>
                <View style={styles.serviceItemTop}>
                  <View style={styles.serviceIconCircle}>
                    <Text style={{ fontSize: 22 }}>{srv.catIcon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.serviceItemName}>{srv.catName}</Text>
                    <Text style={styles.serviceItemRate}>
                      Starting from <Text style={styles.serviceItemPrice}>₹{srv.basePrice}</Text>
                    </Text>
                  </View>
                </View>

                {srv.subs.length > 0 && (
                  <View style={styles.subPillsRow}>
                    {srv.subs.map((sub, sIdx) => (
                      <View key={sIdx} style={styles.subPill}>
                        <CheckCircle2 size={12} color="#6C47FF" style={{ marginRight: 4 }} />
                        <Text style={styles.subPillText}>{sub}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* About & Quality Guarantees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About {w.name ? w.name.split(' ')[0] : 'Professional'}
          </Text>
          
          <View style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              {w.bio && w.bio.trim().length > 0 
                ? w.bio 
                : `Verified and dedicated ${primaryService.catName} specialist with extensive hands-on experience. Fully trained, equipped with professional diagnostic tools, and dedicated to transparent pricing and customer satisfaction.`}
            </Text>

            <View style={styles.trustDivider} />

            <View style={styles.trustGrid}>
              <View style={styles.trustItem}>
                <Zap size={15} color="#10b981" />
                <Text style={styles.trustItemText}>Fast Response</Text>
              </View>
              <View style={styles.trustItem}>
                <Award size={15} color="#6C47FF" />
                <Text style={styles.trustItemText}>Quality Guarantee</Text>
              </View>
              <View style={styles.trustItem}>
                <ShieldCheck size={15} color="#2563eb" />
                <Text style={styles.trustItemText}>Identity Verified</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Verified Customer Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Customer Reviews</Text>
            {reviewsList.length > 0 && (
              <Text style={styles.reviewsCountText}>
                ★ {ratingAvg.toFixed(1)} ({reviewsList.length})
              </Text>
            )}
          </View>

          {reviewsList.length === 0 ? (
            <View style={styles.emptyReviewCard}>
              <Sparkles size={24} color="#6C47FF" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyReviewTitle}>Verified Professional</Text>
              <Text style={styles.emptyReviewSub}>
                Be among the first customers to book and review {w.name ? w.name.split(' ')[0] : 'this professional'}!
              </Text>
            </View>
          ) : (
            reviewsList.map((rev, rIdx) => (
              <View key={rev.id || rIdx} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}>
                    <Text style={styles.reviewerAvatarText}>
                      {rev.reviewerName ? rev.reviewerName.charAt(0).toUpperCase() : 'C'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.reviewerName}>{rev.reviewerName}</Text>
                    <View style={styles.ratingStarsRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={12} 
                          color={star <= rev.score ? '#f59e0b' : '#d1d5db'} 
                          fill={star <= rev.score ? '#f59e0b' : 'transparent'} 
                        />
                      ))}
                      <Text style={styles.reviewDate}>
                        {rev.date ? ` · ${new Date(rev.date).toLocaleDateString()}` : ''}
                      </Text>
                    </View>
                  </View>
                  {rev.service && (
                    <View style={styles.reviewServiceTag}>
                      <Text style={styles.reviewServiceTagText}>{rev.service}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reviewComment}>{rev.reviewText}</Text>
              </View>
            ))
          )}
        </View>

        {/* Extra Bottom Padding */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Bottom Booking Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomRateLabel}>Base Inspection Fee</Text>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPrice}>₹{startingPrice}</Text>
            <Text style={styles.bottomEtaPill}>⏱️ ~{w.eta || 15} mins</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.bookButton}
          activeOpacity={0.85}
          onPress={() => {
            navigation.navigate('DescribeJob', { 
              category: { name: primaryService.catName }, 
              subcategory: primaryService.subs[0] || 'Inspection & Repair',
              selectedWorker: {
                id: w._id || w.id,
                _id: w._id || w.id,
                name: w.name,
                profileImage: w.profileImage,
                phone: w.phone,
                cat: primaryService.catName,
                price: startingPrice
              }
            });
          }}
        >
          <LinearGradient
            colors={['#6C47FF', '#5535d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookButtonGradient}
          >
            <Text style={styles.bookButtonText}>Select Professional</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradientHeader: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientCircle1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ambientCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  safeAppBarArea: {
    paddingHorizontal: 16,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroProfile: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  workerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 6,
  },
  primaryCatBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  primaryCatBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  verifiedBadgeText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '800',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  cityText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    paddingTop: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
    backgroundColor: theme.colors.border,
  },
  section: {
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionSubtitleBadge: {
    fontSize: 12,
    color: '#6C47FF',
    fontWeight: '700',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  serviceItemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  serviceItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  serviceItemRate: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  serviceItemPrice: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 13,
  },
  subPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F3F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subPillText: {
    fontSize: 11,
    color: isDarkMode ? '#C4B5FD' : '#5B21B6',
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 8,
  },
  aboutText: {
    fontSize: 14,
    color: theme.colors.textDim,
    lineHeight: 22,
  },
  trustDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },
  trustGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  reviewsCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  emptyReviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  emptyReviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptyReviewSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerAvatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginLeft: 4,
  },
  reviewServiceTag: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewServiceTagText: {
    color: '#6C47FF',
    fontSize: 10,
    fontWeight: '700',
  },
  reviewComment: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 19,
    marginTop: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomPriceCol: {
    flex: 1,
    marginRight: 12,
  },
  bottomRateLabel: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  bottomPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  bottomEtaPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookButton: {
    flex: 1.2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default WorkerProfileScreen;
