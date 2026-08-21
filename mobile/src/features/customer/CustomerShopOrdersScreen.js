import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Alert } from 'react-native';
import { Package } from 'lucide-react-native';
import { shopService } from '../../services/shopService';
import AppBar from '../../components/AppBar';
import LinearGradient from 'react-native-linear-gradient';
import { SearchBar } from '../../components/ui/SearchBar';

const CustomerShopOrdersScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await shopService.getCustomerOrders();
      if (res.data?.status === 'success') {
        const list = res.data.data.orders || res.data.data;
        setOrders(list);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(item => 
      !searchQuery || 
      item.shopId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orders, searchQuery]);

  const renderOrderItem = ({ item }) => {
    const isActive = ['NEW', 'PACKING', 'OUT_FOR_DELIVERY'].includes(item.status);
    return (
      <TouchableOpacity 
        style={styles.orderCard} 
        onPress={() => navigation.navigate('ShopOrderDetails', { orderId: item._id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.shopBox}>
            <Text style={{ fontSize: 20 }}>🏪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{item.shopId?.name || 'Shop'}</Text>
            <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#fef3c7' : '#d1fae5' }]}>
            <Text style={[styles.statusText, { color: isActive ? '#d97706' : '#059669' }]}>
              {item.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.orderDetails}>
          <Text style={styles.itemCount}>{item.items?.length || 0} items</Text>
          <Text style={styles.orderTotal}>₹{item.total}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="My Shop Orders" 
          showBack={true} 
          transparent={true} 
          showLogo={false} 
          showProfile={false}
          showCart={false}
          onBackPress={() => navigation.goBack()} 
        />
      </LinearGradient>

      {/* Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10, marginBottom: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search orders, shops..."
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Package size={64} color={theme.colors.textDim} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>You haven't placed any orders from shops.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item._id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  shopBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  itemCount: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  }
});

export default CustomerShopOrdersScreen;


