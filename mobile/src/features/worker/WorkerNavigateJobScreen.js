import React from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Phone, MessageCircle } from 'lucide-react-native';

const WorkerNavigateJobScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Navigate to Job</Text>
          <Text style={styles.appBarSub}>Anita</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Map Placeholder */}
        <View style={styles.mapContainer}>
          {/* Abstract map drawing */}
          <View style={styles.mapLine} />
          <View style={[styles.mapPin, { left: '25%', top: '65%', backgroundColor: '#0ea5e9' }]} />
          <View style={[styles.mapPin, { left: '75%', top: '35%', backgroundColor: '#ef4444' }]} />
          
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>🚗 25 min - 4.2 km</Text>
          </View>
        </View>

        {/* Customer Info Box */}
        <View style={styles.customerBox}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>Anita</Text>
            <Text style={styles.customerLocation}>📍 A-12 Sector 21</Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Phone size={18} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.colors.primary + '1A' }]}>
              <MessageCircle size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingBox}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Job amount</Text>
              <Text style={styles.priceSub}>Commission (10%)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceValPositive}>₹499</Text>
              <Text style={styles.priceValNegative}>-₹50</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <Text style={styles.earningLabel}>Your earning</Text>
            <Text style={styles.earningVal}>₹449</Text>
          </View>
        </View>

        {/* Arrived Action */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('WorkerArrivalOTP')}>
          <Text style={styles.actionBtnText}>✓ I've Arrived → Enter OTP</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
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
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  mapContainer: {
    height: 200, backgroundColor: '#DBEAFE', borderRadius: 24,
    marginBottom: 20, overflow: 'hidden', position: 'relative'
  },
  mapLine: {
    position: 'absolute', width: '55%', height: 2, backgroundColor: '#64748B',
    top: '50%', left: '25%', transform: [{ rotate: '-30deg' }]
  },
  mapPin: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    borderWidth: 3, borderColor: 'white',
    transform: [{ translateX: -10 }, { translateY: -10 }]
  },
  etaBadge: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  etaText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  customerBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#0ea5e9',
    justifyContent: 'center', alignItems: 'center'
  },
  avatarText: { color: 'white', fontSize: 20, fontWeight: '800' },
  customerInfo: { flex: 1, marginLeft: 16 },
  customerName: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  customerLocation: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center'
  },
  pricingBox: {
    backgroundColor: theme.colors.surface, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 24
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  priceSub: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
  priceValPositive: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  priceValNegative: { fontSize: 13, fontWeight: '600', color: '#ef4444', marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  earningLabel: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  earningVal: { fontSize: 20, fontWeight: '800', color: theme.colors.primary },
  actionBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center'
  },
  actionBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerNavigateJobScreen;
