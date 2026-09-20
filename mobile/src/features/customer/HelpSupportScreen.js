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
    { question: 'How do I book a local service worker (e.g., Electrician, Plumber, Cleaner)?', answer: 'Tap "Book" or select a category on the home screen, specify your task details, preferred time, and location, and post your request. Nearby verified professionals will send you quotes with their rates and ratings. You can compare quotes and accept the best worker in one tap.', category: 'booking' },
    { question: 'What are the Arrival OTP and Completion OTP?', answer: 'For your security, Kwickly uses dual OTP verification: 1) The Arrival OTP is shared with the worker when they arrive at your location to confirm arrival. 2) The Completion OTP should ONLY be shared after the worker finishes the task and you have inspected and approved the work.', category: 'safety' },
    { question: 'How do I order groceries or products from nearby shops?', answer: 'Browse local stores in your area, add items to your cart, choose your delivery slot or instant delivery, and proceed to checkout. You will be able to track your order preparation and live delivery on the interactive map.', category: 'orders' },
    { question: 'What payment methods are supported on Kwickly?', answer: 'You can pay using your Kwickly In-App Wallet, 1-Click Direct UPI Intent (Google Pay, PhonePe, Paytm, BHIM, CRED), or Cash on Delivery / Pay after Service. All online UPI payments are 0% MDR surcharge-free and verified in real-time.', category: 'payments' },
    { question: 'How do I add money to my Kwickly Wallet and what are the benefits?', answer: 'Go to "My Wallet" from your profile or side drawer, select or enter the top-up amount, and pay seamlessly via UPI. Wallet payments offer instant 1-tap checkout, zero transaction failures, and immediate automatic refunds for any cancelled orders.', category: 'payments' },
    { question: 'What is the cancellation and refund policy?', answer: 'You can cancel any service booking or shop order before the worker arrives or before the store dispatches your items without any cancellation fee. If you paid online or via wallet, 100% of the amount is immediately credited back to your Kwickly Wallet.', category: 'orders' },
    { question: 'Are Kwickly service professionals verified and safe?', answer: 'Yes. Every service partner on Kwickly must complete mandatory Know-Your-Customer (KYC) verification with government ID proof (Aadhaar/PAN/Driving License) and trade validation before they can receive job broadcasts.', category: 'safety' },
    { question: 'Can I track my service worker or delivery partner in real-time?', answer: 'Yes! Once a worker accepts your booking or an order is dispatched, you can view their real-time GPS location and estimated time of arrival (ETA) live on the map in your booking details screen.', category: 'booking' },
    { question: 'How does the Kwickly Referral Program work?', answer: 'Share your unique referral code or link with friends and family from the "Refer & Earn" screen. When they sign up and complete their first verified booking or order, both of you receive bonus wallet cash.', category: 'payments' }
  ],
  WORKER: [
    { question: 'How do I register as a Service Partner and start receiving jobs?', answer: 'Download the Kwickly app, register with your mobile number, select "Worker/Service Partner", choose your service skills, and upload your government ID proof for KYC. Once approved (usually within 24 hours), turn your toggle "Online" to receive nearby job alerts.', category: 'booking' },
    { question: 'How do I get notified of customer jobs and submit quotes?', answer: 'Ensure your app is Online and location permissions are set to "Always" or "While Using App". When a customer posts a job in your service radius, you will receive an instant audio/push alert. Review the task details and submit your competitive price quote.', category: 'booking' },
    { question: 'When and how do I receive payment for completed jobs?', answer: 'Upon finishing the work, ask the customer for their 4-digit Completion OTP and enter it in your app. The earnings (minus any platform convenience fee) are instantly credited to your Kwickly Worker Wallet balance.', category: 'payments' },
    { question: 'How do I withdraw my earnings to my bank account or UPI?', answer: 'Navigate to the "Earnings / Wallet" section in your app, tap "Withdraw", enter the amount, and select your verified Bank Account (via IFSC) or UPI ID. Withdrawal requests are processed quickly into your bank account.', category: 'payments' },
    { question: 'How does the Partner Free Trial and Subscription work?', answer: 'New service partners receive a complimentary 14-Day Free Trial. After the trial, you can subscribe to affordable Monthly or Annual plans to enjoy unlimited bidding, verified badge, priority job matching, and reduced commission rates.', category: 'booking' },
    { question: 'What happens if a customer cancels after I arrive?', answer: 'If the customer cancels after you have arrived and entered the Arrival OTP, you may be eligible for a doorstep travel compensation credited directly to your wallet.', category: 'safety' },
    { question: 'How do customer ratings affect my earnings?', answer: 'Partners with high ratings (4.5 stars and above) receive priority lead dispatches and higher placement on customer quote comparisons, leading to significantly higher monthly earnings.', category: 'booking' }
  ],
  SHOP: [
    { question: 'How do I list my store and products on Kwickly?', answer: 'Register as a Shop Merchant, complete your store profile (store name, category, opening hours, address), and start adding products with photos, prices, unit weights, and stock levels from the "Product Catalog" tab.', category: 'orders' },
    { question: 'How do I process incoming shop orders?', answer: 'When a nearby customer places an order, you will receive a loud real-time order notification. Tap to accept the order, pack the requested items, and mark "Ready for Pickup". Provide the package to the delivery partner upon verifying the Delivery OTP.', category: 'orders' },
    { question: 'What is the 30-minute auto-cancellation rule for shops?', answer: 'To guarantee fast fulfillment for customers, shops have 30 minutes to accept incoming orders. Unaccepted orders are automatically cancelled and refunded to the customer. Keep your store notifications active during business hours.', category: 'orders' },
    { question: 'How do merchant settlements and payouts work?', answer: 'The net value of completed orders is automatically credited to your Merchant Wallet upon delivery. You can initiate payouts directly to your registered business bank account at any time.', category: 'payments' },
    { question: 'Can I manage product inventory, discounts, and out-of-stock items?', answer: 'Yes! From your Merchant Dashboard, you can toggle item availability on/off instantly, update prices, add promotional discounts, and edit inventory with zero delay.', category: 'orders' }
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
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [expandedIndex, setExpandedIndex] = useState(null);
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
        // Filter out dummy placeholder questions
        const validFaqs = serverFaqs.filter(f => 
          f && f.question && 
          f.question.trim() !== 'New Question?' && 
          f.question.trim() !== 'Enter new question here...' &&
          f.answer && f.answer.trim().length > 5
        );

        // Filter FAQs for current user role or 'ALL'
        const relevant = validFaqs.filter(f => !f.targetRole || f.targetRole === 'ALL' || f.targetRole === role);
        if (relevant.length > 0) {
          setFaqs(relevant);
          return;
        }
      }
      setFaqs(defaultRoleFaqs);
    } catch (e) {
      setFaqs(defaultRoleFaqs);
    } finally {
      setLoading(false);
    }
  };

  // Filter FAQs by selected topic if clicked
  const filteredFaqs = faqs.filter(faq => {
    if (selectedTopic === 'ALL') return true;
    const q = (faq.question || '').toLowerCase();
    const a = (faq.answer || '').toLowerCase();
    if (selectedTopic === 'BOOKING') return q.includes('book') || q.includes('worker') || q.includes('quote') || q.includes('register') || q.includes('job') || q.includes('bidding');
    if (selectedTopic === 'ORDERS') return q.includes('order') || q.includes('shop') || q.includes('store') || q.includes('delivery') || q.includes('product');
    if (selectedTopic === 'PAYMENTS') return q.includes('pay') || q.includes('wallet') || q.includes('upi') || q.includes('withdraw') || q.includes('refund') || q.includes('earn');
    if (selectedTopic === 'SAFETY') return q.includes('otp') || q.includes('safety') || q.includes('verify') || q.includes('kyc') || q.includes('secure') || q.includes('cancel');
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* App Bar inside purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', position: 'relative' }}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 110 }]}>
        
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

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            Frequently Asked Questions
          </Text>
          <View style={{ backgroundColor: theme.colors.primary + '18', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, flexShrink: 0 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.colors.primary }}>{filteredFaqs.length} FAQs</Text>
          </View>
        </View>

        {/* Topic Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.topicScroll, { paddingRight: 24 }]}>
          {[
            { id: 'ALL', label: '🌟 All' },
            { id: 'BOOKING', label: '⚡ Services & Bids' },
            { id: 'ORDERS', label: '🛍️ Shop Orders' },
            { id: 'PAYMENTS', label: '💳 UPI & Wallet' },
            { id: 'SAFETY', label: '🔒 OTP & Safety' },
          ].map(chip => {
            const isSelected = selectedTopic === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.topicChip, isSelected && styles.topicChipActive]}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedTopic(chip.id);
                  setExpandedIndex(null);
                }}
              >
                <Text style={[styles.topicChipText, isSelected && styles.topicChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {loading && faqs.length === 0 ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 30 }} />
        ) : filteredFaqs.length === 0 ? (
          <View style={[styles.faqContainer, { padding: 24, alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.textDim, fontSize: 14 }}>No questions found in this category.</Text>
          </View>
        ) : (
          <View style={styles.faqContainer}>
            {filteredFaqs.map((faq, index) => {
              const isExpanded = expandedIndex === index;
              const qText = faq.question || faq.q;
              const aText = faq.answer || faq.a;
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.faqItem, index === filteredFaqs.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.75}
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <View style={styles.faqHeader}>
                    <Text style={[styles.faqQ, isExpanded && { color: '#6C47FF' }]}>{qText}</Text>
                    {isExpanded ? (
                      <ChevronUp size={18} color="#6C47FF" />
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
    marginBottom: 30
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  topicScroll: { paddingBottom: 14, gap: 8 },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6
  },
  topicChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF'
  },
  topicChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.textDim
  },
  topicChipTextActive: {
    color: '#FFFFFF'
  },
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
  faqA: { fontSize: 13.5, color: theme.colors.textDim, lineHeight: 22, marginTop: 10 },
});

export default HelpSupportScreen;

