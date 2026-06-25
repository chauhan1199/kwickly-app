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
  ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

const EditProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [imageUri, setImageUri] = useState(user?.profileImage ? 'http://10.0.2.2:5000' + user.profileImage : null);
  const [imageFile, setImageFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const styles = createStyles(theme, isDarkMode);

  // Generate initials
  const getInitials = (n) => {
    if (!n) return 'C';
    const parts = n.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  };

  const handleEditAvatar = () => {
    Alert.alert(
      "Upload Photo",
      "Choose an option",
      [
        {
          text: "Camera",
          onPress: async () => {
            try {
              const result = await launchCamera({ mediaType: 'photo', quality: 0.8, includeBase64: true });
              if (result.didCancel) return;
              if (result.errorCode || !result.assets) throw new Error();
              setImageUri(result.assets[0].uri);
              setImageFile({ base64: result.assets[0].base64, type: result.assets[0].type || 'image/jpeg', name: result.assets[0].fileName || 'profile.jpg' });
            } catch (e) {
              Alert.alert('Emulator Fallback', 'Camera failed. Using mock image.');
              setImageUri('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80');
            }
          }
        },
        {
          text: "Gallery",
          onPress: async () => {
            try {
              const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: true });
              if (result.didCancel) return;
              if (result.errorCode || !result.assets) throw new Error();
              setImageUri(result.assets[0].uri);
              setImageFile({ base64: result.assets[0].base64, type: result.assets[0].type || 'image/jpeg', name: result.assets[0].fileName || 'profile.jpg' });
            } catch (e) {
              Alert.alert('Emulator Fallback', 'Gallery failed. Using mock image.');
              setImageUri('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80');
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload = { name };
      if (email) payload.email = email;
      if (imageFile && imageFile.base64) {
        payload.profileImageBase64 = imageFile.base64;
      }
      await customerService.updateProfile(payload);
      await fetchUser();
      navigation.navigate('Profile');
    } catch (error) {
      console.log('Update profile error:', error?.response?.data || error);
      Alert.alert('Error', JSON.stringify(error?.response?.data || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Edit Profile</Text>
      </View>

      <View style={styles.content}>
        
        {/* Profile Image */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.cameraBtn}
            onPress={handleEditAvatar}
          >
            <Text style={{fontSize: 14}}>📷</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput 
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput 
            style={[styles.input, { opacity: 0.6 }]}
            value={phone}
            editable={false}
            keyboardType="phone-pad"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput 
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#001016" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginLeft: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  imageContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#86efac',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#064e3b',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  bottomBar: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  }
});

export default EditProfileScreen;
