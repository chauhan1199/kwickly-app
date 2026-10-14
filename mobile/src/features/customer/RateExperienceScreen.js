import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const RATING_LABELS = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent'];

const RateExperienceScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight, 12);

  const { worker } = route.params || {};
  // Real worker + service from the job; no placeholder person
  const ratedJob = route.params?.job;
  const jobWorker = ratedJob && typeof ratedJob.workerId === 'object' ? ratedJob.workerId : null;
  const w = {
    ...(jobWorker || {}),
    ...(worker || {}),
    cat: worker?.cat || [ratedJob?.category, ratedJob?.subcategory].filter(Boolean).join(' · '),
  };
  const jobId = ratedJob?._id || route.params?.jobId;

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goHome = () => navigation.navigate('Home');

  const handleSubmit = async () => {
    if (!jobId) {
      Alert.alert('Rating Unavailable', 'This job could not be found. Please rate it from your job history.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/jobs/${jobId}/rate`, { score: rating, review: review.trim() });
      Alert.alert('Thank you!', `Your ${rating}-star rating for ${w.name || 'the worker'} has been saved.`, [
        { text: 'Done', onPress: goHome }
      ]);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        Alert.alert('Already Rated', 'You have already rated this job.', [{ text: 'OK', onPress: goHome }]);
      } else {
        Alert.alert('Could Not Save Rating', e?.response?.data?.message || 'Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const styles = createStyles(theme, isDarkMode, safeTop, insets.bottom);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>Rate your experience</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{w.name ? w.name[0].toUpperCase() : 'W'}</Text>
          </View>

          <Text style={styles.workerName} numberOfLines={1}>{w.name || 'Worker'}</Text>
          {w.cat ? <Text style={styles.workerSub} numberOfLines={2}>{w.cat}</Text> : null}
          <Text style={styles.successText}>✅ Job Completed Successfully</Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
              >
                <Text style={[styles.star, star <= rating ? styles.starOn : styles.starOff]}>
                  {star <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>

          <TextInput
            style={styles.reviewInput}
            placeholder="Write a review (optional)"
            placeholderTextColor={theme.colors.textDim}
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
            value={review}
            onChangeText={setReview}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitBtnText}>Submit Rating</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={goHome} disabled={submitting} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = (theme, isDarkMode, safeTop, safeBottom) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: safeTop + 8,
    paddingBottom: 12,
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
    flex: 1,
    marginLeft: 12,
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: safeBottom + 110, // clear the bottom tab bar
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f5b300',
    marginTop: -12,
    marginBottom: 20,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // Ok color tinted
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10b981', // Ok color
  },
  workerName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  workerSub: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textDim,
  },
  successText: {
    fontSize: 13,
    color: '#10b981', // Ok color
    marginTop: 6,
    marginBottom: 20,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  star: {
    fontSize: 40,
  },
  starOn: {
    color: '#f5b300',
  },
  starOff: {
    color: theme.colors.textDim,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    color: theme.colors.text,
    minHeight: 100,
    marginBottom: 16,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  skipBtnText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  }
});

export default RateExperienceScreen;
