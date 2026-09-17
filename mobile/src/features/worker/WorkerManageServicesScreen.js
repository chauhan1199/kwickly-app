import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshControl,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import { workerService } from '../../services/workerService';
import { jobService } from '../../services/jobService';
import { getImageUrl } from '../../utils/helpers';
import { 
  Settings, 
  Wrench, 
  Zap, 
  X, 
  MapPin, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  CheckCheck, 
  XCircle,
  Layers,
  ChevronRight,
  Edit3
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const RADIUS_PRESETS = [5, 10, 15, 25, 50];

const WorkerManageServicesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [services, setServices] = useState([]);
  const [radius, setRadius] = useState(15);
  
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
        workerService.getProfile().catch(() => null),
        jobService.getCategories().catch(() => null)
      ]);
      const profileData = profileRes?.data?.data || {};
      const catData = catRes?.data?.data || [];
      
      setServices(profileData.services || []);
      setRadius(profileData.serviceRadius || 15);
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
        workerService.getProfile().catch(() => null),
        jobService.getCategories().catch(() => null)
      ]);
      const profileData = profileRes?.data?.data || {};
      const catData = catRes?.data?.data || [];

      setServices(profileData.services || []);
      setRadius(profileData.serviceRadius || 15);
      setAllCategories(catData || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh services');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveRadius = async () => {
    try {
      setSavingRadius(true);
      const res = await workerService.updateLocation({ radius: Number(radius) });
      if (res?.data?.status === 'success' || res?.data?.data) {
        Alert.alert('Success 🎉', `Service radius updated to ${radius} km. You will receive jobs within this area.`);
      } else {
        throw new Error(res?.data?.message || 'Failed to update radius');
      }
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'Failed to update radius';
      Alert.alert('Radius Update Error', errMsg);
    } finally {
      setSavingRadius(false);
    }
  };

  const saveServices = async (updatedServices) => {
    try {
      setSavingServices(true);
      const payload = updatedServices.map(s => {
        const catId = s.category?._id || s.category;
        const fullCat = allCategories.find(c => c._id === catId);
        return {
          category: catId,
          categoryName: s.categoryName || fullCat?.name || '',
          subcategories: s.subcategories || [],
          isActive: s.isActive !== false
        };
      });
      const res = await workerService.updateServices(payload);
      if (res?.data?.status === 'success' || res?.data?.data) {
        fetchData();
        if (fetchUser) fetchUser('WORKER');
        return true;
      }
      throw new Error(res?.data?.message || 'Failed to save services');
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'Failed to save services';
      Alert.alert('Services Error', errMsg);
      return false;
    } finally {
      setSavingServices(false);
    }
  };

  const handleToggleService = async (serviceIndex) => {
    const newServices = [...services];
    newServices[serviceIndex].isActive = !newServices[serviceIndex].isActive;
    setServices(newServices);
    await saveServices(newServices);
  };

  const handleRemoveService = (serviceIndex) => {
    Alert.alert(
      'Remove Category',
      'Are you sure you want to remove this category and its subcategories from your profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const newServices = services.filter((_, idx) => idx !== serviceIndex);
            setServices(newServices);
            await saveServices(newServices);
          }
        }
      ]
    );
  };

  const handleAddService = (categoryObj) => {
    if (services.find(s => (s.category?._id || s.category) === categoryObj._id)) {
      Alert.alert('Already Added', 'This category is already in your active list. You can edit its subcategories.');
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSelectedCategoryForSubCats(categoryObj);
    // Pre-select all subcategories by default for convenience
    const allSubNames = (categoryObj.subcategories || []).map(s => s.name);
    setTempSelectedSubCats(allSubNames);
    setSubCatModalVisible(true);
  };

  const handleManageSubCats = (serviceObj) => {
    const categoryId = serviceObj.category?._id || serviceObj.category;
    const fullCat = allCategories.find(c => c._id === categoryId) || serviceObj.category;
    setSelectedCategoryForSubCats(fullCat);
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

  const handleSelectAllSubCats = () => {
    if (!fullCategoryDetail?.subcategories) return;
    const allNames = fullCategoryDetail.subcategories.map(s => s.name);
    setTempSelectedSubCats(allNames);
  };

  const handleClearAllSubCats = () => {
    setTempSelectedSubCats([]);
  };

  const handleSaveSubCats = async () => {
    if (!selectedCategoryForSubCats) return;
    if (tempSelectedSubCats.length === 0) {
      Alert.alert('Select Subcategory', 'Please select at least 1 subcategory to receive job requests.');
      return;
    }
    
    const catId = selectedCategoryForSubCats._id || selectedCategoryForSubCats;
    const existsIndex = services.findIndex(s => (s.category?._id || s.category) === catId);
    
    let newServices = [...services];
    if (existsIndex >= 0) {
      newServices[existsIndex].subcategories = tempSelectedSubCats;
    } else {
      newServices.push({
        category: catId,
        categoryName: selectedCategoryForSubCats.name || '',
        subcategories: tempSelectedSubCats,
        isActive: true
      });
    }
    
    setServices(newServices);
    const success = await saveServices(newServices);
    if (success) {
      setSubCatModalVisible(false);
      Alert.alert('Updated 🎉', `${tempSelectedSubCats.length} subcategories saved for ${selectedCategoryForSubCats.name || 'Category'}`);
    }
  };

  const handleSuggestSubmit = async () => {
    if (!suggestName.trim()) return Alert.alert('Missing Field', 'Please enter a name for the suggestion.');
    if (suggestType === 'SUBCATEGORY' && !suggestParentCat) return Alert.alert('Missing Field', 'Please select a parent category.');

    try {
      setSavingRadius(true);
      await workerService.submitCategorySuggestion({
        name: suggestName.trim(),
        type: suggestType,
        parentCategory: suggestParentCat
      });
      Alert.alert('Submitted 🎉', 'Your category suggestion has been submitted to the admin team for review.');
      setSuggestModalVisible(false);
      setSuggestName('');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit suggestion');
    } finally {
      setSavingRadius(false);
    }
  };

  const renderIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('elec') || t.includes('zap')) return <Zap size={22} color="#6C47FF" />;
    if (t.includes('appliance') || t.includes('setting')) return <Settings size={22} color="#6C47FF" />;
    return <Wrench size={22} color="#6C47FF" />;
  };

  const fullCategoryDetail = useMemo(() => {
    if (!selectedCategoryForSubCats) return null;
    const targetId = selectedCategoryForSubCats._id || selectedCategoryForSubCats;
    return allCategories.find(c => c._id === targetId) || selectedCategoryForSubCats;
  }, [selectedCategoryForSubCats, allCategories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const query = searchQuery.toLowerCase().trim();
    return allCategories.filter(c => {
      if (c.name.toLowerCase().includes(query)) return true;
      if (c.subcategories && c.subcategories.some(sub => sub.name.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [allCategories, searchQuery]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      <WorkerHeroHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C47FF']} tintColor="#6C47FF" />
        }
      >
        {/* ═══════════════════════════════════════
            SERVICE RADIUS CARD
        ═══════════════════════════════════════ */}
        <View style={styles.radiusCard}>
          <View style={styles.radiusHeaderRow}>
            <View style={styles.radiusIconBox}>
              <MapPin size={22} color="#6C47FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.radiusTitle}>Service Radius</Text>
              <Text style={styles.radiusSub}>Receive job alerts within this distance</Text>
            </View>
            <View style={styles.radiusCurrentBadge}>
              <Text style={styles.radiusCurrentText}>{radius} km</Text>
            </View>
          </View>
          
          {/* Stepper Display */}
          <View style={styles.stepperContainer}>
            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={() => setRadius(Math.max(1, radius - 1))}
              activeOpacity={0.7}
            >
              <Minus size={22} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.stepperValueBox}>
              <Text style={styles.stepperValue}>{radius}</Text>
              <Text style={styles.stepperUnit}>km</Text>
            </View>

            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={() => setRadius(Math.min(100, radius + 1))}
              activeOpacity={0.7}
            >
              <Plus size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Quick Radius Preset Chips */}
          <View style={styles.presetChipsRow}>
            {RADIUS_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetChip, radius === preset && styles.presetChipActive]}
                onPress={() => setRadius(preset)}
                activeOpacity={0.75}
              >
                <Text style={[styles.presetChipText, radius === preset && styles.presetChipTextActive]}>
                  {preset} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Save Radius Button */}
          <TouchableOpacity 
            style={[styles.saveRadiusBtn, savingRadius && { opacity: 0.7 }]} 
            onPress={handleSaveRadius} 
            disabled={savingRadius}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#6C47FF', '#8B6FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveRadiusGradient}
            >
              {savingRadius ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveRadiusText}>Save Service Radius</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════
            ACTIVE CATEGORIES LIST
        ═══════════════════════════════════════ */}
        <View style={styles.listContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Layers size={20} color="#6C47FF" style={{ marginRight: 8 }} />
              <Text style={styles.sectionHeader}>Active Categories</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{services.length} Active</Text>
            </View>
          </View>
          
          {services.length === 0 && (
            <View style={styles.emptyCategoriesBox}>
              <Wrench size={40} color="#6C47FF" />
              <Text style={styles.emptyCategoriesTitle}>No Categories Added</Text>
              <Text style={styles.emptyCategoriesSub}>
                Add the skills and services you offer to start getting matched with customer job requests.
              </Text>
            </View>
          )}

          {services.map((cat, index) => {
            const categoryId = cat.category?._id || cat.category;
            const fullCat = allCategories.find(c => c._id === categoryId);
            const catTitle = fullCat?.name || cat.categoryName || cat.category?.name || 'Category';
            const subCount = cat.subcategories?.length || 0;
            const imageUri = fullCat?.imageUrl ? getImageUrl(fullCat.imageUrl) : null;

            return (
              <View key={index} style={styles.categoryCard}>
                <View style={styles.categoryCardTop}>
                  {/* Category Image */}
                  <View style={styles.catImageBox}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.catImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.catFallbackBox}>
                        {renderIcon(catTitle)}
                      </View>
                    )}
                  </View>

                  {/* Category Info */}
                  <View style={styles.catInfoBox}>
                    <Text style={styles.catTitle} numberOfLines={1}>{catTitle}</Text>
                    
                    <View style={styles.statusPillRow}>
                      <View style={[styles.statusDot, { backgroundColor: cat.isActive ? '#10B981' : '#EF4444' }]} />
                      <Text style={[styles.statusText, { color: cat.isActive ? '#10B981' : '#EF4444' }]}>
                        {cat.isActive ? 'Active • Receiving job alerts' : 'Deactivated'}
                      </Text>
                    </View>

                    {/* Subcategories Badge & Edit Button */}
                    <TouchableOpacity 
                      style={styles.subcatsEditBadge} 
                      onPress={() => handleManageSubCats(cat)}
                      activeOpacity={0.75}
                    >
                      <Sparkles size={12} color="#6C47FF" style={{ marginRight: 4 }} />
                      <Text style={styles.subcatsEditText}>
                        {subCount} Subcategor{subCount === 1 ? 'y' : 'ies'} Selected
                      </Text>
                      <Edit3 size={11} color="#6C47FF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Card Actions Bar */}
                <View style={styles.cardActionsBar}>
                  <TouchableOpacity 
                    style={[styles.toggleActiveBtn, cat.isActive ? styles.toggleActiveBtnOn : styles.toggleActiveBtnOff]} 
                    onPress={() => handleToggleService(index)}
                    disabled={savingServices}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.toggleActiveText, cat.isActive ? styles.toggleActiveTextOn : styles.toggleActiveTextOff]}>
                      {cat.isActive ? 'Disable Category' : 'Enable Category'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.deleteCategoryBtn} 
                    onPress={() => handleRemoveService(index)}
                    disabled={savingServices}
                    activeOpacity={0.75}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Add Category Button */}
          <TouchableOpacity 
            style={styles.addCategoryBtn} 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#6C47FF', '#8B6FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addCategoryGradient}
            >
              <Plus size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addCategoryBtnText}>+ Add New Category</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Suggest Category Button */}
          <TouchableOpacity 
            style={styles.suggestBtn} 
            onPress={() => setSuggestModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>💡</Text>
            <Text style={styles.suggestBtnText}>Suggest Missing Category / Skill</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════
          MODAL 1: ADD CATEGORY MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose Category</Text>
                <Text style={styles.modalSub}>Select a category to offer on your profile</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.categorySearchInput}
              placeholder="Search categories (e.g. Salon, Plumbing, Cleaning)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {filteredCategories.length > 0 ? (
                filteredCategories.map(c => {
                  const isAlreadyAdded = services.some(s => (s.category?._id || s.category) === c._id);
                  const imageUri = c.imageUrl ? getImageUrl(c.imageUrl) : null;
                  
                  return (
                    <TouchableOpacity 
                      key={c._id} 
                      style={[styles.modalCatItem, isAlreadyAdded && { opacity: 0.6 }]}
                      onPress={() => handleAddService(c)}
                      disabled={isAlreadyAdded}
                      activeOpacity={0.75}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={styles.modalCatImgBox}>
                          {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.modalCatImg} resizeMode="cover" />
                          ) : (
                            renderIcon(c.name)
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.modalCatText}>{c.name}</Text>
                          <Text style={styles.modalCatSubCount}>{c.subcategories?.length || 0} subcategories</Text>
                        </View>
                      </View>

                      {isAlreadyAdded ? (
                        <View style={styles.alreadyAddedBadge}>
                          <Text style={styles.alreadyAddedText}>Added</Text>
                        </View>
                      ) : (
                        <View style={styles.addIconCircle}>
                          <Plus size={16} color="#6C47FF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptySearchBox}>
                  <Text style={styles.emptySearchText}>
                    {searchQuery ? `No categories matching "${searchQuery}"` : 'No categories available'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 2: PREMIUM SUBCATEGORIES SELECTION MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={subCatModalVisible} transparent animationType="slide" onRequestClose={() => setSubCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />

            {/* Subcategory Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.subCatHeaderCategoryBadge}>
                  <Sparkles size={14} color="#6C47FF" style={{ marginRight: 5 }} />
                  <Text style={styles.subCatHeaderCategoryText} numberOfLines={1}>
                    {fullCategoryDetail?.name || 'Category'}
                  </Text>
                </View>
                <Text style={styles.subCatSheetTitle}>Select Subcategories</Text>
                <Text style={styles.subCatSheetSub}>Choose the specific jobs you want alerts for</Text>
              </View>
              <TouchableOpacity onPress={() => setSubCatModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions Bar (Select All / Clear All + Counter) */}
            <View style={styles.quickActionBar}>
              <View style={styles.selectionCounterBadge}>
                <Text style={styles.selectionCounterText}>
                  {tempSelectedSubCats.length} / {fullCategoryDetail?.subcategories?.length || 0} Selected
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.quickActionChip} onPress={handleSelectAllSubCats} activeOpacity={0.7}>
                  <CheckCheck size={14} color="#6C47FF" style={{ marginRight: 4 }} />
                  <Text style={styles.quickActionChipText}>Select All</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionChip} onPress={handleClearAllSubCats} activeOpacity={0.7}>
                  <XCircle size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.quickActionChipText, { color: '#EF4444' }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Subcategories List Cards */}
            <ScrollView style={styles.subCatsScroll} showsVerticalScrollIndicator={false}>
              {fullCategoryDetail?.subcategories?.length > 0 ? (
                fullCategoryDetail.subcategories.map(sub => {
                  const isChecked = tempSelectedSubCats.includes(sub.name);
                  const subImageUri = sub.imageUrl ? getImageUrl(sub.imageUrl) : null;

                  return (
                    <TouchableOpacity 
                      key={sub._id || sub.name} 
                      style={[styles.subCatCard, isChecked && styles.subCatCardChecked]}
                      onPress={() => toggleTempSubCat(sub.name)}
                      activeOpacity={0.8}
                    >
                      {/* Left Subcategory Image / Icon */}
                      <View style={[styles.subCatImgBox, isChecked && styles.subCatImgBoxChecked]}>
                        {subImageUri ? (
                          <Image source={{ uri: subImageUri }} style={styles.subCatImg} resizeMode="cover" />
                        ) : (
                          <Sparkles size={18} color={isChecked ? '#6C47FF' : '#94A3B8'} />
                        )}
                      </View>

                      {/* Title */}
                      <View style={{ flex: 1, paddingHorizontal: 12 }}>
                        <Text style={[styles.subCatCardTitle, isChecked && styles.subCatCardTitleChecked]}>
                          {sub.name}
                        </Text>
                        {isChecked && (
                          <Text style={styles.subCatAlertOnText}>✓ Receiving alerts for this job</Text>
                        )}
                      </View>

                      {/* Checkbox Icon Pill */}
                      <View style={[styles.checkboxPill, isChecked && styles.checkboxPillChecked]}>
                        {isChecked ? (
                          <CheckCircle2 size={20} color="#6C47FF" />
                        ) : (
                          <Circle size={20} color="#CBD5E1" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptySearchBox}>
                  <Text style={styles.emptySearchText}>No subcategories available in this category</Text>
                </View>
              )}
            </ScrollView>

            {/* Save Subcategories Button */}
            <TouchableOpacity 
              style={[styles.saveSubcatsBtn, (savingServices || tempSelectedSubCats.length === 0) && { opacity: 0.6 }]} 
              onPress={handleSaveSubCats}
              disabled={savingServices}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveSubcatsGradient}
              >
                {savingServices ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveSubcatsBtnText}>
                    Save Subcategories ({tempSelectedSubCats.length})
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 3: SUGGEST CATEGORY / SUBCATEGORY
      ═══════════════════════════════════════ */}
      <Modal visible={suggestModalVisible} transparent animationType="slide" onRequestClose={() => setSuggestModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Suggest Missing</Text>
                <Text style={styles.modalSub}>Help us expand our service directory</Text>
              </View>
              <TouchableOpacity onPress={() => setSuggestModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.inputSectionLabel}>What would you like to suggest?</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.suggestTypeBtn, suggestType === 'CATEGORY' && styles.suggestTypeBtnActive]}
                  onPress={() => setSuggestType('CATEGORY')}
                >
                  <Text style={[styles.suggestTypeText, suggestType === 'CATEGORY' && styles.suggestTypeTextActive]}>
                    New Category
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.suggestTypeBtn, suggestType === 'SUBCATEGORY' && styles.suggestTypeBtnActive]}
                  onPress={() => setSuggestType('SUBCATEGORY')}
                >
                  <Text style={[styles.suggestTypeText, suggestType === 'SUBCATEGORY' && styles.suggestTypeTextActive]}>
                    New Subcategory
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {suggestType === 'SUBCATEGORY' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.inputSectionLabel}>Under which Category?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {allCategories.map(c => (
                    <TouchableOpacity 
                      key={c._id}
                      style={[styles.parentCatChip, suggestParentCat === c._id && styles.parentCatChipActive]}
                      onPress={() => setSuggestParentCat(c._id)}
                    >
                      <Text style={[styles.parentCatChipText, suggestParentCat === c._id && styles.parentCatChipTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputSectionLabel}>Suggested Name</Text>
              <TextInput 
                style={styles.suggestInput}
                placeholder="e.g. Drone Repair, Solar Panel Installation..."
                placeholderTextColor="#94A3B8"
                value={suggestName}
                onChangeText={setSuggestName}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveSubcatsBtn} 
              onPress={handleSuggestSubmit} 
              disabled={savingRadius}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveSubcatsGradient}
              >
                {savingRadius ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveSubcatsBtnText}>Submit Suggestion</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' 
  },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingTop: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  
  // Radius Card
  radiusCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  radiusSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  radiusCurrentBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
  },
  radiusCurrentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: 28,
  },
  stepperValue: {
    fontSize: 44,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  stepperUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6C47FF',
    marginLeft: 6,
  },
  presetChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  saveRadiusBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveRadiusGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRadiusText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  // Active Categories Section
  listContainer: { 
    marginBottom: 24 
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeader: { 
    fontSize: 17, 
    fontWeight: '800', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  countBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  },
  emptyCategoriesBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 14,
  },
  emptyCategoriesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginTop: 10,
  },
  emptyCategoriesSub: {
    fontSize: 13,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  categoryCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catImageBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  catImg: {
    width: '100%',
    height: '100%',
  },
  catFallbackBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  catInfoBox: {
    flex: 1,
    marginLeft: 14,
  },
  catTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  subcatsEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(108, 71, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  subcatsEditText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  cardActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  toggleActiveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleActiveBtnOn: {
    borderColor: '#E2E8F0',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
  },
  toggleActiveBtnOff: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  toggleActiveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleActiveTextOn: {
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  toggleActiveTextOff: {
    color: '#6C47FF',
  },
  deleteCategoryBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addCategoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  addCategoryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
  },
  suggestBtnText: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 13.5,
  },

  // Modals Styling
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  modalHandle: {
    width: 44,
    height: 5,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B' 
  },
  modalSub: { 
    fontSize: 12.5, 
    color: isDarkMode ? '#94A3B8' : '#64748B', 
    marginTop: 2 
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySearchInput: {
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    fontSize: 13.5,
    marginBottom: 14,
  },
  modalCatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  modalCatImgBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCatImg: {
    width: '100%',
    height: '100%',
  },
  modalCatText: { 
    fontSize: 14.5, 
    fontWeight: '700', 
    color: isDarkMode ? '#F8FAFC' : '#1E293B' 
  },
  modalCatSubCount: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  alreadyAddedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  alreadyAddedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  addIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Subcategory Specific Modal
  subCatHeaderCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  subCatHeaderCategoryText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  subCatSheetTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  subCatSheetSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  quickActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    padding: 10,
    borderRadius: 14,
    marginBottom: 14,
  },
  selectionCounterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectionCounterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  quickActionChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  subCatsScroll: {
    maxHeight: 360,
  },
  subCatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  subCatCardChecked: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#1E1E38' : '#FAF8FF',
  },
  subCatImgBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCatImgBoxChecked: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
  },
  subCatImg: {
    width: '100%',
    height: '100%',
  },
  subCatCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  subCatCardTitleChecked: {
    color: isDarkMode ? '#FFFFFF' : '#1E293B',
    fontWeight: '800',
  },
  subCatAlertOnText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  checkboxPill: {
    padding: 4,
  },
  checkboxPillChecked: {},
  saveSubcatsBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 14,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveSubcatsGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSubcatsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Suggest Modal
  inputSectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 8,
  },
  suggestTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
  },
  suggestTypeBtnActive: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  suggestTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  suggestTypeTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  parentCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  parentCatChipActive: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    borderColor: '#6C47FF',
  },
  parentCatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  parentCatChipTextActive: {
    color: '#6C47FF',
  },
  suggestInput: {
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    fontSize: 13.5,
  },
  emptySearchBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptySearchText: {
    fontSize: 13,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
  }
});

export default WorkerManageServicesScreen;
