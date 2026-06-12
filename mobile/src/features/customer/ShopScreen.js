import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { shopService } from '../../services/shopService';
import { ActivityIndicator } from 'react-native';

const STATIC_SHOPS = [
  {id:'s1',name:'Sharma General Store',rating:4.7,dist:'0.6 km',items:42,delivery:'30 min',minFree:1000,tag:'Groceries',icon:'🏪',color:'#7ed957'},
  {id:'s2',name:'Fresh Mart',rating:4.5,dist:'1.1 km',items:120,delivery:'45 min',minFree:800,tag:'Groceries',icon:'🥦',color:'#43a047'},
  {id:'s3',name:'Daily Needs',rating:4.8,dist:'1.5 km',items:88,delivery:'40 min',minFree:1200,tag:'Dairy',icon:'🥛',color:'#0288d1'},
  {id:'s4',name:'MediPlus Pharmacy',rating:4.9,dist:'0.8 km',items:300,delivery:'20 min',minFree:500,tag:'Pharmacy',icon:'💊',color:'#e53935'},
  {id:'s5',name:'City Dairy',rating:4.6,dist:'2.0 km',items:30,delivery:'35 min',minFree:600,tag:'Dairy',icon:'🧈',color:'#f9a825'},
  {id:'s6',name:'Sweet Bakery',rating:4.4,dist:'1.8 km',items:55,delivery:'50 min',minFree:400,tag:'Bakery',icon:'🍞',color:'#6d4c41'},
];

const ShopScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [filter, setFilter] = useState('All');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  const chips = ['All', 'Groceries', 'Pharmacy', 'Dairy', 'Bakery'];

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const res = await shopService.getShops();
      // Backend returns array directly in data.data
      const fetchedShops = Array.isArray(res.data.data) ? res.data.data : [];
      
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
        address: s.address || ''
      }));
      setShops(mappedShops);
    } catch (error) {
      console.log("Error fetching shops:", error);
      // Removed fallback to let it show empty state if error occurs
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = filter === 'All' ? shops : shops.filter(s => s.tag === filter);

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Nearby Shops</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Buy daily essentials</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('CustomerShopOrders')} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>📦</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput 
          placeholder="Search shops, products..."
          placeholderTextColor={theme.colors.textDim}
          style={styles.searchInput}
        />
      </View>

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : filteredShops.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: theme.colors.textDim }}>No shops found.</Text>
        ) : filteredShops.map((shop) => (
          <TouchableOpacity 
            key={shop.id} 
            style={[styles.shopCard, !shop.isOnline && { opacity: 0.6 }]}
            onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id })}
          >
            <View style={styles.shopRow}>
               <View style={[styles.shopIconBox, { backgroundColor: shop.color + '26' }]}>
                 <Text style={{fontSize: 22}}>{shop.icon}</Text>
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={styles.shopName}>{shop.name}</Text>
                 <Text style={styles.shopStats}>
                   <Text style={{color: '#f5b300'}}>★ {typeof shop.rating === 'object' ? (shop.rating?.average || 0) : (shop.rating || 4.5)}</Text> · {shop.dist} · {shop.delivery}
                 </Text>
                 <Text style={styles.shopSub}>Free delivery over ₹{shop.minFree}</Text>
               </View>
               <Text style={styles.shopArrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
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
    paddingTop: 10,
    paddingBottom: 14,
  },
  appBarTitle: {
    fontSize: 20,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  shopStats: {
    fontSize: 12,
    color: theme.colors.text,
    marginBottom: 2,
    fontWeight: '500',
  },
  shopSub: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  shopArrow: {
    fontSize: 24,
    color: theme.colors.primary,
    marginLeft: 8,
  }
});

export default ShopScreen;
