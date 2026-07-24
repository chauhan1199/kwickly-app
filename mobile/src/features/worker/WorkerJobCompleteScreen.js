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
import LinearGradient from 'react-native-linear-gradient';

const WorkerJobCompleteScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const { job, quoteAmount } = route.params || {};

  const amount = quoteAmount || job?.payment?.amount || 499;
  const commissionRate = job?.commissionRate || 0.1;
  const commission = Math.round(amount * commissionRate);
  const earning = amount - commission;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Text */}
        <View style={styles.headerBox}>
          <Text style={styles.mainTitle}>Job Complete!</Text>
          <Text style={styles.mainSub}>Awaiting customer payment</Text>
        </View>

        {/* Celebration Graphic */}
        <View style={styles.graphicBox}>
          <Text style={styles.graphicEmoji}>🎉</Text>
          <Text style={styles.congratsText}>Great work!</Text>
          <Text style={styles.congratsSub}>Customer is reviewing the completion media</Text>
        </View>

        {/* Completion Media */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Completion media submitted</Text>
          <View style={styles.mediaGrid}>
            <LinearGradient colors={['#8b5cf6', '#06b6d4']} style={styles.mediaTileFilled}>
              <Text style={styles.mediaTileText}>✓ Before</Text>
            </LinearGradient>
            <LinearGradient colors={['#8b5cf6', '#06b6d4']} style={styles.mediaTileFilled}>
              <Text style={styles.mediaTileText}>✓ After</Text>
            </LinearGradient>
            <LinearGradient colors={['#8b5cf6', '#06b6d4']} style={styles.mediaTileFilled}>
              <Text style={styles.mediaTileText}>🎥 Video</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingBox}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Bid amount</Text>
              <Text style={styles.priceSub}>Commission ({Math.round(commissionRate * 100)}%)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceValPositive}>₹{amount}</Text>
              <Text style={styles.priceValNegative}>-₹{commission}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.earningLabel}>Your earning</Text>
              <Text style={styles.earningNote}>Auto-credited on customer payment</Text>
            </View>
            <Text style={styles.earningVal}>₹{earning}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.doneBtnText}>Done - Back Home</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => navigation.navigate('WorkerRateCustomer')}
          >
            <Text style={styles.rateBtnText}>Rate Customer →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 40 },
  headerBox: {
    marginBottom: 40,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
  },
  mainSub: {
    fontSize: 15,
    color: theme.colors.textDim,
    marginTop: 4,
  },
  graphicBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  graphicEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  congratsSub: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  pricingBox: {
    backgroundColor: theme.colors.surface, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaTileFilled: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTileText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  priceSub: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
  priceValPositive: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  priceValNegative: { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  earningLabel: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  earningNote: { fontSize: 11, color: theme.colors.textDim, marginTop: 4 },
  earningVal: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  actionsContainer: {
    gap: 16,
  },
  doneBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  rateBtn: {
    backgroundColor: theme.colors.background,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  rateBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerJobCompleteScreen;
