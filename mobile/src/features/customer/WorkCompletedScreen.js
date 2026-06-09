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
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

const WorkCompletedScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { worker } = route.params || {};

  const w = worker || { name: 'Ramesh Kumar' };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Work Completed</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Review & Pay</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Completion Media */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Completion media by {w.name}</Text>
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

        {/* Invoice */}
        <View style={styles.card}>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceText}>Service charge</Text>
            <Text style={styles.invoiceTextBold}>₹499</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceMuted}>Platform fee (10%)</Text>
            <Text style={styles.invoiceMuted}>₹49</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceMuted}>GST (5%)</Text>
            <Text style={styles.invoiceMuted}>₹27</Text>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.invoiceRow}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalPrice}>₹575</Text>
          </View>
          
          <Text style={styles.autoSplitText}>
            Auto-split: Worker gets ₹450 · Platform ₹125 (instant wallet credit)
          </Text>
        </View>

        {/* Payment Buttons */}
        <View style={styles.payGrid}>
          <TouchableOpacity 
            style={styles.walletBtn}
            onPress={() => navigation.navigate('RateExperience', { worker: w })}
          >
            <Text style={styles.walletBtnText}>💰 Wallet (₹1240)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.upiBtn}
            onPress={() => navigation.navigate('RateExperience', { worker: w })}
          >
            <Text style={styles.upiBtnText}>Pay UPI ₹575</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.cardBtn}
          onPress={() => navigation.navigate('RateExperience', { worker: w })}
        >
          <Text style={styles.cardBtnText}>💳 Credit/Debit Card</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  invoiceTextBold: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  invoiceMuted: {
    color: theme.colors.textDim,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  totalText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  totalPrice: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  autoSplitText: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 8,
  },
  payGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  walletBtn: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  walletBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  upiBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upiBtnText: {
    color: '#001016',
    fontSize: 13,
    fontWeight: '800',
  },
  cardBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  }
});

export default WorkCompletedScreen;
