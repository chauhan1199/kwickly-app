import React, { useState } from 'react';
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
  ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, Search, Image as ImageIcon, X, RefreshCw, Moon, Sun, Menu, ChevronDown } from 'lucide-react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { shopService } from '../../services/shopService';
import { getImageUrl, requestCameraPermission } from '../../utils/helpers';
import { SafeAreaView } from 'react-native-safe-area-context';

const ShopProductsScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const styles = createStyles(theme, isDarkMode);

  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  
  // Dummy form data
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

  React.useEffect(() => {
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
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
                quality: 0.5,
                maxWidth: 600,
                maxHeight: 600,
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
                quality: 0.5,
                maxWidth: 600,
                maxHeight: 600,
                selectionLimit: 1,
                includeBase64: true,
              });
              if (!result.didCancel && result.assets?.length > 0) {
                setFormData(prev => ({ ...prev, image: result.assets[0] }));
              } else if (result.errorCode) {
                Alert.alert('Error', 'Failed to pick image: ' + result.errorMessage);
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
    const nameStr = String(formData.name || '').trim();
    if (!nameStr || nameStr.length < 2) {
      Alert.alert('Validation Error', 'Product name must be at least 2 characters.');
      return;
    }

    const priceRaw = String(formData.price || '').trim();
    if (!priceRaw) {
      Alert.alert('Validation Error', 'Price is required.');
      return;
    }
    const priceNum = Number(priceRaw);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Validation Error', 'Price must be a valid numeric value greater than 0 (e.g. 100).');
      return;
    }

    const stockRaw = String(formData.stock ?? '').trim();
    if (stockRaw === '') {
      Alert.alert('Validation Error', 'Stock quantity is required.');
      return;
    }
    const stockNum = Number(stockRaw);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      Alert.alert('Validation Error', 'Stock must be a valid non-negative integer (e.g. 10).');
      return;
    }

    const minQtyRaw = String(formData.minQty ?? '1').trim();
    const minQtyNum = Number(minQtyRaw);
    if (isNaN(minQtyNum) || minQtyNum < 1 || !Number.isInteger(minQtyNum)) {
      Alert.alert('Validation Error', 'Minimum quantity must be a valid integer of at least 1 (e.g. 1).');
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
      } else {
        await shopService.updateProduct(formData.id, payload);
      }

      setIsModalVisible(false);
      fetchProducts();
    } catch (e) {
      setSaving(false);
      const errDetails = e?.response?.data?.errors;
      let errMsg = e?.response?.data?.message || e.message;
      if (Array.isArray(errDetails) && errDetails.length > 0) {
        errMsg = errDetails.join('\n• ');
      }
      Alert.alert('Save Failed', errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View>
            <Text style={styles.appBarTitle}>Products</Text>
            <Text style={styles.appBarSubtitle}>Manage your catalog</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={toggleTheme}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={fetchProducts}>
            <RefreshCw size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={() => navigation.navigate('ShopNotifications')}>
            <Bell size={20} color={theme.colors.text} />
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
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addBtnText}>+ Add New Product</Text>
        </TouchableOpacity>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.textDim} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={theme.colors.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Product List */}
        <View style={styles.productsList}>
          {filteredProducts.map((product) => {
            const resolvedImage = getImageUrl(product.imageUrl);
            return (
            <View key={product.id} style={styles.productCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.productIconBox, { backgroundColor: product.bg, overflow: 'hidden' }]}>
                  {resolvedImage ? (
                    <Image 
                      source={{ uri: resolvedImage }} 
                      style={{ width: '100%', height: '100%' }} 
                      resizeMode="cover" 
                    />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{product.icon}</Text>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.brand ? <Text style={{ color: theme.colors.textDim, fontSize: 12, marginBottom: 4 }}>Brand: {product.brand}</Text> : null}
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{product.stock} Stock</Text>
                      </View>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>Min {product.minQty}</Text>
                      </View>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{product.unit}</Text>
                      </View>
                      {product.attributes?.map((attr, idx) => (
                        <View key={idx} style={styles.tagPill}>
                          <Text style={styles.tagPillText}>{attr.name}: {attr.value}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={styles.productPrice}>₹{product.price} / {product.unit}</Text>
                </View>
              </View>
              
              <View style={styles.productActions}>
                <TouchableOpacity style={[styles.editBtn, { flex: 1, marginRight: 6 }]} onPress={() => handleOpenEditModal(product)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deleteBtn, { flex: 1, marginLeft: 6 }]} onPress={() => handleDelete(product.id)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )})}
          {filteredProducts.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textDim }}>No products found.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Product Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Add New Product' : `Edit: ${formData.name}`}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name</Text>
                <TextInput 
                  style={styles.inputField} 
                  placeholder="e.g. Tata Salt 1kg"
                  placeholderTextColor={theme.colors.textDim}
                  value={formData.name}
                  onChangeText={(t) => setFormData({...formData, name: t})}
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput 
                    style={styles.inputField} 
                    placeholder="e.g. Grocery"
                    placeholderTextColor={theme.colors.textDim}
                    value={formData.category}
                    onChangeText={(t) => setFormData({...formData, category: t})}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Brand</Text>
                  <TextInput 
                    style={styles.inputField} 
                    placeholder="e.g. Asian Paints"
                    placeholderTextColor={theme.colors.textDim}
                    value={formData.brand}
                    onChangeText={(t) => setFormData({...formData, brand: t})}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput 
                  style={[styles.inputField, { height: 80, textAlignVertical: 'top' }]} 
                  placeholder="Enter product description..."
                  placeholderTextColor={theme.colors.textDim}
                  multiline
                  value={formData.description}
                  onChangeText={(t) => setFormData({...formData, description: t})}
                />
              </View>

              <View style={[styles.inputGroup, { zIndex: 5 }]}>
                <Text style={styles.inputLabel}>Selling Unit</Text>
                <TouchableOpacity 
                  style={[styles.inputField, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                >
                  <Text style={{ color: formData.unit ? theme.colors.text : theme.colors.textDim }}>
                    {formData.unit || 'Select unit'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.textDim} />
                </TouchableOpacity>
                <Modal visible={showUnitDropdown} transparent animationType="fade" onRequestClose={() => setShowUnitDropdown(false)}>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowUnitDropdown(false)}>
                    <View style={{ width: '85%', maxHeight: '60%', backgroundColor: theme.colors.surface, borderRadius: 16, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8 }}>
                      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Select Unit</Text>
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {UNIT_OPTIONS.map((unit, i) => (
                          <TouchableOpacity 
                            key={i} 
                            style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < UNIT_OPTIONS.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}
                            onPress={() => { setFormData({...formData, unit}); setShowUnitDropdown(false); }}
                          >
                            <Text style={{ color: formData.unit === unit ? theme.colors.primary : theme.colors.text, fontWeight: formData.unit === unit ? 'bold' : 'normal', fontSize: 15 }}>{unit}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Price (₹)</Text>
                  <TextInput 
                    style={styles.inputField} 
                    placeholder="99"
                    keyboardType="decimal-pad"
                    placeholderTextColor={theme.colors.textDim}
                    value={formData.price}
                    onChangeText={(t) => setFormData({...formData, price: t.replace(/[^0-9.]/g, '')})}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput 
                    style={styles.inputField} 
                    placeholder="50"
                    keyboardType="number-pad"
                    placeholderTextColor={theme.colors.textDim}
                    value={formData.stock}
                    onChangeText={(t) => setFormData({...formData, stock: t.replace(/[^0-9]/g, '')})}
                  />
                  <Text style={{ fontSize: 10, color: theme.colors.textDim, marginTop: 4 }}>Total inventory</Text>
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Min Qty</Text>
                  <TextInput 
                    style={styles.inputField} 
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={theme.colors.textDim}
                    value={formData.minQty}
                    onChangeText={(t) => setFormData({...formData, minQty: t.replace(/[^0-9]/g, '')})}
                  />
                  <Text style={{ fontSize: 10, color: theme.colors.textDim, marginTop: 4 }}>Min order limit</Text>
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Image</Text>
                  <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage}>
                    {formData.image ? (
                      <Image source={{ uri: formData.image.uri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                    ) : formData.imageUrl ? (
                      <Image source={{ uri: getImageUrl(formData.imageUrl) }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                    ) : (
                      <Text style={styles.imageUploadText}>+ Upload Image</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Dynamic Attributes</Text>
                  <TouchableOpacity onPress={addAttribute}>
                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>+ Add Attribute</Text>
                  </TouchableOpacity>
                </View>
                
                {formData.attributes?.map((attr, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <TextInput 
                      style={[styles.inputField, { flex: 1, marginBottom: 0 }]} 
                      placeholder="Name (e.g. Length)"
                      placeholderTextColor={theme.colors.textDim}
                      value={attr.name}
                      onChangeText={(t) => updateAttribute(index, 'name', t)}
                    />
                    <TextInput 
                      style={[styles.inputField, { flex: 1, marginBottom: 0 }]} 
                      placeholder="Value (e.g. 10 ft)"
                      placeholderTextColor={theme.colors.textDim}
                      value={attr.value}
                      onChangeText={(t) => updateAttribute(index, 'value', t)}
                    />
                    <TouchableOpacity onPress={() => removeAttribute(index)} style={{ padding: 8 }}>
                      <X size={20} color="#F43F5E" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryBtnText}>{modalMode === 'add' ? 'Add Product' : 'Save Changes'}</Text>}
                </TouchableOpacity>
                {modalMode === 'edit' && (
                  <TouchableOpacity style={styles.modalDangerBtn} onPress={() => handleDelete(formData.id)}>
                    <Text style={styles.modalDangerBtnText}>Delete Product</Text>
                  </TouchableOpacity>
                )}
              </View>

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
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 1,
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#F4F4F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: theme.colors.text,
  },
  productsList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  productCard: {
    flexDirection: 'column',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  productIconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  tagPill: {
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#F3F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6C47FF',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6C47FF',
  },
  productActions: {
    flexDirection: 'row',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.12)' : '#F3F0FF',
    borderWidth: 1,
    borderColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  imageUploadBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
  },
  imageUploadText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    marginTop: 24,
    gap: 12,
  },
  modalPrimaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  modalDangerBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  modalDangerBtnText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '800',
  }
});

export default ShopProductsScreen;
