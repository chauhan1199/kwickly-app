import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';
import settingsService from '../../services/settingsService';

const PrivacyScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('TOS'); // 'TOS' | 'PRIVACY'
  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await settingsService.getPublicSettings();
      if (res.data?.data) {
        setTerms(res.data.data.termsOfService || '');
        setPrivacy(res.data.data.privacyPolicy || '');
      }
    } catch (err) {
      console.log('Error fetching policies from Redis/server:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* App Bar inside purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <AppBar 
          title="T&C / Privacy"
          showBack={true}
          transparent={true} 
          showLogo={false} 
          onBackPress={() => navigation.goBack()}
        />

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'TOS' && styles.tabButtonActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('TOS')}
          >
            <Text
              style={[styles.tabText, activeTab === 'TOS' && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              📜 Terms & Conditions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'PRIVACY' && styles.tabButtonActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('PRIVACY')}
          >
            <Text
              style={[styles.tabText, activeTab === 'PRIVACY' && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              🔒 Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchPolicies(true)} 
            colors={['#6C47FF']} 
            tintColor="#6C47FF" 
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {activeTab === 'TOS' ? 'Kwickly Terms of Service' : 'Kwickly Privacy Policy'}
            </Text>
            <Text style={styles.lastUpdated}>Last updated: September 2026</Text>
            <View style={styles.divider} />
            <Text style={styles.paragraph}>
              {activeTab === 'TOS' ? terms : privacy}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  tabTextActive: {
    color: '#6C47FF',
  },
  content: { padding: 18 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  lastUpdated: { fontSize: 12, color: theme.colors.textDim, marginBottom: 12 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginBottom: 16 },
  paragraph: { fontSize: 13.5, color: theme.colors.text, lineHeight: 22, letterSpacing: 0.2 },
});

export default PrivacyScreen;
