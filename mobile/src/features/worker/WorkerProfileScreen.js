import React, { useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  Platform,
  PermissionsAndroid,
  Dimensions
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import Geolocation from '@react-native-community/geolocation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { workerService } from '../../services/workerService';
import { 
  Camera, 
  ChevronRight, 
  ShieldCheck, 
  Building2, 
  Star, 
  Wrench, 
  Wallet, 
  LifeBuoy,
  LogOut,
  X,
  UploadCloud,
  MapPin,
  Trash2,
  Edit2,
  Crosshair,
  Briefcase,
  Smartphone,
  Landmark,
  CheckCircle2,
  Plus,
  Compass,
  Check,
  Eye,
  FileText,
  AlertCircle,
  Clock
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getImageUrl } from '../../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ADDR_LABELS = ['Home', 'Work', 'Office', 'Shop', 'Other'];
const DOC_TYPES = ['AADHAR', 'PAN', 'LICENSE', 'VOTER_ID', 'PASSPORT'];

const WorkerProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, signOut, fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [activeModal, setActiveModal] = useState(null); // 'kyc', 'bank', 'editProfile', 'addresses', 'editAddress'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);

  // Form states for Edit Profile
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Form states for Bank Account & UPI
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // KYC state
  const [docUrl, setDocUrl] = useState(null);
  const [kycType, setKycType] = useState('AADHAR');
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // Address states
  const [addressList, setAddressList] = useState([]);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);
  const [addrCoordinate, setAddrCoordinate] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const res = await workerService.getProfile();
      const userData = res.data?.data || res.data;
      setProfile(userData);
      setEditName(userData?.name || '');
      setEditEmail(userData?.email || '');
      setEditPhone(userData?.phone || '');
      
      if (userData?.wallet?.bankDetails) {
        setBankName(userData.wallet.bankDetails.bankName || '');
        setAccountNumber(userData.wallet.bankDetails.accountNumber || '');
        setIfscCode(userData.wallet.bankDetails.ifscCode || '');
      } else {
        setBankName('');
        setAccountNumber('');
        setIfscCode('');
      }
      if (userData?.wallet?.upiId) {
        setUpiId(userData.wallet.upiId);
      } else {
        setUpiId('');
      }
      if (userData?.addresses) {
        setAddressList(userData.addresses);
      }
    } catch (error) {
      // Silently handle
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════
  // 1. PROFILE PHOTO UPLOAD
  // ═══════════════════════════════════════════
  const handlePickPhoto = () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose how you would like to select your photo',
      [
        {
          text: '📷 Take Photo (Camera)',
          onPress: async () => {
            const options = { mediaType: 'photo', quality: 0.8, includeBase64: true, maxWidth: 1024, maxHeight: 1024 };
            const response = await launchCamera(options);
            processPickedImage(response);
          }
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            const options = { mediaType: 'photo', quality: 0.8, includeBase64: true, maxWidth: 1024, maxHeight: 1024 };
            const response = await launchImageLibrary(options);
            processPickedImage(response);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const processPickedImage = async (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', response.errorMessage || 'Failed to select image');
      return;
    }
    if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      setSaving(true);
      try {
        const payload = {
          profileImageBase64: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`
        };
        await workerService.updateProfilePhoto(payload);
        Alert.alert('Success 🎉', 'Profile photo updated successfully!');
        fetchProfile();
        if (fetchUser) fetchUser('WORKER');
      } catch (error) {
        const msg = error.response?.data?.message || error.message || 'Failed to upload photo';
        Alert.alert('Upload Error', msg);
      } finally {
        setSaving(false);
      }
    }
  };

  // ═══════════════════════════════════════════
  // 2. BANK ACCOUNT & UPI MANAGEMENT
  // ═══════════════════════════════════════════
  const handleSaveBank = async () => {
    if (!bankName && !accountNumber && !ifscCode && !upiId) {
      Alert.alert('Required', 'Please provide either Bank Details or a UPI ID.');
      return;
    }

    if (upiId && upiId.trim()) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upiId.trim())) {
        Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. yourname@bank).');
        return;
      }
    }

    if (bankName || accountNumber || ifscCode) {
      if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
        Alert.alert('Incomplete Bank Details', 'Please enter Bank Name, Account Number, and IFSC code.');
        return;
      }
      if (!/^\d{9,18}$/.test(accountNumber.trim())) {
        Alert.alert('Invalid Account Number', 'Bank account number must be between 9 and 18 digits.');
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
        Alert.alert('Invalid IFSC Code', 'IFSC Code must be 11 characters (e.g. SBIN0001234, HDFC0001234).');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {};
      if (bankName && accountNumber && ifscCode) {
        payload.bankDetails = {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase()
        };
      }
      if (upiId && upiId.trim()) {
        payload.upiId = upiId.trim();
      }

      await workerService.updateBank(payload);
      Alert.alert('Success ✅', 'Payout account details updated successfully.');
      setActiveModal(null);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save payment details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankDetails = () => {
    Alert.alert(
      'Remove Bank Account',
      'Are you sure you want to remove your saved bank account details?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await workerService.updateBank({ bankDetails: null });
              setBankName('');
              setAccountNumber('');
              setIfscCode('');
              fetchProfile();
              Alert.alert('Removed ✅', 'Bank account details removed successfully.');
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove bank details.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteUpi = () => {
    Alert.alert(
      'Remove UPI ID',
      'Are you sure you want to remove your UPI ID?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await workerService.updateBank({ upiId: '' });
              setUpiId('');
              fetchProfile();
              Alert.alert('Removed ✅', 'UPI ID removed successfully.');
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove UPI ID.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // ═══════════════════════════════════════════
  // 3. MANAGE ADDRESSES WITH MAP & GPS
  // ═══════════════════════════════════════════
  const handleUseGps = async () => {
    setGpsLoading(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'GPS Location Permission',
            message: 'Kwickly needs access to your GPS location to accurately set your address.',
            buttonPositive: 'Allow'
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setGpsLoading(false);
          Alert.alert('Permission Denied', 'Please allow GPS location permission to auto-detect location.');
          return;
        }
      }

      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setAddrCoordinate({ latitude, longitude });
          setGpsLoading(false);
          // Auto reverse geocode
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              const a = data.address || {};
              if (a.road || a.building) setAddrStreet(a.road || a.building);
              if (a.suburb || a.neighbourhood) setAddrArea(a.suburb || a.neighbourhood);
              if (a.city || a.town || a.village) setAddrCity(a.city || a.town || a.village);
              if (a.postcode && /^[1-9][0-9]{5}$/.test(a.postcode)) setAddrPincode(a.postcode);
            })
            .catch(() => {});
          Alert.alert('GPS Location Captured 📍', `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        (error) => {
          // Fallback to network/coarse location
          Geolocation.getCurrentPosition(
            (fallbackPos) => {
              const { latitude, longitude } = fallbackPos.coords;
              setAddrCoordinate({ latitude, longitude });
              setGpsLoading(false);
            },
            () => {
              setGpsLoading(false);
              setAddrCoordinate({ latitude: 23.0225, longitude: 72.5714 });
              Alert.alert('GPS Notice', 'Could not get direct satellite lock. You can drag and pin your exact location on the map below.');
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 }
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    } catch (e) {
      setGpsLoading(false);
    }
  };

  const handleMapLocationSelect = (locationData) => {
    const { latitude, longitude, details } = locationData;
    setAddrCoordinate({ latitude, longitude });
    if (details) {
      if (details.street && !addrStreet) setAddrStreet(details.street);
      if (details.area) setAddrArea(details.area);
      if (details.city) setAddrCity(details.city);
      if (details.pincode && /^[1-9][0-9]{5}$/.test(details.pincode)) setAddrPincode(details.pincode);
    }
  };

  const handleSaveAddress = async () => {
    if (!addrStreet.trim() || !addrArea.trim() || !addrCity.trim() || !addrPincode.trim()) {
      Alert.alert('Required Fields', 'Please fill in Street, Area, City, and Pincode.');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(addrPincode.trim())) {
      Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    setSaving(true);
    try {
      const data = {
        label: addrLabel,
        street: addrStreet.trim(),
        area: addrArea.trim(),
        city: addrCity.trim(),
        pincode: addrPincode.trim(),
        isPrimary: addrIsPrimary
      };

      if (addrCoordinate) {
        data.location = {
          type: 'Point',
          coordinates: [addrCoordinate.longitude, addrCoordinate.latitude]
        };
      }

      if (editingAddress) {
        const res = await workerService.updateAddress(editingAddress._id, data);
        setAddressList(res.data?.data || res.data || []);
      } else {
        const res = await workerService.addAddress(data);
        setAddressList(res.data?.data || res.data || []);
      }

      Alert.alert('Success 🎉', 'Address saved successfully.');
      setActiveModal('addresses');
      fetchProfile();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await workerService.deleteAddress(id);
            setAddressList(res.data?.data || res.data || []);
            fetchProfile();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete address.');
          }
        }
      }
    ]);
  };

  const handleSetPrimaryAddress = async (id) => {
    try {
      const res = await workerService.setPrimaryAddress(id);
      setAddressList(res.data?.data || res.data || []);
      fetchProfile();
    } catch (e) {
      Alert.alert('Error', 'Failed to set primary address.');
    }
  };

  const openEditAddress = (addr = null) => {
    if (addr) {
      setEditingAddress(addr);
      setAddrLabel(addr.label || 'Home');
      setAddrStreet(addr.street || '');
      setAddrArea(addr.area || '');
      setAddrCity(addr.city || '');
      setAddrPincode(addr.pincode || '');
      setAddrIsPrimary(addr.isPrimary || false);
      if (addr.location?.coordinates && addr.location.coordinates.length === 2) {
        setAddrCoordinate({
          longitude: addr.location.coordinates[0],
          latitude: addr.location.coordinates[1]
        });
      } else {
        setAddrCoordinate(null);
      }
    } else {
      setEditingAddress(null);
      setAddrLabel('Home');
      setAddrStreet('');
      setAddrArea('');
      setAddrCity(profile?.city || 'Ahmedabad');
      setAddrPincode('');
      setAddrIsPrimary(addressList.length === 0);
      setAddrCoordinate(null);
    }
    setActiveModal('editAddress');
  };

  // ═══════════════════════════════════════════
  // 4. KYC DOCUMENT UPLOAD & MANAGEMENT
  // ═══════════════════════════════════════════
  const pickKycImage = () => {
    Alert.alert(
      'Upload KYC Document',
      'Choose an option to upload document',
      [
        {
          text: '📷 Take Photo (Camera)',
          onPress: async () => {
            const options = { mediaType: 'photo', quality: 0.8, includeBase64: true, maxWidth: 1200, maxHeight: 1200 };
            const response = await launchCamera(options);
            if (!response.didCancel && !response.errorCode && response.assets?.length > 0) {
              setDocUrl(response.assets[0]);
            }
          }
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            const options = { mediaType: 'photo', quality: 0.8, includeBase64: true, maxWidth: 1200, maxHeight: 1200 };
            const response = await launchImageLibrary(options);
            if (!response.didCancel && !response.errorCode && response.assets?.length > 0) {
              setDocUrl(response.assets[0]);
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleUploadKyc = async () => {
    if (!docUrl) {
      Alert.alert('Error', 'Please select a document image to upload.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        documentType: kycType,
        documentName: `${kycType} Card / ID`,
        documentBase64: `data:${docUrl.type || 'image/jpeg'};base64,${docUrl.base64}`
      };
      await workerService.updateKyc(payload);
      Alert.alert('Success 🎉', `${kycType} document uploaded for admin verification!`);
      setDocUrl(null);
      fetchProfile();
      if (fetchUser) fetchUser('WORKER');
    } catch (error) {
      Alert.alert('Upload Error', error.response?.data?.message || 'Failed to upload KYC document.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKyc = (index, docName) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to remove ${docName || 'this document'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await workerService.removeKycDocument(index);
              fetchProfile();
              if (fetchUser) fetchUser('WORKER');
              Alert.alert('Removed', 'Document removed.');
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove document.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const renderMenuItem = (icon, title, subtitle, onPress, showArrow = true, danger = false) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.menuIconBox, danger && { backgroundColor: '#FEE2E2' }]}>
        {icon}
      </View>
      <View style={styles.menuItemTextContainer}>
        <Text style={[styles.menuItemTitle, danger && { color: theme.colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.menuItemSubtitle}>{subtitle}</Text> : null}
      </View>
      {showArrow && <ChevronRight size={20} color={theme.colors.border} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }

  const kycStatus = profile?.kyc?.status || 'PENDING';
  const isKycApproved = kycStatus === 'APPROVED';
  const isKycRejected = kycStatus === 'REJECTED';
  const kycDocuments = profile?.kyc?.documents || [];
  const hasBank = !!profile?.wallet?.bankDetails?.accountNumber || !!profile?.wallet?.upiId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Top Gradient Profile Header */}
        <LinearGradient
          colors={['#6C47FF', '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderGradient}
        >
          <View style={styles.profileHeaderContent}>
            <View style={styles.avatarWrapperNew}>
              {profile?.profileImage ? (
                <Image source={{ uri: getImageUrl(profile.profileImage) }} style={styles.avatarImageNew} />
              ) : (
                <View style={[styles.avatarImageNew, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 38, fontWeight: '800', color: '#fff' }}>{profile?.name ? profile.name.charAt(0) : 'W'}</Text>
                </View>
              )}
              {saving ? (
                <View style={styles.avatarEditBtnNew}>
                  <ActivityIndicator size="small" color="#6C47FF" />
                </View>
              ) : (
                <TouchableOpacity style={styles.avatarEditBtnNew} onPress={handlePickPhoto} activeOpacity={0.85}>
                  <Camera size={14} color="#6C47FF" />
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.profileNameNew}>{profile?.name || 'Worker'}</Text>
            <Text style={styles.profilePhoneNew}>{profile?.phone || ''}</Text>

            {/* Subscription & Rating Badges */}
            <View style={styles.headerBadgesRow}>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>
                  {profile?.subscription?.expiryDate ? 'PRO Active' : 'Free Trial'}
                </Text>
              </View>
              <View style={[
                styles.badgePill, 
                { 
                  backgroundColor: isKycApproved 
                    ? 'rgba(16, 185, 129, 0.25)' 
                    : isKycRejected 
                    ? 'rgba(239, 68, 68, 0.25)' 
                    : 'rgba(245, 158, 11, 0.25)' 
                }
              ]}>
                <Text style={[
                  styles.badgePillText, 
                  { 
                    color: isKycApproved 
                      ? '#A7F3D0' 
                      : isKycRejected 
                      ? '#FECACA' 
                      : '#FDE68A' 
                  }
                ]}>
                  {isKycApproved ? 'KYC Verified ✓' : isKycRejected ? 'KYC Rejected ✕' : 'KYC Pending ⏳'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Menu Cards */}
        <View style={styles.menuContainer}>
          
          {/* Section 1: Core Payouts & Addresses */}
          <Text style={styles.sectionHeading}>Financial & Locations</Text>
          <View style={styles.menuCard}>
            {renderMenuItem(
              <Landmark size={20} color="#6C47FF" />,
              'Bank Account & UPI',
              hasBank ? 'Active payout destinations configured' : 'Add Bank account or UPI ID for payouts',
              () => setActiveModal('bank')
            )}
            <View style={styles.divider} />
            {renderMenuItem(
              <MapPin size={20} color="#6C47FF" />,
              'Manage Addresses',
              `${addressList.length} saved addresses (GPS & Map Pins)`,
              () => setActiveModal('addresses')
            )}
          </View>

          {/* Section 2: Services & KYC Verification */}
          <Text style={styles.sectionHeading}>Professional Profile</Text>
          <View style={styles.menuCard}>
            {renderMenuItem(
              <Wrench size={20} color="#6C47FF" />,
              'My Services & Radius',
              `${profile?.services?.length || 0} active categories configured`,
              () => navigation.navigate('Services')
            )}
            <View style={styles.divider} />
            {renderMenuItem(
              <ShieldCheck size={20} color={isKycApproved ? '#10B981' : isKycRejected ? '#EF4444' : '#F59E0B'} />,
              'KYC Verification',
              isKycApproved 
                ? 'Identity verified & approved ✓' 
                : `${kycDocuments.length} document(s) submitted · ${kycStatus}`,
              () => setActiveModal('kyc')
            )}
            <View style={styles.divider} />
            {renderMenuItem(
              <Star size={20} color="#F59E0B" />,
              'My Ratings & Reviews',
              `${profile?.rating?.average || 5.0} ★ (${profile?.rating?.count || 0} reviews)`,
              () => Alert.alert('Customer Reviews', `Your average customer rating is ${profile?.rating?.average || 5.0} stars across ${profile?.rating?.count || 0} completed orders.`)
            )}
          </View>

          {/* Section 3: App & Account */}
          <Text style={styles.sectionHeading}>Account</Text>
          <View style={styles.menuCard}>
            {renderMenuItem(
              <LogOut size={20} color="#EF4444" />,
              'Log Out',
              'Sign out of your worker account',
              () => {
                Alert.alert('Log Out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out', style: 'destructive', onPress: signOut }
                ]);
              },
              false,
              true
            )}
          </View>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════
          MODAL 1: BANK ACCOUNT & UPI MANAGEMENT
      ═══════════════════════════════════════════ */}
      <Modal visible={activeModal === 'bank'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bank Account & UPI</Text>
                <Text style={styles.modalSub}>Manage your payout destinations</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Section A: Bank Details */}
              <View style={styles.modalSectionBox}>
                <View style={styles.modalSectionHeader}>
                  <Landmark size={18} color="#6C47FF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSectionTitle}>Bank Account Details</Text>
                  {bankName || accountNumber ? (
                    <TouchableOpacity onPress={handleDeleteBankDetails} style={styles.deleteMiniBtn}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. State Bank of India, HDFC"
                  placeholderTextColor="#94A3B8"
                  value={bankName}
                  onChangeText={setBankName}
                />

                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 123456789012"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />

                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. SBIN0001234"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  value={ifscCode}
                  onChangeText={(t) => setIfscCode(t.toUpperCase())}
                />
              </View>

              {/* Section B: UPI Details */}
              <View style={[styles.modalSectionBox, { marginTop: 14 }]}>
                <View style={styles.modalSectionHeader}>
                  <Smartphone size={18} color="#6C47FF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSectionTitle}>UPI ID (VPA)</Text>
                  {upiId ? (
                    <TouchableOpacity onPress={handleDeleteUpi} style={styles.deleteMiniBtn}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.inputLabel}>UPI ID</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. mobile-number@oksbi, name@paytm"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </View>

              <TouchableOpacity 
                style={[styles.modalPrimaryBtn, saving && { opacity: 0.7 }]} 
                onPress={handleSaveBank}
                disabled={saving}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalPrimaryGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Save Payout Details</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 2: MANAGE ADDRESSES LIST
      ═══════════════════════════════════════════ */}
      <Modal visible={activeModal === 'addresses'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Saved Addresses</Text>
                <Text style={styles.modalSub}>{addressList.length} registered locations</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {addressList.map((addr) => {
                const isPrimary = addr.isPrimary;
                const hasCoords = addr.location?.coordinates?.length === 2;

                return (
                  <View key={addr._id} style={[styles.addressItemCard, isPrimary && styles.addressItemCardPrimary]}>
                    <View style={styles.addrCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.addrLabelPill}>
                          <Text style={styles.addrLabelPillText}>{addr.label || 'Address'}</Text>
                        </View>
                        {isPrimary && (
                          <View style={styles.primaryBadge}>
                            <CheckCircle2 size={12} color="#10B981" style={{ marginRight: 3 }} />
                            <Text style={styles.primaryBadgeText}>Default Primary</Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => openEditAddress(addr)} style={styles.addrActionBtn}>
                          <Edit2 size={15} color="#6C47FF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteAddress(addr._id)} style={styles.addrActionBtn}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.addrText}>{addr.street}, {addr.area}, {addr.city} - {addr.pincode}</Text>
                    
                    {hasCoords && (
                      <View style={styles.coordsRow}>
                        <Compass size={12} color="#6C47FF" style={{ marginRight: 4 }} />
                        <Text style={styles.coordsText}>
                          GPS: {addr.location.coordinates[1].toFixed(4)}, {addr.location.coordinates[0].toFixed(4)}
                        </Text>
                      </View>
                    )}

                    {!isPrimary && (
                      <TouchableOpacity 
                        style={styles.setDefaultBtn} 
                        onPress={() => handleSetPrimaryAddress(addr._id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.setDefaultBtnText}>Set as Default Primary</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {addressList.length === 0 && (
                <View style={styles.emptyAddressBox}>
                  <MapPin size={36} color="#6C47FF" />
                  <Text style={styles.emptyAddressTitle}>No Addresses Saved</Text>
                  <Text style={styles.emptyAddressSub}>Add your primary working location for high-accuracy customer matches.</Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.addNewAddrBtn} 
                onPress={() => openEditAddress(null)}
                activeOpacity={0.85}
              >
                <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addNewAddrBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 3: ADD / EDIT ADDRESS (UBER-LIKE MAP)
      ═══════════════════════════════════════════ */}
      <Modal visible={activeModal === 'editAddress'} transparent animationType="slide" onRequestClose={() => setActiveModal('addresses')}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingAddress ? 'Edit Address' : 'Add New Address'}</Text>
                <Text style={styles.modalSub}>Move map to drop pin or use GPS</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('addresses')} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Uber-Style Map Pin Selector */}
              <View style={styles.mapSectionBox}>
                <View style={styles.mapSectionHeader}>
                  <MapPin size={16} color="#6C47FF" style={{ marginRight: 4 }} />
                  <Text style={styles.mapSectionTitle}>Pin Location (Pan Map to Set Exact Spot)</Text>
                  <TouchableOpacity style={styles.useGpsMiniBtn} onPress={handleUseGps} activeOpacity={0.8}>
                    {gpsLoading ? (
                      <ActivityIndicator size="small" color="#6C47FF" />
                    ) : (
                      <>
                        <Crosshair size={13} color="#6C47FF" style={{ marginRight: 4 }} />
                        <Text style={styles.useGpsMiniText}>Use GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <LeafletMapPicker
                  initialCoordinate={addrCoordinate || { latitude: 23.0225, longitude: 72.5714 }}
                  onLocationSelect={handleMapLocationSelect}
                  height={220}
                />
                
                {addrCoordinate && (
                  <Text style={styles.pinnedCoordsText}>
                    📍 Pinned: {addrCoordinate.latitude.toFixed(4)}, {addrCoordinate.longitude.toFixed(4)}
                  </Text>
                )}
              </View>

              {/* Label Selector Chips */}
              <Text style={styles.inputLabel}>Address Label</Text>
              <View style={styles.labelChipsRow}>
                {ADDR_LABELS.map((lbl) => (
                  <TouchableOpacity
                    key={lbl}
                    style={[styles.labelChip, addrLabel === lbl && styles.labelChipActive]}
                    onPress={() => setAddrLabel(lbl)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.labelChipText, addrLabel === lbl && styles.labelChipTextActive]}>
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Street / Building / Flat No.</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dwarkesh Heavens, Flat 402"
                placeholderTextColor="#94A3B8"
                value={addrStreet}
                onChangeText={setAddrStreet}
              />

              <Text style={styles.inputLabel}>Area / Locality</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Chandkheda"
                placeholderTextColor="#94A3B8"
                value={addrArea}
                onChangeText={setAddrArea}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ahmedabad"
                    placeholderTextColor="#94A3B8"
                    value={addrCity}
                    onChangeText={setAddrCity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="382424"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={6}
                    value={addrPincode}
                    onChangeText={setAddrPincode}
                  />
                </View>
              </View>

              {/* Set as Primary Switch */}
              <View style={styles.primarySwitchRow}>
                <View>
                  <Text style={styles.primarySwitchTitle}>Set as Default Primary Address</Text>
                  <Text style={styles.primarySwitchSub}>Used automatically for incoming job distance calculation</Text>
                </View>
                <Switch
                  trackColor={{ false: isDarkMode ? '#334155' : '#E2E8F0', true: '#6C47FF' }}
                  thumbColor={'#FFFFFF'}
                  value={addrIsPrimary}
                  onValueChange={setAddrIsPrimary}
                />
              </View>

              <TouchableOpacity 
                style={[styles.modalPrimaryBtn, saving && { opacity: 0.7 }]} 
                onPress={handleSaveAddress}
                disabled={saving}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalPrimaryGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Save Address</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 4: KYC VERIFICATION & DOCUMENTS LIST
      ═══════════════════════════════════════════ */}
      <Modal visible={activeModal === 'kyc'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>KYC Verification</Text>
                <Text style={styles.modalSub}>Manage ID proofs & check verification status</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* KYC Status Banner */}
              <View style={[
                styles.kycStatusCard,
                isKycApproved && styles.kycStatusApproved,
                isKycRejected && styles.kycStatusRejected,
                (!isKycApproved && !isKycRejected) && styles.kycStatusPending
              ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  {isKycApproved ? (
                    <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 6 }} />
                  ) : isKycRejected ? (
                    <AlertCircle size={18} color="#EF4444" style={{ marginRight: 6 }} />
                  ) : (
                    <Clock size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[
                    styles.kycStatusTitle,
                    isKycApproved && { color: '#065F46' },
                    isKycRejected && { color: '#991B1B' },
                    (!isKycApproved && !isKycRejected) && { color: '#92400E' }
                  ]}>
                    {isKycApproved 
                      ? 'Identity Verified & Approved' 
                      : isKycRejected 
                      ? 'Verification Rejected' 
                      : 'Verification Pending Review'}
                  </Text>
                </View>
                <Text style={[
                  styles.kycStatusMsg,
                  isKycApproved && { color: '#047857' },
                  isKycRejected && { color: '#B91C1C' },
                  (!isKycApproved && !isKycRejected) && { color: '#B45309' }
                ]}>
                  {isKycApproved 
                    ? 'Your official ID proofs have been verified by the admin. Your account is active.' 
                    : isKycRejected 
                    ? `Reason: ${profile?.kyc?.rejectReason || 'Document details were unclear'}. Please re-upload your document.` 
                    : 'Your submitted documents are in queue for verification by our admin team.'}
                </Text>
              </View>

              {/* Submitted Documents Section */}
              <Text style={styles.sectionSubTitle}>
                Submitted Documents ({kycDocuments.length})
              </Text>

              {kycDocuments.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  {kycDocuments.map((doc, idx) => (
                    <View key={idx} style={styles.docItemCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <TouchableOpacity 
                          onPress={() => doc.url && setPreviewImageModal(getImageUrl(doc.url))}
                          activeOpacity={0.8}
                          style={styles.docThumbBox}
                        >
                          {doc.url ? (
                            <Image source={{ uri: getImageUrl(doc.url) }} style={styles.docThumb} />
                          ) : (
                            <FileText size={20} color="#6C47FF" />
                          )}
                        </TouchableOpacity>

                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.docTypeBadge}>
                              <Text style={styles.docTypeBadgeText}>{doc.type || doc.docType || 'ID'}</Text>
                            </View>
                          </View>
                          <Text style={styles.docItemName} numberOfLines={1}>
                            {doc.name || `${doc.type || 'ID'} Document`}
                          </Text>
                          <Text style={styles.docItemDate}>
                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Uploaded'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {doc.url && (
                          <TouchableOpacity 
                            onPress={() => setPreviewImageModal(getImageUrl(doc.url))}
                            style={styles.docActionBtn}
                          >
                            <Eye size={16} color="#6C47FF" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                          onPress={() => handleRemoveKyc(idx, doc.name || doc.type)}
                          style={styles.docActionBtn}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noDocsBox}>
                  <FileText size={28} color="#94A3B8" />
                  <Text style={styles.noDocsText}>No documents uploaded yet</Text>
                </View>
              )}

              {/* Upload New Document Form */}
              <Text style={styles.sectionSubTitle}>Upload ID Document</Text>

              <Text style={styles.inputLabel}>Select ID Document Type</Text>
              <View style={styles.labelChipsRow}>
                {DOC_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.labelChip, kycType === type && styles.labelChipActive]}
                    onPress={() => setKycType(type)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.labelChipText, kycType === type && styles.labelChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.uploadDocBox} onPress={pickKycImage} activeOpacity={0.85}>
                {docUrl ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image source={{ uri: docUrl.uri }} style={styles.pickedDocPreview} />
                    <Text style={styles.uploadDocTitle}>Document Selected ✓</Text>
                    <Text style={styles.uploadDocSub}>Tap to change image</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <UploadCloud size={32} color="#6C47FF" />
                    <Text style={styles.uploadDocTitle}>Tap to Select Document Image</Text>
                    <Text style={styles.uploadDocSub}>Supports JPG, PNG (Camera or Gallery)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalPrimaryBtn, (!docUrl || saving) && { opacity: 0.7 }]} 
                onPress={handleUploadKyc}
                disabled={!docUrl || saving}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalPrimaryGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Submit Document for Verification →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          FULLSCREEN IMAGE VIEWER MODAL
      ═══════════════════════════════════════════ */}
      <Modal visible={!!previewImageModal} transparent animationType="fade" onRequestClose={() => setPreviewImageModal(null)}>
        <View style={styles.imageViewerOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.imageViewerHeader}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Document Preview</Text>
              <TouchableOpacity onPress={() => setPreviewImageModal(null)} style={styles.imageViewerClose}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageViewerBody}>
              {previewImageModal && (
                <Image 
                  source={{ uri: previewImageModal }} 
                  style={{ width: '100%', height: '85%' }} 
                  resizeMode="contain" 
                />
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  profileHeaderGradient: {
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  profileHeaderContent: {
    alignItems: 'center',
  },
  avatarWrapperNew: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'relative',
    marginBottom: 12,
  },
  avatarImageNew: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarEditBtnNew: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  profileNameNew: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profilePhoneNew: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Menu items
  menuContainer: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionSubTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginTop: 14,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 18,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
    marginLeft: 70,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
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
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  modalSub: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSectionBox: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    flex: 1,
  },
  deleteMiniBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  modalPrimaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 10,
  },
  modalPrimaryGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Address items
  addressItemCard: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 10,
  },
  addressItemCardPrimary: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#1A1838' : '#FAF8FF',
  },
  addrCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addrLabelPill: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  addrLabelPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6C47FF',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  addrActionBtn: {
    padding: 4,
  },
  addrText: {
    fontSize: 13,
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    lineHeight: 18,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  coordsText: {
    fontSize: 11,
    color: '#6C47FF',
    fontWeight: '600',
  },
  setDefaultBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  setDefaultBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  emptyAddressBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyAddressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  emptyAddressSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 20,
  },
  addNewAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  addNewAddrBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Edit Address Form
  labelChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  labelChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  labelChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  labelChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  labelChipTextActive: {
    color: '#FFFFFF',
  },
  useGpsMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  useGpsMiniText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  mapSectionBox: {
    marginBottom: 12,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mapSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    flex: 1,
  },
  pinnedCoordsText: {
    fontSize: 11.5,
    color: '#6C47FF',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  primarySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  primarySwitchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  primarySwitchSub: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
    maxWidth: 240,
  },

  // KYC
  kycStatusCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.2,
    marginBottom: 12,
  },
  kycStatusApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  kycStatusPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  kycStatusRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  kycStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  kycStatusMsg: {
    fontSize: 12,
    lineHeight: 17,
  },

  docItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  docThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docThumb: {
    width: '100%',
    height: '100%',
  },
  docTypeBadge: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  docTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6C47FF',
  },
  docItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  docItemDate: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 1,
  },
  docActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDocsBox: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noDocsText: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 6,
  },
  uploadDocBox: {
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: isDarkMode ? '#0F172A' : '#FAF8FF',
  },
  pickedDocPreview: {
    width: 120,
    height: 80,
    borderRadius: 10,
    marginBottom: 8,
  },
  uploadDocTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#6C47FF',
    marginTop: 4,
  },
  uploadDocSub: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },

  // Image Viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  imageViewerClose: {
    padding: 6,
  },
  imageViewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

export default WorkerProfileScreen;
