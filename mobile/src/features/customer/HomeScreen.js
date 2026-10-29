import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Platform,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import { shopService } from '../../services/shopService';

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import BannerCarousel from '../../components/ui/BannerCarousel';
import PromoCarousel from '../../components/ui/PromoCarousel';
import { ServiceCard, getServiceImage } from '../../components/ui/ServiceCard';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronRight, Star, Zap, MapPin, Bell, Package, Store, Clock, RotateCcw, X, Radio, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/ui/SearchBar';
import GlassCard from '../../components/ui/GlassCard';
import { getImageUrl, formatStatus } from '../../utils/helpers';
import { activeJobPillLabel } from '../../utils/jobStatus';

// ── Purple accent ──
const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';
const BG = '#fff';

const haversine = (coords1, coords2) => {
  if (!coords1 || !coords2 || coords1.length !== 2 || coords2.length !== 2) return null;
  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c; // in km
};

const DEFAULT_COORDS = [72.574115, 23.1222453];

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Card width follows the live window width: 3 per row on phones, 4-5 on >=600dp
  const cardCols = windowWidth >= 840 ? 5 : windowWidth >= 600 ? 4 : 3;
  const cardW = Math.floor((Math.min(windowWidth, 800) - 32 - (cardCols - 1) * 12) / cardCols);
  const { theme, isDarkMode } = useTheme();
  const { userToken, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  // True from mount until the first data fetch settles, so the screen never
  // renders an empty-content state while its data is still loading.
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState([]);
  const [activeShopOrders, setActiveShopOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [promos, setPromos] = useState([]);
  const [homeBanners, setHomeBanners] = useState([]);

  // Sort Top Services by frequency and booking counts (most frequently used first)
  const sortedTopServices = useMemo(() => {
    return [...categories].sort((a, b) => {
      const scoreA = (a.frequencyScore || 0) + (a.bookingCount || 0) * 10;
      const scoreB = (b.frequencyScore || 0) + (b.bookingCount || 0) * 10;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [categories]);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  // Primary user address & stable coordinates
  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const userLng = primaryAddress?.location?.coordinates?.[0] ?? DEFAULT_COORDS[0];
  const userLat = primaryAddress?.location?.coordinates?.[1] ?? DEFAULT_COORDS[1];
  const userCoords = useMemo(() => [userLng, userLat], [userLng, userLat]);
  // Distances are only shown when measured from the user's real saved address, never the fallback point
  const hasUserLocation = Array.isArray(primaryAddress?.location?.coordinates) && primaryAddress.location.coordinates.length === 2;

  const displayLocation = primaryAddress 
    ? ([primaryAddress.area, primaryAddress.city].filter(Boolean).join(', ') || primaryAddress.label || 'Saved address')
    : (user?.city || 'Set your location');

  // Load cached categories, shops, promos and banners immediately on launch
  useEffect(() => {
    AsyncStorage.multiGet(['kwickly_cache_categories', 'kwickly_cache_shops', 'kwickly_cache_promos', 'kwickly_cache_home_banners'])
      .then(([[, catJson], [, shopJson], [, promoJson], [, bannerJson]]) => {
        let hasCache = false;
        if (catJson) {
          try {
            const parsed = JSON.parse(catJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCategories(parsed);
              hasCache = true;
            }
          } catch (_) {}
        }
        if (shopJson) {
          try {
            const parsedS = JSON.parse(shopJson);
            if (Array.isArray(parsedS) && parsedS.length > 0) {
              setShops(parsedS);
              hasCache = true;
            }
          } catch (_) {}
        }
        if (promoJson) {
          try {
            const parsedP = JSON.parse(promoJson);
            if (Array.isArray(parsedP) && parsedP.length > 0) setPromos(parsedP);
          } catch (_) {}
        }
        if (bannerJson) {
          try {
            const parsedB = JSON.parse(bannerJson);
            if (Array.isArray(parsedB) && parsedB.length > 0) setHomeBanners(parsedB);
          } catch (_) {}
        }
        if (hasCache) {
          setInitialLoading(false);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      }
      setInitialLoading((prev) => (categories.length === 0 && shops.length === 0 ? true : false));

      const params = hasUserLocation ? { limit: 10, lng: userLng, lat: userLat } : { limit: 10 };

      // Parallelize all requests including dynamic banners and promos from admin
      const [catRes, shopsRes, jobsRes, oRes, bannersRes, promosRes] = await Promise.allSettled([
        jobService.getCategories(),
        shopService.getShops(params),
        userToken ? jobService.getMyJobs() : Promise.resolve(null),
        userToken ? shopService.getCustomerOrders() : Promise.resolve(null),
        api.get('/promotions/banners'),
        api.get('/promotions/active'),
      ]);

      // Categories
      if (catRes.status === 'fulfilled' && catRes.value?.data?.status === 'success') {
        const mappedCats = catRes.value.data.data.map(c => ({
          id: c._id,
          icon: c.icon,
          label: c.name,
          name: c.name,
          color: c.color,
          imageUrl: c.imageUrl || null,
          bookingCount: c.bookingCount || 0,
          frequencyScore: c.frequencyScore || 0,
          rating: c.rating || null,
          subs: c.subcategories?.map(s => ({
            id: s._id,
            name: s.name,
            imageUrl: s.imageUrl || null
          })) || [],
          localImage: getServiceImage(c.name),
        }));
        setCategories(mappedCats);
        AsyncStorage.setItem('kwickly_cache_categories', JSON.stringify(mappedCats)).catch(() => {});
      }

      // Dynamic Home Banners
      if (bannersRes.status === 'fulfilled' && bannersRes.value?.data?.status === 'success') {
        const allB = Array.isArray(bannersRes.value.data.data) ? bannersRes.value.data.data : [];
        const hBanners = allB.filter(b => b.position === 'HOME_TOP' || b.position === 'HOME_MIDDLE');
        const finalB = hBanners.length > 0 ? hBanners : allB.slice(0, 3);
        setHomeBanners(finalB);
        AsyncStorage.setItem('kwickly_cache_home_banners', JSON.stringify(finalB)).catch(() => {});
      }

      // Dynamic Active Promotions
      if (promosRes.status === 'fulfilled' && promosRes.value?.data?.status === 'success') {
        const fetchedPromos = Array.isArray(promosRes.value.data.data) ? promosRes.value.data.data : [];
        if (fetchedPromos.length > 0) {
          setPromos(fetchedPromos);
          AsyncStorage.setItem('kwickly_cache_promos', JSON.stringify(fetchedPromos)).catch(() => {});
        }
      }

      // Shops
      if (shopsRes.status === 'fulfilled') {
        const payload = shopsRes.value.data?.data;
        const fetchedShops = Array.isArray(payload) ? payload : (payload?.shops || []);

        const mapped = fetchedShops.map((s) => {
          let distanceKm = hasUserLocation ? s.distanceKm : null;
          let distanceFormatted = hasUserLocation ? s.distanceFormatted : null;
          let deliveryEstimate = hasUserLocation ? (s.deliveryEstimate || null) : null;

          if (hasUserLocation && s.location?.coordinates && s.location.coordinates.length === 2) {
            const raw = haversine([userLng, userLat], s.location.coordinates);
            if (raw !== null) {
              distanceKm = Math.round(raw * 10) / 10;
              distanceFormatted = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
              deliveryEstimate = distanceKm <= 1.5 ? '15-25 min' : distanceKm <= 3 ? '20-30 min' : '30-45 min';
            }
          }

          return {
            ...s,
            id: s._id,
            distanceKm: distanceKm !== null && distanceKm !== undefined ? distanceKm : 999,
            dist: distanceFormatted || null, // hidden in the UI when unknown
            delivery: deliveryEstimate,
            // Real shop rating only; null (shown as "New") when the shop has none yet
            rating: Number(s.rating) > 0 ? Number(s.rating).toFixed(1) : null,
            totalOrders: s.totalOrders || 0,
            category: s.category || 'General',
            logoUrl: s.logoUrl || null
          };
        });

        mapped.sort((a, b) => a.distanceKm - b.distanceKm);
        setShops(mapped);
        AsyncStorage.setItem('kwickly_cache_shops', JSON.stringify(mapped)).catch(() => {});
      }

      // Active Jobs
      if (jobsRes.status === 'fulfilled' && jobsRes.value?.data?.status === 'success') {
        // A COMPLETED job stays here only until it is paid
        const active = jobsRes.value.data.data.filter(j =>
          ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'].includes(j.status) &&
          !(j.status === 'COMPLETED' && j.payment?.status === 'PAID')
        ).map(j => ({
          id: j._id,
          title: `${j.category}${j.subcategory ? ' — ' + j.subcategory : ''}`,
          category: j.category,
          subcategory: j.subcategory,
          worker: j.workerId?.name || null,
          status: j.status,
          fromPrice: j.payment?.amount || j.budget || null,
          preferredDate: j.preferredDate ? new Date(j.preferredDate).toLocaleDateString('en-IN') : null,
          timeSlot: j.timeSlot || 'urgent',
          progress:
            j.status === 'BROADCASTING' ? 20 :
            j.status === 'QUOTES_RECEIVED' ? 45 :
            j.status === 'ALLOCATED' ? 60 :
            j.status === 'IN_PROGRESS' ? 80 : 50,
          isIP: ['IN_PROGRESS', 'ARRIVING', 'ALLOCATED'].includes(j.status),
          isCompleted: j.status === 'COMPLETED',
          hasQuotes: j.status === 'QUOTES_RECEIVED',
          rawJob: j,
        }));
        setActiveJobs(active);
      }

      // Active Shop Orders (only show orders that are confirmed/paid/in-progress and not cancelled or unpaid draft)
      if (oRes.status === 'fulfilled' && oRes.value?.data?.status === 'success') {
        const list = oRes.value.data.data.orders || oRes.value.data.data;
        const validActiveOrders = (Array.isArray(list) ? list : []).filter(o => {
          if (!o || ['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)) return false;
          // Must have successful or submitted payment (WALLET, verified UPI, or confirmed status)
          const isPaid = o.payment?.status === 'PAID' || o.payment?.status === 'PENDING_VERIFICATION' || o.payment?.method === 'WALLET' || ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY'].includes(o.status);
          return isPaid;
        });
        setActiveShopOrders(validActiveOrders);
      }
    } catch (e) {
      // Error handled silently
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [userToken, userLng, userLat, hasUserLocation]);

  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Search Results filtering for both Services & Shops
  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase().trim();

  const matchedServices = useMemo(() => {
    if (!isSearching) return categories;
    return categories.filter(c =>
      (c.label || c.name || '').toLowerCase().includes(q) ||
      c.subs?.some(s => s.name?.toLowerCase().includes(q))
    );
  }, [categories, isSearching, q]);

  const matchedShops = useMemo(() => {
    if (!isSearching) return shops;
    return shops.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    );
  }, [shops, isSearching, q]);

  const firstName = user?.name?.split(' ')[0] || 'there';



  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* ═══════════════════════════════════════
          PURPLE HERO HEADER (Fixed at Top)
      ═══════════════════════════════════════ */}
      <View style={{ zIndex: 10 }}>
        <LinearGradient
          colors={[PURPLE, '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 20, 36) + 12, paddingBottom: 30 }]}
        >
          {/* Dynamic background shapes */}
          <View style={styles.blob1} pointerEvents="none" />
          <View style={styles.blob2} pointerEvents="none" />

          {/* Top row: Location on left, Orders + Notifications on right */}
          <View style={[styles.heroTopRow, { marginBottom: 12 }]}>
            <TouchableOpacity style={[styles.locationRow, { flex: 1, marginRight: 12 }]} activeOpacity={0.8} onPress={() => navigation.navigate('SavedAddresses')}>
              <MapPin size={14} color="#FFFFFF" />
              <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
              <Text style={styles.locationCaret}>  ⌄</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={[styles.bellBtn, { marginRight: 16 }]} activeOpacity={0.8} onPress={() => navigation.navigate('CustomerShopOrders')}>
                <Package size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications')}>
                <Bell size={22} color="#fff" />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting + mascot row */}
          <Animated.View style={[styles.heroMiddleRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>Hi, {firstName}!</Text>
              <Text style={styles.heroSubtitle}>Services + Products available in local services</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              {user?.profileImage ? (
                <Image
                  source={{ uri: getImageUrl(user.profileImage) }}
                  style={styles.heroMascot}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.heroMascot, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>{firstName[0]?.toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* Search bar component - overlapping the header and body */}
        <Animated.View pointerEvents="box-none" style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], zIndex: 11 }}>
          <SearchBar 
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search services, shops, products..."
            theme={theme}
            onFilterPress={() => navigation.navigate('Book')}
            style={{ marginHorizontal: 16, marginTop: -22 }}
          />
        </Animated.View>
      </View>

      {/* ═══════════════════════════════════════
          SCROLLABLE BODY (Between Header & Footer)
      ═══════════════════════════════════════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={PURPLE} />}
      >
        {/* ═══════════════════════════════════════
            BODY
        ═══════════════════════════════════════ */}
        <View style={[styles.body, { backgroundColor: theme.colors.background }]}>

          {/* ═══════════════════════════════════════
              LIVE SEARCH RESULTS VIEW (WHEN SEARCHING)
          ═══════════════════════════════════════ */}
          {isSearching ? (
            <View style={styles.searchResultsContainer}>
              {/* Header with Clear Button */}
              <View style={styles.searchHeaderRow}>
                <View>
                  <Text style={[styles.searchResultTitle, { color: theme.colors.text }]}>Search Results</Text>
                  <Text style={styles.searchResultSub}>
                    Matching "{searchQuery}" • {matchedServices.length} services, {matchedShops.length} shops
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.clearSearchBtn}
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.7}
                >
                  <X size={14} color="#6C47FF" />
                  <Text style={styles.clearSearchText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Matched Services */}
              {matchedServices.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      Services ({matchedServices.length})
                    </Text>
                    <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Book')}>
                      <Text style={styles.viewAllText}>All Services</Text>
                      <ChevronRight size={14} color={PURPLE} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.serviceGrid}>
                    {matchedServices.map((cat, index) => {
                      const serviceCols = windowWidth >= 600 ? 3 : 2;
                      const searchCardWidth = (Math.min(windowWidth, 800) - 32 - (serviceCols - 1) * 12) / serviceCols;
                      return (
                        <ServiceCard 
                          key={cat.id || index} 
                          cat={cat} 
                          index={index} 
                          theme={theme} 
                          style={{ width: searchCardWidth, marginBottom: 12 }}
                          onPress={(c) => navigation.navigate('SubCategories', c)} 
                        />
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Matched Shops */}
              {matchedShops.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      Nearby Shops ({matchedShops.length})
                    </Text>
                    <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Shop')}>
                      <Text style={styles.viewAllText}>All Shops</Text>
                      <ChevronRight size={14} color={PURPLE} />
                    </TouchableOpacity>
                  </View>

                  {matchedShops.map((shop) => (
                    <GlassCard
                      key={shop.id || shop._id} 
                      style={[styles.shopSearchCard, { borderColor: theme.colors.border }]}
                      isDarkMode={isDarkMode}
                      onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id || shop._id, shopData: shop })}
                    >
                      <View style={styles.shopSearchRow}>
                        <View style={[styles.shopSearchIconBox, { backgroundColor: '#6C47FF1A' }]}>
                          {shop.logoUrl ? (
                            <Image 
                              source={{ uri: getImageUrl(shop.logoUrl) }} 
                              style={{ width: '100%', height: '100%' }} 
                              resizeMode="cover" 
                            />
                          ) : (
                            <Store size={26} color="#6C47FF" />
                          )}
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.shopSearchName, { color: theme.colors.text }]} numberOfLines={1}>{shop.name}</Text>
                          <Text style={styles.shopSearchCategory} numberOfLines={1}>{shop.category}</Text>
                          <View style={styles.statsRow}>
                            <View style={styles.ratingBadge}>
                              {shop.rating ? <Star size={11} color="#F59E0B" fill="#F59E0B" /> : null}
                              <Text style={styles.ratingText}>{shop.rating || 'New'}</Text>
                            </View>
                            {shop.dist ? (
                              <View style={styles.distBadge}>
                                <MapPin size={11} color="#6C47FF" />
                                <Text style={styles.distText}>{shop.dist}</Text>
                              </View>
                            ) : null}
                            {shop.delivery ? (
                              <View style={styles.timeBadge}>
                                <Clock size={11} color="#10B981" />
                                <Text style={styles.timeText}>{shop.delivery}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.shopActionBtn}>
                          <Text style={styles.shopActionText}>Visit</Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              )}

              {/* No matches at all */}
              {matchedServices.length === 0 && matchedShops.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Store size={48} color={theme.colors.textDim} />
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No results found</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.colors.textDim }]}>
                    No services or shops found matching "{searchQuery}".
                  </Text>
                  <View style={styles.popularTagsRow}>
                    <Text style={[styles.popularTagsLabel, { color: theme.colors.textDim }]}>Try searching:</Text>
                    {['Cook', 'Plumbing', 'Bakery', 'Pharmacy', 'Grocery'].map((tag, idx) => (
                      <TouchableOpacity 
                        key={idx}
                        style={styles.popularTagPill}
                        onPress={() => setSearchQuery(tag)}
                      >
                        <Text style={styles.popularTagText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity 
                    style={styles.resetBtn}
                    onPress={() => setSearchQuery('')}
                    activeOpacity={0.8}
                  >
                    <RotateCcw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.resetBtnText}>Clear Search</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* ═══════════════════════════════════════
               DEFAULT HOME DASHBOARD (NO SEARCH)
            ═══════════════════════════════════════ */
            <>
              {/* ── ACTIVE JOBS (LIVE BROADCAST / ASSIGNED) ── */}
              {activeJobs.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Active Services</Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{activeJobs.length}</Text>
                      </View>
                    </View>
                  </View>
                  {activeJobs.map(job => (
                    <ActiveJobCard key={job.id} job={job} navigation={navigation} theme={theme} categories={categories} />
                  ))}
                </View>
              )}

              {/* ── ACTIVE SHOP ORDERS ── */}
              {activeShopOrders.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Active Shop Orders</Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{activeShopOrders.length}</Text>
                      </View>
                    </View>
                  </View>
                  {activeShopOrders.map(order => (
                    <TouchableOpacity
                      key={order._id}
                      style={[styles.jobCard, { backgroundColor: theme.colors.card, borderLeftColor: PURPLE, borderLeftWidth: 4 }]}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order._id })}
                    >
                      <View style={styles.jobCardTop}>
                        <View style={[styles.jobIconBox, { backgroundColor: PURPLE + '18' }]}>
                          <Text style={{ fontSize: 22 }}>📦</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>Order from {order.shopId?.name || 'Shop'}</Text>
                          <Text style={styles.jobSub}>Status: {formatStatus(order.status)} • Total: ₹{Number(order.total ?? order.payment?.amount ?? order.totalAmount ?? 0).toFixed(2)}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: PURPLE + '18' }]}>
                          <Text style={[styles.statusPillText, { color: PURPLE }]}>TRACK</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── DYNAMIC HOME BANNERS (Auto-scrolls every 2s, left/right) ── */}
              {homeBanners.length > 0 && (
                <View style={{ height: 135, marginBottom: 16, alignItems: 'center', overflow: 'hidden' }}>
                  <BannerCarousel
                    banners={homeBanners}
                    itemWidth={Math.min(windowWidth - 32, 680)}
                    itemHeight={135}
                    style={{ height: 135 }}
                    autoPlayInterval={2000}
                    contentContainerStyle={{ paddingHorizontal: 0 }}
                  />
                </View>
              )}

              {/* ── TOP SERVICES ── */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Services</Text>
                <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Book')}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <ChevronRight size={14} color={PURPLE} />
                </TouchableOpacity>
              </View>

              {/* Horizontal service slider (Sorted by frequency of usage) */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.serviceSlider}
              >
                {sortedTopServices.map((cat, index, arr) => (
                  <ServiceCard 
                    key={cat.id || index} 
                    cat={cat} 
                    index={index} 
                    theme={theme} 
                    isLast={index === arr.length - 1}
                    style={{ width: cardW }}
                    onPress={(c) => navigation.navigate('SubCategories', c)} 
                  />
                ))}
              </ScrollView>

              {/* ── BROWSE NEARBY SHOPS (NEAR TO HIGH) ── */}
              <View style={[styles.sectionHeader, { marginTop: 12 }]}>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Nearby Shops</Text>
                  <Text style={{ fontSize: 11.5, color: theme.colors.textDim, marginTop: 2 }}>From nearest to farthest</Text>
                </View>
                <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Shop')}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <ChevronRight size={14} color={PURPLE} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.serviceSlider}
              >
                {shops.length > 0 ? shops.map((shop, index, arr) => (
                  <TouchableOpacity
                    key={shop.id || shop._id}
                    style={[
                      styles.serviceCard, 
                      { 
                        backgroundColor: theme.colors.card, 
                        borderColor: theme.colors.border,
                        marginRight: index === arr.length - 1 ? 0 : 12,
                        width: Math.floor((Math.min(windowWidth, 800) - 32 - 16) / 2.3)
                      }
                    ]}
                    onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id || shop._id, shopData: shop })}
                    activeOpacity={0.88}
                  >
                    <View style={[styles.serviceCardImgBox, { height: cardW * 0.95, backgroundColor: theme.colors.card }]}>
                      {shop.logoUrl ? (
                        <Image 
                          source={{ uri: getImageUrl(shop.logoUrl) }} 
                          style={styles.serviceCardImg} 
                          resizeMode="cover" 
                        />
                      ) : (
                        <View style={[styles.serviceCardImgFallback, { backgroundColor: PURPLE_LIGHT }]}>
                          <Store color={PURPLE} size={32} />
                        </View>
                      )}
                    </View>
                    <View style={styles.serviceCardFooter}>
                      <Text style={[styles.serviceCardName, { color: theme.colors.text }]} numberOfLines={1}>{shop.name}</Text>
                      <Text style={{ fontSize: 11, color: PURPLE, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{shop.category}</Text>
                      <View style={styles.serviceCardRatingRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          {shop.rating ? <Star size={11} color="#F5A623" fill="#F5A623" /> : null}
                          <Text style={styles.serviceCardRating}>{shop.rating || 'New'}</Text>
                        </View>
                        {shop.dist ? (
                          <>
                            <Text style={{ fontSize: 10, color: theme.colors.textDim }}> • </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <MapPin size={10} color={PURPLE} />
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: PURPLE }}>{shop.dist}</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                )) : (
                  <Text style={{ color: theme.colors.textDim, padding: 20 }}>No approved shops found near you.</Text>
                )}
              </ScrollView>

              {/* ── DYNAMIC PROMO CAROUSEL (Auto-scrolls every 2s, left/right) ── */}
              <PromoCarousel
                promos={promos}
                itemWidth={Math.min(windowWidth - 32, 680)}
                autoPlayInterval={2000}
                onPress={() => navigation.navigate('Book')}
                style={{ marginTop: 8, marginBottom: 16 }}
              />

              {/* ── WHY CHOOSE US ── */}
              <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Why Choose Us?</Text>
              </View>
              <View style={styles.trustRow}>
                {TRUST_ITEMS.map((item, i) => (
                  <View key={i} style={styles.trustItem}>
                    <View style={[styles.trustIconCircle, { borderColor: theme.colors.border }]}>
                      <Text style={styles.trustIcon}>{item.icon}</Text>
                    </View>
                    <Text style={[styles.trustLabel, { color: theme.colors.text }]}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* ── NEW REQUEST (when no active jobs) ── */}
              {activeJobs.length === 0 && (
                <TouchableOpacity
                  style={styles.bookNowBlock}
                  onPress={() => navigation.navigate('Book')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[PURPLE, '#9575FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bookNowInner}
                  >
                    <Zap size={18} color="#fff" />
                    <Text style={styles.bookNowText}>Book a New Service</Text>
                    <ChevronRight size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ── Active Job Card ──────────────────────────────────────
const ActiveJobCard = ({ job, navigation, theme, categories = [] }) => {
  const PURPLE = '#6C47FF';
  const accentColor = job.isCompleted ? '#10B981' : job.isIP ? '#0284C7' : PURPLE;
  const matchedCat = categories.find(c => (c.name || c.label || '').toLowerCase() === (job.category || '').toLowerCase());
  const networkImg = matchedCat?.imageUrl ? getImageUrl(matchedCat.imageUrl) : null;
  const serviceImg = getServiceImage(job.category) || (matchedCat ? getServiceImage(matchedCat.name || matchedCat.label) : null);

  return (
    <TouchableOpacity
      style={[
        styles.jobCard,
        { backgroundColor: theme.colors.card, borderLeftColor: accentColor, borderLeftWidth: 4 }
      ]}
      activeOpacity={0.85}
      onPress={() => {
        if (job.isCompleted) navigation.navigate('WorkCompleted', { worker: { name: job.worker }, job: job.rawJob });
        // Pass the real populated worker; LiveTracking computes ETA/distance from live location
        else if (job.isIP) navigation.navigate('LiveTracking', { worker: typeof job.rawJob?.workerId === 'object' && job.rawJob.workerId ? job.rawJob.workerId : undefined, job: job.rawJob, jobId: job.id });
        else navigation.navigate('LiveBids', { jobId: job.id, job: job.rawJob, category: { name: job.category }, subcategory: job.subcategory || '', address: '', timeSlot: job.timeSlot === 'urgent' ? 'ASAP' : job.timeSlot });
      }}
    >
      <View style={styles.jobCardTop}>
        <View style={[styles.jobIconBox, { backgroundColor: accentColor + '15' }]}>
          {networkImg ? (
            <Image source={{ uri: networkImg }} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="cover" />
          ) : serviceImg ? (
            <Image source={serviceImg} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 24 }}>{job.isCompleted ? '✅' : job.isIP ? '⚡' : '🔧'}</Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.jobTitle, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
              {job.title}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: accentColor + '18' }]}>
              <Text style={[styles.statusPillText, { color: accentColor }]}>
                {activeJobPillLabel(job.rawJob || job)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.jobSub} numberOfLines={1}>
            {job.status === 'BROADCASTING' ? '⚡ Searching for nearby workers...' :
             job.hasQuotes ? 'Quotes received — tap to accept!' :
             job.isIP ? `Worker: ${job.worker || 'On the way'}` :
             job.isCompleted ? (job.rawJob?.payment?.status === 'PENDING_VERIFICATION' ? 'UPI payment being verified' : 'Work finished · payment due') : 'Pending assignment'}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[accentColor, '#9575FF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${job.progress}%` }]}
        />
      </View>

      <View style={styles.jobCardBottom}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Clock size={12} color={theme.colors.textDim} />
          <Text style={[styles.workerName, { color: theme.colors.textDim, fontSize: 12 }]}>
            {job.preferredDate ? `${job.preferredDate} • ${job.timeSlot}` : job.timeSlot === 'urgent' ? 'Immediate / Urgent' : job.timeSlot}
          </Text>
        </View>

        <Text style={[styles.jobPrice, { color: accentColor, fontWeight: '800' }]}>
          {job.fromPrice ? `₹${job.fromPrice}` : 'Open Quotes'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Trust items ─────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: '✔', label: 'Verified\nProfessionals' },
  { icon: '⏰', label: 'On-Time\nService' },
  { icon: '🔒', label: 'Secure\nPayments' },
  { icon: '🎧', label: '24/7 Customer\nSupport' },
];

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Hero ──
  heroGradient: {
    paddingTop: (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 18,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  blob1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  locationCaret: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: PURPLE,
  },
  heroMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroMascot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 12,
  },
  heroGreeting: {
    fontSize: 26,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
    paddingRight: 12,
  },

  // ── Body ──
  body: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: 30,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.3,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Search Results Styles ──
  searchResultsContainer: {
    paddingTop: 6,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  searchResultTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  searchResultSub: {
    fontSize: 12,
    color: '#6C47FF',
    fontWeight: '600',
    marginTop: 2,
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  clearSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shopSearchCard: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  shopSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopSearchIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  shopSearchName: {
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  shopSearchCategory: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6C47FF',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  shopActionBtn: {
    backgroundColor: '#6C47FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  shopActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  popularTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  popularTagsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  popularTagPill: {
    backgroundColor: '#F1F4F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  popularTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C47FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 14,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // ── Service Cards ──
  serviceSlider: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  serviceCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  serviceCardImgBox: {
    width: '100%',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  serviceCardImg: {
    width: '100%',
    height: '100%',
  },
  serviceCardImgFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCardFooter: {
    padding: 10,
    paddingBottom: 12,
    height: 72,
    justifyContent: 'space-between',
  },
  serviceCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 17,
    height: 34,
    marginBottom: 4,
  },
  serviceCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
  },
  serviceCardRating: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },

  // ── Promo Banner ──
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  promoDiscCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoDiscText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  promoLine1: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  promoLine2: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  promoCode: {
    color: '#FFE082',
    fontWeight: '800',
  },
  promoBookBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginLeft: 8,
  },
  promoBookBtnText: {
    color: PURPLE,
    fontWeight: '800',
    fontSize: 12,
  },

  // ── Trust items ──
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  trustItem: {
    alignItems: 'center',
    width: '23%',
  },
  trustIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
  },
  trustIcon: {
    fontSize: 18,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444',
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Active Job Card ──
  jobCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  jobSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  jobCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: PURPLE,
  },
  countBadge: {
    backgroundColor: PURPLE + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  countBadgeText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Book Now CTA ──
  bookNowBlock: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  bookNowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  bookNowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginLeft: 10,
  },
});

export default HomeScreen;
