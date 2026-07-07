import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Linking
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, PhoneCall, Mail, ChevronRight } from 'lucide-react-native';

const HelpSupportScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const isWorker = user?.role === 'WORKER';

  const customerFaqs = [
    { q: 'How do I cancel a booking?', a: 'You can cancel a booking from the "Quotes/My Bookings" tab up to 2 hours before the scheduled time without any penalty.' },
    { q: 'When will my shop order arrive?', a: 'Shop orders are typically delivered within 30-45 minutes depending on the store\'s distance.' },
    { q: 'How do refunds work?', a: 'Refunds for cancelled prepaid orders are processed immediately and reflect in your account within 3-5 business days.' },
  ];

  const workerFaqs = [
    { q: 'How do I withdraw my earnings?', a: 'Go to the Earnings tab and click on the Withdraw button. You can select your saved Bank or UPI account. Transfers take 1-2 business days.' },
    { q: 'How do I contact a customer?', a: 'You can contact a customer directly from the Active Job details screen by clicking the Chat or Call button.' },
    { q: 'How do subscription plans work?', a: 'Subscription plans give you access to premium features and lower commission rates. You can manage your plan in the Earnings tab.' },
  ];

  const shopFaqs = [
    { q: 'How do I update my business hours?', a: 'Go to Settings -> Business Hours. Changes will reflect instantly on your store profile.' },
    { q: 'When do I receive my payouts?', a: 'Payouts are processed automatically every Monday and Thursday to your primary Bank or UPI account.' },
    { q: 'How to handle an out-of-stock item?', a: 'Go to Products, search for the item, and toggle its availability. This prevents customers from ordering it.' },
  ];

  const faqs = isWorker ? workerFaqs : user?.role === 'SHOP' ? shopFaqs : customerFaqs;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Help & Support"
          showBack={true}
          transparent={true} 
          showLogo={false} 
          hideCart={isWorker || user?.role === 'SHOP'}
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
        
        <View style={styles.faqContainer}>
          {faqs.map((faq, index) => (
            <View key={index} style={[styles.faqItem, index === faqs.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </View>

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
    overflow: 'hidden'
  },
  faqItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  faqQ: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  faqA: { fontSize: 14, color: theme.colors.textDim, lineHeight: 22 },
});

export default HelpSupportScreen;
