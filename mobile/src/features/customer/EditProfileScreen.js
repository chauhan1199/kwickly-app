import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft, Camera, User, Phone, Mail, Lock, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

const EditProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [imageUri, setImageUri] = useState(user?.profileImage ? getImageUrl(user.profileImage) : null);
  const [imageFile, setImageFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const styles = createStyles(theme, isDarkMode);

  // Generate initials
  const getInitials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  };

  const handleEditAvatar = () => {
    Alert.alert(
      "Update Profile Photo",
      "Choose a source for your photo",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            try {
              const result = await launchCamera({ 
                mediaType: 'photo', 
                quality: 0.8, 
                includeBase64: true,
                maxWidth: 1024,
                maxHeight: 1024
              });
              if (result.didCancel) return;
              if (result.errorCode || !result.assets || result.assets.length === 0) throw new Error();
              setImageUri(result.assets[0].uri);
              setImageFile({ 
                base64: result.assets[0].base64, 
                type: result.assets[0].type || 'image/jpeg', 
                name: result.assets[0].fileName || 'profile.jpg' 
              });
            } catch (e) {
              Alert.alert('Camera Error', 'Could not open camera. Please check camera permissions.');
            }
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            try {
              const result = await launchImageLibrary({ 
                mediaType: 'photo', 
                quality: 0.8, 
                includeBase64: true,
                maxWidth: 1024,
                maxHeight: 1024
              });
              if (result.didCancel) return;
              if (result.errorCode || !result.assets || result.assets.length === 0) throw new Error();
              setImageUri(result.assets[0].uri);
              setImageFile({ 
                base64: result.assets[0].base64, 
                type: result.assets[0].type || 'image/jpeg', 
                name: result.assets[0].fileName || 'profile.jpg' 
              });
            } catch (e) {
              Alert.alert('Gallery Error', 'Could not open gallery. Please check storage permissions.');
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = { name: name.trim() };
      if (email.trim()) payload.email = email.trim().toLowerCase();
      if (imageFile && imageFile.base64) {
        payload.profileImageBase64 = `data:${imageFile.type || 'image/jpeg'};base64,${imageFile.base64}`;
      }
      await customerService.updateProfile(payload);
      await fetchUser();
      Alert.alert('Success', 'Your profile details have been saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Update Failed', e.message || 'Could not update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* Notch-Safe Gradient Header */}
      <LinearGradient
        colors={['#5535d4', '#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.ambientShape1} />
        <View style={styles.ambientShape2} />

        <SafeAreaView style={styles.safeHeaderArea}>
          <View style={styles.appBar}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Edit Profile</Text>

            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Keyboard Avoiding Container */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Avatar Card */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImg} />
              ) : (
                <LinearGradient
                  colors={['#8B6FFF', '#6C47FF']}
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarInitial}>{getInitials(name)}</Text>
                </LinearGradient>
              )}
              
              <TouchableOpacity 
                style={styles.cameraBadge}
                activeOpacity={0.8}
                onPress={handleEditAvatar}
              >
                <Camera size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.changePhotoText}>Tap camera to change photo</Text>
          </View>

          {/* Form Fields Card */}
          <View style={styles.card}>
            {/* Full Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name <Text style={styles.reqStar}>*</Text></Text>
              <View style={[
                styles.inputWrapper,
                focusedField === 'name' && styles.inputWrapperFocused
              ]}>
                <User size={18} color={focusedField === 'name' ? '#6C47FF' : theme.colors.textDim} style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.colors.textDim}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number (Verified / Read-Only) */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.verifiedTag}>
                  <ShieldCheck size={11} color="#10b981" />
                  <Text style={styles.verifiedTagText}>Verified</Text>
                </View>
              </View>
              <View style={[styles.inputWrapper, styles.inputWrapperDisabled]}>
                <Phone size={18} color={theme.colors.textDim} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.textInput, styles.textInputDisabled]}
                  value={phone}
                  editable={false}
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.textDim}
                />
                <Lock size={15} color={theme.colors.textDim} style={{ marginRight: 12 }} />
              </View>
              <Text style={styles.helperText}>Mobile number is linked to your account identity.</Text>
            </View>

            {/* Email Address */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address (Optional)</Text>
              <View style={[
                styles.inputWrapper,
                focusedField === 'email' && styles.inputWrapperFocused
              ]}>
                <Mail size={18} color={focusedField === 'email' ? '#6C47FF' : theme.colors.textDim} style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="name@example.com"
                  placeholderTextColor={theme.colors.textDim}
                />
              </View>
            </View>
          </View>

          {/* Action Save Button */}
          <TouchableOpacity 
            style={styles.saveButton} 
            activeOpacity={0.88}
            onPress={handleSave} 
            disabled={isLoading}
          >
            <LinearGradient
              colors={['#6C47FF', '#5535d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              {isLoading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.saveBtnText}>Saving Changes…</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <CheckCircle2 size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradientHeader: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 12 : 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientShape1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ambientShape2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  safeHeaderArea: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#6C47FF',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6C47FF',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  formGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  reqStar: {
    color: '#ef4444',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.06)' : '#FAF8FF',
  },
  inputWrapperDisabled: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F1F5F9',
    borderColor: theme.colors.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  textInputDisabled: {
    color: theme.colors.textDim,
  },
  helperText: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 6,
    marginLeft: 4,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  }
});

export default EditProfileScreen;
