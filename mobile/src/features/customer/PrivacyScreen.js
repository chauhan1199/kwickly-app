import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';
import settingsService from '../../services/settingsService';

const PrivacyScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getPublicSettings();
      if (res.data?.data) {
        setTerms(res.data.data.termsOfService || 'No terms specified yet.');
        setPrivacy(res.data.data.privacyPolicy || 'No privacy policy specified yet.');
      }
    } catch (err) {
      setTerms('Failed to load terms.');
      setPrivacy('Failed to load privacy policy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="T&C / Privacy"
          showBack={true}
          transparent={true} 
          showLogo={false} 
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.title}>Terms & Conditions</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20, marginBottom: 20 }} />
        ) : (
          <Text style={styles.paragraph}>{terms}</Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.title}>Privacy Policy</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20, marginBottom: 20 }} />
        ) : (
          <Text style={styles.paragraph}>{privacy}</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  paragraph: { fontSize: 14, color: theme.colors.textDim, lineHeight: 22 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 30 },
});

export default PrivacyScreen;
