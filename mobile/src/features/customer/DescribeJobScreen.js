import React, { useState } from 'react';
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
  ImageBackground
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Camera, Image as ImageIcon, XCircle, UploadCloud, Video, X } from 'lucide-react-native';

const DescribeJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { 
    category = { name: 'Cleaning' }, 
    subcategory = 'Home Cleaning',
    selectedWorker
  } = route.params || {};

  const { user, token } = useAuth();
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState([]); 
  const [addressType, setAddressType] = useState('Home');
  const [address, setAddress] = useState(user?.activeLocation?.address || user?.addresses?.[0]?.street || '');
  const [location, setLocation] = useState(user?.activeLocation?.coordinates ? { type: 'Point', coordinates: user.activeLocation.coordinates } : { type: 'Point', coordinates: [77.2090, 28.6139] });
  const [preferredDate, setPreferredDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeSlot, setTimeSlot] = useState('urgent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeSlots = [
    { id: 'urgent', icon: '⚡', label: 'Urgent / ASAP', sub: 'Within 1-2 hrs' },
    { id: 'morning', icon: '🌅', label: 'Morning', sub: '8 AM - 12 PM' },
    { id: 'afternoon', icon: '☀️', label: 'Afternoon', sub: '12 PM - 4 PM' },
    { id: 'evening', icon: '🌆', label: 'Evening', sub: '4 PM - 8 PM' },
  ];

  // Generate next 7 days for the custom JS Date Picker
  const getNext7Days = () => {
    const days = [];
    for(let i=0; i<7; i++){
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const handlePickMedia = async () => {
    if (media.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 photos.');
      return;
    }
    
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (!result.didCancel && result.assets?.length > 0) {
      setMedia([...media, result.assets[0].uri]);
    }
  };

  const handleRemoveMedia = (index) => {
    const newMedia = [...media];
    newMedia.splice(index, 1);
    setMedia(newMedia);
  };

  const handlePickMap = () => {
    Alert.alert(
      "Simulated Map Picker",
      "In a real build, this would open react-native-maps. Setting location to mocked coordinates.",
      [{ text: "OK", onPress: () => {
        setLocation({ type: 'Point', coordinates: [72.8777, 19.0760] }); // Mumbai
        setAddress('Bandra West, Mumbai');
        setAddressType('Other');
      }}]
    );
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please describe the issue.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid service address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        category: category.name,
        subcategory: subcategory,
        description,
        media,
        preferredDate: preferredDate.toISOString(),
        timeSlot,
        location,
        addressDetails: address
      };

      const res = await api.post('/jobs', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newJob = res.data.data;

      if (selectedWorker) {
        navigation.navigate('LiveTracking', { worker: selectedWorker });
      } else {
        navigation.navigate('LiveBids', {
          jobId: newJob._id,
          category,
          subcategory,
          address,
          timeSlot: timeSlots.find(t => t.id === timeSlot)?.label || 'ASAP',
          budget: '499'
        });
      }
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Failed to post job';
      Alert.alert('Error', errDetails);
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Describe your job</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>{category.name} · {subcategory}</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Describe Issue */}
        <Text style={styles.label}>Describe the issue</Text>
        <Input
          containerStyle={{ marginBottom: 14 }}
          inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
          multiline={true}
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          placeholder="E.g. AC not cooling, makes loud noise..."
        />

        {/* Photos / Video */}
        <Text style={styles.label}>Add photos / video</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaGrid}>
          {media.map((uri, index) => (
             <View key={index} style={styles.mediaTileFilled}>
               <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
               <TouchableOpacity 
                 style={styles.deleteMediaBtn}
                 onPress={() => handleRemoveMedia(index)}
               >
                 <X size={14} color="#fff" />
               </TouchableOpacity>
             </View>
          ))}
          {media.length < 3 && (
            <TouchableOpacity style={styles.mediaTileEmpty} onPress={handlePickMedia}>
              <UploadCloud size={28} color={theme.colors.primary} style={{ marginBottom: 4 }} />
              <Text style={{fontSize: 12, color: theme.colors.textDim, fontWeight: '600'}}>Upload</Text>
              <Text style={{fontSize: 10, color: theme.colors.textDim}}>Max 3</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Service Address */}
        <Text style={styles.label}>Service address</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressChipsScroll}>
          <TouchableOpacity 
            style={[styles.addrChip, addressType === 'Home' && styles.addrChipActive]}
            onPress={() => { setAddressType('Home'); setAddress(user?.addresses?.find(a => a.label === 'Home')?.street || user?.activeLocation?.address || ''); }}
          >
            <Text style={[styles.addrChipText, addressType === 'Home' && styles.addrChipTextActive]}>🏠 Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.addrChip, addressType === 'Office' && styles.addrChipActive]}
            onPress={() => { setAddressType('Office'); setAddress(user?.addresses?.find(a => a.label === 'Office')?.street || ''); }}
          >
            <Text style={[styles.addrChipText, addressType === 'Office' && styles.addrChipTextActive]}>🏢 Office</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.addrChip, addressType === 'Other' && styles.addrChipActive]}
            onPress={() => { setAddressType('Other'); setAddress(''); }}
          >
            <Text style={[styles.addrChipText, addressType === 'Other' && styles.addrChipTextActive]}>➕ Other</Text>
          </TouchableOpacity>
        </ScrollView>
        <Input
          containerStyle={{ marginBottom: 14 }}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter service address..."
        />
        <TouchableOpacity style={styles.mapBtn} onPress={handlePickMap}>
          <Text style={styles.mapBtnText}>📍 Pick from Map</Text>
        </TouchableOpacity>

        {/* Preferred Date */}
        <Text style={[styles.label, {marginTop: 10}]}>Preferred date</Text>
        <TouchableOpacity 
          style={styles.inputField} 
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={{ color: theme.colors.text, paddingVertical: 2 }}>
            {preferredDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </TouchableOpacity>

        {/* Time Slot */}
        <Text style={styles.label}>Time slot</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map(slot => (
            <TouchableOpacity 
              key={slot.id} 
              style={[styles.timeCard, timeSlot === slot.id && styles.timeCardActive]}
              onPress={() => setTimeSlot(slot.id)}
            >
              <Text style={{fontSize: 20}}>{slot.icon}</Text>
              <Text style={styles.timeLabel}>{slot.label}</Text>
              <Text style={styles.timeSub}>{slot.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
             <ActivityIndicator color="#001016" />
          ) : (
            <Text style={styles.submitBtnText}>
              {selectedWorker ? `🚀 Book ${selectedWorker.name.split(' ')[0]}` : `🚀 Post Job · Get Bids`}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Pure JS Custom Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Preferred Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 20 }}>
              {getNext7Days().map((date, idx) => {
                const isSelected = preferredDate.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.dateCard, isSelected && styles.dateCardActive]}
                    onPress={() => setPreferredDate(date)}
                  >
                    <Text style={[styles.dateCardDay, isSelected && {color: '#fff'}]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateCardDate, isSelected && {color: '#fff'}]}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCloseBtnText}>Done</Text>
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
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 6,
    marginTop: 4,
  },
  textArea: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    color: theme.colors.text,
    minHeight: 80,
    marginBottom: 14,
  },
  inputField: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    marginBottom: 8,
  },
  mediaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  mediaTileFilled: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative'
  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  mediaTileEmpty: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addressChipsScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  addrChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  addrChipActive: {
    borderColor: theme.colors.primary,
  },
  addrChipText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  addrChipTextActive: {
    color: theme.colors.primary,
  },
  mapBtn: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  mapBtnText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  timeCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
  },
  timeCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(14, 154, 167, 0.1)',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
  timeSub: {
    fontSize: 10,
    color: theme.colors.textDim,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 250,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  dateCard: {
    width: 60,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateCardDay: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 4,
  },
  dateCardDate: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalCloseBtn: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '700',
  }
});

export default DescribeJobScreen;
