import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
  BackHandler
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ShoppingCart, Plus, Minus, ArrowLeft } from 'lucide-react-native';
import api from '../../services/api';

const ShopDetailScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const { shopId } = route.params || {};
  
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});

  useEffect(() => {
    fetchShopAndProducts();
  }, [shopId]);

  useEffect(() => {
    const handleBackPress = () => {
      if (Object.keys(cart).length > 0) {
        Alert.alert(
          "Discard Cart?",
          "Kwickly carts are specific to each shop. Leaving will clear your current cart.",
          [
            { text: "Stay", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => navigation.goBack() }
          ]
        );
        return true; // prevent default
      }
      return false; // let default happen
    };
    
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [cart, navigation]);

  const handleBack = () => {
    if (Object.keys(cart).length > 0) {
      Alert.alert(
        "Discard Cart?",
        "Kwickly carts are specific to each shop. Leaving will clear your current cart.",
        [
          { text: "Stay", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const fetchShopAndProducts = async () => {
    try {
      setLoading(true);
      const [shopRes, productsRes] = await Promise.all([
        api.get(`/shops/${shopId}`),
        api.get(`/products?shopId=${shopId}`)
      ]);
      if (shopRes.data?.status === 'success') {
        setShop(shopRes.data.data);
      }
      if (productsRes.data?.status === 'success') {
        setProducts(productsRes.data.data);
      }
    } catch (e) {
      console.log('Error fetching shop/products', e);
    } finally {
      setLoading(false);
    }
  };

  const updateCart = (product, delta) => {
    setCart(prev => {
      const newCart = { ...prev };
      const currentQty = newCart[product._id]?.qty || 0;
      const nextQty = currentQty + delta;
      
      if (nextQty <= 0) {
        delete newCart[product._id];
      } else {
        newCart[product._id] = { ...product, qty: nextQty };
      }
      return newCart;
    });
  };

  const cartArray = Object.values(cart);
  const totalItems = cartArray.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cartArray.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>{shop?.name || 'Shop Details'}</Text>
          <Text style={styles.appBarSubtitle} numberOfLines={1}>{shop?.category || 'General'} • {shop?.isOnline ? 'Open' : 'Closed'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {products.length === 0 ? (
          <Text style={styles.emptyText}>No products available.</Text>
        ) : (
          products.map(product => {
            const qty = cart[product._id]?.qty || 0;
            return (
              <View key={product._id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                </View>
                <View style={styles.actionContainer}>
                  {qty > 0 ? (
                    <View style={styles.qtyBox}>
                      <TouchableOpacity onPress={() => updateCart(product, -1)} style={styles.qtyBtn}>
                        <Minus size={16} color={theme.colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity onPress={() => updateCart(product, 1)} style={styles.qtyBtn}>
                        <Plus size={16} color={theme.colors.text} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => updateCart(product, 1)}>
                      <Text style={styles.addBtnText}>ADD</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {totalItems > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomBarText}>{totalItems} Items</Text>
            <Text style={styles.bottomBarPrice}>₹{totalPrice}</Text>
          </View>
          <TouchableOpacity 
            style={styles.checkoutBtn}
            onPress={() => navigation.navigate('Cart', { shopId, cart: cartArray })}
          >
            <Text style={styles.checkoutBtnText}>View Cart</Text>
            <ShoppingCart size={20} color="#001016" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: 4 },
  appBarTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  appBarSubtitle: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  content: { padding: 16 },
  emptyText: { textAlign: 'center', color: theme.colors.textDim, marginTop: 40 },
  productCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: 16,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border
  },
  productInfo: { flex: 1, paddingRight: 16 },
  productName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  productDesc: { fontSize: 12, color: theme.colors.textDim, marginBottom: 8 },
  productPrice: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  actionContainer: { alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    borderWidth: 1, borderColor: theme.colors.primary,
    borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: theme.colors.primary + '10'
  },
  addBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 14 },
  qtyBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, overflow: 'hidden'
  },
  qtyBtn: { padding: 8, backgroundColor: theme.colors.surface },
  qtyText: { paddingHorizontal: 12, fontSize: 14, fontWeight: '700', color: theme.colors.text },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    paddingBottom: 30
  },
  bottomBarText: { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  bottomBarPrice: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  checkoutBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12
  },
  checkoutBtnText: { color: '#001016', fontSize: 15, fontWeight: '800' }
});

export default ShopDetailScreen;
