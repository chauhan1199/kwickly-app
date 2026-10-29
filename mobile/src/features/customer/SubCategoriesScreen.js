import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { jobService } from '../../services/jobService';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronRight, Clock, IndianRupee, X } from 'lucide-react-native';
import { SearchBar } from '../../components/ui/SearchBar';
import { getImageUrl } from '../../utils/helpers';
import { getCategoryIcon, getCategoryLocalImage } from '../../utils/categoryTheme';

const PURPLE = '#6C47FF';

// Gradient palettes for hero (cycle by category index / id hash)
const HERO_GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fda085', '#f6d365'],
  ['#84fab0', '#8fd3f4'],
];

const SubCategoryCardItem = React.memo(({ sub, index, category, displayIcon, finalHeroImage, localHeroImg, navigation, styles, theme }) => {
  const [imgErr, setImgErr] = useState(false);
  const resolvedSubImage = getImageUrl(sub.imageUrl);
  // Uploaded subcategory image > category image > bundled local stock image
  const cardImg = (!imgErr && resolvedSubImage) 
    ? { uri: resolvedSubImage } 
    : (finalHeroImage || localHeroImg);

  return (
    <TouchableOpacity
      key={sub._id || sub.id || index}
      style={styles.subCard}
      activeOpacity={0.8}
      onPress={() =>
        navigation.navigate('DescribeJob', {
          category: { ...category, id: category.id, name: category.name, icon: displayIcon, imageUrl: category.imageUrl },
          subcategory: sub.name,
        })
      }
    >
      {/* Left accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: PURPLE }]} />

      <View style={[styles.cardIconBox, cardImg && { backgroundColor: 'transparent', padding: 0 }]}>
        {cardImg ? (
          <Image 
            source={cardImg} 
            style={{ width: '100%', height: '100%', borderRadius: 14 }} 
            resizeMode="cover" 
            onError={() => setImgErr(true)}
          />
        ) : (
          <Text style={styles.cardIcon}>{displayIcon}</Text>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{sub.name}</Text>
      </View>

      <ChevronRight size={18} color={theme.colors.textDim} />
    </TouchableOpacity>
  );
});

const SubCategoriesScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestionName, setSuggestionName] = useState('');
  const [suggestionDesc, setSuggestionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    id,
    name = 'Category',
    icon = '✨',
    color = PURPLE,
    imageUrl = null,
    subs = []
  } = route.params || {};

  const displayIcon = getCategoryIcon(name, icon);
  const localHeroImg = getCategoryLocalImage(name);
  const [categoryImageUrl, setCategoryImageUrl] = useState(imageUrl);
  const [heroImgError, setHeroImgError] = useState(false);
  const heroGradient = ['#6C47FF', '#8B6FFF'];
  const resolvedHeroImage = getImageUrl(categoryImageUrl || imageUrl);
  const finalHeroImage = (!heroImgError && resolvedHeroImage) ? { uri: resolvedHeroImage } : localHeroImg;

  const [localSubs, setLocalSubs] = useState(subs || []);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubs = useCallback(async () => {
    try {
      if (id) {
        const res = await jobService.getCategoryById(id);
        if (res.data?.status === 'success' && res.data.data) {
          const cat = res.data.data;
          if (cat.subcategories?.length) setLocalSubs(cat.subcategories);
          if (cat.imageUrl) setCategoryImageUrl(cat.imageUrl);
          return;
        }
      }
      const res = await jobService.getCategories();
      if (res.data?.status === 'success') {
        const cat = res.data.data.find(c => (id && c._id === id) || c.name === name);
        if (cat) {
          if (cat.subcategories) setLocalSubs(cat.subcategories);
          if (cat.imageUrl) setCategoryImageUrl(cat.imageUrl);
        }
      }
    } catch (e) {
    }
  }, [id, name]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubs();
    setRefreshing(false);
  };

  React.useEffect(() => {
    if (route.params?.subs?.length) {
      setLocalSubs(route.params.subs);
    } else {
      loadSubs();
    }
    const subEvt = DeviceEventEmitter.addListener('NEW_NOTIFICATION', () => {
      loadSubs();
    });
    return () => subEvt.remove();
  }, [route.params, loadSubs]);

  const sortedSubs = React.useMemo(() => {
    return [...localSubs].sort((a, b) => {
      const scoreA = (a.frequencyScore || 0) + (a.bookingCount || 0) * 10;
      const scoreB = (b.frequencyScore || 0) + (b.bookingCount || 0) * 10;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [localSubs]);

  const styles = createStyles(theme, isDarkMode, insets);

  return (
    <View style={styles.container}>
      {/* ── Hero Header ── */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />

        {/* Content row: Left details, Right framed image */}
        <View style={styles.heroContentRow}>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroTitle} numberOfLines={2}>{name}</Text>
            <View style={styles.servicesBadge}>
              <Clock size={12} color="#E0E7FF" style={{ marginRight: 4 }} />
              <Text style={styles.heroSubtitle}>{sortedSubs.length} service{sortedSubs.length !== 1 ? 's' : ''} available</Text>
            </View>
          </View>

          {finalHeroImage ? (
            <View style={styles.heroImageCardWrapper}>
              <Image source={finalHeroImage} style={styles.heroFramedImage} resizeMode="cover" onError={() => setHeroImgError(true)} />
            </View>
          ) : (
            <View style={styles.heroIconCardWrapper}>
              <Text style={{ fontSize: 40 }}>{displayIcon}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Search - overlapping header */}
      <View pointerEvents="box-none" style={{ paddingHorizontal: 16, marginTop: -20, zIndex: 10, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search services..."
        />

      </View>

      {/* ── Subcategory List (Sorted by most used first) ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} colors={[PURPLE]} />
        }
      >
        <Text style={styles.listHeading}>Choose a service type</Text>

        {sortedSubs
          .filter(sub => !searchQuery || sub.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((sub, index) => (
            <SubCategoryCardItem
              key={sub._id || sub.id || index}
              sub={sub}
              index={index}
              category={{ ...route.params, id, name, icon: displayIcon, imageUrl: categoryImageUrl }}
              displayIcon={displayIcon}
              finalHeroImage={finalHeroImage}
              localHeroImg={localHeroImg}
              navigation={navigation}
              styles={styles}
              theme={theme}
            />
          ))}

        {/* Suggest missing */}
        <TouchableOpacity style={styles.suggestBtn} activeOpacity={0.75} onPress={() => setModalVisible(true)}>
          <Text style={styles.suggestBtnText}>+ Missing a service? Suggest one</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Suggestion Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card, position: 'relative' }]}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 6 }}
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={theme.colors.textDim} />
            </TouchableOpacity>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, paddingRight: 28 }]}>Suggest a Subcategory</Text>
            <Text style={[styles.modalDesc, { color: theme.colors.textDim }]}>
              Don't see what you're looking for under {name}? Suggest it!
            </Text>

            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="E.g., Window Cleaning"
              placeholderTextColor={theme.colors.textDim}
              value={suggestionName}
              onChangeText={setSuggestionName}
            />

            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, height: 80, textAlignVertical: 'top' }]}
              placeholder="Additional details (optional)"
              placeholderTextColor={theme.colors.textDim}
              value={suggestionDesc}
              onChangeText={setSuggestionDesc}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.submitBtn, { backgroundColor: PURPLE }]}
                onPress={async () => {
                  if (!suggestionName.trim()) {
                    Alert.alert('Error', 'Please enter a name for the subcategory.');
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    await api.post('/customers/category-suggestions', {
                      type: 'new_subcategory',
                      name: suggestionName.trim(),
                      parentCategory: name,
                      description: suggestionDesc.trim(),
                    });
                    Alert.alert('Success', 'Thank you! Your suggestion has been sent for review.');
                    setModalVisible(false);
                    setSuggestionName('');
                    setSuggestionDesc('');
                  } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'Failed to submit suggestion.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (theme, isDarkMode, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // ── Hero ──
    hero: {
      paddingTop: insets.top + 14,
      paddingBottom: 40,
      paddingHorizontal: 16,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      position: 'relative',
      overflow: 'hidden',
    },
    heroDecor1: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroDecor2: {
      position: 'absolute',
      bottom: -30,
      left: -20,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    heroTextCol: {
      flex: 1,
      marginRight: 10,
      justifyContent: 'center',
    },
    heroIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    heroIcon: {
      fontSize: 20,
    },
    heroTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.3,
      lineHeight: 27,
      marginBottom: 8,
    },
    servicesBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4.5,
      borderRadius: 12,
    },
    heroSubtitle: {
      fontSize: 12,
      color: '#E0E7FF',
      fontWeight: '600',
    },
    heroImageCardWrapper: {
      width: 86,
      height: 86,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 6,
    },
    heroFramedImage: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    heroIconCardWrapper: {
      width: 86,
      height: 86,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
    },


    // ── List ──
    listContent: {
      paddingHorizontal: 14,
      paddingTop: 30,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    listHeading: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textDim,
      marginBottom: 14,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    subCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? theme.colors.surface : '#fff',
      borderRadius: 20,
      marginBottom: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      shadowColor: PURPLE,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
      overflow: 'hidden',
    },
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
    },
    cardIconBox: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#F2EEFF',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 6,
      marginRight: 16,
    },
    cardIcon: {
      fontSize: 24,
    },
    cardBody: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 5,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaText: {
      fontSize: 11,
      color: theme.colors.textDim,
      fontWeight: '500',
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.colors.textDim,
    },

    // ── Suggest btn ──
    suggestBtn: {
      marginTop: 8,
      alignSelf: 'center',
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      backgroundColor: 'transparent',
    },
    suggestBtnText: {
      color: PURPLE,
      fontWeight: '700',
      fontSize: 14,
    },
    
    // ── Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Math.max(insets.bottom, 16) + 24,
      maxHeight: '90%',
    },
    modalTitle: {
      fontWeight: '700',
      fontSize: 20,
      marginBottom: 8,
    },
    modalDesc: {
      fontWeight: '400',
      fontSize: 14,
      marginBottom: 20,
      lineHeight: 20,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      fontWeight: '500',
      fontSize: 15,
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: {
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    cancelBtnText: {
      fontWeight: '600',
      fontSize: 15,
    },
    submitBtn: {
    },
    submitBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 15,
    },
  });

export default SubCategoriesScreen;
