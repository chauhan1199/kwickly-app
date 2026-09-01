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

const DEFAULT_TERMS = `Welcome to Kwickly. By downloading, accessing, or using the Kwickly platform ("App", "Website", or "Services"), you agree to be bound by these Terms and Conditions ("Terms").

1. PLATFORM OVERVIEW
Kwickly is a technology aggregator platform connecting customers with independent service professionals ("Workers") and local retail merchants ("Shops").

2. USER ACCOUNTS & VERIFICATION
• Users must provide accurate mobile numbers and verify via OTP.
• Workers and Shops must complete mandatory KYC verification with government ID proof before offering services or goods on the platform.
• You are responsible for maintaining the security of your account and MPIN.

3. SERVICE BOOKINGS & PRICING
• Quotes: Workers submit quotes based on customer job descriptions. Accepting a quote forms a direct service contract.
• Security OTPs: Service jobs utilize an Arrival OTP and a Completion OTP to guarantee work completion before payments are released.
• Platform Fees: Kwickly charges a transparent platform convenience fee and applicable taxes (GST) on completed jobs.

4. SHOP ORDERS & FAST DELIVERY
• Customers can browse local stores, add items to cart, select delivery slots, and place orders.
• Delivery OTP: Customers must verify the Delivery OTP with delivery personnel upon receiving orders.
• Stock & Cancellations: Unconfirmed orders auto-cancel after 30 minutes with 100% immediate wallet refund.

5. PAYMENTS, DIRECT UPI & WALLET
• Payments can be made via Kwickly Wallet, 1-Click Direct UPI (Google Pay, PhonePe, Paytm, BHIM), or Cash.
• 0% MDR Direct UPI: UPI payments transfer directly to platform accounts with zero gateway processing markups.

6. CANCELLATION & REFUND POLICY
• Customer Cancellations: You may cancel a booking or order before dispatch or worker arrival without penalty.
• Automatic Refunds: Cancelled prepaid orders and failed transactions are refunded instantly to your Kwickly Wallet balance.
• Wallet Withdrawals: Workers and Shops can request payouts of their available earnings to their verified Bank/UPI accounts.

7. CONTACT & GRIEVANCE
For queries, disputes, or legal notices, contact Kwickly Support at support@kwickly.com.`;

const DEFAULT_PRIVACY = `Kwickly ("we", "our", or "us") values your trust and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data.

1. INFORMATION WE COLLECT
• Account Data: Name, mobile phone number, profile image, and email address.
• Location Data: We collect precise background and foreground location data to enable nearby worker discovery, live delivery tracking, and accurate service radius matching.
• KYC & Professional Documents: For Workers and Shops, we securely collect government identity cards solely for background verification and platform safety.
• Transaction Information: Transaction IDs, order history, and wallet records (no bank passwords or UPI PINs are stored).

2. HOW WE USE YOUR INFORMATION
• To connect customers with the nearest eligible service workers and local shops.
• To calculate accurate ETAs, service distances, and delivery routes.
• To process automated UPI and wallet payments with cryptographically signed verification.
• To prevent fraud and unauthorized account access.
• To send essential push notifications regarding job status, order updates, and OTPs.

3. DATA SECURITY & RETENTION
All data in transit is protected using industry-standard TLS encryption. Passwords and MPINs are hashed using bcrypt.

4. GRIEVANCE OFFICER
In accordance with Information Technology Rules, contact our Grievance Officer at grievance@kwickly.com.`;

const PrivacyScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOS'); // 'TOS' | 'PRIVACY'
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getPublicSettings();
      if (res.data?.data) {
        if (res.data.data.termsOfService && res.data.data.termsOfService.trim().length > 10) {
          setTerms(res.data.data.termsOfService);
        }
        if (res.data.data.privacyPolicy && res.data.data.privacyPolicy.trim().length > 10) {
          setPrivacy(res.data.data.privacyPolicy);
        }
      }
    } catch (err) {
      // Retain fallback defaults
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
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
            <Text style={[styles.tabText, activeTab === 'TOS' && styles.tabTextActive]}>
              📜 Terms & Conditions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'PRIVACY' && styles.tabButtonActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('PRIVACY')}
          >
            <Text style={[styles.tabText, activeTab === 'PRIVACY' && styles.tabTextActive]}>
              🔒 Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
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
    fontSize: 13,
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
