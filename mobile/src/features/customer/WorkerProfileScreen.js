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
  Award,
  Zap,
  Info
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';
import { getCategoryIcon } from '../../utils/categoryTheme';

const { width } = Dimensions.get('window');

const WorkerProfileScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { worker } = route.params || {};

  // If no worker data passed, go back
  if (!worker) {
    navigation.goBack();
    return null;
  }

  const [workerData, setWorkerData] = useState(worker);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCatIndex, setSelectedCatIndex] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

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

  // Extract structured dynamic services added by worker
  const servicesList = (w.services || [])
    .filter(s => s && s.isActive !== false)
    .map(s => {
      const catName = s.categoryName || s.category?.name || (typeof s === 'string' ? s : 'General Service');
      const catIcon = getCategoryIcon(catName, s.category?.icon);
      const subs = Array.isArray(s.subcategories) ? s.subcategories : [];
      const basePrice = s.category?.basePrice || w.price || 199;
      const desc = s.category?.description || '';
      return { catName, catIcon, subs, basePrice, desc };
    });

  const primaryService = servicesList[0] || {
    catName: w.cat || 'Professional Services',
    catIcon: getCategoryIcon(w.cat || 'General', '🛠️'),
    subs: ['General Maintenance & Diagnostics'],
    basePrice: w.price || 199
  };

  // Sync route params with selection or fallback to first
  useEffect(() => {
    if (servicesList.length > 0) {
      if (route.params?.category?.name) {
        const idx = servicesList.findIndex(
          s => s.catName?.toLowerCase() === route.params.category.name.toLowerCase()
        );
        if (idx >= 0) {
          setSelectedCatIndex(idx);
          setSelectedSubcategory(route.params?.subcategory || servicesList[idx].subs[0] || 'General Service');
          return;
        }
      }
      if (!selectedSubcategory) {
        setSelectedSubcategory(servicesList[0]?.subs[0] || 'General Service');
      }
    }
  }, [servicesList.length, route.params]);

  const activeService = servicesList[selectedCatIndex] || servicesList[0] || primaryService;
  const activeSub = selectedSubcategory || activeService.subs[0] || 'General Inspection';
  const activePrice = activeService.basePrice || w.price || 199;

  const startingPrice = servicesList.length > 0 
    ? Math.min(...servicesList.map(s => s.basePrice || 199)) 
    : (w.price || 199);

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

            <View style={{ width: 40 }} />
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

          {w.city ? (
            <View style={styles.cityRow}>
              <MapPin size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.cityText}>
                Based in {w.city} {w.serviceRadius ? `· Service Radius: ${w.serviceRadius} km` : ''}
              </Text>
            </View>
          ) : null}
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
              {ratingCount > 0 ? `${ratingCount} reviews` : 'Top Rated'}
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
            <Text style={styles.statValue}>{w.dist || 'Nearby'}</Text>
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

        {/* Specialized Services Offered Section (Interactive Selection) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Wrench size={18} color="#6C47FF" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Services & Specializations</Text>
            </View>
            <Text style={styles.sectionSubtitleBadge}>
              Tap to select
            </Text>
          </View>

          {servicesList.length === 0 ? (
            <View style={styles.serviceItemCard}>
              <View style={styles.serviceItemTop}>
                <View style={styles.serviceIconCircle}>
                  <Text style={{ fontSize: 20 }}>🛠️</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.serviceItemName}>{w.cat || 'General Service'}</Text>
                  <Text style={styles.serviceItemRate}>Base fee ₹{startingPrice}</Text>
                </View>
              </View>
            </View>
          ) : (
            servicesList.map((srv, idx) => {
              const isSelected = selectedCatIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.88}
                  onPress={() => {
                    setSelectedCatIndex(idx);
                    setSelectedSubcategory(srv.subs[0] || 'General Service');
                  }}
                  style={[
                    styles.serviceItemCard,
                    isSelected && styles.serviceItemCardActive
                  ]}
                >
                  <View style={styles.serviceItemTop}>
                    <View style={[styles.serviceIconCircle, isSelected && styles.serviceIconCircleActive]}>
                      <Text style={{ fontSize: 22 }}>{srv.catIcon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={[styles.serviceItemName, isSelected && styles.serviceItemNameActive]}>
                          {srv.catName}
                        </Text>
                        {isSelected ? (
                          <View style={styles.activeCheckBadge}>
                            <CheckCircle2 size={18} color="#6C47FF" />
                          </View>
                        ) : (
                          <Text style={styles.tapToSelectText}>Tap to select</Text>
                        )}
                      </View>
                      <Text style={styles.serviceItemRate}>
                        Starting from <Text style={styles.serviceItemPrice}>₹{srv.basePrice}</Text>
                      </Text>
                    </View>
                  </View>

                  {srv.subs.length > 0 && (
                    <View style={styles.subPillsRow}>
                      {srv.subs.map((sub, sIdx) => {
                        const isSubActive = isSelected && selectedSubcategory === sub;
                        return (
                          <TouchableOpacity
                            key={sIdx}
                            activeOpacity={0.75}
                            onPress={() => {
                              setSelectedCatIndex(idx);
                              setSelectedSubcategory(sub);
                            }}
                            style={[styles.subPill, isSubActive && styles.subPillActive]}
                          >
                            <CheckCircle2 size={12} color={isSubActive ? '#fff' : '#6C47FF'} style={{ marginRight: 4 }} />
                            <Text style={[styles.subPillText, isSubActive && styles.subPillTextActive]}>{sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* About & Verified Qualifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About {w.name ? w.name.split(' ')[0] : 'Professional'}
          </Text>
          
          <View style={styles.aboutCard}>
            {w.bio && w.bio.trim().length > 0 ? (
              <Text style={styles.aboutText}>{w.bio.trim()}</Text>
            ) : (
              <View style={styles.noBioBox}>
                <Info size={16} color={theme.colors.textDim} style={{ marginRight: 6 }} />
                <Text style={styles.noBioText}>
                  This verified professional has not added a personal bio description yet.
                </Text>
              </View>
            )}

            {/* Real verified attributes */}
            <View style={styles.trustDivider} />

            <View style={styles.trustGrid}>
              {w.verified !== false && (
                <View style={styles.trustItem}>
                  <ShieldCheck size={14} color="#10B981" />
                  <Text style={styles.trustItemText}>KYC Verified</Text>
                </View>
              )}
              {w.city ? (
                <View style={styles.trustItem}>
                  <MapPin size={14} color="#6C47FF" />
                  <Text style={styles.trustItemText}>In {w.city}</Text>
                </View>
              ) : null}
              {w.serviceRadius ? (
                <View style={styles.trustItem}>
                  <Zap size={14} color="#F59E0B" />
                  <Text style={styles.trustItemText}>{w.serviceRadius} km Radius</Text>
                </View>
              ) : null}
              {w.createdAt ? (
                <View style={styles.trustItem}>
                  <Award size={14} color="#2563EB" />
                  <Text style={styles.trustItemText}>
                    Joined {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ) : null}
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
              <Text style={styles.emptyReviewTitle}>No Customer Reviews Yet</Text>
              <Text style={styles.emptyReviewSub}>
                Be among the first customers to book {w.name ? w.name.split(' ')[0] : 'this professional'} and leave a review!
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
                {rev.reviewText ? (
                  <Text style={styles.reviewComment}>{rev.reviewText}</Text>
                ) : (
                  <Text style={[styles.reviewComment, { fontStyle: 'italic', color: theme.colors.textDim }]}>
                    Customer rated {rev.score} stars
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Bottom Booking Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomRateLabel} numberOfLines={1}>
            {activeService.catName}
          </Text>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPrice}>₹{activePrice}</Text>
            <View style={styles.selectedSubBadge}>
              <Text style={styles.bottomSubPill} numberOfLines={1}>
                {activeSub}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.bookButton}
          activeOpacity={0.85}
          onPress={() => {
            navigation.navigate('DescribeJob', { 
              category: { name: activeService.catName }, 
              subcategory: activeSub,
              selectedWorker: {
                id: w._id || w.id,
                _id: w._id || w.id,
                name: w.name,
                profileImage: w.profileImage,
                phone: w.phone,
                cat: activeService.catName,
                price: activePrice,
                rating: w.rating,
                jobs: totalJobs,
                verified: w.verified
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
            <Text style={styles.bookButtonText}>Select Professional →</Text>
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
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientCircle1: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ambientCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  safeAppBarArea: {
    zIndex: 10,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroProfile: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
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
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    fontWeight: '700',
    color: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  serviceItemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  serviceItemCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F7F5FF',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
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
  serviceIconCircleActive: {
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  serviceItemNameActive: {
    color: '#6C47FF',
  },
  activeCheckBadge: {
    marginLeft: 6,
  },
  tapToSelectText: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '600',
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subPillActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  subPillText: {
    fontSize: 11,
    color: isDarkMode ? '#C4B5FD' : '#5B21B6',
    fontWeight: '600',
  },
  subPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
    color: theme.colors.text,
    lineHeight: 22,
  },
  noBioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  noBioText: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontStyle: 'italic',
    flex: 1,
  },
  trustDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  selectedSubBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 1,
  },
  bottomSubPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
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
    fontSize: 14,
    fontWeight: '800',
  }
});

export default WorkerProfileScreen;
