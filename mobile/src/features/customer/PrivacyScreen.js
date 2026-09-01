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

const DEFAULT_TERMS = `Welcome to Kwickly. By downloading, accessing, browsing, or using the Kwickly mobile application, website, or associated services (collectively, the "Platform" or "Services"), you agree to be bound by these Terms and Conditions ("Terms").

1. PLATFORM OVERVIEW & CONTRACTUAL RELATIONSHIP
Kwickly Technologies Private Limited ("Kwickly") operates an on-demand hyperlocal technology aggregator connecting Customers with independent verified Service Professionals ("Workers") and local retail merchants ("Shops"). Kwickly provides software matching, digital communication, route optimization, quote bidding, and payment settlement facilitation.

2. USER ACCOUNTS, ELIGIBILITY & KYC VERIFICATION
• Eligibility: You must be at least 18 years of age and legally competent under Indian law.
• Authentication: Account access is authenticated via mobile number and secure OTP / MPIN.
• Partner KYC: All Workers and Merchants must undergo mandatory Know-Your-Customer (KYC) verification with government ID proof (Aadhaar, PAN, Driving License) before receiving job broadcasts or listing products.

3. ON-DEMAND SERVICE BOOKINGS & DUAL-OTP SECURITY
• Job Posting & Quotes: Customers submit service requests; nearby verified Workers submit competitive quotes.
• Arrival OTP: The Worker must verify the 4-digit Arrival OTP upon reaching the customer location to confirm on-site presence.
• Completion OTP: The customer must inspect the completed work and share the 4-digit Completion OTP ONLY when fully satisfied. Entering the Completion OTP confirms delivery and triggers payment release.

4. HYPERLOCAL SHOPPING & DELIVERY
• Product Listings: Merchants are responsible for accurate pricing, freshness, and inventory.
• 30-Minute Acceptance SLA: If a merchant does not accept an order within 30 minutes, it is automatically cancelled with 100% instant refund to your Kwickly Wallet.
• Delivery OTP: The customer must verify the Delivery OTP upon physical handoff of items.

5. PAYMENTS, 0% MDR DIRECT UPI & WALLET SYSTEM
• Payment Modes: Kwickly In-App Wallet, 1-Click Direct NPCI UPI Intent (Google Pay, PhonePe, Paytm, BHIM, CRED), or Cash on Delivery.
• 0% MDR Direct UPI: Direct peer-to-platform UPI payments with zero payment gateway processing surcharges.
• Real-Time Webhooks: Online transactions are cryptographically verified in real-time via HMAC SHA-256 webhooks for fraud-proof settlements.
• Wallet Withdrawals: Partners can withdraw earned wallet balances directly to their verified Bank Accounts or UPI IDs.

6. CANCELLATION & REFUND POLICY
• Free Cancellations: Cancel anytime before worker arrival or shop order dispatch with zero cancellation penalty.
• Instant Wallet Refunds: Cancelled prepaid orders and overpayments are credited immediately (100% without deductions) to your Kwickly Wallet.

7. PARTNER SUBSCRIPTIONS & FREE TRIALS
• New verified Service Partners receive an introductory 14-day Free Trial.
• Partners may subscribe to Monthly or Annual tiers for unlimited bidding, priority dispatch, and reduced commission.

8. CONTACT & GRIEVANCE
For support or inquiries, contact us via in-app 24/7 Support Chat or email support@kwickly.com.`;

const DEFAULT_PRIVACY = `Kwickly Technologies Private Limited is dedicated to safeguarding your personal privacy and protecting the confidentiality of your data.

1. INFORMATION WE COLLECT
• Personal Identification: Name, mobile phone number, email address, profile photo, and delivery addresses.
• Precision Location Data: Foreground and background GPS location to discover nearby verified workers/shops, calculate accurate ETAs, and enable live map tracking.
• Partner KYC Documents: Government IDs (Aadhaar, PAN, Driving License) collected strictly for identity verification and platform safety.
• Financial & Transaction Data: Transaction logs, order invoices, and wallet balances. We do NOT store UPI PINs, NetBanking passwords, or card CVVs.

2. HOW WE USE YOUR INFORMATION
• To connect customers with nearby verified service workers and local retail shops.
• To calculate travel distances, live delivery routes, and dynamic search radiuses.
• To process payments, verify cryptographic webhook signatures, and manage wallet ledgers.
• To send critical transactional notifications, OTPs, job alerts, and order status updates.
• To prevent fraud, detect unauthorized access, and enforce safety policies.

3. DATA SECURITY & RETENTION
• All transmissions are encrypted using industry-standard TLS 1.3 encryption.
• Passwords and MPINs are hashed using bcrypt.
• We never sell, rent, or trade your personal information to third-party advertisers.

4. GRIEVANCE OFFICER
In accordance with Information Technology Rules, contact our Grievance Officer at legal@kwickly.com / support@kwickly.com.`;

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
