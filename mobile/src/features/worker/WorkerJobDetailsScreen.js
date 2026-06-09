import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { jobService } from '../../services/jobService';

const WorkerJobDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, signOut } = useAuth();
  const { job } = route.params || {};
  
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [timeToReach, setTimeToReach] = useState('');
  const [location, setLocation] = useState(job?.addressDetails || 'Address not provided');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canQuote = user?.kyc?.status === 'APPROVED' && (user?.wallet?.balance || 0) >= 100;

  const styles = createStyles(theme, isDarkMode);

  const handleSubmit = async () => {
    if (!price || !description || !timeToReach) {
      return Alert.alert('Error', 'Please fill in all details');
    }
    if (!canQuote) {
      return Alert.alert('Blocked', 'You must have an approved KYC and at least ₹100 in your wallet to quote.');
    }

    setIsSubmitting(true);
    try {
      const res = await jobService.placeQuote({
        jobId: job?._id || 'mock-id',
        amount: Number(price),
        description,
        timeToReach
      });
      if (res.data.status === 'success') {
        Alert.alert("Success", "Your quote has been submitted successfully.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to submit quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <AppBar 
        title="Job Details" 
        subtitle="AC & HVAC · AC Service" 
        showBack={true} 
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Customer Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{job?.customer?.name ? job.customer.name[0] : 'C'}</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{job?.customer?.name || 'Customer'}</Text>
            <Text style={styles.customerLocation}>{job?.addressDetails || 'Address not provided'}</Text>
          </View>
        </View>

        {/* Problem Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Problem Description</Text>
          <Text style={styles.problemText}>"Not cooling since 2 days"</Text>
        </View>

        {/* Media */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Customer Media</Text>
          <View style={styles.mediaRow}>
            {job?.media && job.media.length > 0 ? (
                job.media.map((url, i) => (
                    <View key={i} style={[styles.mediaBox, { backgroundColor: '#6366f1' }]} />
                ))
            ) : (
                <Text style={styles.problemText}>No media attached</Text>
            )}
          </View>
        </View>

        {/* Submit Quote Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submit Your Quote</Text>
          
          {!canQuote && (
            <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700' }}>
                Your KYC must be approved and you need at least ₹100 in your wallet to quote on jobs.
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Your price (₹)</Text>
          <TextInput 
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="e.g. 500"
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Description / Notes</Text>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Full service including gas refilling."
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Estimated Time to Reach</Text>
          <TextInput 
            style={styles.input}
            value={timeToReach}
            onChangeText={setTimeToReach}
            placeholder="e.g. 25 mins"
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <TouchableOpacity 
            style={[styles.submitBtn, (!canQuote || isSubmitting) && { opacity: 0.5 }]} 
            onPress={handleSubmit}
            disabled={!canQuote || isSubmitting}
          >
            <Text style={styles.submitBtnText}>{isSubmitting ? 'Submitting...' : 'Submit Quote'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  statusBox: {
    backgroundColor: theme.colors.primary + '26',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBoxText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  customerLocation: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  problemText: {
    fontSize: 15,
    color: theme.colors.textDim,
    fontStyle: 'italic',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    opacity: 0.8,
  },
  inputLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  locationInputRow: {
    flexDirection: 'row',
  },
  gpsBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 1,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textDim,
  }
});

export default WorkerJobDetailsScreen;
