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
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const HelpSupportScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const faqs = [
    { q: 'How do I cancel a booking?', a: 'You can cancel a booking from the "Quotes/My Bookings" tab up to 2 hours before the scheduled time without any penalty.' },
    { q: 'When will my shop order arrive?', a: 'Shop orders are typically delivered within 30-45 minutes depending on the store\'s distance.' },
    { q: 'How do refunds work?', a: 'Refunds for cancelled prepaid orders are processed immediately and reflect in your account within 3-5 business days.' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Help & Support</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.headerTitle}>Hi {user?.name ? user.name.split(' ')[0] : 'User'},</Text>
        <Text style={styles.headerSub}>How can we help you today?</Text>

        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactCard} onPress={() => {}}>
            <Text style={{fontSize: 24, marginBottom: 8}}>💬</Text>
            <Text style={styles.contactTitle}>Chat Support</Text>
            <Text style={styles.contactSub}>Usually responds in 5 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('tel:18001234567')}>
            <Text style={{fontSize: 24, marginBottom: 8}}>📞</Text>
            <Text style={styles.contactTitle}>Call Us</Text>
            <Text style={styles.contactSub}>Available 24/7</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.emailCard} onPress={() => Linking.openURL('mailto:support@kwickly.com')}>
          <Text style={{fontSize: 24, marginRight: 16}}>✉️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>support@kwickly.com</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        
        <View style={styles.faqContainer}>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
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
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginLeft: 12 },
  content: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  headerSub: { fontSize: 15, color: theme.colors.textDim, marginBottom: 24 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  contactCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center'
  },
  contactTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  contactSub: { fontSize: 12, color: theme.colors.textDim, textAlign: 'center' },
  emailCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 40
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
  faqContainer: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  faqItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  faqQ: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  faqA: { fontSize: 13, color: theme.colors.textDim, lineHeight: 20 },
});

export default HelpSupportScreen;
