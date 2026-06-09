import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  SafeAreaView, 
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
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Star } from 'lucide-react-native';

const WorkerRateCustomerScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  
  const styles = createStyles(theme, isDarkMode);

  const handleSubmit = () => {
    Alert.alert(
      "Rating Submitted",
      "Thank you for your feedback!",
      [
        {
          text: "Back to Home",
          onPress: () => navigation.navigate('WorkerApp')
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerBox}>
            
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>

            <Text style={styles.customerName}>Anita Sharma</Text>
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

            <Button title="Submit Rating" onPress={() => {}} />

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
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
