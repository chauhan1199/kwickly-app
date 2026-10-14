import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
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

import ProductImage from '../../components/ui/ProductImage';

const ShopDetailScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  
  const { shopId, shopData } = route.params || {};
  
  const [shop, setShop] = useState(shopData || null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(!shopData);
  
  const { cart: globalCart, addToCart, updateItem, removeItem, clearCart, fetchCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  
  // Quantity Modal State
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [selectedProductForQty, setSelectedProductForQty] = useState(null);

  const fetchShopAndProducts = useCallback(async () => {
    if (!shopId) return;
    try {
      if (!shop) setLoading(true);
      const [shopRes, productsRes] = await Promise.allSettled([
        shopService.getShopById(shopId),
        shopService.getProducts(shopId)
      ]);
      
      if (shopRes.status === 'fulfilled' && shopRes.value?.data?.status === 'success') {
        setShop(shopRes.value.data.data);
      }
      
      if (productsRes.status === 'fulfilled' && productsRes.value?.data?.status === 'success') {
        const prodData = productsRes.value.data.data;
        setProducts(Array.isArray(prodData) ? prodData : (prodData?.products || []));
      }
    } catch (e) {
      if (!shop && !shopData) {
        Alert.alert('Error', 'Failed to load shop details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, shop, shopData]);

  useEffect(() => {
    fetchShopAndProducts();
    if (fetchCart) fetchCart();
  }, [shopId, fetchShopAndProducts, fetchCart]);

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
    const mrp = Number(item.mrp);
    const price = Number(item.price);
    const hasMrpDiscount = mrp > 0 && price > 0 && mrp > price;
    const discountPct = hasMrpDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

    return (
      <View style={styles.productCard}>
        {/* Top Image Section */}
        <View style={styles.imageContainer}>
          <ProductImage
            imageUrl={item.imageUrl}
            name={item.name}
            style={[styles.productImage, { borderRadius: 10 }]}
            resizeMode="contain"
            iconSize={36}
            isDarkMode={isDarkMode}
          />
          {/* Rating pill only when the product carries a real rating */}
          {Number(item.rating?.average ?? item.rating) > 0 ? (
            <View style={styles.ratingPill}>
              <Star size={10} color="#EAB308" fill="#EAB308" />
              <Text style={styles.ratingText}>{Number(item.rating?.average ?? item.rating).toFixed(1)}</Text>
            </View>
          ) : null}
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
                {/* MRP strike-through and discount only when the shop set a real MRP above the price */}
                {hasMrpDiscount ? (
                  <Text style={styles.mrpText}>MRP ₹{item.mrp}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.priceText}>₹{item.price}</Text>
                  {hasMrpDiscount ? (
                    <Text style={styles.discountText}>{discountPct}% OFF</Text>
                  ) : null}
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#A78BFA' : '#6C47FF'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#4C1D95' : '#6C47FF'} />
      
      {/* CUSTOM HEADER */}
      <LinearGradient
        colors={isDarkMode ? ['#4C1D95', '#6D28D9'] : ['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, position: 'relative', overflow: 'hidden' }}
      >
        {/* Dynamic background shapes */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

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
      <View pointerEvents="box-none" style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search products in shop..."
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
                <Text style={styles.shopRatingText}>{Number(shop.rating) > 0 ? Number(shop.rating).toFixed(1) : 'New'}</Text>
              </View>
              <Text style={styles.shopCategoryText}>{shop.category}</Text>
              <Text style={[styles.shopStatusText, { color: shop.isOnline ? (isDarkMode ? '#34D399' : '#10B981') : '#EF4444' }]}>
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
      <Modal visible={qtyModalVisible} transparent animationType="fade" onRequestClose={() => setQtyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Quantity</Text>
              <TouchableOpacity onPress={() => setQtyModalVisible(false)}>
                <X size={24} color={isDarkMode ? '#F8FAFC' : '#333'} />
              </TouchableOpacity>
            </View>
            {[1, 2, 3, 4, 5].map((qty) => (
              <TouchableOpacity 
                key={qty} 
                style={styles.modalOption}
                onPress={() => selectQtyFromModal(qty)}
              >
                <Text style={styles.modalOptionText}>
                  {qty} {qty === 5 && <Text style={{ color: isDarkMode ? '#94A3B8' : '#888', fontWeight: '400' }}>Max Quantity</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD',
  },
  
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
  expressText: { fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B' },
  locationText: { fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.2 : 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    fontSize: 15,
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
    padding: 0,
  },
  shopDetailsCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.25 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shopNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
    marginBottom: 4,
  },
  shopDescText: {
    fontSize: 13,
    color: isDarkMode ? '#94A3B8' : '#64748B',
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
    backgroundColor: isDarkMode ? '#7C3AED' : '#6C47FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
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
    color: isDarkMode ? '#94A3B8' : '#475569',
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
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginRight: 10,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
  },
  filterPillActive: {
    backgroundColor: isDarkMode ? '#7C3AED' : '#6C47FF',
    borderColor: isDarkMode ? '#7C3AED' : '#6C47FF',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  emptyText: { 
    textAlign: 'center', 
    color: isDarkMode ? '#94A3B8' : '#64748B', 
    marginTop: 40,
    fontSize: 14,
    fontWeight: '500',
  },

  // Product Card
  productCard: {
    width: '48%',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDarkMode ? 0.25 : 0.05,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'column',
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    position: 'relative',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#F1F5F9',
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
    backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.18)' : '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(234, 179, 8, 0.35)' : '#FDE047',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: isDarkMode ? '#FDE047' : '#854D0E',
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
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
    lineHeight: 18,
    marginBottom: 4,
  },
  productSubtitle: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginBottom: 10,
  },
  priceRow: {
    marginTop: 4,
  },
  mrpText: {
    fontSize: 11,
    color: isDarkMode ? '#64748B' : '#94A3B8',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#34D399' : '#10B981',
  },
  
  // Buttons
  addBtn: {
    backgroundColor: isDarkMode ? '#7C3AED' : '#6C47FF',
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
    backgroundColor: isDarkMode ? '#7C3AED' : '#6C47FF',
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 8,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#F1F5F9',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? '#F8FAFC' : '#0F172A',
  },

  // Cart Banner
  cartBannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: isDarkMode ? 'rgba(11, 15, 25, 0.95)' : 'rgba(248, 249, 253, 0.95)',
  },
  cartBanner: {
    backgroundColor: isDarkMode ? '#7C3AED' : '#6C47FF',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cartItemsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cartSubText: {
    fontSize: 12,
    color: '#E0E7FF',
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
