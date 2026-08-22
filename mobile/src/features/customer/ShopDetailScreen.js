import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
  BackHandler,
  TextInput,
  Modal
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ShoppingCart, Plus, Minus, ArrowLeft, Camera, Search, Zap, Star, X } from 'lucide-react-native';
import { shopService } from '../../services/shopService';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { SearchBar } from '../../components/ui/SearchBar';
import { useCart } from '../../context/CartContext';

import { getImageUrl } from '../../utils/helpers';

const ShopDetailScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  
  const { shopId } = route.params || {};
  
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { cart: globalCart, addToCart, updateItem, removeItem, clearCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  
  // Quantity Modal State
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [selectedProductForQty, setSelectedProductForQty] = useState(null);

  const fetchShopAndProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [shopRes, productsRes] = await Promise.all([
        shopService.getShopById(shopId),
        shopService.getProducts(shopId)
      ]);
      if (shopRes.data?.status === 'success') {
        setShop(shopRes.data.data);
      }
      if (productsRes.data?.status === 'success') {
        setProducts(productsRes.data.data);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load shop details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchShopAndProducts();
  }, [shopId, fetchShopAndProducts]);

  const handleBack = () => {
    navigation.goBack();
  };

  const openQuantityModal = (product) => {
    setSelectedProductForQty(product);
    setQtyModalVisible(true);
  };

  const getProductCartInfo = (productId) => {
    const cid = typeof globalCart?.shopId === 'object' ? globalCart.shopId._id : globalCart?.shopId;
    if (!globalCart || cid !== shopId) return null;
    return globalCart.items?.find(i => (typeof i.productId === 'object' ? i.productId._id : i.productId) === productId);
  };

  const handleUpdate = async (product, newQty) => {
    const cartItem = getProductCartInfo(product._id);
    if (!cartItem) {
      if (newQty > 0) {
        const res = await addToCart(shopId, product._id, newQty);
        if (res.conflict) {
          Alert.alert("Different Shop", "Your cart contains items from another shop. Clear existing cart?", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear & Add", style: "destructive", onPress: async () => {
              await clearCart();
              const addRes = await addToCart(shopId, product._id, newQty);
              if (!addRes.success) Alert.alert("Error", addRes.message || "Failed to add item");
            }}
          ]);
        } else if (!res.success) {
          Alert.alert("Error", res.message || "Failed to add item");
        }
      }
    } else {
      if (newQty <= 0) {
        const res = await removeItem(cartItem._id);
        if (!res.success) Alert.alert("Error", res.message || "Failed to remove item");
      } else {
        const res = await updateItem(cartItem._id, newQty);
        if (!res.success) Alert.alert("Error", res.message || "Failed to update item");
      }
    }
  };

  const selectQtyFromModal = async (qty) => {
    if (selectedProductForQty) {
      await handleUpdate(selectedProductForQty, qty);
    }
    setQtyModalVisible(false);
    setSelectedProductForQty(null);
  };

  const isSameShop = (typeof globalCart?.shopId === 'object' ? globalCart.shopId._id : globalCart?.shopId) === shopId;
  const totalItems = isSameShop ? globalCart?.items?.reduce((sum, item) => sum + item.qty, 0) || 0 : 0;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const styles = createStyles(theme, isDarkMode);

  const renderProduct = ({ item }) => {
    const cartItem = getProductCartInfo(item._id);
    const qty = cartItem ? cartItem.qty : 0;

    return (
      <View style={styles.productCard}>
        {/* Top Image Section */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image 
              source={{ uri: getImageUrl(item.imageUrl) }} 
              style={styles.productImage} 
              resizeMode="contain" 
            />
          ) : (
            <View style={[styles.productImage, { backgroundColor: '#f5f5f5' }]} />
          )}
          <View style={styles.ratingPill}>
            <Star size={10} color="#EAB308" fill="#EAB308" />
            <Text style={styles.ratingText}>4.5</Text>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.productInfo}>
          <View>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.productSubtitle} numberOfLines={1}>
              {item.unit || item.description}
            </Text>

            <View style={styles.priceRow}>
              <View>
                <Text style={styles.mrpText}>MRP ₹{item.mrp || item.price}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.priceText}>₹{item.price}</Text>
                  <Text style={styles.discountText}>15% OFF</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Add Button */}
          <View style={{ marginTop: 12 }}>
            {qty > 0 ? (
              <View style={styles.qtyBox}>
                <TouchableOpacity onPress={() => handleUpdate(item, qty - 1)} style={styles.qtyBtn}>
                  <Minus size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={() => handleUpdate(item, qty + 1)} style={styles.qtyBtn}>
                  <Plus size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => openQuantityModal(item)}>
                <Text style={styles.addBtnText}>Add to cart</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f2f2" />
      
      {/* CUSTOM HEADER */}
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
          showBack={true} 
          onBackPress={handleBack} 
          title={shop?.name || 'Shop Details'} 
          subtitle={shop?.category || 'Buy daily essentials'} 
          transparent={true} 
          showLogo={false} 
        />
      </LinearGradient>

      {/* OVERLAPPING SEARCH BAR */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search products in this shop..."
        />

      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        {shop && (
          <View style={styles.shopDetailsCard}>
            <Text style={styles.shopNameText}>{shop.name}</Text>
            <Text style={styles.shopDescText} numberOfLines={2}>{shop.description}</Text>
            <View style={styles.shopMetaRow}>
              <View style={styles.shopRatingBox}>
                <Star size={12} color="#fff" fill="#fff" />
                <Text style={styles.shopRatingText}>{shop.rating || '4.5'}</Text>
              </View>
              <Text style={styles.shopCategoryText}>{shop.category}</Text>
              <Text style={[styles.shopStatusText, { color: shop.isOnline ? '#6C47FF' : '#EF4444' }]}>
                • {shop.isOnline ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterPill, selectedFilter === 'All' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('All')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'All' && styles.filterPillTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterPill, selectedFilter === 'Branded Substitute' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('Branded Substitute')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'Branded Substitute' && styles.filterPillTextActive]}>Branded Substitute 💊</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PRODUCT GRID */}
      <FlatList
        data={filteredProducts}
        keyExtractor={item => item._id}
        renderItem={renderProduct}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.rowWrapper}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No products found.</Text>
        }
      />

      {/* FLOATING CART BANNER */}
      {totalItems > 0 && (
        <View style={styles.cartBannerContainer}>
          <View style={styles.cartBanner}>
            <View>
              <Text style={styles.cartItemsText}>{totalItems} items</Text>
              <Text style={styles.cartSubText}>In cart</Text>
            </View>
            <TouchableOpacity 
              style={styles.checkoutBtn}
              onPress={() => navigation.navigate('Cart')}
            >
              <Text style={styles.checkoutBtnText}>View Cart</Text>
              <ShoppingCart size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* QUANTITY MODAL */}
      <Modal visible={qtyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Quantity</Text>
              <TouchableOpacity onPress={() => setQtyModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {[1, 2, 3, 4, 5].map((qty) => (
              <TouchableOpacity 
                key={qty} 
                style={styles.modalOption}
                onPress={() => selectQtyFromModal(qty)}
              >
                <Text style={styles.modalOptionText}>
                  {qty} {qty === 5 && <Text style={{ color: '#888', fontWeight: '400' }}>Max Quantity</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  
  // Header Styles
  headerContainer: {
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expressText: { fontSize: 13 },
  locationText: { fontSize: 13, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    fontSize: 15,
    color: '#111',
    padding: 0,
  },
  shopDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shopNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  shopDescText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C47FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  shopRatingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  shopCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginRight: 6,
  },
  shopStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    backgroundColor: '#fff'
  },
  filterPillActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444'
  },
  filterPillTextActive: {
    color: '#fff'
  },

  // Grid Styles
  listContent: {
    padding: 12,
    paddingBottom: 120, // space for cart banner
  },
  rowWrapper: {
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },

  // Product Card
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'column',
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#fff',
    position: 'relative',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  ratingPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde047'
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#854d0e',
    marginLeft: 4,
  },
  productInfo: {
    padding: 12,
    paddingTop: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 18,
    marginBottom: 4,
  },
  productSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  priceRow: {
    marginTop: 4,
  },
  mrpText: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  
  // Buttons
  addBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6C47FF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },

  // Cart Banner
  cartBannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f9f9f9', // blends with list bottom
  },
  cartBanner: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  cartItemsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cartSubText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  }
});

export default ShopDetailScreen;
