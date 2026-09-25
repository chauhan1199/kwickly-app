import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Dimensions, 
  useWindowDimensions,
  Platform, 
  Image, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import api from '../../services/api';
import BannerCarousel from '../../components/ui/BannerCarousel';
import AppBar from '../../components/AppBar';
import LinearGradient from 'react-native-linear-gradient';
import { SearchBar } from '../../components/ui/SearchBar';
import { MapPin, Star, Store, Clock, RotateCcw, ChevronRight, Sparkles } from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';

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

const ShopScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const [filter, setFilter] = useState('All');
  const [shops, setShops] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debugError, setDebugError] = useState(null);

  const chips = ['All', 'Groceries', 'Pharmacy', 'Bakery', 'Fruits & Vegetables', 'Electronics'];

  // User location for distance sorting
  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const userLng = primaryAddress?.location?.coordinates?.[0] ?? 72.574115;
  const userLat = primaryAddress?.location?.coordinates?.[1] ?? 23.1222453;

  // Instant local cache restore
  useEffect(() => {
    AsyncStorage.multiGet(['kwickly_cache_shops', 'kwickly_cache_banners'])
      .then(([[, sJson], [, bJson]]) => {
        if (sJson) {
          try {
            const parsed = JSON.parse(sJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setShops(parsed);
              setLoading(false);
            }
          } catch (_) {}
        }
        if (bJson) {
          try {
            const parsedB = JSON.parse(bJson);
            if (Array.isArray(parsedB)) setBanners(parsedB);
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  const fetchShops = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      setDebugError(null);

      const params = { lng: userLng, lat: userLat };

      // Parallel fetch for shops and banners
      const [shopsResult, bannersResult] = await Promise.allSettled([
        shopService.getShops(params),
        api.get('/promotions/banners')
      ]);

      if (shopsResult.status === 'fulfilled') {
        const payload = shopsResult.value.data?.data;
        const fetchedShops = Array.isArray(payload) ? payload : (payload?.shops || []);
        
        const mappedShops = fetchedShops.map((s) => {
          let distanceKm = s.distanceKm;
          let distanceFormatted = s.distanceFormatted;
          let deliveryEstimate = s.deliveryEstimate || '20-35 min';

          if (s.location?.coordinates && s.location.coordinates.length === 2) {
            const rawDist = haversine([userLng, userLat], s.location.coordinates);
            if (rawDist !== null) {
              distanceKm = Math.round(rawDist * 10) / 10;
              distanceFormatted = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
              deliveryEstimate = distanceKm <= 1.5 ? '15-25 min' : distanceKm <= 3 ? '20-30 min' : '30-45 min';
            }
          }

          return {
            id: s._id,
            name: s.name,
            category: s.category || 'General',
            description: s.description || '',
            rating: typeof s.rating === 'number' ? s.rating : 4.5,
            totalOrders: s.totalOrders || 0,
            distanceKm: distanceKm !== null && distanceKm !== undefined ? distanceKm : 999,
            dist: distanceFormatted || '1.2 km',
            delivery: deliveryEstimate,
            minFree: s.deliveryConfig?.freeDeliveryAbove || 500,
            isOnline: s.isOnline !== false,
            address: s.address || '',
            logoUrl: s.logoUrl || null
          };
        });

        // Sort from nearest to farthest
        mappedShops.sort((a, b) => a.distanceKm - b.distanceKm);
        setShops(mappedShops);
        AsyncStorage.setItem('kwickly_cache_shops', JSON.stringify(mappedShops)).catch(() => {});
      } else {
        if (shops.length === 0) {
          setDebugError(shopsResult.reason?.response?.data?.message || shopsResult.reason?.message || 'Failed to fetch shops');
        }
      }

      if (bannersResult.status === 'fulfilled') {
        const bList = bannersResult.value.data?.data;
        if (Array.isArray(bList)) {
          const shopBanners = bList.filter(b => b.position === 'SHOP_PAGE');
          const finalBanners = shopBanners.length >= 2 ? shopBanners : (bList.length > 0 ? bList : shopBanners);
          setBanners(finalBanners);
          AsyncStorage.setItem('kwickly_cache_banners', JSON.stringify(finalBanners)).catch(() => {});
        }
      }

    } catch (error) {
      if (shops.length === 0) {
        setDebugError(error.response?.data?.message || error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userLng, userLat, shops.length]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShops(true);
  };

  // Filter shops by Category Chip & Search Query
  const filteredShops = useMemo(() => {
    return shops.filter(shop => {
      // 1. Category filter
      let matchesCategory = true;
      if (filter !== 'All') {
        const fLower = filter.toLowerCase();
        const catLower = (shop.category || '').toLowerCase();
        const nameLower = (shop.name || '').toLowerCase();
        const descLower = (shop.description || '').toLowerCase();

        if (fLower === 'groceries' || fLower === 'grocery') {
          matchesCategory = catLower.includes('grocer') || catLower.includes('general') || nameLower.includes('grocer') || nameLower.includes('market');
        } else if (fLower === 'pharmacy') {
          matchesCategory = catLower.includes('pharm') || catLower.includes('health') || nameLower.includes('med') || nameLower.includes('pharm');
        } else if (fLower === 'bakery') {
          matchesCategory = catLower.includes('bake') || nameLower.includes('bake') || descLower.includes('bread') || descLower.includes('cake');
        } else if (fLower === 'fruits & vegetables') {
          matchesCategory = catLower.includes('fruit') || catLower.includes('veg') || nameLower.includes('orchard') || nameLower.includes('fruit');
        } else if (fLower === 'electronics') {
          matchesCategory = catLower.includes('electr') || catLower.includes('tech') || nameLower.includes('tech') || nameLower.includes('electr');
        } else {
          matchesCategory = catLower.includes(fLower) || nameLower.includes(fLower);
        }
      }

      // 2. Search query filter
      let matchesSearch = true;
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        matchesSearch =
          shop.name.toLowerCase().includes(q) ||
          shop.category.toLowerCase().includes(q) ||
          shop.description.toLowerCase().includes(q) ||
          shop.address.toLowerCase().includes(q);
      }

      return matchesCategory && matchesSearch;
    });
  }, [shops, filter, searchQuery]);

  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerBlob1} />
        <View style={styles.headerBlob2} />

        <AppBar 
          title="Nearby Shops" 
          subtitle="Sorted from nearest to farthest" 
          transparent={true} 
          showLogo={false} 
          showBack={false}
          showCart={true}
          showProfile={false}
          showNotifications={true}
        />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={styles.searchOverlapBox}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search shops & stores..."
          theme={theme}
          onFilterPress={() => {}}
        />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C47FF" />}
      >
        {/* Dynamic Banners */}
        {banners.length > 0 && !searchQuery && (
          <BannerCarousel 
            banners={banners} 
            itemWidth={Math.min(windowWidth - 28, 680)} 
            itemHeight={140}
            style={{ marginBottom: 14, alignItems: 'center' }}
            autoPlayInterval={2000}
          />
        )}

        {/* Category Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.chipsScroll} 
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {chips.map((chip, index) => {
            const isActive = filter === chip;
            return (
              <TouchableOpacity 
                key={index} 
                style={[styles.chipItem, isActive && styles.chipItemActive]}
                onPress={() => setFilter(chip)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header with Count */}
        <View style={styles.listHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.listTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {filter === 'All' ? 'All Nearby Shops' : `${filter} Shops`}
            </Text>
            <Sparkles size={16} color="#6C47FF" style={{ marginLeft: 6 }} />
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredShops.length} Found</Text>
          </View>
        </View>

        {/* Shops Content */}
        <View style={styles.content}>
          {loading && shops.length === 0 ? (
            <ActivityIndicator size="large" color="#6C47FF" style={{ marginTop: 40 }} />
          ) : debugError && shops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Store size={48} color={theme.colors.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Unable to load shops</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textDim }]}>{debugError}</Text>
              <TouchableOpacity style={styles.resetBtn} onPress={() => fetchShops(true)} activeOpacity={0.8}>
                <RotateCcw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.resetBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredShops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Store size={48} color={theme.colors.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No shops found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textDim }]}>
                {searchQuery 
                  ? `No shops matching "${searchQuery}". Try a different keyword.` 
                  : `No shops currently open in the "${filter}" category.`}
              </Text>
              <TouchableOpacity 
                style={styles.resetBtn}
                onPress={() => { setFilter('All'); setSearchQuery(''); }}
                activeOpacity={0.8}
              >
                <RotateCcw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.resetBtnText}>View All Shops</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredShops.map((shop) => (
              <TouchableOpacity
                key={shop.id} 
                style={[styles.shopCard, !shop.isOnline && { opacity: 0.65 }]}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id, shopData: shop })}
              >
                <View style={styles.shopCardMain}>
                  {/* Left: Shop Image with Rating Tag */}
                  <View style={styles.shopImageContainer}>
                    {shop.logoUrl ? (
                      <Image 
                        source={{ uri: getImageUrl(shop.logoUrl) }} 
                        style={styles.shopLogoImg} 
                        resizeMode="cover" 
                      />
                    ) : (
                      <View style={styles.shopFallbackBox}>
                        <Store size={32} color="#6C47FF" />
                      </View>
                    )}
                    <View style={styles.floatingRating}>
                      <Star size={10} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.floatingRatingText}>{shop.rating}</Text>
                    </View>
                  </View>

                  {/* Right: Info Section */}
                  <View style={styles.shopInfoBox}>
                    {/* Title */}
                    <Text style={[styles.shopName, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]} numberOfLines={2}>
                      {shop.name}
                    </Text>

                    {/* Category & Distance */}
                    <View style={styles.categoryDistRow}>
                      <Text style={styles.shopCategoryText} numberOfLines={1}>{shop.category}</Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <View style={styles.distBadge}>
                        <MapPin size={11} color="#6C47FF" style={{ marginRight: 2 }} />
                        <Text style={styles.distText}>{shop.dist}</Text>
                      </View>
                    </View>

                    {/* Badges Row */}
                    <View style={styles.deliveryBadgeRow}>
                      <View style={styles.deliveryTimePill}>
                        <Clock size={11} color="#059669" style={{ marginRight: 3 }} />
                        <Text style={styles.deliveryTimeText}>{shop.delivery}</Text>
                      </View>

                      {shop.minFree ? (
                        <View style={styles.freeDeliveryPill}>
                          <Text style={styles.freeDeliveryText}>Free over ₹{shop.minFree}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Card Footer Bar */}
                <View style={styles.shopCardFooter}>
                  <Text style={styles.shopAddressText} numberOfLines={1}>
                    {shop.address || 'Verified Merchant'}
                  </Text>
                  <View style={styles.visitStoreBtn}>
                    <Text style={styles.visitStoreText}>Visit Store</Text>
                    <ChevronRight size={14} color="#6C47FF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  headerGradient: {
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBlob1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerBlob2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchOverlapBox: {
    paddingHorizontal: 16,
    marginTop: -22,
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 16,
    paddingTop: 16,
  },
  chipsScroll: {
    marginVertical: 12,
  },
  chipItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginRight: 8,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chipItemActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
    shadowColor: '#6C47FF',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  countText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  content: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  shopCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  shopCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shopImageContainer: {
    width: 82,
    height: 82,
    borderRadius: 16,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  shopLogoImg: {
    width: '100%',
    height: '100%',
  },
  shopFallbackBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6C47FF14',
  },
  floatingRating: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  floatingRatingText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#92400E',
  },
  shopInfoBox: {
    flex: 1,
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 4,
  },
  categoryDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  shopCategoryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6C47FF',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  deliveryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  deliveryTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  deliveryTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  freeDeliveryPill: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  freeDeliveryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  shopCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  shopAddressText: {
    flex: 1,
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '500',
    marginRight: 10,
  },
  visitStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
  },
  visitStoreText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
    marginRight: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
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
});

export default ShopScreen;
