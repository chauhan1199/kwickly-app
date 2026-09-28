import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const RateExperienceScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const { worker } = route.params || {};
  const w = worker || { name: 'Ramesh Kumar', cat: 'Cleaning · Home Cleaning' };

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const jobId = route.params?.job?._id || route.params?.jobId || worker?.jobId || worker?._id;
    if (!jobId) {
      navigation.navigate('Home');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/jobs/${jobId}/rate`, { score: rating, review });
      navigation.navigate('Home');
    } catch (e) {
      console.warn('Rating submission error:', e?.response?.data?.message || e.message);
      navigation.navigate('Home');
    } finally {
      setSubmitting(false);
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
          <Text style={styles.appBarTitle} numberOfLines={1}>Rate your experience</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{w.name ? w.name[0] : 'W'}</Text>
        </View>

        <Text style={styles.workerName}>{w.name || 'Worker'}</Text>
        <Text style={styles.workerSub}>{w.cat}</Text>
        
        <Text style={styles.successText}>✅ Job Completed Successfully</Text>

        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating ? styles.starOn : styles.starOff]}>
                {star <= rating ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput 
          style={styles.reviewInput}
          placeholder="Write a review (optional)"
          placeholderTextColor={theme.colors.textDim}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={review}
          onChangeText={setReview}
        />

        <Button title={submitting ? "Submitting..." : "Submit Rating"} onPress={handleSubmit} disabled={submitting} />

        <TouchableOpacity 
          style={styles.skipBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    paddingTop: 24,
    alignItems: 'center',
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  }
});

export default RateExperienceScreen;
