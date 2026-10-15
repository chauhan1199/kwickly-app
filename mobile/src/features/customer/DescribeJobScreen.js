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
  PermissionsAndroid,
  DeviceEventEmitter,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import { getCurrentCoordinates } from '../../utils/currentLocation';
import {
  ChevronLeft,
  UploadCloud,
  X,
  MapPin,
  Bell,
  Camera,
  Video,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  CheckCircle,
  Plus,
} from 'lucide-react-native';

const PURPLE      = '#6C47FF';
const PURPLE_DARK = '#5535d4';
const PURPLE_SOFT = 'rgba(108,71,255,0.13)';
const ERROR_RED   = '#EF4444';
const SUCCESS_GRN = '#22C55E';

// Max file size in bytes (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Max number of attachments
const MAX_MEDIA     = 5;
// Allowed MIME type prefixes
const ALLOWED_TYPES = ['image/', 'video/'];

// ── Validation helpers ──────────────────────────────────────────────────────
const validateAsset = (asset) => {
  if (!asset?.uri) return 'Could not read the selected file.';
  if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE)
    return `File too large (max 10 MB). Selected file is ${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB.`;
  const mime = asset.type || '';
  if (mime && !ALLOWED_TYPES.some(t => mime.startsWith(t)))
    return `Unsupported file type (${mime}). Only photos and videos are allowed.`;
  return null; // valid
};

// ── Human-readable file-type tag ────────────────────────────────────────────
const getMediaTag = (item) => {
  if (item.type?.startsWith('video')) return 'VIDEO';
  return 'PHOTO';
};

// ── Colour for tag pill ─────────────────────────────────────────────────────
const getTagColor = (item) => {
  if (item.type?.startsWith('video')) return '#7C3AED';
  return '#2563EB';
};

// The saved address's own pin as a GeoJSON Point, or null. Every address switch replaces the
// job location with this, so a previous address's coordinates are never reused.
const locationFromAddress = (addr) => {
  const c = addr?.location?.coordinates || addr?.coordinates;
  if (!Array.isArray(c) || c.length !== 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
};

const DescribeJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const {
    category    = { name: 'Service' },
    subcategory = 'General',
    selectedWorker,
  } = route.params || {};

  const { user, token } = useAuth();

  const [description,      setDescription]      = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [budget,           setBudget]           = useState('');
  const [media,            setMedia]            = useState([]);   // [{ uri, type, name, fileSize }]
  const [mediaError,       setMediaError]       = useState('');
  const [addressType,      setAddressType]      = useState('Home');
  const [address,          setAddress]          = useState('');
  const [addressError,     setAddressError]     = useState('');
  const [location,         setLocation]         = useState(null);
  const [preferredDate,    setPreferredDate]    = useState(new Date());
  const [showDatePicker,   setShowDatePicker]   = useState(false);
  const [timeSlot,         setTimeSlot]         = useState('urgent');
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [submitError,      setSubmitError]      = useState('');
  const [submitSuccess,    setSubmitSuccess]    = useState(false);

  // Media action-sheet modal
  const [showMediaSheet, setShowMediaSheet] = useState(false);

  const hasInitializedAddressRef = React.useRef(false);

  // ── Populate address from user profile on mount ──────────────────────────
  React.useEffect(() => {
    if (!hasInitializedAddressRef.current && user?.addresses?.length > 0) {
      hasInitializedAddressRef.current = true;
      const primary = user.addresses.find(a => a.isPrimary) || user.addresses[0];
      const fullAddr = [primary.street, primary.area, `${primary.city || ''} ${primary.pincode || ''}`]
        .filter(Boolean)
        .join(', ')
        .trim();
      setAddress(fullAddr || primary.address || '');
      setAddressType(primary.label || 'Home');
      setLocation(locationFromAddress(primary));
    }
  }, [user]);

  // ── Listen for ADDRESS_SELECTED event from SavedAddressesScreen ──────────
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ADDRESS_SELECTED', (sel) => {
      if (sel) {
        const fullAddr = [sel.street, sel.area, `${sel.city || ''} ${sel.pincode || ''}`]
          .filter(Boolean)
          .join(', ')
          .trim();
        setAddress(fullAddr || sel.address || '');
        setAddressType(sel.label || 'Other');
        setLocation(locationFromAddress(sel));
        setAddressError('');
      }
    });
    return () => sub.remove();
  }, []);

  // ── Receive address back from SavedAddressesScreen route params ──────────
  useFocusEffect(
    useCallback(() => {
      const sel = route.params?.selectedAddress;
      if (sel) {
        const fullAddr = [sel.street, sel.area, `${sel.city || ''} ${sel.pincode || ''}`]
          .filter(Boolean)
          .join(', ')
          .trim();
        setAddress(fullAddr || sel.address || '');
        setAddressType(sel.label || 'Other');
        setLocation(locationFromAddress(sel));
        setAddressError('');
        navigation.setParams({ selectedAddress: undefined });
      }
    }, [route.params?.selectedAddress, navigation])
  );

  // ── Address chip switch ──────────────────────────────────────────────────
  const switchAddressChip = (type) => {
    setAddressType(type);
    setAddressError('');
    if (!user?.addresses?.length) { setLocation(null); return; }
    const matched = user.addresses.find(a => (a.label || '').toLowerCase() === type.toLowerCase());
    if (matched) {
      const fullAddr = [matched.street, matched.area, `${matched.city || ''} ${matched.pincode || ''}`]
        .filter(Boolean)
        .join(', ')
        .trim();
      setAddress(fullAddr || matched.address || '');
      setLocation(locationFromAddress(matched));
    } else {
      // No saved address for this chip: start empty so neither the text nor the pin of the
      // previous address carries over
      setAddress('');
      setLocation(null);
    }
  };

  const hasNoAddresses = !user?.addresses?.length && !address;

  // ── Add a validated asset to media list ────────────────────────────────
  const addAsset = (asset) => {
    const err = validateAsset(asset);
    if (err) {
      Alert.alert('Cannot Add File', err);
      return;
    }
    setMedia(prev => [
      ...prev,
      {
        uri:      asset.uri,
        type:     asset.type || 'image/jpeg',
        name:     asset.fileName || `media_${Date.now()}`,
        fileSize: asset.fileSize || 0,
      },
    ]);
    setMediaError('');
  };

  // ── Request CAMERA permission at runtime (Android) ───────────────────
  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'Kwickly needs camera access to take photos and videos for your job request.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      Alert.alert(
        'Camera Permission Denied',
        'Please go to Settings → Apps → Kwickly → Permissions and enable Camera to use this feature.',
        [{ text: 'OK' }]
      );
      return false;
    } catch (e) {
      return false;
    }
  };

  // ── Request storage/media permission at runtime (Android) ────────────
  const requestStoragePermission = async (needVideo = false) => {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = Platform.Version; // Android API level (number)
      let permsToRequest = [];

      if (apiLevel >= 33) {
        // Android 13+ uses granular media permissions
        permsToRequest = [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES];
        if (needVideo) permsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
      } else {
        // Android 12 and below
        permsToRequest = [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
      }

      const results = await PermissionsAndroid.requestMultiple(permsToRequest);
      const allGranted = Object.values(results).every(
        r => r === PermissionsAndroid.RESULTS.GRANTED
      );
      if (allGranted) return true;

      Alert.alert(
        'Storage Permission Denied',
        'Please go to Settings → Apps → Kwickly → Permissions and enable Storage/Photos to pick files.',
        [{ text: 'OK' }]
      );
      return false;
    } catch (e) {
      return false;
    }
  };

  // ── Launch camera (photo or video) ────────────────────────────────────
  const handleCamera = async (mediaType = 'photo') => {
    setShowMediaSheet(false);
    if (media.length >= MAX_MEDIA) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_MEDIA} files.`);
      return;
    }

    // Request CAMERA permission first
    const hasCamPerm = await requestCameraPermission();
    if (!hasCamPerm) return;

    try {
      const result = await launchCamera({
        mediaType,
        quality: 0.8,
        videoQuality: 'medium',
        durationLimit: 60,
        saveToPhotos: true,   // Save to gallery so user can see it
        includeBase64: false,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        const msgs = {
          camera_unavailable: 'Camera is not available on this device or emulator.',
          permission:         'Camera permission denied. Please enable it in App Settings.',
          others:             result.errorMessage || 'Camera error. Please try again.',
        };
        Alert.alert(
          'Camera Error',
          msgs[result.errorCode] || result.errorMessage || 'Unknown camera error.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!result.assets?.length) {
        Alert.alert('Capture Failed', 'No file was captured. Please try again.');
        return;
      }
      addAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Camera Error', e.message || 'Unable to open camera. Please try again.');
    }
  };

  // ── Launch image gallery ──────────────────────────────────────────────
  const handleGallery = async (mediaType = 'photo') => {
    setShowMediaSheet(false);
    if (media.length >= MAX_MEDIA) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_MEDIA} files.`);
      return;
    }

    // Request storage/media permission first
    const needVideo = mediaType === 'video';
    const hasStorePerm = await requestStoragePermission(needVideo);
    if (!hasStorePerm) return;

    try {
      const result = await launchImageLibrary({
        mediaType,
        quality: 0.8,
        selectionLimit: 1,
        includeBase64: false,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        const msgs = {
          permission: 'Gallery permission denied. Please enable it in App Settings.',
          others:     result.errorMessage || 'Gallery error. Please try again.',
        };
        Alert.alert('Gallery Error', msgs[result.errorCode] || msgs.others, [{ text: 'OK' }]);
        return;
      }

      if (!result.assets?.length) {
        Alert.alert(
          'No File Selected',
          mediaType === 'video'
            ? 'No video was selected. If your gallery is empty, use "Record Video" to capture one first.'
            : 'No photo was selected. If your gallery is empty, use "Take Photo" to capture one first.',
          [{ text: 'OK' }]
        );
        return;
      }
      addAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Gallery Error', e.message || 'Unable to open gallery. Please try again.');
    }
  };

  // ── Remove media item ────────────────────────────────────────────────
  const handleRemoveMedia = (index) => {
    Alert.alert(
      'Remove Attachment',
      'Remove this photo/video from your job request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => setMedia(prev => prev.filter((_, i) => i !== index)),
        },
      ]
    );
  };

  // ── Map / Address picker ─────────────────────────────────────────────
  const handlePickMap = () => {
    navigation.navigate('SavedAddresses', {
      fromBooking: true,
      onSelectAddress: (selectedAddr) => {
        const fullAddr = [selectedAddr.street, selectedAddr.area, `${selectedAddr.city || ''} ${selectedAddr.pincode || ''}`]
          .filter(Boolean)
          .join(', ')
          .trim();
        setAddress(fullAddr || selectedAddr.address || '');
        setAddressType(selectedAddr.label || 'Other');
        setLocation(locationFromAddress(selectedAddr));
        setAddressError('');
      },
    });
  };

  // ── Form validation ───────────────────────────────────────────────────
  const validateForm = () => {
    let valid = true;

    if (!description.trim()) {
      setDescriptionError('Please describe the issue in at least a few words.');
      valid = false;
    } else if (description.trim().length < 10) {
      setDescriptionError('Description is too short (minimum 10 characters).');
      valid = false;
    } else {
      setDescriptionError('');
    }

    if (!address?.trim()) {
      setAddressError('Please add a service address to proceed.');
      valid = false;
    } else {
      setAddressError('');
    }

    return valid;
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError('');
    if (!validateForm()) return;

    // The job is broadcast to workers around its pin, so it must be a real location:
    // never the user's last-known position or a default city.
    if (!locationFromAddress({ location })) {
      setAddressError('Pin this address on the map, or use your current location.');
      Alert.alert(
        'Where is the job?',
        'This address has no map pin. Pick it on the map, or use your current location if you are there now.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pick on map', onPress: handlePickMap },
          {
            text: 'Use current location',
            onPress: async () => {
              try {
                const coordinates = await getCurrentCoordinates({
                  precise: false,
                  reason: 'Location permission is needed to pin the job at your current location.',
                });
                setLocation({ type: 'Point', coordinates });
                setAddressError('');
              } catch (e) {
                Alert.alert('Location unavailable', `${e.message} You can pick the address on the map instead.`);
              }
            },
          },
        ]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryName = typeof category === 'string'
        ? category
        : (category?.name || category?.label || 'Service');

      // Checked above: the selected address's own pin (or the user's GPS fix)
      const jobLocation = locationFromAddress({ location });

      // Parallelize media uploads if attached
      const mediaUrls = [];
      if (Array.isArray(media) && media.length > 0) {
        const uploadPromises = media.map(async (m) => {
          try {
            const formData = new FormData();
            const cleanUri = Platform.OS === 'android' ? m.uri : m.uri.replace('file://', '');
            const fileType = m.type || 'image/jpeg';
            const fileName = m.name || m.fileName || `media_${Date.now()}.jpg`;

            formData.append('media', {
              uri: cleanUri,
              type: fileType,
              name: fileName,
            });

            const uploadRes = await jobService.uploadMedia(formData);
            return uploadRes?.data?.data?.url || uploadRes?.data?.url || null;
          } catch (e) {
            console.warn('Failed to upload media item:', e?.message || e);
            return null;
          }
        });

        const uploadedResults = await Promise.all(uploadPromises);
        mediaUrls.push(...uploadedResults.filter(Boolean));
      }

      const payload = {
        category:       categoryName,
        subcategory:    subcategory || 'General',
        description:    description.trim(),
        budget:         budget.trim() ? Number(budget.trim()) : undefined,
        media:          mediaUrls.filter(Boolean),
        preferredDate:  preferredDate.toISOString(),
        timeSlot:       (timeSlots.find(t => t.id === timeSlot && !isSlotOver(t)) ? timeSlot : 'urgent'),
        location:       jobLocation,
        addressDetails: address.trim(),
        preferredWorkerId: selectedWorker?._id || selectedWorker?.id || undefined,
      };

      const res    = await jobService.createJob(payload);
      const newJob = res.data?.data;

      if (!newJob?._id) throw new Error('Invalid response from server.');

      setSubmitSuccess(true);
      navigation.navigate('Home', { screen: 'HomeMain', params: { refresh: Date.now() } });
    } catch (error) {
      const serverErrors = error.response?.data?.errors;
      const msg =
        (Array.isArray(serverErrors) ? serverErrors.join('\n') : null) ||
        error.response?.data?.message ||
        error.message ||
        'Failed to post job. Please check your connection and try again.';
      setSubmitError(msg);
      Alert.alert('Booking Failed', msg, [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = [
    { id: 'urgent',    icon: '⚡', label: 'Urgent / ASAP', sub: 'Within 1-2 hrs' },
    { id: 'morning',   icon: '🌅', label: 'Morning',       sub: '8 AM – 12 PM', endHour: 12 },
    { id: 'afternoon', icon: '☀️',  label: 'Afternoon',     sub: '12 PM – 4 PM', endHour: 16 },
    { id: 'evening',   icon: '🌆', label: 'Evening',        sub: '4 PM – 8 PM',  endHour: 20 },
  ];

  // A slot that has already ended today can't be booked for today
  const isSlotOver = (slot, date = preferredDate) => {
    if (!slot.endHour) return false;
    const now = new Date();
    return date.toDateString() === now.toDateString() && now.getHours() >= slot.endHour;
  };

  const getNext7Days = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const styles = createStyles(theme, isDarkMode);

  const remainingSlots = MAX_MEDIA - media.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* ── Purple Gradient Header ── */}
      <LinearGradient
        colors={[PURPLE, '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView style={styles.safeHeaderRow}>
          <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ChevronLeft size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>Describe your job</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{category.name} · {subcategory}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
          >
            <Bell size={20} color="#fff" />
            <View style={styles.badge} />
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: 95 }]}
          keyboardShouldPersistTaps="handled"
        >

        {/* ── Preferred Worker Banner (If booking a specific verified pro) ── */}
        {selectedWorker && (
          <View style={styles.preferredWorkerBanner}>
            <View style={styles.preferredWorkerTop}>
              {selectedWorker.profileImage ? (
                <Image source={{ uri: selectedWorker.profileImage }} style={styles.preferredWorkerAvatar} />
              ) : (
                <View style={styles.preferredWorkerAvatarPlaceholder}>
                  <Text style={styles.preferredWorkerAvatarText}>
                    {selectedWorker.name ? selectedWorker.name.trim().charAt(0).toUpperCase() : 'P'}
                  </Text>
                </View>
              )}
              <View style={styles.preferredWorkerInfo}>
                <View style={styles.preferredWorkerNameRow}>
                  <Text style={styles.preferredWorkerName} numberOfLines={1}>{selectedWorker.name}</Text>
                  {selectedWorker.verified && (
                    <View style={styles.preferredWorkerKyc}>
                      <Text style={styles.preferredWorkerKycText}>KYC ✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.preferredWorkerSub} numberOfLines={1}>
                  Direct Request · {category?.name || category} ({subcategory})
                </Text>
              </View>
              <View style={styles.preferredWorkerBadge}>
                <Text style={styles.preferredWorkerBadgeText}>Priority Dispatch</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Description ── */}
        <Text style={styles.label}>Describe the issue <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.textArea, descriptionError ? styles.inputError : null]}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={t => { setDescription(t); if (descriptionError) setDescriptionError(''); }}
          placeholder="E.g. AC not cooling, makes loud noise… (min 10 characters)"
          placeholderTextColor={theme.colors.textDim}
          textAlignVertical="top"
          maxLength={500}
        />
        <View style={styles.descFooter}>
          {descriptionError ? (
            <View style={styles.errorRow}>
              <AlertCircle size={13} color={ERROR_RED} />
              <Text style={styles.errorText}>{descriptionError}</Text>
            </View>
          ) : <View />}
          <Text style={[styles.charCount, description.length > 450 && styles.charCountWarn]}>
            {description.length}/500
          </Text>
        </View>

        {/* ── Media Upload ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>
          Photos / Videos
          <Text style={styles.labelHint}> (optional · max {MAX_MEDIA})</Text>
        </Text>

        {/* Attachment grid */}
        {media.length > 0 && (
          <View style={styles.mediaGrid}>
            {media.map((item, idx) => (
              <View key={idx} style={styles.mediaTileFilled}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
                {/* Type pill */}
                <View style={[styles.mediaTypePill, { backgroundColor: getTagColor(item) }]}>
                  <Text style={styles.mediaTypePillText}>{getMediaTag(item)}</Text>
                </View>
                {/* Video overlay icon */}
                {item.type?.startsWith('video') && (
                  <View style={styles.videoPlayOverlay}>
                    <Video size={20} color="#fff" />
                  </View>
                )}
                {/* Remove button */}
                <TouchableOpacity
                  style={styles.deleteMediaBtn}
                  onPress={() => handleRemoveMedia(idx)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add-more tile */}
            {media.length < MAX_MEDIA && (
              <TouchableOpacity
                style={styles.mediaAddMoreTile}
                onPress={() => setShowMediaSheet(true)}
                activeOpacity={0.8}
              >
                <Plus size={26} color={PURPLE} />
                <Text style={styles.mediaAddMoreText}>Add More</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Add-first button (shown when no media yet) */}
        {media.length === 0 && (
          <TouchableOpacity
            style={styles.mediaEmptyBtn}
            onPress={() => setShowMediaSheet(true)}
            activeOpacity={0.8}
          >
            <UploadCloud size={28} color={PURPLE} />
            <Text style={styles.mediaEmptyTitle}>Upload Photos or Videos</Text>
            <Text style={styles.mediaEmptyHint}>
              Take a photo/video with camera, or pick from your gallery.{'\n'}
              Max {MAX_MEDIA} files · up to 10 MB each
            </Text>
          </TouchableOpacity>
        )}

        {/* Counter / error */}
        <View style={styles.mediaFooter}>
          {mediaError ? (
            <View style={styles.errorRow}>
              <AlertCircle size={13} color={ERROR_RED} />
              <Text style={styles.errorText}>{mediaError}</Text>
            </View>
          ) : (
            <Text style={styles.mediaHint}>
              {media.length === 0
                ? 'Attach photos/videos to help workers understand the issue'
                : `${media.length}/${MAX_MEDIA} file${media.length > 1 ? 's' : ''} attached · ${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining`}
            </Text>
          )}
        </View>

        {/* ── Service Address ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>
          Service address <Text style={styles.required}>*</Text>
        </Text>

        {hasNoAddresses ? (
          <View style={[styles.noAddressBanner, addressError && styles.noAddressBannerError]}>
            <MapPin size={20} color={addressError ? ERROR_RED : PURPLE} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.noAddressTitle, addressError && { color: ERROR_RED }]}>No saved address</Text>
              <Text style={styles.noAddressSub}>Add an address to continue booking</Text>
            </View>
            <TouchableOpacity
              style={styles.noAddressBtn}
              onPress={handlePickMap}
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
              style={[styles.addressInput, addressError ? styles.inputError : null]}
              value={address}
              onChangeText={t => { setAddress(t); if (addressError) setAddressError(''); }}
              placeholder="Enter service address…"
              placeholderTextColor={theme.colors.textDim}
              multiline
            />
          </>
        )}

        {addressError ? (
          <View style={[styles.errorRow, { marginBottom: 6 }]}>
            <AlertCircle size={13} color={ERROR_RED} />
            <Text style={styles.errorText}>{addressError}</Text>
          </View>
        ) : null}

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
            const over = isSlotOver(slot);
            const active = timeSlot === slot.id && !over;
            return (
              <TouchableOpacity
                key={slot.id}
                style={[styles.timeCard, active && styles.timeCardActive, over && { opacity: 0.4 }]}
                onPress={() => setTimeSlot(slot.id)}
                disabled={over}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22 }}>{slot.icon}</Text>
                <Text style={[styles.timeLabel, active && { color: PURPLE }]}>{slot.label}</Text>
                <Text style={styles.timeSub}>{slot.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Estimated Budget (Optional) ── */}
        <Text style={[styles.label, { marginTop: 14 }]}>
          Estimated Budget (₹) <Text style={styles.optionalBadge}>(Optional)</Text>
        </Text>
        <View style={styles.budgetRow}>
          <View style={styles.budgetCurrencyBadge}>
            <Text style={styles.budgetCurrencyText}>₹</Text>
          </View>
          <TextInput
            style={styles.budgetInput}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder="e.g. 500 (or leave empty for open bids)"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>
        <Text style={styles.budgetHint}>
          💡 Leave empty if you want nearby workers to provide their best custom quotes.
        </Text>

        {/* ── Global submit error ── */}
        {submitError ? (
          <View style={styles.submitErrorBox}>
            <AlertCircle size={16} color={ERROR_RED} />
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </View>
        ) : null}

        {/* ── Submit Button ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={isSubmitting || submitSuccess}
          style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', opacity: isSubmitting ? 0.8 : 1 }}
        >
          <LinearGradient
            colors={submitSuccess ? [SUCCESS_GRN, '#16A34A'] : [PURPLE, PURPLE_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            {isSubmitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitBtnText}>Posting Job…</Text>
              </View>
            ) : submitSuccess ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Job Posted!</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>
                {selectedWorker ? `🚀 Book ${selectedWorker.name?.split(' ')[0]}` : '🚀 Post Job · Get Bids'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ══════════════════════════════════════
          MEDIA SOURCE ACTION SHEET
      ══════════════════════════════════════ */}
      <Modal
        visible={showMediaSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMediaSheet(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMediaSheet(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.actionSheetTitle}>Add Attachment</Text>
            <Text style={styles.actionSheetSub}>
              {remainingSlots} of {MAX_MEDIA} slots remaining · max 10 MB each
            </Text>

            {/* Emulator / fresh-device tip */}
            <View style={styles.actionTipBox}>
              <Text style={styles.actionTipText}>
                💡 <Text style={{ fontWeight: '700' }}>No photos in gallery?</Text> Use{' '}
                <Text style={{ fontWeight: '700' }}>Take Photo</Text> or{' '}
                <Text style={{ fontWeight: '700' }}>Record Video</Text> to capture directly.
              </Text>
            </View>

            {/* Camera — Photo */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleCamera('photo')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Camera size={22} color="#4F46E5" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Take Photo</Text>
                <Text style={styles.actionSub}>Capture using your camera</Text>
              </View>
            </TouchableOpacity>

            {/* Camera — Video */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleCamera('video')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F5F3FF' }]}>
                <Video size={22} color="#7C3AED" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Record Video</Text>
                <Text style={styles.actionSub}>Record up to 60 seconds</Text>
              </View>
            </TouchableOpacity>

            {/* Gallery — Photos */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleGallery('photo')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
                <ImageIcon size={22} color="#059669" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Choose Photo from Gallery</Text>
                <Text style={styles.actionSub}>Pick an existing photo from your device</Text>
              </View>
            </TouchableOpacity>

            {/* Gallery — Videos */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleGallery('video')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
                <FileText size={22} color="#EA580C" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Choose Video from Gallery</Text>
                <Text style={styles.actionSub}>Pick an existing video from your device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowMediaSheet(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ══════════════════════════════════════
          DATE PICKER MODAL
      ══════════════════════════════════════ */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
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
                    onPress={() => {
                      setPreferredDate(date);
                      // Picking today after the chosen slot has ended falls back to ASAP
                      const chosen = timeSlots.find(t => t.id === timeSlot);
                      if (chosen && isSlotOver(chosen, date)) setTimeSlot('urgent');
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateCardDay, isSelected && { color: PURPLE }]}>
                      {idx === 0 ? 'Today' : idx === 1 ? 'Tmrw' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateCardNum, isSelected && { color: PURPLE }]}>
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
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header */
  header: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 12 : 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  safeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    top: 7, right: 8,
    width: 7, height: 7,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },

  /* Content */
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textDim,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelHint: {
    fontWeight: '500',
    textTransform: 'none',
    fontSize: 11,
  },
  required: {
    color: ERROR_RED,
    fontWeight: '900',
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
    marginBottom: 4,
  },
  inputError: {
    borderColor: ERROR_RED,
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  descFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  charCountWarn: {
    color: '#F59E0B',
    fontWeight: '700',
  },

  /* Error */
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: {
    fontSize: 12,
    color: ERROR_RED,
    fontWeight: '600',
    flex: 1,
  },

  /* Media grid */
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  mediaTileFilled: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaTypePill: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mediaTypePillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 5,
  },
  mediaAddMoreTile: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    backgroundColor: PURPLE_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  mediaAddMoreText: {
    fontSize: 10,
    color: PURPLE,
    fontWeight: '700',
  },

  /* Media empty CTA */
  mediaEmptyBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    backgroundColor: PURPLE_SOFT,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mediaEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE,
  },
  mediaEmptyHint: {
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  mediaFooter: {
    marginBottom: 4,
    minHeight: 18,
  },
  mediaHint: {
    fontSize: 11,
    color: theme.colors.textDim,
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
    marginBottom: 6,
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
    marginBottom: 6,
  },
  noAddressBannerError: {
    borderColor: ERROR_RED,
    backgroundColor: 'rgba(239,68,68,0.06)',
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
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: ERROR_RED,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  submitErrorText: {
    flex: 1,
    fontSize: 13,
    color: ERROR_RED,
    fontWeight: '600',
    lineHeight: 18,
  },
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

  /* Action Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
    textAlign: 'center',
  },
  actionSheetSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 10,
  },
  actionTipBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  actionTipText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors.border,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },

  /* Date Picker Modal */
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  modalHandle: {
    width: 40, height: 4,
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
    width: 64, height: 90,
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
  optionalBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  budgetCurrencyBadge: {
    width: 44,
    height: 48,
    backgroundColor: PURPLE_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  budgetCurrencyText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE,
  },
  budgetInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  budgetHint: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 5,
    lineHeight: 15,
  },

  // ── Preferred Worker Banner ──
  preferredWorkerBanner: {
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.15)' : '#F4F0FF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
  preferredWorkerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferredWorkerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
  preferredWorkerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferredWorkerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  preferredWorkerInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
    minWidth: 0,
    justifyContent: 'center',
  },
  preferredWorkerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 5,
  },
  preferredWorkerName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.colors.text,
    flexShrink: 1,
  },
  preferredWorkerKyc: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    flexShrink: 0,
  },
  preferredWorkerKycText: {
    color: '#10b981',
    fontSize: 9.5,
    fontWeight: '800',
  },
  preferredWorkerSub: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  preferredWorkerBadge: {
    backgroundColor: 'rgba(108,71,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0,
    alignSelf: 'center',
  },
  preferredWorkerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
});

export default DescribeJobScreen;
