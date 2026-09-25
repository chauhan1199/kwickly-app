import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  Platform,
  Image,
  RefreshControl,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { 
  Search, 
  Star, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Briefcase, 
  CheckCircle2, 
  ChevronRight, 
  SlidersHorizontal,
  Wrench,
  Sparkles,
  Zap,
  X
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import { customerService } from '../../services/customerService';
import AppBar from '../../components/AppBar';
import BannerCarousel from '../../components/ui/BannerCarousel';
import GlassCard from '../../components/ui/GlassCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { getCategoryIcon, getCategoryLocalImage } from '../../utils/categoryTheme';
import { getImageUrl } from '../../utils/helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

// Haversine formula to calculate accurate distance between two coordinates in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CategoryGridCard = React.memo(({ cat, index, onPress, styles }) => {
  const catName = cat.name || cat.label || 'Service';
  const resolvedNetworkImg = getImageUrl(cat.imageUrl);
  const localImg = getCategoryLocalImage(catName);
  const displayIcon = getCategoryIcon(catName, cat.icon);
  const [imgError, setImgError] = useState(false);

  // Uploaded admin/worker image strictly takes precedence over local stock illustration
  const cardImg = (!imgError && resolvedNetworkImg) ? { uri: resolvedNetworkImg } : localImg;

  return (
    <TouchableOpacity
      key={cat.id || cat._id || index}
      style={styles.categoryCard}
      activeOpacity={0.8}
      onPress={() => onPress(cat, displayIcon)}
    >
      <View style={styles.categoryIconCircle}>
        {cardImg ? (
          <Image
            source={cardImg}
            style={styles.categoryCardImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Text style={styles.categoryIconText}>{displayIcon}</Text>
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={2}>
        {catName}
      </Text>
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>
          {cat.subs?.length || 1} {cat.subs?.length === 1 ? 'Service' : 'Services'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const BookServiceScreen = ({ navigation, route }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const statusBarH = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 0;
  const safeTop = Math.max(insets.top, statusBarH, Platform.OS === 'android' ? 36 : 20);
  const bannerWidth = Math.min(windowWidth - 28, 680);

  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [error, setError] = useState(null);

  // Pro booking modal state
  const [bookingWorker, setBookingWorker] = useState(null);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  const handleBookNowPress = (worker) => {
    const services = worker.services && worker.services.length > 0
      ? worker.services
      : [{ catName: worker.cat, catIcon: worker.catIcon || '🛠️', subs: worker.subcategories || [], basePrice: worker.price || 199 }];

    if (services.length > 1 || (services[0]?.subs && services[0].subs.length > 1)) {
      setBookingWorker(worker);
      setSelectedServiceIndex(0);
      setSelectedSubcategory(services[0]?.subs?.[0] || 'General Service');
    } else {
      navigation.navigate('DescribeJob', {
        category: { name: services[0]?.catName || worker.cat },
        subcategory: services[0]?.subs?.[0] || 'General Service',
        selectedWorker: worker
      });
    }
  };

  const handleConfirmWorkerBooking = () => {
    if (!bookingWorker) return;
    const services = bookingWorker.services && bookingWorker.services.length > 0
      ? bookingWorker.services
      : [{ catName: bookingWorker.cat, catIcon: bookingWorker.catIcon || '🛠️', subs: bookingWorker.subcategories || [], basePrice: bookingWorker.price || 199 }];

    const chosenService = services[selectedServiceIndex] || services[0];
    const chosenSub = selectedSubcategory || chosenService?.subs?.[0] || 'General Service';
    const workerToBook = {
      ...bookingWorker,
      cat: chosenService.catName,
      price: chosenService.basePrice || bookingWorker.price
    };
    setBookingWorker(null);
    navigation.navigate('DescribeJob', {
      category: { name: chosenService.catName },
      subcategory: chosenSub,
      selectedWorker: workerToBook
    });
  };

  // Determine customer's active location coordinates
  const customerCoords = useMemo(() => {
    if (route.params?.location?.latitude && route.params?.location?.longitude) {
      return {
        lat: route.params.location.latitude,
        lng: route.params.location.longitude
      };
    }
    const primaryAddr = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
    if (primaryAddr?.location?.coordinates?.length === 2) {
      return {
        lat: primaryAddr.location.coordinates[1],
        lng: primaryAddr.location.coordinates[0]
      };
    }
    if (user?.activeLocation?.coordinates?.length === 2) {
      return {
        lat: user.activeLocation.coordinates[1],
        lng: user.activeLocation.coordinates[0]
      };
    }
    // Default fallback coordinates (Ahmedabad city center)
    return { lat: 23.0225, lng: 72.5714 };
  }, [route.params?.location, user]);

  // Load cached categories immediately on launch
  useEffect(() => {
    AsyncStorage.getItem('kwickly_cache_categories')
      .then(catJson => {
        if (catJson) {
          try {
            const parsed = JSON.parse(catJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCategories(parsed);
              setIsLoading(false);
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      const [catRes, workerRes, bannerRes] = await Promise.allSettled([
        jobService.getCategories(forceRefresh ? { refresh: 'true' } : {}),
        customerService.getTopPros(),
        api.get('/promotions/banners')
      ]);

      if (catRes.status === 'fulfilled' && catRes.value?.data?.status === 'success') {
        const mappedCats = catRes.value.data.data.map(c => ({
          id: c._id,
          _id: c._id,
          icon: getCategoryIcon(c.name, c.icon),
          name: c.name,
          label: c.name,
          imageUrl: c.imageUrl || null,
          basePrice: c.basePrice || 199,
          subs: (c.subcategories || []).map(s => ({
            id: s._id,
            name: s.name,
            imageUrl: s.imageUrl || null
          }))
        }));
        setCategories(mappedCats);
        AsyncStorage.setItem('kwickly_cache_categories', JSON.stringify(mappedCats)).catch(() => {});
      }

      if (bannerRes.status === 'fulfilled' && bannerRes.value?.data?.status === 'success') {
        setBanners(bannerRes.value.data.data.filter(b => b.position === 'CATEGORY_PAGE'));
      }

      if (workerRes.status === 'fulfilled' && workerRes.value?.data?.status === 'success') {
        const mappedWorkers = workerRes.value.data.data.map(w => {
          const wLat = w.activeLocation?.coordinates?.[1] || customerCoords.lat + (Math.random() * 0.04 - 0.02);
          const wLon = w.activeLocation?.coordinates?.[0] || customerCoords.lng + (Math.random() * 0.04 - 0.02);
          
          let distKm = calculateDistance(customerCoords.lat, customerCoords.lng, wLat, wLon);
          if (distKm === null || isNaN(distKm)) distKm = 1.8;
          
          // Clamp realistic urban distance & ETA
          const formattedDist = distKm < 1 ? `${(distKm * 1000).toFixed(0)} m` : `${distKm.toFixed(1)} km`;
          const etaMins = Math.max(5, Math.min(60, Math.round(distKm * 4.5)));

          // Extract all structured services
          const servicesList = (w.services || [])
            .filter(s => s && s.isActive !== false)
            .map(s => {
              const catName = s.categoryName || s.category?.name || (typeof s === 'string' ? s : 'General');
              const catIcon = getCategoryIcon(catName, s.category?.icon);
              const catImageUrl = s.category?.imageUrl || s.categoryImageUrl || null;
              const subs = Array.isArray(s.subcategories) ? s.subcategories : [];
              const basePrice = s.category?.basePrice || 199;
              return { catName, catIcon, catImageUrl, category: s.category, subs, basePrice };
            });

          const primaryCategory = servicesList[0]?.catName || 'General Expert';
          const primaryIcon = servicesList[0]?.catIcon || getCategoryIcon(primaryCategory, '🛠️');
          const primaryImageUrl = servicesList[0]?.catImageUrl || null;
          const allSubs = servicesList.flatMap(s => s.subs);
          const startingPrice = servicesList.length > 0
            ? Math.min(...servicesList.map(s => s.basePrice))
            : (w.price || 199);

          const ratingAvg = typeof w.rating === 'object' ? (w.rating?.average || 5.0) : (Number(w.rating) || 5.0);
          const ratingCount = typeof w.rating === 'object' ? (w.rating?.count || 0) : 0;
          const totalJobs = w.completedJobs !== undefined ? w.completedJobs : (w.jobs || 0);

          return {
            ...w,
            id: w._id || w.id,
            _id: w._id || w.id,
            name: w.name || 'Verified Professional',
            profileImage: w.profileImage || null,
            phone: w.phone,
            rating: { average: ratingAvg, count: ratingCount },
            jobs: totalJobs,
            price: startingPrice,
            eta: etaMins,
            verified: w.kyc?.status === 'APPROVED' || w.isVerified !== false,
            dist: formattedDist,
            distNumeric: distKm,
            cat: primaryCategory,
            catIcon: primaryIcon,
            catImageUrl: primaryImageUrl,
            services: servicesList,
            subcategories: allSubs,
            bio: w.bio,
            city: w.city
          };
        });

        // Sort nearest pros first
        mappedWorkers.sort((a, b) => (a.distNumeric || 0) - (b.distNumeric || 0));
        setWorkers(mappedWorkers);
      }

      if (catRes.status !== 'fulfilled') {
        setCategories(prev => {
          if (prev.length === 0) setError('Unable to load services right now. Pull down to retry.');
          return prev;
        });
      }
    } catch (e) {
      console.log('[BookServiceScreen] Fetch error:', e?.message);
      setCategories(prev => {
        if (prev.length === 0) setError('Unable to load services right now. Pull down to retry.');
        return prev;
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [customerCoords.lat, customerCoords.lng]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Filter workers based on search query and category filter
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL') {
        const matchesCategory = (w.services || []).some(s => 
          s.catName.toLowerCase().includes(selectedCategoryFilter.toLowerCase())
        ) || w.cat.toLowerCase().includes(selectedCategoryFilter.toLowerCase());
        
        if (!matchesCategory) return false;
      }

      // Search query
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesCat = w.cat.toLowerCase().includes(query);
        const matchesService = (w.services || []).some(s => 
          s.catName.toLowerCase().includes(query) ||
          s.subs.some(sub => sub.toLowerCase().includes(query))
        );
        return matchesName || matchesCat || matchesService;
      }

      return true;
    });
  }, [workers, selectedCategoryFilter, searchQuery]);

  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* Unified Purple Gradient App Header */}
      <LinearGradient
        colors={['#5535d4', '#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientHeader, { paddingTop: safeTop }]}
      >
        <View style={styles.ambientShape1} />
        <View style={styles.ambientShape2} />

        <AppBar title="Book a Service" transparent={true} showBack={false} showLogo={false} />
      </LinearGradient>

      {/* Floating Search Bar */}
      <View style={styles.searchBarWrapper}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search electricians, plumbers, AC repair..."
          theme={theme}
          onFilterPress={() => {}}
        />
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: 60 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C47FF']} />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={onRefresh}
              style={{ marginTop: 8, backgroundColor: '#6C47FF', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Promotional Banners */}
        {banners.length > 0 && (
          <View style={{ height: 135, marginBottom: 18, alignItems: 'center', overflow: 'hidden' }}>
            <BannerCarousel 
              banners={banners} 
              itemWidth={bannerWidth} 
              itemHeight={135}
              style={{ height: 135 }}
              autoPlayInterval={4000}
              contentContainerStyle={{ paddingHorizontal: 14 }}
            />
          </View>
        )}

        {/* Service Categories Grid Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Explore Service Categories</Text>
            <Text style={styles.sectionSubtitle}>Verified doorstep professionals & instant booking</Text>
          </View>
        </View>

        {/* Dynamic Service Categories Grid */}
        <View style={styles.categoryGrid}>
          {isLoading && categories.length === 0 ? (
            <ActivityIndicator size="small" color="#6C47FF" style={{ marginVertical: 20, width: '100%' }} />
          ) : categories.length === 0 ? (
            <Text style={styles.emptyText}>No categories found.</Text>
          ) : (
            categories
              .filter(cat => !searchQuery || (cat.label || cat.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((cat, index) => (
                <CategoryGridCard
                  key={cat.id || cat._id || index}
                  cat={cat}
                  index={index}
                  onPress={(selectedCat, displayIcon) => navigation.navigate('SubCategories', { ...selectedCat, icon: displayIcon })}
                  styles={styles}
                />
              ))
          )}
        </View>

        {/* Dynamic Category Filter Pills */}
        <View style={styles.filterSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedCategoryFilter === 'ALL' && styles.filterPillActive
              ]}
              onPress={() => setSelectedCategoryFilter('ALL')}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.filterPillText,
                selectedCategoryFilter === 'ALL' && styles.filterPillTextActive
              ]}>
                🔥 All Pros ({workers.length})
              </Text>
            </TouchableOpacity>

            {categories.map(c => {
              const count = workers.filter(w => 
                (w.services || []).some(s => s.catName.toLowerCase().includes(c.name.toLowerCase())) ||
                w.cat.toLowerCase().includes(c.name.toLowerCase())
              ).length;

              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.filterPill,
                    selectedCategoryFilter === c.name && styles.filterPillActive
                  ]}
                  onPress={() => setSelectedCategoryFilter(selectedCategoryFilter === c.name ? 'ALL' : c.name)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.filterPillText,
                    selectedCategoryFilter === c.name && styles.filterPillTextActive
                  ]}>
                    {c.icon} {c.name} {count > 0 ? `(${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Section Header: Top Pros Near You */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View>
            <Text style={styles.sectionTitle}>Top Verified Pros Near You</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredWorkers.length} {filteredWorkers.length === 1 ? 'expert available' : 'experts available'} around your location
            </Text>
          </View>
        </View>

        {/* Pros List */}
        <View style={styles.workersList}>
          {isLoading && workers.length === 0 ? (
            <ActivityIndicator size="large" color="#6C47FF" style={{ marginVertical: 30 }} />
          ) : filteredWorkers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Sparkles size={32} color="#6C47FF" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No professionals found</Text>
              <Text style={styles.emptySub}>
                Try selecting "All Pros" or searching for another service category.
              </Text>
            </View>
          ) : (
            filteredWorkers.map((worker) => (
              <TouchableOpacity
                key={worker.id} 
                style={styles.proCard}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('WorkerProfile', { worker })}
              >
                {/* Top Row: Avatar, Name, KYC, and Price */}
                <View style={styles.proCardHeader}>
                  <View style={styles.proAvatarWrapper}>
                    {worker.profileImage ? (
                      <Image source={{ uri: worker.profileImage }} style={styles.proAvatarImg} />
                    ) : (
                      <LinearGradient
                        colors={['#8B6FFF', '#6C47FF']}
                        style={styles.proAvatarPlaceholder}
                      >
                        <Text style={styles.proAvatarText}>
                          {worker.name ? worker.name.trim().charAt(0).toUpperCase() : 'P'}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.onlineDotBorder}>
                      <View style={styles.onlineDotInner} />
                    </View>
                  </View>

                  <View style={styles.proInfoCol}>
                    <View style={styles.proNameRow}>
                      <Text style={styles.proName} numberOfLines={1}>
                        {worker.name}
                      </Text>
                      {worker.verified && (
                        <View style={styles.kycBadge}>
                          <ShieldCheck size={11} color="#10b981" style={{ marginRight: 3 }} />
                          <Text style={styles.kycBadgeText}>KYC</Text>
                        </View>
                      )}
                    </View>

                    {/* Rating & Jobs Done */}
                    <View style={styles.ratingJobsRow}>
                      <View style={styles.starPill}>
                        <Star size={11} color="#f59e0b" fill="#f59e0b" />
                        <Text style={styles.starText}>
                          {worker.rating?.average > 0 ? worker.rating.average.toFixed(1) : '5.0'}
                        </Text>
                      </View>
                      <Text style={styles.dotDivider}>·</Text>
                      <Text style={styles.jobsDoneText}>
                        {worker.jobs} {worker.jobs === 1 ? 'job done' : 'jobs done'}
                      </Text>
                      <Text style={styles.dotDivider}>·</Text>
                      <Text style={styles.distanceText}>📍 {worker.dist}</Text>
                    </View>
                  </View>

                  <View style={styles.proPriceCol}>
                    <Text style={styles.priceLabel}>From</Text>
                    <Text style={styles.priceValue}>₹{worker.price}</Text>
                  </View>
                </View>

                {/* Middle Row: Specialized Services Badges (Crucial) */}
                <View style={styles.servicesPillsContainer}>
                  {(worker.services && worker.services.length > 0) ? (
                    worker.services.slice(0, 3).map((srv, sIdx) => (
                      <View key={sIdx} style={styles.serviceBadge}>
                        <Text style={styles.serviceBadgeText}>
                          {srv.catIcon} {srv.catName}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.serviceBadge}>
                      <Text style={styles.serviceBadgeText}>
                        {worker.catIcon} {worker.cat}
                      </Text>
                    </View>
                  )}

                  {worker.subcategories && worker.subcategories.length > 0 && (
                    <View style={styles.subSkillBadge}>
                      <Text style={styles.subSkillBadgeText} numberOfLines={1}>
                        ⚡ {worker.subcategories.slice(0, 2).join(' · ')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bottom Action Footer */}
                <View style={styles.proCardFooter}>
                  <View style={styles.etaContainer}>
                    <Clock size={13} color="#10b981" />
                    <Text style={styles.etaText}>Arrives in ~{worker.eta} mins</Text>
                  </View>

                  <View style={styles.actionBtnGroup}>
                    <TouchableOpacity
                      style={styles.viewProfileBtn}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('WorkerProfile', { worker })}
                    >
                      <Text style={styles.viewProfileBtnText}>View Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.bookNowBtn}
                      activeOpacity={0.85}
                      onPress={() => handleBookNowPress(worker)}
                    >
                      <LinearGradient
                        colors={['#6C47FF', '#5535d4']}
                        style={styles.bookNowBtnGradient}
                      >
                        <Text style={styles.bookNowBtnText}>Book Now</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Booking Pro Service Selection Modal ── */}
      <Modal
        visible={!!bookingWorker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBookingWorker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalWorkerInfo}>
                {bookingWorker?.profileImage ? (
                  <Image source={{ uri: bookingWorker.profileImage }} style={styles.modalAvatar} />
                ) : (
                  <View style={styles.modalAvatarPlaceholder}>
                    <Text style={styles.modalAvatarText}>
                      {bookingWorker?.name ? bookingWorker.name.trim().charAt(0).toUpperCase() : 'P'}
                    </Text>
                  </View>
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.modalWorkerName} numberOfLines={1}>{bookingWorker?.name}</Text>
                  <Text style={styles.modalSubTitle}>Select service & problem type</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setBookingWorker(null)} style={styles.modalCloseBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Step 1: Select Category */}
              <Text style={styles.modalSectionLabel}>1. SELECT SERVICE CATEGORY</Text>
              <View style={styles.modalCategoriesWrap}>
                {(bookingWorker?.services && bookingWorker.services.length > 0
                  ? bookingWorker.services
                  : [{ catName: bookingWorker?.cat, catIcon: bookingWorker?.catIcon, subs: bookingWorker?.subcategories, basePrice: bookingWorker?.price }]
                ).map((srv, idx) => {
                  const isCatSelected = selectedServiceIndex === idx;
                  const matchedCat = categories.find(c => c.name?.toLowerCase() === srv.catName?.toLowerCase());
                  const srvNetImg = getImageUrl(srv.catImageUrl || matchedCat?.imageUrl);
                  const srvLocalImg = getCategoryLocalImage(srv.catName);
                  const srvImg = srvNetImg ? { uri: srvNetImg } : srvLocalImg;
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedServiceIndex(idx);
                        setSelectedSubcategory(srv.subs?.[0] || 'General Service');
                      }}
                      style={[styles.modalCatCard, isCatSelected && styles.modalCatCardActive]}
                    >
                      <View style={[styles.modalCatIconCircle, isCatSelected && styles.modalCatIconCircleActive, { overflow: 'hidden' }]}>
                        {srvImg ? (
                          <Image source={srvImg} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 18 }}>{srv.catIcon || '⚡'}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.modalCatName, isCatSelected && styles.modalCatNameActive]} numberOfLines={1}>
                          {srv.catName}
                        </Text>
                        <Text style={styles.modalCatPrice}>Starting from ₹{srv.basePrice || 199}</Text>
                      </View>
                      {isCatSelected && <CheckCircle2 size={18} color="#6C47FF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Step 2: Select Subcategory */}
              <Text style={styles.modalSectionLabel}>2. SELECT SUBCATEGORY / PROBLEM</Text>
              <View style={styles.modalSubsWrap}>
                {(() => {
                  const currentSrv = (bookingWorker?.services || [])[selectedServiceIndex] || { subs: bookingWorker?.subcategories || [] };
                  const subList = (currentSrv.subs && currentSrv.subs.length > 0)
                    ? currentSrv.subs
                    : ['General Inspection & Diagnostics', 'Routine Maintenance'];
                  const matchedCat = categories.find(c => c.name?.toLowerCase() === currentSrv.catName?.toLowerCase());

                  return subList.map((sub, sIdx) => {
                    const isSubSelected = selectedSubcategory === sub;
                    const matchedSub = (matchedCat?.subs || []).find(s => s.name?.toLowerCase() === sub?.toLowerCase());
                    const subImgUrl = getImageUrl(matchedSub?.imageUrl);
                    return (
                      <TouchableOpacity
                        key={sIdx}
                        activeOpacity={0.75}
                        onPress={() => setSelectedSubcategory(sub)}
                        style={[styles.modalSubChip, isSubSelected && styles.modalSubChipActive]}
                      >
                        {subImgUrl ? (
                          <Image source={{ uri: subImgUrl }} style={{ width: 16, height: 16, borderRadius: 4, marginRight: 6 }} resizeMode="cover" />
                        ) : (
                          <CheckCircle2 size={12} color={isSubSelected ? '#fff' : '#6C47FF'} style={{ marginRight: 5 }} />
                        )}
                        <Text style={[styles.modalSubChipText, isSubSelected && styles.modalSubChipTextActive]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            </ScrollView>

            {/* Modal Bottom Action */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalContinueBtn}
                activeOpacity={0.88}
                onPress={handleConfirmWorkerBooking}
              >
                <LinearGradient
                  colors={['#6C47FF', '#5535d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalContinueGradient}
                >
                  <Text style={styles.modalContinueText}>
                    Continue with {bookingWorker?.name ? bookingWorker.name.split(' ')[0] : 'Professional'} →
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradientHeader: {
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientShape1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ambientShape2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  safeHeaderArea: {
    paddingHorizontal: 4,
  },
  searchBarWrapper: {
    paddingHorizontal: 14,
    marginTop: -22,
    zIndex: 10,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  errorBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  errorText: {
    color: '#991B1B',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  categoryIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  categoryCardImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  categoryIconText: {
    fontSize: 22,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
  categoryBadge: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 14,
  },
  filterScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  workersList: {
    paddingHorizontal: 14,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textDim,
    marginVertical: 10,
    width: '100%',
  },
  proCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  proCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proAvatarWrapper: {
    position: 'relative',
  },
  proAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  proAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  onlineDotBorder: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  proInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  proNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kycBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
  },
  ratingJobsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  dotDivider: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  jobsDoneText: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  proPriceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#6C47FF',
  },
  servicesPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  serviceBadge: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.18)' : '#F3F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#C4B5FD' : '#5B21B6',
  },
  subSkillBadge: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: '50%',
  },
  subSkillBadgeText: {
    fontSize: 10,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  proCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  viewProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  bookNowBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  bookNowBtnGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bookNowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ── Pro Booking Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 14,
  },
  modalWorkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
  modalAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalWorkerName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalSubTitle: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textDim,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  modalCategoriesWrap: {
    gap: 8,
    marginBottom: 14,
  },
  modalCatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  modalCatCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.12)' : '#F5F2FF',
  },
  modalCatIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(108,71,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCatIconCircleActive: {
    backgroundColor: 'rgba(108,71,255,0.2)',
  },
  modalCatName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalCatNameActive: {
    color: '#6C47FF',
  },
  modalCatPrice: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  modalSubsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modalSubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#F1EDFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalSubChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  modalSubChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? '#C4B5FD' : '#5B21B6',
  },
  modalSubChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalContinueBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalContinueGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContinueText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default BookServiceScreen;
