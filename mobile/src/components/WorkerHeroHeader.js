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
import { getImageUrl } from '../utils/helpers';
import { useNavigation } from '@react-navigation/native';

const PURPLE = '#6C47FF';

const WorkerHeroHeader = ({ searchQuery, setSearchQuery }) => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const displayName = user?.name ? user.name.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ') : 'Worker';
  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const displayLocation = primaryAddress 
    ? `${primaryAddress.area ? primaryAddress.area + ', ' : ''}${primaryAddress.city || ''}`
    : (user?.city || 'Select Location');

  return (
    <View style={{ zIndex: 10 }}>
      <LinearGradient
        colors={['#5830E0', '#7447FF', '#8F66FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroGradient, { paddingTop: Math.max(insets.top, 16) + 12 }]}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        {/* Top row: location + bell/notifications */}
        <View style={styles.heroTopRow}>
          <TouchableOpacity 
            style={styles.locationPill} 
            activeOpacity={0.85} 
            onPress={() => navigation.navigate('Profile')}
          >
            <MapPin size={13} color="#FFFFFF" />
            <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
            <Text style={styles.locationCaret}>▾</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity 
              style={styles.bellBtn} 
              activeOpacity={0.85} 
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell size={20} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting + avatar row */}
        <View style={styles.heroMiddleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroGreeting}>Hi, {displayName}! 👋</Text>
            <Text style={styles.heroSubtitle}>
              {searchQuery !== undefined ? 'Search and manage all your quotes' : 'Ready to accept more customer jobs today?'}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')} 
            activeOpacity={0.85}
            style={styles.avatarWrapper}
          >
            <View style={styles.avatarFrame}>
              {user?.profileImage ? (
                <Image
                  source={{ uri: getImageUrl(user.profileImage) }}
                  style={styles.heroMascot}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{displayName[0]?.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.cameraIconBadge}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search bar component (Only if search is enabled for the screen) */}
      {searchQuery !== undefined && (
        <View style={{ zIndex: 10 }}>
          <SearchBar 
            value={searchQuery}
            onChangeText={setSearchQuery}
            theme={theme}
            onFilterPress={() => {}}
            style={{ marginHorizontal: 20, marginTop: -24 }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  heroGradient: {
    paddingHorizontal: 18,
    paddingBottom: 38,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  blob1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blob2: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    maxWidth: '75%',
    gap: 6,
  },
  locationText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
    flexShrink: 1,
  },
  locationCaret: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '800',
  },
  bellBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7447FF',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  heroMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroGreeting: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    lineHeight: 18,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarFrame: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  heroMascot: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6C47FF',
  },
  avatarFallbackText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7447FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default WorkerHeroHeader;
