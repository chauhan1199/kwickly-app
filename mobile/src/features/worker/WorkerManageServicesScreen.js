import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  RefreshControl
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import AppBar from '../../components/AppBar';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import { workerService } from '../../services/workerService';
import { jobService } from '../../services/jobService';
import { getImageUrl } from '../../utils/helpers';
import { Settings, Wrench, Zap, X, MapPin, Plus, Minus, Trash2, CheckSquare, Square } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const WorkerManageServicesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState([]);
  const [radius, setRadius] = useState(10);
  
  const [allCategories, setAllCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Subcategory Selection Modal State
  const [subCatModalVisible, setSubCatModalVisible] = useState(false);
  const [selectedCategoryForSubCats, setSelectedCategoryForSubCats] = useState(null);
  const [tempSelectedSubCats, setTempSelectedSubCats] = useState([]);

  // Suggestion Modal State
  const [suggestModalVisible, setSuggestModalVisible] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestType, setSuggestType] = useState('CATEGORY');
  const [suggestParentCat, setSuggestParentCat] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, catRes] = await Promise.all([
        workerService.getProfile(),
        jobService.getCategories()
      ]);
      const profileData = profileRes.data.data;
      const catData = catRes.data.data;
      
      setServices(profileData.services || []);
      setRadius(profileData.serviceRadius || 10);
      setAllCategories(catData || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [profileRes, catRes] = await Promise.all([
        workerService.getProfile(),
        jobService.getCategories()
      ]);
      setServices(profileRes.data.data.services || []);
      setRadius(profileRes.data.data.serviceRadius || 10);
      setAllCategories(catRes.data.data || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh services');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveRadius = async () => {
    try {
      setSaving(true);
      await workerService.updateLocation({ radius });
      Alert.alert('Success', 'Service radius updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update radius');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleService = async (serviceIndex) => {
    const newServices = [...services];
    newServices[serviceIndex].isActive = !newServices[serviceIndex].isActive;
    setServices(newServices);
    saveServices(newServices);
  };

  const handleRemoveService = async (serviceIndex) => {
    const newServices = services.filter((_, idx) => idx !== serviceIndex);
    setServices(newServices);
    saveServices(newServices);
  };

  const handleAddService = (categoryObj) => {
    if (services.find(s => s.category?._id === categoryObj._id || s.category === categoryObj._id)) {
      Alert.alert('Info', 'Category already added. You can manage its subcategories from the list.');
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSelectedCategoryForSubCats(categoryObj);
    setTempSelectedSubCats([]);
    setSubCatModalVisible(true);
  };

  const handleManageSubCats = (serviceObj) => {
    setSelectedCategoryForSubCats(serviceObj.category);
    setTempSelectedSubCats(serviceObj.subcategories || []);
    setSubCatModalVisible(true);
  };

  const toggleTempSubCat = (subCatName) => {
    if (tempSelectedSubCats.includes(subCatName)) {
      setTempSelectedSubCats(tempSelectedSubCats.filter(name => name !== subCatName));
    } else {
      setTempSelectedSubCats([...tempSelectedSubCats, subCatName]);
    }
  };

  const handleSaveSubCats = () => {
    if (!selectedCategoryForSubCats) return;
    
    const existsIndex = services.findIndex(s => s.category?._id === selectedCategoryForSubCats._id || s.category === selectedCategoryForSubCats._id);
    
    let newServices = [...services];
    if (existsIndex >= 0) {
      newServices[existsIndex].subcategories = tempSelectedSubCats;
    } else {
      newServices.push({
        category: selectedCategoryForSubCats._id,
        subcategories: tempSelectedSubCats,
        isActive: true
      });
    }
    
    setServices(newServices);
    saveServices(newServices);
    setSubCatModalVisible(false);
  };

  const handleSuggestSubmit = async () => {
    if (!suggestName.trim()) return Alert.alert('Error', 'Please enter a name');
    if (suggestType === 'SUBCATEGORY' && !suggestParentCat) return Alert.alert('Error', 'Please select a parent category');

    try {
      setSaving(true);
      await workerService.submitCategorySuggestion({
        name: suggestName.trim(),
        type: suggestType,
        parentCategory: suggestParentCat
      });
      Alert.alert('Success', 'Your suggestion has been sent to the admin for review. Once approved, it will appear here.');
      setSuggestModalVisible(false);
      setSuggestName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit suggestion');
    } finally {
      setSaving(false);
    }
  };

  const saveServices = async (updatedServices) => {
    try {
      const payload = updatedServices.map(s => ({
        category: s.category?._id || s.category,
        subcategories: s.subcategories || [],
        isActive: s.isActive
      }));
      await workerService.updateServices(payload);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save services');
    }
  };

  const renderIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('elec') || t.includes('zap')) return <Zap size={20} color="#001016" />;
    if (t.includes('appliance') || t.includes('setting')) return <Settings size={20} color="#001016" />;
    return <Wrench size={20} color="#001016" />;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Get full category details from allCategories to render subcategory options
  const fullCategoryDetail = selectedCategoryForSubCats 
    ? allCategories.find(c => c._id === (selectedCategoryForSubCats._id || selectedCategoryForSubCats)) 
    : null;

  const filteredCategories = allCategories.filter(c => {
    const query = searchQuery.toLowerCase();
    if (c.name.toLowerCase().includes(query)) return true;
    if (c.subcategories && c.subcategories.some(sub => sub.name.toLowerCase().includes(query))) return true;
    return false;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      <WorkerHeroHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        
        {/* Service Radius */}
        <View style={styles.radiusContainer}>
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
            <MapPin size={24} color={theme.colors.primary} style={{marginRight: 8}} />
            <View>
              <Text style={styles.radiusTitle}>Service Radius</Text>
              <Text style={styles.radiusSub}>Jobs within this distance will alert you</Text>
            </View>
          </View>
          
          <View style={styles.stepperContainer}>
            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={() => setRadius(Math.max(1, radius - 1))}
            >
              <Minus size={20} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.stepperValueBox}>
              <Text style={styles.stepperValue}>{radius}</Text>
              <Text style={styles.stepperUnit}>km</Text>
            </View>

            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={() => setRadius(Math.min(100, radius + 1))}
            >
              <Plus size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.saveRadiusBtn} onPress={handleSaveRadius} disabled={saving}>
            {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.saveRadiusText}>Save Radius</Text>}
          </TouchableOpacity>
        </View>

        {/* Categories List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionHeader}>Active Categories</Text>
          
          {services.length === 0 && (
             <Text style={{color: theme.colors.textDim, textAlign: 'center', marginVertical: 20}}>
               No services added yet. Add a category below.
             </Text>
          )}

          {services.map((cat, index) => {
            const categoryId = cat.category?._id || cat.category;
            const fullCat = allCategories.find(c => c._id === categoryId);
            const catTitle = fullCat?.name || cat.category?.name || 'Loading...';
            const subCount = cat.subcategories?.length || 0;
            return (
              <View key={index} style={styles.card}>
                <View style={[styles.iconWrapper, fullCat?.imageUrl && { backgroundColor: 'transparent' }]}>
                  {fullCat?.imageUrl ? (
                    <Image source={{ uri: getImageUrl(fullCat.imageUrl) }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  ) : (
                    renderIcon(catTitle)
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{catTitle}</Text>
                  <Text style={[styles.cardStatus, !cat.isActive && {color: theme.colors.danger}]}>
                    {cat.isActive ? 'Active - Receiving alerts' : 'Deactivated'}
                  </Text>
                  <TouchableOpacity onPress={() => handleManageSubCats(cat)}>
                    <Text style={{color: theme.colors.primary, fontSize: 13, marginTop: 4, fontWeight: '600'}}>
                      {subCount} Subcategories Selected ✎
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{flexDirection: 'column', gap: 8}}>
                  <TouchableOpacity 
                    style={[styles.manageBtn, cat.isActive ? {borderColor: theme.colors.primary} : {borderColor: theme.colors.border}]} 
                    onPress={() => handleToggleService(index)}
                  >
                    <Text style={[styles.manageBtnText, cat.isActive && {color: theme.colors.primary}]}>
                      {cat.isActive ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.manageBtn, {borderColor: theme.colors.danger}]} 
                    onPress={() => handleRemoveService(index)}
                  >
                    <Trash2 size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Plus size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add New Category</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.suggestBtn} onPress={() => setSuggestModalVisible(true)}>
            <Text style={{fontSize: 16}}>💡</Text>
            <Text style={styles.suggestBtnText}>Suggest Missing Category</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', paddingBottom: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color={theme.colors.text} /></TouchableOpacity>
            </View>
            
            <TextInput
              style={{
                borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, 
                color: theme.colors.text, backgroundColor: theme.colors.background, marginBottom: 16
              }}
              placeholder="Search categories (e.g. Home, Salon...)"
              placeholderTextColor={theme.colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
              {filteredCategories && filteredCategories.length > 0 ? filteredCategories.map(c => (
                <TouchableOpacity 
                  key={c._id} 
                  style={styles.modalCatItem}
                  onPress={() => handleAddService(c)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {c.imageUrl ? (
                      <Image source={{ uri: getImageUrl(c.imageUrl) }} style={{ width: 32, height: 32, borderRadius: 8, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }}>
                        {renderIcon(c.name)}
                      </View>
                    )}
                    <Text style={styles.modalCatText}>{c.name}</Text>
                  </View>
                  <Plus size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )) : (
                <Text style={{textAlign: 'center', color: theme.colors.textDim, padding: 20}}>
                  {searchQuery ? `No categories found for "${searchQuery}"` : "No categories available"}
                </Text>
              )}
              
              <TouchableOpacity style={[styles.suggestBtn, { marginTop: 24, marginBottom: 40 }]} onPress={() => { setModalVisible(false); setSuggestModalVisible(true); }}>
                <Text style={styles.suggestBtnText}>Suggest Missing Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Suggest Category/Subcategory Modal */}
      <Modal visible={suggestModalVisible} transparent animationType="slide" onRequestClose={() => setSuggestModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suggest Missing</Text>
              <TouchableOpacity onPress={() => setSuggestModalVisible(false)}><X color={theme.colors.text} /></TouchableOpacity>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 8 }}>What's missing?</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.manageBtn, suggestType === 'CATEGORY' ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' } : {}]}
                  onPress={() => setSuggestType('CATEGORY')}
                >
                  <Text style={[styles.manageBtnText, suggestType === 'CATEGORY' ? { color: theme.colors.primary } : {}]}>New Category</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.manageBtn, suggestType === 'SUBCATEGORY' ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' } : {}]}
                  onPress={() => setSuggestType('SUBCATEGORY')}
                >
                  <Text style={[styles.manageBtnText, suggestType === 'SUBCATEGORY' ? { color: theme.colors.primary } : {}]}>New Subcategory</Text>
                </TouchableOpacity>
              </View>
            </View>

            {suggestType === 'SUBCATEGORY' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 8 }}>Under which Category?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {allCategories.map(c => (
                    <TouchableOpacity 
                      key={c._id}
                      style={[styles.manageBtn, suggestParentCat === c._id ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' } : {}]}
                      onPress={() => setSuggestParentCat(c._id)}
                    >
                      <Text style={[styles.manageBtnText, suggestParentCat === c._id ? { color: theme.colors.primary } : {}]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 8 }}>Name</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 16, color: theme.colors.text, backgroundColor: theme.colors.background }}
                placeholder="e.g. Carpentry, Deep Cleaning..."
                placeholderTextColor={theme.colors.textDim}
                value={suggestName}
                onChangeText={setSuggestName}
              />
            </View>

            <TouchableOpacity style={styles.saveSubBtn} onPress={handleSuggestSubmit} disabled={saving}>
              {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.saveSubBtnText}>Submit Suggestion</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Subcategories Modal */}
      <Modal visible={subCatModalVisible} transparent animationType="slide" onRequestClose={() => setSubCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Subcategories</Text>
                <Text style={styles.modalSub}>{fullCategoryDetail?.name || 'Loading...'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSubCatModalVisible(false)}><X color={theme.colors.text} /></TouchableOpacity>
            </View>
            
            <ScrollView style={{maxHeight: 400}}>
              {fullCategoryDetail?.subcategories?.length > 0 ? (
                fullCategoryDetail.subcategories.map(sub => {
                  const isChecked = tempSelectedSubCats.includes(sub.name);
                  return (
                    <TouchableOpacity 
                      key={sub._id || sub.name} 
                      style={styles.modalCatItem}
                      onPress={() => toggleTempSubCat(sub.name)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {sub.imageUrl && (
                          <Image source={{ uri: getImageUrl(sub.imageUrl) }} style={{ width: 32, height: 32, borderRadius: 8, marginRight: 12 }} />
                        )}
                        <Text style={styles.modalCatText}>{sub.name}</Text>
                      </View>
                      {isChecked ? (
                        <CheckSquare color={theme.colors.primary} size={24} />
                      ) : (
                        <Square color={theme.colors.textDim} size={24} />
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{textAlign: 'center', color: theme.colors.textDim, padding: 20}}>No subcategories found</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.saveSubBtn} onPress={handleSaveSubCats}>
              <Text style={styles.saveSubBtnText}>Save Subcategories</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  listContainer: { marginBottom: 24 },
  sectionHeader: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12,
  },
  iconWrapper: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  cardStatus: { fontSize: 13, color: theme.colors.textDim, marginTop: 4 },
  manageBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, 
    borderWidth: 1, justifyContent: 'center', alignItems: 'center'
  },
  manageBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },
  addBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 20, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  suggestBtn: {
    backgroundColor: 'rgba(108, 71, 255, 0.05)',
    borderWidth: 1, borderColor: 'rgba(108, 71, 255, 0.2)',
    borderRadius: 20, paddingVertical: 16, alignItems: 'center', marginTop: 12,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  suggestBtnText: { color: '#6C47FF', fontWeight: '700', fontSize: 14 },
  radiusContainer: {
    backgroundColor: theme.colors.surface, padding: 20, borderRadius: 24,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 32,
  },
  radiusTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  radiusSub: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  stepperContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 24,
  },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.border,
    justifyContent: 'center', alignItems: 'center'
  },
  stepperValueBox: {
    flexDirection: 'row', alignItems: 'baseline', marginHorizontal: 24
  },
  stepperValue: { fontSize: 42, fontWeight: '900', color: theme.colors.text },
  stepperUnit: { fontSize: 16, fontWeight: '700', color: theme.colors.textDim, marginLeft: 4 },
  saveRadiusBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 16,
    alignItems: 'center',
  },
  saveRadiusText: { color: '#001016', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  modalSub: { fontSize: 14, color: theme.colors.textDim, marginTop: 4 },
  modalCatItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border
  },
  modalCatText: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  saveSubBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', marginTop: 24,
  },
  saveSubBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' }
});

export default WorkerManageServicesScreen;
