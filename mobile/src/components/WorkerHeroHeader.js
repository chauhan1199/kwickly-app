import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MapPin, Bell, Package } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from './ui/SearchBar';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const PURPLE = '#6C47FF';

const WorkerHeroHeader = ({ searchQuery, setSearchQuery }) => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const firstName = user?.name?.split(' ')[0] || 'Worker';
  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const displayLocation = primaryAddress 
    ? `${primaryAddress.area ? primaryAddress.area + ', ' : ''}${primaryAddress.city || ''}`
    : (user?.city || 'Select Location');

  return (
    <View style={{ zIndex: 10 }}>
      <LinearGradient
        colors={[PURPLE, '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroGradient, { paddingTop: Math.max(insets.top, 16) + 16 }]}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        {/* Top row: location + bell/cart */}
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.locationRow} activeOpacity={0.8} onPress={() => navigation.navigate('Profile')}>
            <MapPin size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
            <Text style={styles.locationCaret}>  ⌄</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications')}>
              <Bell size={22} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting + mascot row */}
        <View style={styles.heroMiddleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>Hi, {firstName}! 👋</Text>
            <Text style={styles.heroSubtitle}>{searchQuery !== undefined ? 'Let\'s complete more jobs today' : 'Ready to get more jobs today?'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            {user?.profileImage ? (
              <Image 
                source={{ uri: user.profileImage.startsWith('http') ? user.profileImage.replace('localhost', '10.0.2.2') : `http://10.0.2.2:5000${user.profileImage}` }}
                style={styles.heroMascot} 
                resizeMode="cover" 
              />
            ) : (
              <View style={[styles.heroMascot, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>{firstName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <Text style={{fontSize: 8}}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search bar component - overlapping the header and body (Only if search is enabled for the screen) */}
      {searchQuery !== undefined && (
        <View style={{ zIndex: 10 }}>
          <SearchBar 
            value={searchQuery}
            onChangeText={setSearchQuery}
            theme={theme}
            onFilterPress={() => {}}
            style={{ marginHorizontal: 20, marginTop: -26 }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  heroGradient: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  blob1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  locationCaret: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PURPLE,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  heroMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroMascot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 12,
  },
  heroGreeting: {
    fontSize: 26,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
    paddingRight: 12,
  },
});

export default WorkerHeroHeader;
