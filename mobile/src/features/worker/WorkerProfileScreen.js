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
  Linking
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
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
  Briefcase
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const getImageUri = (path) => {
  if (!path) return null;
  let cleanPath = path;
  if (cleanPath.startsWith('http://localhost')) {
    cleanPath = cleanPath.replace('http://localhost', 'http://10.0.2.2');
  } else if (cleanPath.startsWith('http://127.0.0.1')) {
    cleanPath = cleanPath.replace('http://127.0.0.1', 'http://10.0.2.2');
  }
  
  if (cleanPath.startsWith('http')) {
    return cleanPath;
  }
  return 'http://10.0.2.2:5000' + (cleanPath.startsWith('/') ? '' : '/') + cleanPath;
};

const WorkerProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [activeModal, setActiveModal] = useState(null); // 'kyc', 'bank', 'editProfile'
  const [loading, setLoading] = useState(true);
  const [subCatModalVisible, setSubCatModalVisible] = useState(false);
  const [selectedCategoryForSubCats, setSelectedCategoryForSubCats] = useState(null);
  const [tempSelectedSubCats, setTempSelectedSubCats] = useState([]);
  
  // Image Viewer Modal State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
      const res = await workerService.getProfile();
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
      const payload = {
        documentType: kycType,
        documentBase64: `data:${docUrl.type || 'image/jpeg'};base64,${docUrl.base64}`
      };
      
      await workerService.updateKyc(payload);
      Alert.alert('Success', 'KYC document uploaded successfully!');
      setActiveModal(null);
      setDocUrl(''); // Clear selected image
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to upload KYC document. ' + (error.message || JSON.stringify(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKyc = async (index) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          setSaving(true);
          try {
            await workerService.removeKycDocument(index);
            fetchProfile();
          } catch(e) {
            Alert.alert('Error', 'Failed to delete document');
          } finally {
            setSaving(false);
          }
      }}
    ]);
  };

  const pickKycImage = async () => {
    const options = { mediaType: 'photo', quality: 0.8, includeBase64: true };
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
      includeBase64: true,
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
        const payload = {
          profileImageBase64: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`
        };
        
        await workerService.updateProfilePhoto(payload);
        Alert.alert('Success', 'Profile photo updated');
        fetchProfile();
      } catch (error) {
        Alert.alert('Error', 'Failed to update photo. ' + (error.message || JSON.stringify(error)));
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
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Top Gradient Header */}
        <LinearGradient
          colors={['#6C47FF', '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderGradient}
        >
          <View style={styles.profileHeaderContent}>
            <View style={styles.avatarWrapperNew}>
              {profile?.profileImage ? (
                <Image source={{ uri: getImageUri(profile.profileImage) }} style={styles.avatarImageNew} />
              ) : (
                <View style={[styles.avatarImageNew, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff' }}>{profile?.name ? profile.name.charAt(0) : 'W'}</Text>
                </View>
              )}
              {saving ? (
                <ActivityIndicator style={styles.avatarEditBtnNew} color="#6C47FF" />
              ) : (
                <TouchableOpacity style={styles.avatarEditBtnNew} onPress={handlePickPhoto}>
                  <Camera size={14} color="#6C47FF" />
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.profileNameNew}>{profile?.name || 'Worker'}</Text>
            
            {(() => {
              const expiryDate = profile?.subscription?.expiryDate;
              if (expiryDate) {
                const diffTime = new Date(expiryDate).getTime() - new Date().getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  return <Text style={styles.profileRoleNew}>Premium: {diffDays} days left</Text>;
                } else {
                  return <Text style={[styles.profileRoleNew, { color: '#ef4444' }]}>Plan Expired. Please recharge!</Text>;
                }
              }
              return <Text style={styles.profileRoleNew}>Member since {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : '2023'}</Text>;
            })()}
          </View>
        </LinearGradient>

        {/* Floating Stats Card */}
        <View style={styles.statsCardWrapper}>
          <View style={styles.statsCardNew}>
            <View style={styles.statBoxNew}>
              <View style={[styles.statIconBox, { backgroundColor: '#6C47FF15' }]}>
                 <Briefcase size={20} color="#6C47FF" />
              </View>
              <Text style={styles.statValueNew}>{profile?.jobsCompleted || 0}</Text>
              <Text style={styles.statLabelNew}>Jobs Done</Text>
            </View>
            
            <View style={styles.statDividerNew} />
            
            <View style={styles.statBoxNew}>
              <View style={[styles.statIconBox, { backgroundColor: '#f59e0b15' }]}>
                 <Star size={20} color="#f59e0b" />
              </View>
              <Text style={styles.statValueNew}>{ratingAvg.toFixed(1)}</Text>
              <Text style={styles.statLabelNew}>Rating</Text>
            </View>
            
            <View style={styles.statDividerNew} />
            
            <View style={styles.statBoxNew}>
              <View style={[styles.statIconBox, { backgroundColor: '#10b98115' }]}>
                 <ShieldCheck size={20} color="#10b981" />
              </View>
              <Text style={styles.statValueNew}>Pro</Text>
              <Text style={styles.statLabelNew}>Level</Text>
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

            {profile?.kyc?.documents?.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Uploaded Documents:</Text>
                {profile.kyc.documents.map((doc, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: theme.colors.background, padding: 8, borderRadius: 12 }}>
                    <TouchableOpacity onPress={() => { setViewerImage(getImageUri(doc.url)); setViewerVisible(true); }}>
                      <Image source={{ uri: getImageUri(doc.url) }} style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{doc.type}</Text>
                      <Text style={{ color: theme.colors.textDim, fontSize: 12, marginTop: 2 }}>
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveKyc(idx)} disabled={saving} style={{ padding: 8 }}>
                      <Trash2 size={20} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 12 }} />
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Upload New Document</Text>
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

      {/* Full Screen Image Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setViewerVisible(false)}
          >
            <X color="#fff" size={32} />
          </TouchableOpacity>
          {viewerImage && (
            <Image 
              source={{ uri: viewerImage }} 
              style={{ width: '95%', height: '80%', resizeMode: 'contain' }} 
            />
          )}
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
  },
  profileHeaderGradient: {
    paddingTop: 60,
    paddingBottom: 70,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  profileHeaderContent: {
    alignItems: 'center',
  },
  avatarWrapperNew: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImageNew: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  avatarEditBtnNew: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileNameNew: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  profileRoleNew: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  statsCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -40,
    marginBottom: 24,
    zIndex: 10,
  },
  statsCardNew: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statBoxNew: {
    flex: 1,
    alignItems: 'center',
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValueNew: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabelNew: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  statDividerNew: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
  },
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
  menuContainer: { paddingHorizontal: 20 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  menuIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#6C47FF10',
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
