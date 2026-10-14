import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView,
  Text, 
  TouchableOpacity,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import Button from '../../components/ui/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Star } from 'lucide-react-native';
import { jobService } from '../../services/jobService';

const WorkerRateCustomerScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { jobId, customerName } = route.params || {};
  
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);

  const handleSubmit = async () => {
    if (!jobId) {
      Alert.alert('Error', 'No job ID found');
      return;
    }
    setSubmitting(true);
    try {
      await jobService.rateCustomer(jobId, { score: rating, review: note });
      Alert.alert(
        "Rating Submitted",
        "Thank you for your feedback!",
        [
          {
            text: "Back to Home",
            onPress: () => navigation.navigate('Dashboard')
          }
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Rate the Customer</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior="padding"
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerBox}>
            
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{customerName ? customerName[0] : 'C'}</Text>
            </View>

            <Text style={styles.customerName} numberOfLines={1}>{customerName || 'Customer'}</Text>
            <Text style={styles.subText}>How was the customer?</Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Star 
                    size={40} 
                    color="#FBBF24" 
                    fill={star <= rating ? "#FBBF24" : "transparent"} 
                    style={styles.starIcon} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Optional note..."
              placeholderTextColor={theme.colors.textDim}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />

            <Button title={submitting ? "Submitting..." : "Submit Rating"} onPress={handleSubmit} disabled={submitting} />

          </View>
        </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      

    </View>
  );
};

const createStyles = (theme, isDarkMode, safeTop = 16) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: safeTop + 8, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  content: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
  },
  customerName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subText: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginTop: 4,
    marginBottom: 30,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  textInput: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 30,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerRateCustomerScreen;
