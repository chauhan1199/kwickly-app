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
  Info,
  ChevronLeft
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';
import { jobService } from '../../services/jobService';
import { getCategoryIcon, getCategoryLocalImage } from '../../utils/categoryTheme';
import { getImageUrl } from '../../utils/helpers';
import { formatDistance, estimateEtaMinutes, getRealRating } from '../../utils/geo';
import { getCategoryStartingPrice } from '../../utils/fees';

const WorkerProfileScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { worker } = route.params || {};

  const [workerData, setWorkerData] = useState(worker || {});
  const [allCategories, setAllCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCatIndex, setSelectedCatIndex] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  const workerId = worker?.id || worker?._id;

  // If no worker data passed, go back (from an effect: navigating during render is unsafe)
  useEffect(() => {
    if (!worker) navigation.goBack();
  }, [worker, navigation]);

  // Fetch full live worker profile & reviews from backend
  useEffect(() => {
    let isMounted = true;
    if (workerId) {
      setIsLoading(true);
      Promise.allSettled([
        customerService.getWorkerProfile(workerId),
        jobService.getCategories()
      ])
        .then(([profileRes, catRes]) => {
          if (!isMounted) return;

          if (profileRes.status === 'fulfilled' && profileRes.value?.data?.status === 'success' && profileRes.value?.data?.data) {
            const data = profileRes.value.data.data;
            setWorkerData(prev => ({
              ...prev,
              ...data,
              // Only real values: keep what the list measured, else what the server measured, else unknown
              dist: prev.dist || (data.distanceKm ? formatDistance(Number(data.distanceKm)) : null),
              eta: prev.eta || estimateEtaMinutes(data.distanceKm ? Number(data.distanceKm) : null)
            }));
          }

          if (catRes.status === 'fulfilled' && catRes.value?.data?.status === 'success' && Array.isArray(catRes.value?.data?.data)) {
            setAllCategories(catRes.value.data.data);
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

  // Extract structured dynamic services with images
  const servicesList = (w.services || [])
    .filter(s => s && s.isActive !== false)
    .map(s => {
      const catName = s.categoryName || s.category?.name || (typeof s === 'string' ? s : 'General Service');
      const catIcon = getCategoryIcon(catName, s.category?.icon);
      
      // Match with loaded categories to get admin uploaded imageUrl
      const matchedCategory = allCategories.find(c => c.name?.toLowerCase() === catName.toLowerCase());
      const catImageUrl = s.category?.imageUrl || matchedCategory?.imageUrl || s.catImageUrl || null;
      
      const subs = Array.isArray(s.subcategories) ? s.subcategories : [];
      const subcategoriesWithData = subs.map(subName => {
        const catSubs = s.category?.subcategories || matchedCategory?.subcategories || [];
        const foundSub = catSubs.find(cs => cs.name?.toLowerCase() === subName?.toLowerCase());
        return {
          name: subName,
          imageUrl: foundSub?.imageUrl || null
        };
      });

      const basePrice = getCategoryStartingPrice(s.category) || getCategoryStartingPrice(matchedCategory) || w.price || null;
      const desc = s.category?.description || matchedCategory?.description || '';
      return { catName, catIcon, catImageUrl, subs, subcategoriesWithData, basePrice, desc };
    });

  const primaryService = servicesList[0] || {
    catName: w.cat || 'Professional Services',
    catIcon: getCategoryIcon(w.cat || 'General', '🛠️'),
    catImageUrl: null,
    subs: ['General Maintenance & Diagnostics'],
    subcategoriesWithData: [{ name: 'General Maintenance & Diagnostics', imageUrl: null }],
    basePrice: w.price || null
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

  // All hooks above run on every render; only now is it safe to bail out
  if (!worker) return null;

  const activeService = servicesList[selectedCatIndex] || servicesList[0] || primaryService;
  const activeSub = selectedSubcategory || activeService.subs[0] || 'General Inspection';
  const activePrice = activeService.basePrice || w.price || null;

  const knownPrices = servicesList.map(s => s.basePrice).filter(p => p > 0);
  const startingPrice = knownPrices.length > 0
    ? Math.min(...knownPrices)
    : (w.price || null);

  // Real rating only — 0 renders as "New"; review count never borrows the job count
  const ratingAvg = getRealRating(w.rating) || 0;
  const ratingCount = typeof w.rating === 'object' ? (Number(w.rating?.count) || 0) : 0;
  const totalJobs = w.completedJobs !== undefined ? w.completedJobs : (w.jobs || 0);

  const reviewsList = Array.isArray(w.reviews) ? w.reviews : [];

  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* ── Compact Hero Header (Matching SubCategoriesScreen) ── */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />

        {/* Back navigation button row */}
        <View style={styles.heroTopBar}>
          <TouchableOpacity 
            style={styles.heroBackBtn} 
            onPress={() => navigation.goBack()} 
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Content row: Left details, Right framed worker photo */}
        <View style={styles.heroContentRow}>
          <View style={styles.heroTextCol}>
            <View style={styles.nameRow}>
              <Text style={styles.heroTitle} numberOfLines={1}>{w.name || 'Professional'}</Text>
              {(w.verified !== false) && (
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={11} color="#10b981" style={{ marginRight: 3 }} />
                  <Text style={styles.verifiedBadgeText}>KYC</Text>
                </View>
              )}
            </View>

            <View style={styles.primaryCatBadge}>
              <Text style={styles.primaryCatBadgeText} numberOfLines={1}>
                {primaryService.catIcon} {primaryService.catName}
              </Text>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={styles.starPill}>
                <Star size={11} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.starText}>{ratingAvg > 0 ? ratingAvg.toFixed(1) : 'New'}</Text>
              </View>
              <Text style={styles.dotDivider}>·</Text>
              <Text style={styles.heroMetaText}>{totalJobs} jobs done</Text>
              {w.dist ? (
                <>
                  <Text style={styles.dotDivider}>·</Text>
                  <Text style={styles.heroMetaText}>📍 {w.dist}</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Right Framed Worker Image */}
          <View style={styles.heroImageCardWrapper}>
            {w.profileImage ? (
              <Image source={{ uri: w.profileImage }} style={styles.heroFramedImage} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#8B6FFF', '#6C47FF']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {w.name ? w.name.trim().charAt(0).toUpperCase() : 'P'}
                </Text>
              </LinearGradient>
            )}
            {w.isOnline ? (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
              </View>
            ) : null}
          </View>
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
              {ratingAvg > 0 ? ratingAvg.toFixed(1) : 'New'}
            </Text>
            <Text style={styles.statLabel}>
              {ratingCount > 0 ? `${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
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
            <Text style={styles.statValue}>{w.dist || '—'}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Clock size={16} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{w.eta ? `~${w.eta}m` : '—'}</Text>
            <Text style={styles.statLabel}>Est. Arrival</Text>
          </View>
        </View>

        {/* Specialized Services Offered Section (Dynamic Images & Interactive Selection) */}
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
                  <Text style={styles.serviceItemRate}>{startingPrice ? `Base fee ₹${startingPrice}` : 'Price on quote'}</Text>
                </View>
              </View>
            </View>
          ) : (
            servicesList.map((srv, idx) => {
              const isSelected = selectedCatIndex === idx;
              const resolvedCatImg = getImageUrl(srv.catImageUrl) || getCategoryLocalImage(srv.catName);

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
                    {resolvedCatImg ? (
                      <View style={styles.serviceCatImageWrapper}>
                        <Image 
                          source={typeof resolvedCatImg === 'string' ? { uri: resolvedCatImg } : resolvedCatImg} 
                          style={styles.serviceCatImage} 
                          resizeMode="cover" 
                        />
                      </View>
                    ) : (
                      <View style={[styles.serviceIconCircle, isSelected && styles.serviceIconCircleActive]}>
                        <Text style={{ fontSize: 22 }}>{srv.catIcon}</Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={[styles.serviceItemName, isSelected && styles.serviceItemNameActive]} numberOfLines={1}>
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
                      {srv.basePrice ? (
                        <Text style={styles.serviceItemRate}>
                          Starting from <Text style={styles.serviceItemPrice}>₹{srv.basePrice}</Text>
                        </Text>
                      ) : (
                        <Text style={styles.serviceItemRate}>Price on quote</Text>
                      )}
                    </View>
                  </View>

                  {/* Subcategories with dynamic images */}
                  {srv.subs.length > 0 && (
                    <View style={styles.subPillsRow}>
                      {srv.subs.map((sub, sIdx) => {
                        const isSubActive = isSelected && selectedSubcategory === sub;
                        const subData = (srv.subcategoriesWithData || []).find(s => s.name?.toLowerCase() === sub?.toLowerCase());
                        const subImgUrl = getImageUrl(subData?.imageUrl) || getCategoryLocalImage(sub);

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
                            {subImgUrl ? (
                              <Image 
                                source={typeof subImgUrl === 'string' ? { uri: subImgUrl } : subImgUrl} 
                                style={styles.subChipThumb} 
                                resizeMode="cover" 
                              />
                            ) : (
                              <CheckCircle2 size={12} color={isSubActive ? '#fff' : '#6C47FF'} style={{ marginRight: 4 }} />
                            )}
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
                {ratingAvg > 0 ? `★ ${ratingAvg.toFixed(1)} (${ratingCount || reviewsList.length})` : `${reviewsList.length} ${reviewsList.length === 1 ? 'review' : 'reviews'}`}
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
        <View style={styles.bottomBarInner}>
          <View style={styles.bottomPriceCol}>
            <Text style={styles.bottomRateLabel} numberOfLines={1}>
              {activeService.catName}
            </Text>
            <View style={styles.bottomPriceRow}>
              <Text style={styles.bottomPrice}>{activePrice ? `₹${activePrice}` : 'Get quotes'}</Text>
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
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 32,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroTextCol: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    lineHeight: 26,
    flexShrink: 1,
  },
  primaryCatBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  primaryCatBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  starText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  dotDivider: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  heroMetaText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  verifiedBadgeText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  heroImageCardWrapper: {
    width: 84,
    height: 84,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  heroFramedImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    flex: 1,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.colors.text,
    flexShrink: 1,
  },
  sectionSubtitleBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
    flexShrink: 0,
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
  serviceCatImageWrapper: {
    width: 50,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(108,71,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.15)',
  },
  serviceCatImage: {
    width: '100%',
    height: '100%',
  },
  serviceIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subPillActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  subChipThumb: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginRight: 6,
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
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 720,
    gap: 8,
  },
  bottomPriceCol: {
    flex: 1,
    minWidth: 80,
    marginRight: 6,
  },
  bottomRateLabel: {
    fontSize: 10,
    color: theme.colors.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    flexWrap: 'nowrap',
  },
  bottomPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  selectedSubBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    flexShrink: 1,
  },
  bottomSubPill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6C47FF',
  },
  bookButton: {
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  bookButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  }
});

export default WorkerProfileScreen;
