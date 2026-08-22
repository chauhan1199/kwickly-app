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
  Platform, 
  Image,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import api from '../../services/api';
import BannerCarousel from '../../components/ui/BannerCarousel';
import GlassCard from '../../components/ui/GlassCard';
import AppBar from '../../components/AppBar';
import LinearGradient from 'react-native-linear-gradient';
import { SearchBar } from '../../components/ui/SearchBar';
import { MapPin, Star, Store, Clock, RotateCcw } from 'lucide-react-native';
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
  const userCoords = primaryAddress?.location?.coordinates || [72.574115, 23.1222453]; // Default to Ahmedabad

  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      setDebugError(null);

      const params = {};
      if (userCoords && userCoords.length === 2) {
        params.lng = userCoords[0];
        params.lat = userCoords[1];
      }

      const res = await shopService.getShops(params);
      const payload = res.data?.data;
      const fetchedShops = Array.isArray(payload) ? payload : (payload?.shops || []);
      
      const mappedShops = fetchedShops.map((s) => {
        let distanceKm = s.distanceKm;
        let distanceFormatted = s.distanceFormatted;
        let deliveryEstimate = s.deliveryEstimate || '25-35 min';

        if (userCoords && s.location?.coordinates && s.location.coordinates.length === 2) {
          const rawDist = haversine(userCoords, s.location.coordinates);
          if (rawDist !== null) {
            distanceKm = Math.round(rawDist * 10) / 10;
            distanceFormatted = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
            deliveryEstimate = distanceKm <= 1.5 ? '15-25 min' : distanceKm <= 3 ? '25-35 min' : '35-45 min';
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

      // Sort from near to high (nearest first)
      mappedShops.sort((a, b) => a.distanceKm - b.distanceKm);
      setShops(mappedShops);

      // Fetch Banners for Shop Page
      try {
        const bannerRes = await api.get('/promotions/banners');
        if (bannerRes.data?.status === 'success') {
          setBanners(bannerRes.data.data.filter(b => b.position === 'SHOP_PAGE'));
        }
      } catch (_) {}

    } catch (error) {
      setDebugError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userCoords]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShops();
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, position: 'relative', overflow: 'hidden' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Nearby Shops" 
          subtitle="Sorted from nearest to farthest" 
          transparent={true} 
          showLogo={false} 
          showBack={false}
          showCart={true}
          showProfile={false}
          showThemeToggle={true}
          showNotifications={true}
        />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10 }}>
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
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C47FF" />}
      >
        {/* Dynamic Banners */}
        {banners.length > 0 && !searchQuery && (
          <BannerCarousel 
            banners={banners} 
            itemWidth={Dimensions.get('window').width - 28} 
            itemHeight={140}
            style={{ marginBottom: 16 }}
            autoPlayInterval={4000}
          />
        )}

        {/* Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.chipsScroll} 
          contentContainerStyle={{ paddingHorizontal: 14 }}
        >
          {chips.map((chip, index) => {
            const isActive = filter === chip;
            return (
              <TouchableOpacity 
                key={index} 
                style={[styles.chipItem, isActive && styles.chipItemActive]}
                onPress={() => setFilter(chip)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header with Count */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.colors.text }]}>
            {filter === 'All' ? 'All Nearby Shops' : `${filter} Shops`}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredShops.length} Found</Text>
          </View>
        </View>

        <View style={styles.content}>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color="#6C47FF" style={{ marginTop: 40 }} />
          ) : debugError ? (
            <Text style={{ textAlign: 'center', marginTop: 40, color: '#EF4444' }}>Error: {debugError}</Text>
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
              <GlassCard
                key={shop.id} 
                style={[styles.shopCard, !shop.isOnline && { opacity: 0.6 }]}
                isDarkMode={isDarkMode}
                onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id })}
              >
                <View style={styles.shopRow}>
                  <View style={[styles.shopIconBox, { backgroundColor: '#6C47FF1A' }]}>
                    {shop.logoUrl ? (
                      <Image 
                        source={{ uri: getImageUrl(shop.logoUrl) }} 
                        style={styles.shopLogoImg} 
                        resizeMode="cover" 
                      />
                    ) : (
                      <Store size={28} color="#6C47FF" />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                    <Text style={styles.shopCategory} numberOfLines={1}>{shop.category}</Text>
                    <View style={styles.statsRow}>
                      <View style={styles.ratingBadge}>
                        <Star size={11} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{shop.rating}</Text>
                      </View>
                      <View style={styles.distBadge}>
                        <MapPin size={11} color="#6C47FF" />
                        <Text style={styles.distText}>{shop.dist}</Text>
                      </View>
                      <View style={styles.timeBadge}>
                        <Clock size={11} color="#10B981" />
                        <Text style={styles.timeText}>{shop.delivery}</Text>
                      </View>
                    </View>
                    <Text style={styles.shopSub}>Free delivery over ₹{shop.minFree}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <View style={styles.shopActionBtn}>
                      <Text style={styles.shopActionText}>Visit</Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            ))
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chipsScroll: {
    marginVertical: 10,
  },
  chipItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  chipItemActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  content: {
    paddingHorizontal: 14,
    marginTop: 6,
  },
  shopCard: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#EDF2F7',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  shopLogoImg: {
    width: '100%',
    height: '100%',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  shopCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C47FF',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF',
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
  shopSub: {
    fontSize: 11.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  shopActionBtn: {
    backgroundColor: '#6C47FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  shopActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
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
