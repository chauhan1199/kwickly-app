import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ChevronLeft, UploadCloud, X, MapPin, Bell, Camera, Video } from 'lucide-react-native';

const PURPLE      = '#6C47FF';
const PURPLE_DARK = '#5535d4';
const PURPLE_SOFT = 'rgba(108,71,255,0.13)';

const DescribeJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const {
    category    = { name: 'Service' },
    subcategory = 'General',
    selectedWorker,
  } = route.params || {};

  console.log('DescribeJobScreen loaded with route.params:', JSON.stringify(route.params));

  const { user, token } = useAuth();

  const [description,    setDescription]    = useState('');
  const [media,          setMedia]          = useState([]);     // [{ uri, type }]
  const [addressType,    setAddressType]    = useState('Home');
  const [address,        setAddress]        = useState('');
  const [location,       setLocation]       = useState(null);
  const [preferredDate,  setPreferredDate]  = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeSlot,       setTimeSlot]       = useState('urgent');
  const [isSubmitting,   setIsSubmitting]   = useState(false);

  // ── Populate address from user profile on mount ──
  React.useEffect(() => {
    if (user?.addresses?.length > 0) {
      const primary = user.addresses.find(a => a.isPrimary) || user.addresses[0];
      setAddress(`${primary.street}, ${primary.city} ${primary.pincode}`);
      setAddressType(primary.label || 'Home');
      if (primary.location?.coordinates) setLocation(primary.location);
    }
  }, [user]);

  // ── Receive address back from SavedAddressesScreen or MapPicker ──
  useFocusEffect(
    useCallback(() => {
      const sel = route.params?.selectedAddress;
      if (sel) {
        setAddress(`${sel.street || sel.address || ''}, ${sel.city || ''} ${sel.pincode || ''}`.trim());
        setAddressType(sel.label || 'Other');
        if (sel.location?.coordinates) setLocation(sel.location);
        else if (sel.coordinates)       setLocation({ type: 'Point', coordinates: sel.coordinates });
        // Clear params so re-focus doesn't re-apply
        navigation.setParams({ selectedAddress: undefined });
      }
    }, [route.params?.selectedAddress])
  );

  // ── Address chip switch ──
  const switchAddressChip = (type) => {
    setAddressType(type);
    if (!user?.addresses?.length) return;
    const matched = user.addresses.find(a => (a.label || '').toLowerCase() === type.toLowerCase());
    if (matched) {
      setAddress(`${matched.street}, ${matched.city} ${matched.pincode}`);
      if (matched.location?.coordinates) setLocation(matched.location);
    } else if (type === 'Other') {
      setAddress('');
      setLocation(null);
    }
  };

  const hasNoAddresses = !user?.addresses?.length && !address;

  const timeSlots = [
    { id: 'urgent',    icon: '⚡', label: 'Urgent / ASAP', sub: 'Within 1-2 hrs' },
    { id: 'morning',   icon: '🌅', label: 'Morning',       sub: '8 AM – 12 PM' },
    { id: 'afternoon', icon: '☀️', label: 'Afternoon',     sub: '12 PM – 4 PM' },
    { id: 'evening',   icon: '🌆', label: 'Evening',       sub: '4 PM – 8 PM' },
  ];

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // ── Media picker (photo + video) ──
  const handlePickMedia = async (mediaType = 'photo') => {
    if (media.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 files.');
      return;
    }
    try {
      const result = await launchImageLibrary({ mediaType, quality: 0.8 });
      if (result.didCancel) return;
      if (result.errorCode || !result.assets?.length) throw new Error(result.errorMessage || 'Picker failed');
      const asset = result.assets[0];
      setMedia(prev => [...prev, { uri: asset.uri, type: asset.type?.startsWith('video') ? 'video' : 'photo' }]);
    } catch {
      // Emulator fallback
      setMedia(prev => [...prev, {
        uri: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&q=80',
        type: 'photo',
      }]);
    }
  };

  const handleRemoveMedia = (index) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  // ── Map / Address picker ──
  const handlePickMap = () => {
    navigation.navigate('SavedAddresses', { fromBooking: true });
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!description.trim()) {
      return Alert.alert('Missing Details', 'Please describe the issue.');
    }
    if (!address?.trim()) {
      return Alert.alert('No Address', 'Please add a service address before booking.');
    }

    setIsSubmitting(true);
    try {
      // Build location — use saved coords or a fallback so backend doesn't reject
      const jobLocation = location || {
        type: 'Point',
        coordinates: [72.8777, 19.0760], // default centre; backend should allow this
      };

      const payload = {
        category:       category.name,
        subcategory,
        description,
        media:          media.map(m => m.uri),
        preferredDate:  preferredDate.toISOString(),
        timeSlot,
        location:       jobLocation,
        addressDetails: address,
      };

      const res    = await api.post('/jobs', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newJob = res.data.data;

      if (selectedWorker) {
        navigation.navigate('LiveTracking', { worker: selectedWorker });
      } else {
        navigation.navigate('LiveBids', {
          jobId:      newJob._id,
          job:        newJob,
          category,
          subcategory,
          address,
          timeSlot:   timeSlots.find(t => t.id === timeSlot)?.label || 'ASAP',
        });
      }
    } catch (error) {
      const msg =
        error.response?.data?.errors?.join(', ') ||
        error.response?.data?.message ||
        'Failed to post job. Please try again.';
      Alert.alert('Booking Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE_DARK} />

      {/* ── Purple Gradient Header ── */}
      <LinearGradient
        colors={[PURPLE, '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Describe your job</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{category.name} · {subcategory}</Text>
        </View>

        <TouchableOpacity style={styles.headerIcon}>
          <Bell size={20} color="#fff" />
          <View style={styles.badge} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Description ── */}
        <Text style={styles.label}>Describe the issue</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          placeholder="E.g. AC not cooling, makes loud noise…"
          placeholderTextColor={theme.colors.textDim}
          textAlignVertical="top"
        />

        {/* ── Media Upload ── */}
        <Text style={styles.label}>Add photos / video</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
          {media.map((item, idx) => (
            <View key={idx} style={styles.mediaTileFilled}>
              <Image source={{ uri: item.uri }} style={styles.mediaImage} />
              {item.type === 'video' && (
                <View style={styles.videoOverlay}>
                  <Video size={18} color="#fff" />
                </View>
              )}
              <TouchableOpacity style={styles.deleteMediaBtn} onPress={() => handleRemoveMedia(idx)}>
                <X size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {media.length < 5 && (
            <View style={styles.mediaUploadGroup}>
              <TouchableOpacity style={styles.mediaTileEmpty} onPress={() => handlePickMedia('photo')}>
                <Camera size={22} color={PURPLE} />
                <Text style={styles.mediaTileLabel}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaTileEmpty} onPress={() => handlePickMedia('video')}>
                <Video size={22} color={PURPLE} />
                <Text style={styles.mediaTileLabel}>Video</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <Text style={styles.mediaHint}>Max 5 files · {media.length}/5 added</Text>

        {/* ── Service Address ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>Service address</Text>

        {hasNoAddresses ? (
          /* No saved addresses → prompt to add */
          <View style={styles.noAddressBanner}>
            <MapPin size={20} color={PURPLE} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.noAddressTitle}>No saved address</Text>
              <Text style={styles.noAddressSub}>Add an address to continue booking</Text>
            </View>
            <TouchableOpacity
              style={styles.noAddressBtn}
              onPress={() => navigation.navigate('SavedAddresses', { fromBooking: true })}
            >
              <Text style={styles.noAddressBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Address Type Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {['Home', 'Office', 'Other'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.addrChip, addressType === type && styles.addrChipActive]}
                  onPress={() => switchAddressChip(type)}
                >
                  <Text style={[styles.addrChipText, addressType === type && styles.addrChipTextActive]}>
                    {type === 'Home' ? '🏠' : type === 'Office' ? '🏢' : '➕'} {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Address Text Input */}
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter service address…"
              placeholderTextColor={theme.colors.textDim}
              multiline
            />
          </>
        )}

        {/* Pick from Map */}
        <TouchableOpacity style={styles.mapBtn} onPress={handlePickMap}>
          <MapPin size={16} color={PURPLE} />
          <Text style={styles.mapBtnText}>Pick from Map / Saved Addresses</Text>
        </TouchableOpacity>

        {/* ── Preferred Date ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>Preferred date</Text>
        <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateFieldText}>
            📅  {preferredDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={styles.dateFieldChevron}>›</Text>
        </TouchableOpacity>

        {/* ── Time Slot ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>Time slot</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map(slot => {
            const active = timeSlot === slot.id;
            return (
              <TouchableOpacity
                key={slot.id}
                style={[styles.timeCard, active && styles.timeCardActive]}
                onPress={() => setTimeSlot(slot.id)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22 }}>{slot.icon}</Text>
                <Text style={[styles.timeLabel, active && { color: PURPLE }]}>{slot.label}</Text>
                <Text style={styles.timeSub}>{slot.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Submit Button ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[PURPLE, PURPLE_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {selectedWorker ? `🚀 Book ${selectedWorker.name?.split(' ')[0]}` : '🚀 Post Job · Get Bids'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Date Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Preferred Date</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
              {getNext7Days().map((date, idx) => {
                const isSelected = preferredDate.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dateCard, isSelected && styles.dateCardActive]}
                    onPress={() => { setPreferredDate(date); setShowDatePicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateDay, isSelected && { color: '#fff' }]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateNum, isSelected && { color: '#fff' }]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[styles.dateMon, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                      {date.toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              style={{ borderRadius: 12, overflow: 'hidden', marginTop: 8 }}
              onPress={() => setShowDatePicker(false)}
            >
              <LinearGradient colors={[PURPLE, PURPLE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 14,
    paddingBottom: 16,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },

  /* Content */
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textDim,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  /* Description */
  textArea: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    color: theme.colors.text,
    fontSize: 14,
    minHeight: 90,
    marginBottom: 16,
  },

  /* Media */
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
    paddingBottom: 4,
  },
  mediaTileFilled: {
    width: 82,
    height: 82,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    padding: 4,
  },
  mediaUploadGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaTileEmpty: {
    width: 82,
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    backgroundColor: PURPLE_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  mediaTileLabel: {
    fontSize: 10,
    color: PURPLE,
    fontWeight: '700',
  },
  mediaHint: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginBottom: 4,
  },

  /* Address */
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addrChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  addrChipActive: {
    borderColor: PURPLE,
    backgroundColor: PURPLE_SOFT,
  },
  addrChipText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  addrChipTextActive: {
    color: PURPLE,
  },
  addressInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 48,
  },
  noAddressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PURPLE_SOFT,
    borderWidth: 1.5,
    borderColor: PURPLE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  noAddressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PURPLE,
  },
  noAddressSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  noAddressBtn: {
    backgroundColor: PURPLE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noAddressBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.12)' : '#f5f3ff',
    borderWidth: 1.5,
    borderColor: PURPLE,
    borderRadius: 14,
    padding: 13,
    marginBottom: 4,
  },
  mapBtnText: {
    fontSize: 13,
    color: PURPLE,
    fontWeight: '700',
  },

  /* Date Field */
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 4,
  },
  dateFieldText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dateFieldChevron: {
    fontSize: 22,
    color: theme.colors.textDim,
    lineHeight: 26,
  },

  /* Time Grid */
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  timeCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 3,
  },
  timeCardActive: {
    borderColor: PURPLE,
    backgroundColor: PURPLE_SOFT,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
  timeSub: {
    fontSize: 11,
    color: theme.colors.textDim,
  },

  /* Submit */
  submitBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Date Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 16,
  },
  dateCard: {
    width: 64,
    height: 90,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.surface,
  },
  dateCardActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  dateDay: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  dateNum: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  dateMon: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  doneBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default DescribeJobScreen;
