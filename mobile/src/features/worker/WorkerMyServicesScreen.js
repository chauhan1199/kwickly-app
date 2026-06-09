import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';

const mockServices = [
  {
    id: 1,
    title: 'AC Service',
    price: '₹499',
    location: 'A-12 Sector 21',
    status: 'Pending',
    subtext: '⏳ Awaiting customer',
    avatar: 'A',
    color: '#0ea5e9'
  },
  {
    id: 2,
    title: 'Plumbing',
    price: '₹350',
    location: 'Connaught Place',
    status: 'Canceled',
    subtext: '❌ Canceled by customer',
    avatar: 'P',
    color: '#06b6d4'
  },
  {
    id: 3,
    title: 'Cleaning',
    price: '₹450',
    location: 'Lajpat Nagar',
    status: 'Completed',
    subtext: '✅ Service completed',
    avatar: 'C',
    color: '#14b8a6'
  },
  {
    id: 4,
    title: 'Electrical',
    price: '₹280',
    location: 'Karol Bagh',
    status: 'In Progress',
    subtext: '🛠️ Currently working',
    avatar: 'E',
    color: '#0ea5e9'
  }
];

const WorkerMyServicesScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const styles = createStyles(theme, isDarkMode);

  const tabs = ['All', 'Pending', 'In Progress', 'Completed', 'Canceled'];

  const filteredServices = mockServices.filter(s => activeTab === 'All' || s.status === activeTab);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return { bg: '#fef3c7', text: '#d97706' };
      case 'Completed': return { bg: '#d1fae5', text: '#059669' };
      case 'Canceled': return { bg: '#fee2e2', text: '#dc2626' };
      case 'In Progress': return { bg: '#dbeafe', text: '#2563eb' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      <AppBar title="My Quotes" subtitle="Active and past services" />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {tabs.map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredServices.map((item) => {
          const statusStyle = getStatusColor(item.status);

          const handleServicePress = (status) => {
            switch(status) {
              case 'Pending':
                navigation.navigate('WorkerJobDetails');
                break;
              case 'In Progress':
                navigation.navigate('WorkerActiveJob');
                break;
              case 'Completed':
                navigation.navigate('WorkerJobComplete');
                break;
              case 'Canceled':
                navigation.navigate('WorkerJobCanceled');
                break;
              default:
                break;
            }
          };

          return (
            <TouchableOpacity 
              key={item.id} 
              style={styles.card}
              onPress={() => handleServicePress(item.status)}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                  <Text style={styles.avatarText}>{item.avatar}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title} · {item.price}</Text>
                  <Text style={styles.cardLocation}>{item.location}</Text>
                  <Text style={styles.cardSubtext}>{item.subtext}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  headerSub: { fontSize: 14, color: theme.colors.textDim, marginTop: 4 },
  filterContainer: { marginBottom: 15 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 10,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary + '1A',
    borderColor: theme.colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  filterTabTextActive: {
    color: theme.colors.primary,
  },
  scrollContent: { paddingHorizontal: 20 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  cardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardLocation: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  cardSubtext: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 6,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerMyServicesScreen;
