import React, { useState } from 'react';
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

const ALL_SERVICE_BOOKINGS = [
  {id:'SV001',t:'AC Service',sub:'Gas Refill',s:'Active',w:'Aman Singh',amt:'₹499',icon:'❄️',color:'#0E9AA7'},
  {id:'SV002',t:'Home Cleaning',sub:'Deep Clean',s:'Completed',w:'Sunil Verma',amt:'₹450',icon:'🧹',color:'#10b981'},
  {id:'SV003',t:'Plumbing – Tap Fix',sub:'Tap Repair',s:'Cancelled',w:'—',amt:'₹0',icon:'🔧',color:'#ef4444'},
  {id:'SV004',t:'Electrician – Fan',sub:'Fan Install',s:'Completed',w:'Rahul Das',amt:'₹349',icon:'⚡',color:'#10b981'},
];

const ALL_SHOP_ORDERS = [
  {id:'SO1040',shop:'Sharma General Store',s:'Delivered',amt:'₹758',icon:'🏪',color:'#10b981'},
  {id:'SO1038',shop:'Fresh Mart',s:'Out for Delivery',amt:'₹340',icon:'🥦',color:'#f5b300'},
  {id:'SO1035',shop:'Daily Needs',s:'Cancelled',amt:'₹0',icon:'🥛',color:'#ef4444'},
];

const QuotesScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [filter, setFilter] = useState('All');

  const filters = ['All', 'Active', 'Completed', 'Cancelled'];

  const svcAllow = { All: null, Active: ['Active'], Completed: ['Completed'], Cancelled: ['Cancelled'] };
  const ordAllow = { All: null, Active: ['Out for Delivery'], Completed: ['Delivered'], Cancelled: ['Cancelled'] };
  
  const svcs = svcAllow[filter] ? ALL_SERVICE_BOOKINGS.filter(b => svcAllow[filter].includes(b.s)) : ALL_SERVICE_BOOKINGS;
  const ords = ordAllow[filter] ? ALL_SHOP_ORDERS.filter(o => ordAllow[filter].includes(o.s)) : ALL_SHOP_ORDERS;

  const sc = { 
    Active: theme.colors.primary, 
    Completed: '#10b981', 
    Cancelled: '#ef4444', 
    Delivered: '#10b981', 
    'Out for Delivery': '#f5b300' 
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>My Bookings</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Services & orders</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      {/* Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{paddingHorizontal: 14}}>
        {filters.map((f, index) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.chipItem, isActive && styles.chipItemActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionHeader}>Services</Text>
        
        {svcs.length === 0 && (
          <Text style={styles.emptyText}>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}services</Text>
        )}

        {svcs.map(b => (
          <TouchableOpacity 
            key={b.id} 
            style={styles.card}
            onPress={() => navigation.navigate('PastJobDetails', { 
              job: { id: b.id, title: b.t, worker: b.w, price: b.amt.replace('₹', ''), rating: 5, date: 'Recent' } 
            })}
          >
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: (sc[b.s] || theme.colors.primary) + '26' }]}>
                <Text style={{fontSize: 22}}>{b.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{b.t}</Text>
                <Text style={styles.cardSub}>{b.sub} · {b.w}</Text>
                <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>{b.amt}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (sc[b.s] || theme.colors.textDim) + '26' }]}>
                <Text style={[styles.statusText, { color: sc[b.s] || theme.colors.textDim }]}>{b.s}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Shop Orders</Text>
        
        {ords.length === 0 && (
          <Text style={styles.emptyText}>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}orders</Text>
        )}

        {ords.map(o => (
          <TouchableOpacity 
            key={o.id} 
            style={styles.card}
            onPress={() => navigation.navigate('ShopOrderDetails', { order: o })}
          >
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98126' }]}>
                <Text style={{fontSize: 22}}>{o.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{o.shop}</Text>
                <Text style={styles.cardSub}>Order {o.id} · {o.amt}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (sc[o.s] || theme.colors.textDim) + '26' }]}>
                <Text style={[styles.statusText, { color: sc[o.s] || theme.colors.textDim }]}>{o.s}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

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
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 13,
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
  chipsScroll: {
    maxHeight: 40,
    minHeight: 40,
    marginBottom: 16,
  },
  chipItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    justifyContent: 'center',
  },
  chipItemActive: {
    backgroundColor: theme.colors.primary + '26',
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: theme.colors.primary,
  },
  content: {
    paddingHorizontal: 14,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: theme.colors.textDim,
    fontSize: 13,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  }
});

export default QuotesScreen;
