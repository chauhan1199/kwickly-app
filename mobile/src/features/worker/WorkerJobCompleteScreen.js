import React from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  StatusBar,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { CheckCircle2, ArrowRight, Home, Star, ShieldCheck } from 'lucide-react-native';

const WorkerJobCompleteScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);

  const { job, quoteAmount } = route.params || {};

  const amount = quoteAmount || job?.payment?.workerPayout || job?.payment?.amount || job?.budget || 0;
  const commission = 0; // 0% Partner Commission in Kwickly
  const earning = amount;

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Text */}
        <View style={styles.headerBox}>
          <View style={styles.successBadge}>
            <CheckCircle2 size={16} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={styles.successBadgeText}>WORK MARKED COMPLETED</Text>
          </View>
          <Text style={styles.mainTitle}>Job Complete!</Text>
          <Text style={styles.mainSub}>Awaiting customer payment release & review</Text>
        </View>

        {/* Celebration Graphic */}
        <View style={styles.graphicBox}>
          <Text style={styles.graphicEmoji}>🎉</Text>
          <Text style={styles.congratsText}>Great job, partner!</Text>
          <Text style={styles.congratsSub}>The customer has been notified and can finalize payment now</Text>
        </View>

        {/* Pricing Summary (0% Partner Commission) */}
        <View style={styles.pricingBox}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Agreed Quote</Text>
              <Text style={styles.priceSub}>Platform Fee (0% Partner Commission)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceValPositive}>₹{amount}</Text>
              <Text style={[styles.priceValNegative, { color: '#10B981' }]}>₹0</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.earningLabel}>Your Net Earning</Text>
              <Text style={styles.earningNote}>100% credited directly to your wallet</Text>
            </View>
            <Text style={styles.earningVal}>₹{earning}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#6C47FF', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneBtnGradient}
            >
              <Home size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.doneBtnText}>Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => navigation.navigate('WorkerRateCustomer', { job, quoteAmount })}
            activeOpacity={0.8}
          >
            <Star size={18} color="#6C47FF" style={{ marginRight: 8 }} />
            <Text style={styles.rateBtnText}>Rate Customer →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (theme, isDarkMode, safeTop) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' 
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: safeTop + 20 
  },
  headerBox: {
    marginBottom: 24,
    alignItems: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  successBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  mainSub: {
    fontSize: 13.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  graphicBox: {
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  graphicEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  congratsText: {
    fontSize: 20,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 4,
  },
  congratsSub: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
  },
  pricingBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', 
    padding: 20, 
    borderRadius: 22,
    borderWidth: 1.2, 
    borderColor: isDarkMode ? '#334155' : '#EEF2F6', 
    marginBottom: 28,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  priceSub: { fontSize: 11.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 3 },
  priceValPositive: { fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  priceValNegative: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  divider: { height: 1, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', marginVertical: 14 },
  earningLabel: { fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  earningNote: { fontSize: 11, color: '#10B981', marginTop: 3, fontWeight: '600' },
  earningVal: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  actionsContainer: {
    gap: 12,
  },
  doneBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  rateBtnText: {
    color: '#6C47FF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default WorkerJobCompleteScreen;
