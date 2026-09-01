import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Linking,
  ActivityIndicator
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import settingsService from '../../services/settingsService';
import { MessageSquare, PhoneCall, Mail, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';

const FALLBACK_FAQS = {
  CUSTOMER: [
    { question: 'How do I book a local service worker (e.g. Electrician, Plumber)?', answer: 'Tap "Book" on the home screen, specify your requirements and location, and post the job. Nearby verified workers will submit quotes for you to compare and accept.' },
    { question: 'What are the Arrival OTP and Completion OTP?', answer: 'For your protection: 1) Share the Arrival OTP when the worker arrives on-site. 2) Share the Completion OTP ONLY after the task is finished and you have inspected and approved the work.' },
    { question: 'How do I pay for my shop order or service?', answer: 'You can pay instantly using your Kwickly Wallet, 1-Click Direct UPI (Google Pay, PhonePe, Paytm, BHIM, CRED), or Cash upon service completion. All UPI payments are 0% surcharge-free.' },
    { question: 'How do refunds work for cancelled orders?', answer: 'If you or the merchant cancels a prepaid order before arrival/dispatch, 100% of the amount is instantly credited back to your Kwickly Wallet balance with zero deductions.' },
    { question: 'Can I track my worker or delivery partner in real-time?', answer: 'Yes! Once assigned or dispatched, you can view their live GPS location and arrival ETA on the booking details screen.' },
    { question: 'How do I add balance to my Kwickly Wallet?', answer: 'Go to "My Wallet" from your profile, select an amount, and pay seamlessly via Direct UPI. Wallet balance allows instant 1-tap checkout.' }
  ],
  WORKER: [
    { question: 'How do I receive customer job alerts?', answer: 'Ensure your KYC is approved, your subscription/free trial is active, your GPS is enabled, and your toggle is set to "Online". You will receive instant notifications for nearby jobs.' },
    { question: 'When and how do I receive payment for completed jobs?', answer: 'Upon completing the job, enter the customer’s 4-digit Completion OTP. Earnings are credited directly to your Worker Wallet immediately.' },
    { question: 'How do I withdraw my earnings to my bank account?', answer: 'Navigate to the Earnings screen, tap "Withdraw", enter the amount, and choose your verified Bank Account (via IFSC) or UPI ID.' },
    { question: 'How does the Partner Free Trial & Subscription work?', answer: 'New workers receive a 14-day Free Trial. Afterward, choose a Monthly or Annual plan for unlimited job bidding, verified pro badge, and lowest commission rates.' },
    { question: 'What happens if a customer cancels after I arrive?', answer: 'If the customer cancels after you verify the Arrival OTP at their doorstep, you may be eligible for a travel compensation fee.' }
  ],
  SHOP: [
    { question: 'How do shop orders and settlements work?', answer: 'When customers order, you receive a real-time alert. Once packed and delivered with the Delivery OTP, net product earnings are credited to your Merchant Wallet.' },
    { question: 'What is the 30-minute auto-cancellation rule for shops?', answer: 'Shops have 30 minutes to accept incoming orders. Unaccepted orders auto-cancel with full refund to ensure great customer experience.' },
    { question: 'How do I manage product catalog and inventory?', answer: 'Go to your Shop Dashboard -> Products tab to add items with photos, update prices, apply discounts, or toggle out-of-stock items.' },
    { question: 'How do I withdraw store earnings?', answer: 'Navigate to your Merchant Wallet and request a payout directly to your registered business bank account.' }
  ]
};

const HelpSupportScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const role = user?.role || 'CUSTOMER';
  const isWorker = role === 'WORKER';
  const isShop = role === 'SHOP';

  const defaultRoleFaqs = isWorker ? FALLBACK_FAQS.WORKER : isShop ? FALLBACK_FAQS.SHOP : FALLBACK_FAQS.CUSTOMER;

  const [faqs, setFaqs] = useState(defaultRoleFaqs);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, [role]);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getPublicSettings();
      const serverFaqs = res.data?.data?.faqs;
      if (Array.isArray(serverFaqs) && serverFaqs.length > 0) {
        // Filter FAQs for current user role or 'ALL'
        const relevant = serverFaqs.filter(f => !f.targetRole || f.targetRole === 'ALL' || f.targetRole === role);
        if (relevant.length > 0) {
          setFaqs(relevant);
          return;
        }
      }
    } catch (e) {
      // Retain fallback
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
        style={{ paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', position: 'relative' }}
      >
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Help & Support"
          showBack={true}
          transparent={true} 
          showLogo={false} 
          hideCart={isWorker || isShop}
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.headerTitle}>Hi {user?.name ? user.name.split(' ')[0] : 'User'},</Text>
        <Text style={styles.headerSub}>How can we help you today?</Text>

        <View style={styles.contactRow}>
          <TouchableOpacity 
            style={styles.contactCard} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Chat', { partnerId: 'admin', partnerName: 'Kwickly Support', partnerRole: 'Support Team' })}
          >
            <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
               <MessageSquare size={24} color="#4f46e5" />
            </View>
            <Text style={styles.contactTitle}>Chat Support</Text>
            <Text style={styles.contactSub}>Usually responds in 5 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.contactCard} 
            activeOpacity={0.7}
            onPress={() => Linking.openURL('tel:18001234567')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
               <PhoneCall size={24} color="#16a34a" />
            </View>
            <Text style={styles.contactTitle}>Call Us</Text>
            <Text style={styles.contactSub}>Available 24/7</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.emailCard} 
          activeOpacity={0.7}
          onPress={() => Linking.openURL('mailto:support@kwickly.com')}
        >
          <View style={[styles.iconBox, { backgroundColor: '#fef3c7', marginRight: 16 }]}>
            <Mail size={24} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>support@kwickly.com</Text>
          </View>
          <ChevronRight size={20} color={theme.colors.textDim} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        
        {loading && faqs.length === 0 ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 30 }} />
        ) : (
          <View style={styles.faqContainer}>
            {faqs.map((faq, index) => {
              const isExpanded = expandedIndex === index;
              const qText = faq.question || faq.q;
              const aText = faq.answer || faq.a;
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.faqItem, index === faqs.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.75}
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQ}>{qText}</Text>
                    {isExpanded ? (
                      <ChevronUp size={18} color={theme.colors.primary} />
                    ) : (
                      <ChevronDown size={18} color={theme.colors.textDim} />
                    )}
                  </View>
                  {isExpanded && (
                    <Text style={styles.faqA}>{aText}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  headerSub: { fontSize: 15, color: theme.colors.textDim, marginBottom: 24 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  contactCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
    alignItems: 'center'
  },
  iconBox: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  contactTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  contactSub: { fontSize: 13, color: theme.colors.textDim, textAlign: 'center' },
  emailCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
    marginBottom: 40
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
  faqContainer: { 
    backgroundColor: theme.colors.surface, borderRadius: 20, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  faqItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1, paddingRight: 10 },
  faqA: { fontSize: 13.5, color: theme.colors.textDim, lineHeight: 21, marginTop: 10 },
});

export default HelpSupportScreen;
