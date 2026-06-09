import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const PrivacyScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>T&C / Privacy</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.lastUpdated}>Last updated: June 1, 2026</Text>

        <Text style={styles.heading}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to Kwickly! These Terms of Service govern your use of our platform. By accessing or using Kwickly, you agree to be bound by these Terms and all applicable laws and regulations.
        </Text>

        <Text style={styles.heading}>2. Booking Services</Text>
        <Text style={styles.paragraph}>
          Kwickly acts as an intermediary platform connecting users with professional service providers. We do not directly employ the service providers and are not responsible for the direct execution of services, though we enforce strict quality standards.
        </Text>

        <Text style={styles.heading}>3. Payments and Refunds</Text>
        <Text style={styles.paragraph}>
          Payments are securely processed through our authorized gateways. You may cancel a service up to 2 hours before the scheduled time for a full refund. Cancellations made within 2 hours may incur a cancellation fee.
        </Text>

        <Text style={styles.heading}>4. User Privacy Data</Text>
        <Text style={styles.paragraph}>
          We take your privacy seriously. Your location data is only accessed when you are actively using the app for booking or tracking. We do not sell your personal data to third parties. For full details on our data handling practices, please refer to our Privacy Policy below.
        </Text>

        <Text style={styles.heading}>5. Shop Orders</Text>
        <Text style={styles.paragraph}>
          Products ordered through Kwickly's shop delivery feature are subject to availability at the respective local stores. Delivery times are estimates and may vary based on traffic and store preparation times.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.title}>Privacy Policy</Text>

        <Text style={styles.heading}>Data Collection</Text>
        <Text style={styles.paragraph}>
          We collect personal information such as your name, phone number, email, and address to facilitate services. Payment information is securely handled by our payment processors and is not stored on our servers.
        </Text>

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
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  lastUpdated: { fontSize: 13, color: theme.colors.textDim, marginBottom: 24 },
  heading: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, color: theme.colors.textDim, lineHeight: 22 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 30 },
});

export default PrivacyScreen;
