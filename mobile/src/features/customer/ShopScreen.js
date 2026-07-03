import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  StatusBar,
  Dimensions,
  Platform,
  Image
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { shopService } from '../../services/shopService';
import api from '../../services/api';
import BannerCarousel from '../../components/ui/BannerCarousel';
import GlassCard from '../../components/ui/GlassCard';
import AppBar from '../../components/AppBar';
import LinearGradient from 'react-native-linear-gradient';
import { ActivityIndicator } from 'react-native';
import { SearchBar } from '../../components/ui/SearchBar';



import { getImageUrl } from '../../utils/helpers';

const ShopScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [filter, setFilter] = useState('All');
  const [shops, setShops] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debugError, setDebugError] = useState(null);

  const chips = ['All', 'Groceries', 'Pharmacy', 'Dairy', 'Bakery'];

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const res = await shopService.getShops();
      // Handle both array and paginated object
      const payload = res.data?.data;
      const fetchedShops = Array.isArray(payload) ? payload : (payload?.shops || []);
      
      const mappedShops = fetchedShops.map((s) => ({
        id: s._id,
        name: s.name,
        rating: s.rating || 4.5,
        dist: '1.5 km',
        items: s.totalOrders || 0,
        delivery: '30-45 min',
        minFree: s.delivery?.freeAbove || 500,
        tag: s.description ? s.description.split(' ')[0] : 'General',
        icon: '🏪',
        color: '#0E9AA7',
        isOnline: s.isOnline,
        address: s.address || '',
        logoUrl: s.logoUrl || null
      }));
      setShops(mappedShops);

      // Fetch Banners for Shop Page
      try {
        const bannerRes = await api.get('/promotions/banners');
        if (bannerRes.data?.status === 'success') {
          setBanners(bannerRes.data.data.filter(b => b.position === 'SHOP_PAGE'));
        }
      } catch (err) {
        console.log('Error fetching shop banners:', err);
      }
    } catch (error) {
      console.log("Error fetching shops:", error);
      setDebugError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = filter === 'All' ? shops : shops.filter(s => s.tag === filter);

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

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

        <AppBar title="Nearby Shops" subtitle="Buy daily essentials" transparent={true} showLogo={false} showBack={true} />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40, paddingTop: 30}}>
        {/* Dynamic Banners */}
        {banners.length > 0 && (
          <BannerCarousel 
            banners={banners} 
            itemWidth={Dimensions.get('window').width - 28} 
            itemHeight={140}
            style={{ marginBottom: 16 }}
            autoPlayInterval={4000}
          />
        )}

        {/* Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{paddingHorizontal: 14}}>
        {chips.map((chip, index) => {
          const isActive = filter === chip;
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.chipItem, isActive && styles.chipItemActive]}
              onPress={() => setFilter(chip)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : debugError ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>Error: {debugError}</Text>
        ) : filteredShops.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: theme.colors.textDim }}>No shops found.</Text>
        ) : filteredShops.map((shop) => (
          <GlassCard
            key={shop.id} 
            style={[styles.shopCard, !shop.isOnline && { opacity: 0.6 }]}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id })}
          >
             <View style={styles.shopRow}>
               <View style={[styles.shopIconBox, { backgroundColor: shop.color + '26', overflow: 'hidden' }]}>
                 {shop.logoUrl ? (
                   <Image source={{ uri: getImageUrl(shop.logoUrl) }} style={{ width: 54, height: 54, borderRadius: 16 }} resizeMode="cover" />
                 ) : (
                   <Text style={{fontSize: 26}}>{shop.icon}</Text>
                 )}
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={styles.shopName}>{shop.name}</Text>
                 <Text style={styles.shopStats}>
                   <Text style={{color: '#f5b300'}}>★ {typeof shop.rating === 'object' ? (shop.rating?.average || 0) : (shop.rating || 4.5)}</Text> · {shop.dist} · {shop.delivery}
                 </Text>
                 <Text style={styles.shopSub}>Free delivery over ₹{shop.minFree}</Text>
               </View>
               <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                 <View style={styles.shopActionBtn}>
                   <Text style={styles.shopActionText}>Visit</Text>
                 </View>
               </View>
            </View>
          </GlassCard>
        ))}

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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 14,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 14,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  chipsScroll: {
    maxHeight: 40,
    minHeight: 40,
    marginBottom: 16,
  },
  chipItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    justifyContent: 'center',
  },
  chipItemActive: {
    backgroundColor: theme.colors.primary + '26',
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: theme.colors.primary,
  },
  content: {
    paddingHorizontal: 14,
  },
  shopCard: {
    marginBottom: 14,
    padding: 16,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  shopStats: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 4,
    fontWeight: '600',
  },
  shopSub: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  shopActionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shopActionText: {
    color: '#001016',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerImageContainer: {
    width: Dimensions.get('window').width - 28,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
    position: 'relative',
    backgroundColor: '#1a237e'
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 24,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
  }
});

export default ShopScreen;
