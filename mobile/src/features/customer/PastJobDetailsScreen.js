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

const PastJobDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { job } = route.params || {};

  // Mock data if no job is passed
  const j = job || {
    id: 'BK2033',
    title: 'Home Cleaning',
    worker: 'Priya Sharma',
    price: '599',
    rating: 5,
    date: '28 May'
  };

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
          <Text style={styles.appBarTitle} numberOfLines={1}>Booking Summary</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Job #{j.id}</Text>
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
        
        {/* Job Status Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Text style={{fontSize: 22}}>✅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{j.title}</Text>
              <Text style={styles.cardSub}>{j.date}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Worker Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Professional</Text>
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>{j.worker ? j.worker[0] : 'P'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.workerName}>{j.worker}</Text>
              <Text style={styles.workerRating}>
                <Text style={{ color: '#f5b300' }}>{'★'.repeat(typeof j.rating === 'object' ? Math.round(j.rating?.average || 5) : Math.round(j.rating || 5))}</Text>
                <Text style={{ color: theme.colors.textDim }}>{'☆'.repeat(5 - (typeof j.rating === 'object' ? Math.round(j.rating?.average || 5) : Math.round(j.rating || 5)))}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Invoice Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Payment Details</Text>
          <View style={{ marginTop: 12 }}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceText}>Service charge</Text>
              <Text style={styles.invoiceText}>₹{parseInt(j.price) - 50}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceMuted}>Taxes & Fees</Text>
              <Text style={styles.invoiceMuted}>₹50</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.invoiceRow}>
              <Text style={styles.totalText}>Total Paid</Text>
              <Text style={styles.totalPrice}>₹{j.price}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.rebookBtn} onPress={() => navigation.navigate('Book')}>
          <Text style={styles.rebookBtnText}>↺ Rebook Service</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.invoiceBtn}>
          <Text style={styles.invoiceBtnText}>📄 Download Invoice</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  workerRating: {
    fontSize: 14,
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
  rebookBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  rebookBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  invoiceBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  }
});

export default PastJobDetailsScreen;
