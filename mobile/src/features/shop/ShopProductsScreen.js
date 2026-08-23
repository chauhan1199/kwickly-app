import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  TextInput, 
  Modal, 
  Alert, 
  Image, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { 
  Bell, 
  Search, 
  Image as ImageIcon, 
  X, 
  RefreshCw, 
  Moon, 
  Sun, 
  ChevronDown, 
  Plus, 
  Edit3, 
  Trash2, 
  Package, 
  Tag, 
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { shopService } from '../../services/shopService';
import { getImageUrl, requestCameraPermission } from '../../utils/helpers';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ShopProductsScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const styles = createStyles(theme, isDarkMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    minQty: '1',
    image: null,
    brand: '',
    unit: 'Piece',
    category: 'General',
    description: '',
    attributes: []
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const UNIT_OPTIONS = [
    'Piece', 'Kg (Kilogram)', 'Gram', 'Quintal (100 Kg)', 'Ton', 
    'Liter', 'Milliliter (ml)', 'Dozen (12 pcs)', 'Pack', 'Box', 
    'Bundle', 'Pair', 'Set', 'Bottle', 'Pouch', 'Bag', 'Roll', 
    'Sheet', 'Carton', 'Bar'
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await shopService.getShopProducts();
      if (res.data?.status === 'success') {
        const mapped = res.data.data.map((p, i) => {
          const colors = ['#F43F5E', '#84CC16', '#EAB308', '#0EA5E9', '#8B5CF6'];
          const bgs = ['#FFE4E6', '#ECFCCB', '#FEF9C3', '#E0F2FE', '#EDE9FE'];
          const idx = i % colors.length;
          return {
            id: p._id,
            name: p.name,
            stock: p.stock || 0,
            minQty: p.minQty || 1,
            price: p.price || 0,
            brand: p.brand || '',
            unit: p.unit || 'Piece',
            category: p.category || 'General',
            description: p.description || '',
            attributes: p.attributes || [],
            icon: p.category === 'Grocery' ? '🛒' : '📦',
            color: colors[idx],
            bg: bgs[idx],
            imageUrl: p.imageUrl,
            original: p
          };
        });
        setProducts(mapped);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({ name: '', price: '', stock: '', minQty: '1', image: null, brand: '', unit: 'Piece', category: 'General', description: '', attributes: [] });
    setIsModalVisible(true);
  };

  const handleOpenEditModal = (product) => {
    setModalMode('edit');
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      minQty: product.minQty.toString(),
      brand: product.brand,
      unit: product.unit,
      category: product.category,
      description: product.description,
      attributes: product.attributes || [],
      id: product.id,
      icon: product.icon,
      color: product.color,
      bg: product.bg,
      imageUrl: product.imageUrl,
      image: null
    });
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product from your store catalog?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await shopService.deleteProduct(id);
          fetchProducts();
        } catch (e) {
          Alert.alert('Error', 'Failed to delete product');
        }
      }}
    ]);
  };

  const pickImage = () => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to upload product image',
      [
        {
          text: '📷 Take Photo (Camera)',
          onPress: async () => {
            try {
              const hasPerm = await requestCameraPermission();
              if (!hasPerm) {
                Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
                return;
              }
              const result = await launchCamera({
                mediaType: 'photo',
                quality: 0.6,
                maxWidth: 800,
                maxHeight: 800,
                includeBase64: true,
                saveToPhotos: true,
              });
              if (!result.didCancel && result.assets?.length > 0) {
                setFormData(prev => ({ ...prev, image: result.assets[0] }));
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to open camera');
            }
          },
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            try {
              const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.6,
                maxWidth: 800,
                maxHeight: 800,
                selectionLimit: 1,
                includeBase64: true,
              });
              if (!result.didCancel && result.assets?.length > 0) {
                setFormData(prev => ({ ...prev, image: result.assets[0] }));
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to open gallery');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const addAttribute = () => {
    setFormData({ ...formData, attributes: [...(formData.attributes || []), { name: '', value: '' }] });
  };

  const removeAttribute = (index) => {
    const newAttrs = [...formData.attributes];
    newAttrs.splice(index, 1);
    setFormData({ ...formData, attributes: newAttrs });
  };

  const updateAttribute = (index, field, val) => {
    const newAttrs = [...formData.attributes];
    newAttrs[index][field] = val;
    setFormData({ ...formData, attributes: newAttrs });
  };

  const handleSave = async () => {
    const nameStr = (formData.name || '').trim();
    if (!nameStr) {
      Alert.alert('Validation Error', 'Product name is required.');
      return;
    }
    const priceNum = Number(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price greater than 0.');
      return;
    }
    const stockNum = Number(formData.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Validation Error', 'Please enter a valid stock quantity.');
      return;
    }
    const minQtyNum = Number(formData.minQty || '1');
    if (isNaN(minQtyNum) || minQtyNum < 1) {
      Alert.alert('Validation Error', 'Minimum quantity must be at least 1.');
      return;
    }

    try {
      setSaving(true);
      const cleanedAttributes = (formData.attributes || [])
        .filter(a => a && a.name && String(a.name).trim() && a.value && String(a.value).trim())
        .map(a => ({ name: String(a.name).trim(), value: String(a.value).trim() }));

      const payload = {
        name: nameStr,
        price: priceNum,
        stock: stockNum,
        minQty: minQtyNum,
        brand: String(formData.brand || '').trim(),
        unit: String(formData.unit || 'Piece').trim(),
        category: String(formData.category || 'General').trim() || 'General',
        description: String(formData.description || '').trim(),
        attributes: cleanedAttributes,
      };
      
      if (formData.image?.base64) {
        payload.imageBase64 = `data:${formData.image.type || 'image/jpeg'};base64,${formData.image.base64}`;
      }

      if (modalMode === 'add') {
        await shopService.createProduct(payload);
        Alert.alert('Success 🎉', 'New product added to catalog.');
      } else {
        await shopService.updateProduct(formData.id, payload);
        Alert.alert('Success ✅', 'Product updated successfully.');
      }

      setIsModalVisible(false);
      fetchProducts();
    } catch (e) {
      Alert.alert('Save Failed', e?.response?.data?.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
        {/* App Bar */}
        <View style={styles.appBar}>
          <View>
            <Text style={styles.appBarTitle}>Store Catalog</Text>
            <Text style={styles.appBarSubtitle}>{products.length} products listed</Text>
          </View>

          <View style={styles.appBarActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme} activeOpacity={0.7}>
              {isDarkMode ? <Sun size={19} color={theme.colors.text} /> : <Moon size={19} color={theme.colors.text} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={fetchProducts} activeOpacity={0.7}>
              <RefreshCw size={19} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ShopNotifications')} activeOpacity={0.7}>
              <Bell size={19} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Add Product Button */}
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal} activeOpacity={0.88}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addBtnText}>+ Add New Product</Text>
          </TouchableOpacity>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color={theme.colors.textDim} style={styles.searchIcon} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search by product name, brand..."
              placeholderTextColor={theme.colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
                <X size={16} color={theme.colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Filter Pills */}
          {categories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8 }}>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Product List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C47FF" />
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Package size={36} color="#6C47FF" />
              </View>
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptyText}>Tap "+ Add New Product" to add items to your catalog.</Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {filteredProducts.map((product) => {
                const resolvedImage = getImageUrl(product.imageUrl);
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= 5;

                return (
                  <View key={product.id} style={styles.productCard}>
                    
                    {/* Top Row: Thumbnail + Details */}
                    <View style={styles.productTopRow}>
                      <View style={styles.productThumbnailWrap}>
                        {resolvedImage ? (
                          <Image 
                            source={{ uri: resolvedImage }} 
                            style={styles.productThumbnail} 
                            resizeMode="cover" 
                          />
                        ) : (
                          <View style={[styles.productThumbnail, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 26 }}>{product.icon}</Text>
                          </View>
                        )}
                        {/* Stock status overlay */}
                        <View style={[
                          styles.stockOverlay,
                          { backgroundColor: isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981' }
                        ]}>
                          <Text style={styles.stockOverlayText}>
                            {isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.productDetails}>
                        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                        {product.brand ? (
                          <Text style={styles.productBrand}>Brand: <Text style={{ fontWeight: '700', color: theme.colors.text }}>{product.brand}</Text></Text>
                        ) : null}

                        {/* Badges / Chips */}
                        <View style={styles.badgeRow}>
                          <View style={styles.detailBadge}>
                            <Text style={styles.detailBadgeText}>Min {product.minQty}</Text>
                          </View>
                          <View style={styles.detailBadge}>
                            <Text style={styles.detailBadgeText}>{product.unit}</Text>
                          </View>
                          {product.category && product.category !== 'General' ? (
                            <View style={styles.detailBadge}>
                              <Text style={styles.detailBadgeText}>{product.category}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Price */}
                        <Text style={styles.productPrice}>
                          ₹{product.price.toFixed(2)} <Text style={styles.unitSuffix}>/ {product.unit}</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.cardDivider} />

                    {/* Bottom Actions */}
                    <View style={styles.productActionsRow}>
                      <TouchableOpacity 
                        style={styles.editActionBtn} 
                        onPress={() => handleOpenEditModal(product)}
                        activeOpacity={0.8}
                      >
                        <Edit3 size={15} color="#6C47FF" />
                        <Text style={styles.editActionText}>Edit Product</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.deleteActionBtn} 
                        onPress={() => handleDelete(product.id)}
                        activeOpacity={0.8}
                      >
                        <Trash2 size={15} color="#EF4444" />
                        <Text style={styles.deleteActionText}>Delete</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Add/Edit Product Modal */}
        <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'add' ? 'Add New Product' : 'Edit Product Details'}
                </Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                  <X size={20} color={theme.colors.textDim} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                
                {/* Image Picker Box */}
                <TouchableOpacity style={styles.imagePickerCard} onPress={pickImage} activeOpacity={0.85}>
                  {formData.image ? (
                    <Image source={{ uri: formData.image.uri }} style={styles.imagePreview} />
                  ) : formData.imageUrl ? (
                    <Image source={{ uri: getImageUrl(formData.imageUrl) }} style={styles.imagePreview} />
                  ) : (
                    <View style={styles.imagePickerPlaceholder}>
                      <ImageIcon size={32} color="#6C47FF" />
                      <Text style={styles.imagePickerText}>+ Tap to upload product photo</Text>
                      <Text style={styles.imagePickerSub}>Supports Camera and Photo Gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.formLabel}>Product Title *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="e.g. Dettol Handwash Refill 750ml"
                  placeholderTextColor={theme.colors.textDim}
                  value={formData.name}
                  onChangeText={(t) => setFormData({...formData, name: t})}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.formLabel}>Category</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="e.g. Personal Care"
                      placeholderTextColor={theme.colors.textDim}
                      value={formData.category}
                      onChangeText={(t) => setFormData({...formData, category: t})}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.formLabel}>Brand</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="e.g. Dettol"
                      placeholderTextColor={theme.colors.textDim}
                      value={formData.brand}
                      onChangeText={(t) => setFormData({...formData, brand: t})}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.formLabel}>Price (₹) *</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="119"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textDim}
                      value={formData.price}
                      onChangeText={(t) => setFormData({...formData, price: t.replace(/[^0-9.]/g, '')})}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.formLabel}>Stock Inventory *</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="50"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textDim}
                      value={formData.stock}
                      onChangeText={(t) => setFormData({...formData, stock: t.replace(/[^0-9]/g, '')})}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.formLabel}>Min Order Qty</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="1"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textDim}
                      value={formData.minQty}
                      onChangeText={(t) => setFormData({...formData, minQty: t.replace(/[^0-9]/g, '')})}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.formLabel}>Unit Type</Text>
                    <TouchableOpacity 
                      style={[styles.formInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>{formData.unit}</Text>
                      <ChevronDown size={16} color={theme.colors.textDim} />
                    </TouchableOpacity>
                  </View>
                </View>

                {showUnitDropdown && (
                  <View style={styles.dropdownBox}>
                    <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                      {UNIT_OPTIONS.map((u) => (
                        <TouchableOpacity 
                          key={u} 
                          style={styles.dropdownOption}
                          onPress={() => {
                            setFormData({ ...formData, unit: u.split(' ')[0] });
                            setShowUnitDropdown(false);
                          }}
                        >
                          <Text style={{ color: theme.colors.text, fontSize: 13 }}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Attributes */}
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.formLabel}>Custom Attributes</Text>
                    <TouchableOpacity onPress={addAttribute}>
                      <Text style={{ color: '#6C47FF', fontWeight: '800', fontSize: 12 }}>+ Add Spec</Text>
                    </TouchableOpacity>
                  </View>

                  {formData.attributes?.map((attr, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                      <TextInput 
                        style={[styles.formInput, { flex: 1, marginBottom: 0, height: 42 }]} 
                        placeholder="Key (e.g. Size)"
                        placeholderTextColor={theme.colors.textDim}
                        value={attr.name}
                        onChangeText={(t) => updateAttribute(index, 'name', t)}
                      />
                      <TextInput 
                        style={[styles.formInput, { flex: 1, marginBottom: 0, height: 42 }]} 
                        placeholder="Value (e.g. 750ml)"
                        placeholderTextColor={theme.colors.textDim}
                        value={attr.value}
                        onChangeText={(t) => updateAttribute(index, 'value', t)}
                      />
                      <TouchableOpacity onPress={() => removeAttribute(index)} style={{ padding: 6 }}>
                        <X size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <TouchableOpacity 
                  style={[styles.primarySaveBtn, saving && { opacity: 0.7 }]} 
                  onPress={handleSave} 
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primarySaveBtnText}>{modalMode === 'add' ? 'Save Product to Catalog ✅' : 'Update Product ✅'}</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },

  scrollContent: {
    padding: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginBottom: 14,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },

  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
  },

  /* ── Product Card ── */
  productsList: {
    gap: 14,
  },
  productCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.25 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  productTopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  productThumbnailWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  productThumbnail: {
    width: '100%',
    height: '100%',
  },
  stockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  stockOverlayText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  productDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
  },
  productBrand: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 4,
  },
  detailBadge: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  detailBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#6C47FF',
  },
  unitSuffix: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  cardDivider: {
    height: 1,
    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
    marginVertical: 12,
  },
  productActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  deleteActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    borderRadius: 14,
  },
  imagePickerCard: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
    marginTop: 4,
  },
  imagePickerSub: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 5,
    marginTop: 8,
  },
  formInput: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 6,
  },
  formRow: {
    flexDirection: 'row',
  },
  dropdownBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    marginTop: 4,
    marginBottom: 8,
    padding: 6,
  },
  dropdownOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  primarySaveBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primarySaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default ShopProductsScreen;
