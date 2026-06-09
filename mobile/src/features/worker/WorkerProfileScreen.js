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
  Switch
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
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
  Crosshair
} from 'lucide-react-native';

const WorkerProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [activeModal, setActiveModal] = useState(null); // 'kyc', 'bank', 'editProfile'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  // Form states for Edit Profile
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Form states for Bank
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const [docUrl, setDocUrl] = useState('');
  const [kycType, setKycType] = useState('AADHAR');
  
  // Form states for Photo
  const [photoUri, setPhotoUri] = useState('');
  
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const bankOptions = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra', 'Bank of Baroda', 'Punjab National Bank', 'Other'];

  const [addressList, setAddressList] = useState([]);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrCoordinate, setAddrCoordinate] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const res = await workerService.getWorkerProfile();
      const userData = res.data.data;
      setProfile(userData);
      setEditName(userData?.name || '');
      setEditEmail(userData?.email || '');
      setEditPhone(userData?.phone || '');
      if (userData?.wallet?.bankDetails) {
        setBankName(userData.wallet.bankDetails.bankName || '');
        setAccountNumber(userData.wallet.bankDetails.accountNumber || '');
        setIfscCode(userData.wallet.bankDetails.ifscCode || '');
      }
      if (userData?.wallet?.upiId) {
        setUpiId(userData.wallet.upiId);
      }
      if (userData?.addresses) {
        setAddressList(userData.addresses);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadKyc = async () => {
    if (!docUrl) {
      Alert.alert('Error', 'Please select a document image to upload.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('document', {
        uri: docUrl.uri,
        type: docUrl.type || 'image/jpeg',
        name: docUrl.fileName || 'document.jpg',
      });
      formData.append('documentType', kycType);
      
      await workerService.updateKyc(formData);
      Alert.alert('Success', 'KYC document uploaded successfully!');
      setActiveModal(null);
      setDocUrl(''); // Clear selected image
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to upload KYC document.');
    } finally {
      setSaving(false);
    }
  };

  const pickKycImage = async () => {
    const options = { mediaType: 'photo', quality: 0.8 };
    const response = await launchImageLibrary(options);
    if (!response.didCancel && !response.errorCode && response.assets?.length > 0) {
      setDocUrl(response.assets[0]);
    }
  };

  const handleSaveBank = async () => {
    if (!bankName && !accountNumber && !ifscCode && !upiId) {
      Alert.alert('Error', 'Please provide either Bank Details or UPI ID.');
      return;
    }
    if (upiId) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upiId)) {
        Alert.alert('Error', 'Please enter a valid UPI ID (e.g. name@upi).');
        return;
      }
    }
    if (bankName || accountNumber || ifscCode) {
      if (!bankName || !accountNumber || !ifscCode) {
        Alert.alert('Error', 'Please fill all Bank details if providing a Bank Account.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {};
      if (bankName && accountNumber && ifscCode) {
        payload.bankDetails = { bankName, accountNumber, ifscCode };
      }
      if (upiId) payload.upiId = upiId;

      await workerService.updateBank(payload);
      Alert.alert('Success', 'Payment details saved successfully.');
      setActiveModal(null);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to save payment details.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProfile = async () => {
    setSaving(true);
    try {
      await workerService.updateProfile({ name: editName, email: editEmail });
      Alert.alert('Success', 'Profile updated');
      setActiveModal(null);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!addrStreet || !addrArea || !addrCity || !addrPincode) {
      Alert.alert('Error', 'Please fill all address fields');
      return;
    }
    setSaving(true);
    try {
      const data = { label: addrLabel, street: addrStreet, area: addrArea, city: addrCity, pincode: addrPincode };
      if (addrCoordinate) {
        data.location = { coordinates: [addrCoordinate.longitude, addrCoordinate.latitude] };
      }
      if (editingAddress) {
        const res = await workerService.updateAddress(editingAddress._id, data);
        setAddressList(res.data.data);
      } else {
        const res = await workerService.addAddress(data);
        setAddressList(res.data.data);
      }
      Alert.alert('Success', 'Address saved successfully');
      setActiveModal('addresses');
    } catch (e) {
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await workerService.deleteAddress(id);
            setAddressList(res.data.data);
          } catch(e) {
            Alert.alert('Error', 'Failed to delete address');
          }
      }}
    ]);
  };

  const handleSetPrimaryAddress = async (id) => {
    try {
      const res = await workerService.setPrimaryAddress(id);
      setAddressList(res.data.data);
      fetchProfile();
    } catch(e) {
      Alert.alert('Error', 'Failed to set primary address');
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
      if (addr.location && addr.location.coordinates) {
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
      setAddrCity('');
      setAddrPincode('');
      setAddrCoordinate(null);
    }
    setActiveModal('editAddress');
  };

  const handlePickPhoto = async () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1024,
      maxWidth: 1024,
    };

    const response = await launchImageLibrary(options);

    if (response.didCancel) {
      return;
    } else if (response.errorCode) {
      Alert.alert('Error', 'ImagePicker Error: ' + response.errorMessage);
    } else if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      setSaving(true);
      try {
        const formData = new FormData();
        formData.append('profileImage', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'profile.jpg',
        });
        
        await workerService.updateProfilePhoto(formData);
        Alert.alert('Success', 'Profile photo updated');
        fetchProfile();
      } catch (error) {
        Alert.alert('Error', 'Failed to update photo');
        console.error(error);
      } finally {
        setSaving(false);
      }
    }
  };

  const renderMenuItem = (icon, title, subtitle, onPress, showArrow = true, danger = false) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const kycStatus = profile?.kyc?.status || 'PENDING';
  const isKycApproved = kycStatus === 'APPROVED';
  
  const ratingAvg = profile?.rating?.average || 0;
  const ratingCount = profile?.rating?.count || 0;
  
  const hasBank = !!profile?.wallet?.bankDetails?.accountNumber || !!profile?.wallet?.upiId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      <AppBar title="My Profile" showBack={false} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Hero */}
        <View style={styles.heroSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {profile?.profileImage ? (
                <Image source={{ uri: 'http://10.0.2.2:5000' + profile.profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{profile?.name ? profile.name.charAt(0) : 'W'}</Text>
              )}
            </View>
            {saving ? (
              <ActivityIndicator style={styles.avatarEditBtn} color={theme.colors.primary} />
            ) : (
              <TouchableOpacity style={styles.avatarEditBtn} onPress={handlePickPhoto}>
                <Camera size={14} color="#001016" />
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.profileName}>{profile?.name || 'Worker'}</Text>
          <Text style={styles.profileRole}>{profile?.phone}</Text>
          
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => setActiveModal('editProfile')}>
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={styles.onlineToggle}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }]} />
            <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
            <Switch 
              value={isOnline}
              onValueChange={async (val) => {
                setIsOnline(val);
                try { await workerService.setOnlineStatus(val); } catch (e) {}
              }}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>--</Text>
              <Text style={styles.statLabel}>Jobs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>★ {ratingAvg.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>NEW</Text>
              <Text style={styles.statLabel}>Member</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {renderMenuItem(
            <ShieldCheck size={20} color={isKycApproved ? theme.colors.primary : theme.colors.danger} />, 
            'KYC & Documents', 
            isKycApproved ? 'Verified ✓' : `Status: ${kycStatus}`, 
            () => setActiveModal('kyc')
          )}
          {renderMenuItem(
            <Building2 size={20} color={theme.colors.textDim} />, 
            'Bank Account & UPI', 
            hasBank ? 'Setup Completed' : 'Add Account', 
            () => setActiveModal('bank')
          )}
          {renderMenuItem(
            <MapPin size={20} color="#8B5CF6" />, 
            'Manage Addresses', 
            `${addressList.length} Saved Addresses`, 
            () => setActiveModal('addresses')
          )}
          {renderMenuItem(
            <Star size={20} color="#F59E0B" />, 
            'My Ratings', 
            `${ratingAvg.toFixed(1)} · ${ratingCount} reviews`, 
            () => Alert.alert('Coming Soon', 'Reviews screen is under construction')
          )}
          {renderMenuItem(
            <Wrench size={20} color="#3B82F6" />, 
            'My Services', 
            `${profile?.services?.length || 0} categories`, 
            () => navigation.navigate('Services')
          )}
          {renderMenuItem(
            <Wallet size={20} color="#10B981" />, 
            'Earnings & Wallet', 
            `₹${profile?.wallet?.balance || 0}`, 
            () => navigation.navigate('Earnings')
          )}
          {renderMenuItem(
            <LifeBuoy size={20} color="#EC4899" />, 
            'Help & Support', null, 
            () => navigation.navigate('HelpSupport')
          )}
          {renderMenuItem(
            <LogOut size={20} color={theme.colors.danger} />, 
            'Sign Out', null, signOut, false, true
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* KYC Modal */}
      <Modal visible={activeModal === 'kyc'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>KYC Documents</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}><X color={theme.colors.text} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Select document type and upload an image (Gallery/Camera).</Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['AADHAR', 'PAN', 'LICENSE'].map(t => (
                <TouchableOpacity 
                  key={t}
                  style={{ 
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: kycType === t ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1, borderColor: kycType === t ? theme.colors.primary : theme.colors.border
                  }}
                  onPress={() => setKycType(t)}
                >
                  <Text style={{ color: kycType === t ? '#000' : theme.colors.text, fontWeight: '600' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.input, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }]} 
              onPress={pickKycImage}
            >
              <Text style={{ color: docUrl ? theme.colors.primary : theme.colors.textDim, fontWeight: '600' }}>
                {docUrl ? 'Image Selected ✓ (Tap to change)' : 'Tap to Pick Document Image'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.primaryModalBtn} onPress={handleUploadKyc} disabled={saving}>
              {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.primaryModalBtnText}>Upload & Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bank Modal */}
      <Modal visible={activeModal === 'bank'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'flex-end'}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Details</Text>
                <TouchableOpacity onPress={() => setActiveModal(null)}><X color={theme.colors.text} /></TouchableOpacity>
              </View>
              
              <Text style={styles.sectionTitle}>Bank Account</Text>
              
              {/* Custom Dropdown for Banks */}
              <TouchableOpacity 
                style={[styles.input, { justifyContent: 'center' }]} 
                onPress={() => setShowBankDropdown(true)}
              >
                <Text style={{ color: bankName ? theme.colors.text : theme.colors.textDim }}>
                  {bankName || 'Select Bank (Tap to choose)'}
                </Text>
              </TouchableOpacity>
              <TextInput 
                style={styles.input} placeholder="Account Number" placeholderTextColor={theme.colors.textDim}
                value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad"
              />
              <TextInput 
                style={styles.input} placeholder="IFSC Code" placeholderTextColor={theme.colors.textDim}
                value={ifscCode} onChangeText={setIfscCode} autoCapitalize="characters"
              />

              <Text style={styles.sectionTitle}>OR UPI ID</Text>
              <TextInput 
                style={styles.input} placeholder="yourname@upi" placeholderTextColor={theme.colors.textDim}
                value={upiId} onChangeText={setUpiId}
              />
              
              <TouchableOpacity style={styles.primaryModalBtn} onPress={handleSaveBank} disabled={saving}>
                {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.primaryModalBtnText}>Save Details</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Bank Selection Dropdown Modal */}
      <Modal visible={showBankDropdown} transparent animationType="fade" onRequestClose={() => setShowBankDropdown(false)}>
        <TouchableOpacity 
          style={styles.modalOverlayCenter} 
          activeOpacity={1} 
          onPress={() => setShowBankDropdown(false)}
        >
          <View style={[styles.modalContent, { width: '85%', maxHeight: '60%', padding: 20, borderRadius: 16 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 16, fontSize: 18 }]}>Select Bank</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {bankOptions.map(bank => (
                <TouchableOpacity 
                  key={bank}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border
                  }}
                  onPress={() => {
                    setBankName(bank);
                    setShowBankDropdown(false);
                  }}
                >
                  <Text style={{ color: bankName === bank ? theme.colors.primary : theme.colors.text, fontSize: 16, fontWeight: bankName === bank ? 'bold' : '500' }}>
                    {bank}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={activeModal === 'editProfile'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeaderHandle} />
            <Text style={styles.sheetTitle}>Edit Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ramesh Kumar"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background + '80', color: theme.colors.textDim }]}
              value={editPhone}
              editable={false}
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="user@email.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleEditProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Addresses List Modal */}
      <Modal visible={activeModal === 'addresses'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'flex-end'}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Saved Addresses</Text>
                <TouchableOpacity onPress={() => setActiveModal(null)}><X color={theme.colors.text} /></TouchableOpacity>
              </View>
              
              {addressList.length === 0 ? (
                <Text style={{ textAlign: 'center', marginVertical: 20, color: theme.colors.textDim }}>No saved addresses found.</Text>
              ) : (
                addressList.map(addr => (
                  <View key={addr._id} style={{
                    borderWidth: 1, borderColor: addr.isPrimary ? theme.colors.primary : theme.colors.border,
                    borderRadius: 12, padding: 16, marginBottom: 12, backgroundColor: addr.isPrimary ? '#F0FDF4' : theme.colors.surface
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.text }}>
                        {addr.label || 'Address'} {addr.isPrimary && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>(Primary)</Text>}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => openEditAddress(addr)}>
                          <Edit2 size={18} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteAddress(addr._id)}>
                          <Trash2 size={18} color={theme.colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textDim, marginBottom: 4 }}>{addr.street}</Text>
                    <Text style={{ color: theme.colors.textDim, marginBottom: 12 }}>{addr.area}, {addr.city} - {addr.pincode}</Text>
                    
                    {!addr.isPrimary && (
                      <TouchableOpacity onPress={() => handleSetPrimaryAddress(addr._id)}>
                        <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Set as Primary</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}

              <TouchableOpacity style={[styles.primaryModalBtn, { marginTop: 16 }]} onPress={() => openEditAddress()}>
                <Text style={styles.primaryModalBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit/Add Address Modal */}
      <Modal visible={activeModal === 'editAddress'} transparent animationType="slide" onRequestClose={() => setActiveModal('addresses')}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'flex-end'}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingAddress ? 'Edit Address' : 'Add Address'}</Text>
                <TouchableOpacity onPress={() => setActiveModal('addresses')}><X color={theme.colors.text} /></TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Label (Home, Office, etc)</Text>
              <TextInput style={styles.input} value={addrLabel} onChangeText={setAddrLabel} placeholder="e.g. Home" placeholderTextColor={theme.colors.textDim} />
              
              <Text style={styles.inputLabel}>Street / Building / Flat No.</Text>
              <TextInput style={styles.input} value={addrStreet} onChangeText={setAddrStreet} placeholder="Enter street or building" placeholderTextColor={theme.colors.textDim} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Location Coordinates</Text>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => {
                    Geolocation.getCurrentPosition(
                      (position) => {
                        setAddrCoordinate({
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude
                        });
                      },
                      (error) => {
                        Alert.alert("GPS Error", error.message);
                      },
                      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
                    );
                  }}
                >
                  <Crosshair size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 12 }}>Use GPS</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Area / Locality</Text>
              <TextInput style={styles.input} value={addrArea} onChangeText={setAddrArea} placeholder="Enter area name" placeholderTextColor={theme.colors.textDim} />
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput style={styles.input} value={addrCity} onChangeText={setAddrCity} placeholder="City name" placeholderTextColor={theme.colors.textDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput style={styles.input} value={addrPincode} onChangeText={setAddrPincode} placeholder="Pincode" keyboardType="number-pad" placeholderTextColor={theme.colors.textDim} />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Pin Location</Text>
              <View style={{ height: 150, borderRadius: 12, overflow: 'hidden', marginBottom: 16, backgroundColor: theme.colors.border }}>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: addrCoordinate?.latitude || 19.0760,
                    longitude: addrCoordinate?.longitude || 72.8777,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  onPress={(e) => setAddrCoordinate(e.nativeEvent.coordinate)}
                >
                  {addrCoordinate && (
                    <Marker coordinate={addrCoordinate} />
                  )}
                </MapView>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.textDim, marginBottom: 8, textAlign: 'center' }}>
                {addrCoordinate ? `Pinned: ${addrCoordinate.latitude.toFixed(4)}, ${addrCoordinate.longitude.toFixed(4)}` : 'Tap on the map to drop a pin'}
              </Text>

              <TouchableOpacity style={[styles.primaryModalBtn, { marginTop: 8 }]} onPress={handleSaveAddress} disabled={saving}>
                {saving ? <ActivityIndicator color="#001016" /> : <Text style={styles.primaryModalBtnText}>Save Address</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  heroSection: {
    alignItems: 'center', backgroundColor: theme.colors.surface,
    paddingVertical: 32, paddingHorizontal: 20, borderRadius: 24,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 24,
  },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#001016' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#FFFFFF', padding: 6, borderRadius: 16,
    borderWidth: 2, borderColor: theme.colors.surface,
    elevation: 2,
  },
  profileName: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
  profileRole: { fontSize: 14, color: theme.colors.textDim, marginBottom: 12 },
  editProfileBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  editProfileBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  onlineToggle: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background,
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 24,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  onlineText: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginRight: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { alignItems: 'center', paddingHorizontal: 16 },
  statValue: { fontSize: 16, fontWeight: '800', color: theme.colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  statDivider: { width: 1, height: 24, backgroundColor: theme.colors.border },
  menuContainer: { gap: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border,
  },
  menuIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  menuItemTextContainer: { flex: 1 },
  menuItemTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  menuItemSubtitle: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16,
  },
  sheetHeaderHandle: { width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.text, marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textDim, marginBottom: 8, marginLeft: 4 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.textDim },
  submitBtn: { flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#001016' },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  modalSub: { fontSize: 14, color: theme.colors.textDim, marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: theme.colors.text,
    backgroundColor: theme.colors.background, marginBottom: 16,
  },
  primaryModalBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 16,
  },
  primaryModalBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' }
});

export default WorkerProfileScreen;
