import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import api from '../../services/api';
import { jobService } from '../../services/jobService';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft, ChevronRight, Clock, IndianRupee } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PURPLE = '#6C47FF';
const BASE_IMAGE_URL = 'http://10.0.2.2:5000';

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

const SubCategoriesScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestionName, setSuggestionName] = useState('');
  const [suggestionDesc, setSuggestionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Provide default values so it doesn't crash if accessed directly
  const {
    id = 'cleaning',
    name = 'Cleaning',
    icon = '🧹',
    color = PURPLE,
    imageUrl = null,
    subs = ['Home Cleaning', 'Sofa Cleaning', 'Kitchen Deep Clean', 'Bathroom Cleaning']
  } = route.params || {};

  // Pick a gradient based on simple string hash of id
  const gradientIndex = (id?.toString().charCodeAt(0) || 0) % HERO_GRADIENTS.length;
  const heroGradient = HERO_GRADIENTS[gradientIndex];

  // Resolve image URL
  const resolvedHeroImage = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${BASE_IMAGE_URL}${imageUrl}`) : null;

  const [localSubs, setLocalSubs] = useState(subs || []);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubs = async () => {
    try {
      const res = await jobService.getCategories();
      if (res.data?.status === 'success') {
        const cat = res.data.data.find(c => c._id === id || c.name === name);
        if (cat && cat.subcategories) {
          setLocalSubs(cat.subcategories);
        }
      }
    } catch (e) {
      console.log('Failed to fetch subs', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubs();
    setRefreshing(false);
  };

  React.useEffect(() => {
    loadSubs();
    const sub = DeviceEventEmitter.addListener('NEW_NOTIFICATION', () => {
      loadSubs();
    });
    return () => sub.remove();
  }, []);

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={resolvedHeroImage ? '#46279E' : heroGradient[0]} translucent={false} />

      {/* ── Hero Header ── */}
      {resolvedHeroImage ? (
        // ── Real admin photo hero ──
        <View style={styles.hero}>
          <Image source={{ uri: resolvedHeroImage }} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(108,71,255,0.2)', 'rgba(108,71,255,0.7)', '#2A1A5E']}
            style={styles.heroImageOverlay}
          />
          <View style={styles.heroDecor1} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ChevronLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <View style={styles.heroIconCircle}>
              <Text style={styles.heroIcon}>{icon}</Text>
            </View>
            <Text style={styles.heroTitle}>{name}</Text>
            <Text style={styles.heroSubtitle}>{localSubs.length} service{localSubs.length !== 1 ? 's' : ''} available</Text>
          </View>
        </View>
      ) : (
        // ── Fallback gradient hero ──
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ChevronLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <View style={styles.heroIconCircle}>
              <Text style={styles.heroIcon}>{icon}</Text>
            </View>
            <Text style={styles.heroTitle}>{name}</Text>
            <Text style={styles.heroSubtitle}>{localSubs.length} service{localSubs.length !== 1 ? 's' : ''} available</Text>
          </View>
        </LinearGradient>
      )}
      {/* ── Subcategory List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} colors={[PURPLE]} />
        }
      >
        <Text style={styles.listHeading}>Choose a service type</Text>

        {localSubs.map((sub, index) => {
            const resolvedSubImage = sub.imageUrl ? (sub.imageUrl.startsWith('http') ? sub.imageUrl : `${BASE_IMAGE_URL}${sub.imageUrl}`) : null;

            return (
              <TouchableOpacity
                key={index}
                style={styles.subCard}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('DescribeJob', {
                    category: route.params,
                    subcategory: sub.name,
                  })
                }
              >
                {/* Left accent strip */}
                <View style={[styles.cardAccent, { backgroundColor: PURPLE }]} />

                <View style={[styles.cardIconBox, resolvedSubImage && { backgroundColor: 'transparent', padding: 0 }]}>
                  {resolvedSubImage ? (
                    <Image source={{ uri: resolvedSubImage }} style={{ width: '100%', height: '100%', borderRadius: 14 }} resizeMode="cover" />
                  ) : (
                    <Text style={styles.cardIcon}>{icon}</Text>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{sub.name}</Text>
                </View>

                <ChevronRight size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            );
        })}

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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Suggest a Subcategory</Text>
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // ── Hero ──
    hero: {
      paddingTop: 14,
      paddingBottom: 28,
      paddingHorizontal: 16,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 190,
    },
    heroImage: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100%',
      height: '100%',
    },
    heroImageOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
    },
    heroDecor1: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    heroDecor2: {
      position: 'absolute',
      bottom: -30,
      right: 30,
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.18)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    heroContent: {
      alignItems: 'flex-start',
    },
    heroIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.22)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    heroIcon: {
      fontSize: 30,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      fontWeight: '500',
    },

    // ── List ──
    listContent: {
      paddingHorizontal: 14,
      paddingTop: 20,
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
      paddingBottom: 40,
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
