import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Linking,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import settingsService from '../../services/settingsService';
import { MessageSquare, PhoneCall, Mail, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';

const HelpSupportScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const role = user?.role || 'CUSTOMER';
  const isWorker = role === 'WORKER';
  const isShop = role === 'SHOP';

  const [faqs, setFaqs] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, [role]);

  const fetchFaqs = async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await settingsService.getPublicSettings();
      const serverFaqs = res.data?.data?.faqs;
      if (Array.isArray(serverFaqs) && serverFaqs.length > 0) {
        // Filter out dummy placeholder questions and sort by order
        const validFaqs = serverFaqs
          .filter(f => 
            f && f.question && 
            f.question.trim() !== 'New Question?' && 
            f.question.trim() !== 'Enter new question here...' &&
            f.answer && f.answer.trim().length > 5
          )
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        // Filter FAQs for current user role or 'ALL'
        const relevant = validFaqs.filter(f => !f.targetRole || f.targetRole === 'ALL' || f.targetRole === role);
        setFaqs(relevant);
      } else {
        setFaqs([]);
      }
    } catch (e) {
      console.log('Error fetching dynamic FAQs from Redis/server:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
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

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchFaqs(true)} 
            colors={['#6C47FF']} 
            tintColor="#6C47FF" 
          />
        }
      >
        
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

      </ScrollView>
    </View>
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

