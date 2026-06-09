import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Image
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const WorkerProfileScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { worker } = route.params || {};
  const w = worker || { 
    id: 'w1', 
    name: 'Ramesh Kumar', 
    rating: 4.8, 
    jobs: 312, 
    price: 399, 
    eta: 25, 
    verified: true, 
    dist: '1.2 km', 
    cat: 'AC & HVAC' 
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
          <Text style={styles.appBarTitle} numberOfLines={1}>Professional Profile</Text>
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
        
        {/* Header Profile */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{w.name ? w.name[0] : 'W'}</Text>
          </View>
          <Text style={styles.workerNameLarge}>{w.name || 'Worker'}</Text>
          <Text style={styles.workerCat}>{w.cat} Expert</Text>
          {w.verified && (
            <View style={styles.kycBadge}>
              <Text style={styles.kycBadgeText}>✓ Verified Professional</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>★ {typeof w.rating === 'object' ? (w.rating?.average || 0) : (w.rating || 4.5)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{w.jobs}</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{w.dist}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About {w.name.split(' ')[0]}</Text>
          <Text style={styles.aboutText}>
            Highly skilled and reliable professional with extensive experience in {w.cat}. 
            Known for punctuality, quality of work, and excellent customer service.
            Fully equipped with necessary tools.
          </Text>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <Text style={styles.viewAllText}>View All</Text>
          </View>
          
          <View style={styles.reviewCard}>
            <View style={styles.row}>
              <View style={styles.reviewerAvatar}>
                <Text style={styles.reviewerAvatarText}>S</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.reviewerName}>Sanjay Patel</Text>
                <Text style={styles.reviewStars}>★★★★★ <Text style={styles.reviewDate}>· 2 days ago</Text></Text>
              </View>
            </View>
            <Text style={styles.reviewText}>
              Very professional and quick. Did a great job with the repair and cleaned up afterwards. Highly recommended!
            </Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomPrice}>₹{w.price}</Text>
          <Text style={styles.bottomEta}>Arrives in ~{w.eta} mins</Text>
        </View>
        <TouchableOpacity 
          style={styles.bookBtn} 
          onPress={() => navigation.navigate('DescribeJob', { 
            category: { name: w.cat }, 
            subcategory: 'Direct Booking',
            selectedWorker: w 
          })}
        >
          <Text style={styles.bookBtnText}>Select Professional</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 10,
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
    paddingTop: 10,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  workerNameLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  workerCat: {
    fontSize: 15,
    color: theme.colors.textDim,
    marginBottom: 12,
  },
  kycBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  kycBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 14,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  section: {
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    color: theme.colors.textDim,
    lineHeight: 22,
  },
  viewAllText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  reviewStars: {
    color: '#f5b300',
    fontSize: 12,
  },
  reviewDate: {
    color: theme.colors.textDim,
  },
  reviewText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginTop: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bottomPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  bottomEta: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bookBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bookBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default WorkerProfileScreen;
