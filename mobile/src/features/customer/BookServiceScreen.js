import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { jobService } from '../../services/jobService';
import { customerService } from '../../services/customerService';
import GlassCard from '../../components/ui/GlassCard';

const BookServiceScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const chips = ['🔥 Popular', '🏠 Home', '🚗 Vehicle', '💄 Beauty', '🌿 Garden', '💻 Tech'];

  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [catRes, workerRes] = await Promise.all([
        jobService.getCategories(),
        customerService.getTopPros()
      ]);

      if (catRes.data?.status === 'success') {
        const mappedCats = catRes.data.data.map(c => ({
          id: c._id,
          icon: c.icon,
          name: c.name,
          subs: c.subcategories.map(s => s.name)
        }));
        setCategories(mappedCats);
      }

      if (workerRes.data?.status === 'success') {
        const mappedWorkers = workerRes.data.data.map(w => ({
          id: w._id,
          name: w.name,
          rating: w.rating || 4.5,
          jobs: w.jobs || 0,
          price: 299, // default base price
          eta: Math.floor(Math.random() * 30) + 15, // Mock ETA
          verified: true,
          dist: '1.2 km', // Mock distance
          cat: w.services?.[0] || 'General'
        }));
        setWorkers(mappedWorkers);
      }
    } catch (e) {
      console.error('Error fetching dynamic data for BookService:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>Book a Service</Text>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Search */}
        <View style={{ paddingHorizontal: 14, marginBottom: 12 }}>
          <Input
            placeholder="Search plumber, AC, cleaning..."
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{paddingHorizontal: 14}}>
          {chips.map((chip, index) => (
            <TouchableOpacity key={index} style={styles.chipItem}>
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>All Service Categories</Text>
          
          <View style={styles.gridContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20, width: '100%' }} />
            ) : (
              categories.map((cat, index) => (
                <GlassCard key={cat.id || index} style={styles.catTile} isDarkMode={isDarkMode} onPress={() => navigation.navigate('SubCategories', cat)}>
                  <View style={styles.catIconBox}>
                    <Text style={styles.catIconText}>{cat.icon || '📌'}</Text>
                  </View>
                  <Text style={styles.catNameText}>{cat.name}</Text>
                </GlassCard>
              ))
            )}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Top Pros Near You</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
          ) : workers.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 10, color: theme.colors.textDim }}>No top pros available.</Text>
          ) : (
            workers.map((worker) => (
              <GlassCard
                key={worker.id} 
                style={styles.workerCard}
                isDarkMode={isDarkMode}
                onPress={() => navigation.navigate('WorkerProfile', { worker })}
              >
                <View style={styles.row}>
                  <View style={styles.workerAvatar}>
                    <Text style={styles.workerAvatarText}>{worker.name ? worker.name[0] : 'W'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={[styles.row, { gap: 6 }]}>
                      <Text style={styles.workerName}>{worker.name || 'Worker'}</Text>
                      {worker.verified && (
                        <View style={styles.kycChip}>
                          <Text style={styles.kycChipText}>✓ KYC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.workerStars}>
                      <Text style={{ color: '#f5b300' }}>★★★★★</Text>
                      <Text style={styles.workerMuted}> {typeof worker.rating === 'object' ? (worker.rating?.average || 0) : (worker.rating || 4.5)} · {worker.jobs} jobs</Text>
                    </Text>
                    <Text style={styles.workerMuted}>📍 {worker.dist} · ⏱ {worker.eta} min away</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.workerPrice}>₹{worker.price}</Text>
                    <TouchableOpacity 
                      style={styles.viewBtn}
                      onPress={() => navigation.navigate('WorkerProfile', { worker })}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            ))
          )}

        </View>

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
    paddingBottom: 8,
    gap: 8,
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
    flex: 1,
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
    paddingTop: 4,
  },
  searchBar: {
    marginHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: isDarkMode ? theme.colors.surface : '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
  },
  chipsScroll: {
    marginBottom: 14,
  },
  chipItem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  catTile: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  catIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  catIconText: {
    fontSize: 26,
  },
  catNameText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  workerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  workerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontWeight: '800',
    fontSize: 14,
    color: theme.colors.text,
  },
  kycChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kycChipText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  workerStars: {
    fontSize: 12,
    marginVertical: 4,
  },
  workerMuted: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  workerPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  viewBtn: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 6,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  }
});

export default BookServiceScreen;
