import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Moon, Sun, Package, User, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

/**
 * Universal AppBar for Kwickly customer screens.
 *
 * Props:
 *  showBack        – show back arrow instead of logo (default false)
 *  onBackPress     – override back handler
 *  title           – override title text shown next to logo or after back arrow
 *  subtitle        – small grey subtitle below title
 *  hideRightIcons  – hide all right-side icons (default false)
 */
const AppBar = ({
  showBack = false,
  onBackPress,
  title,
  subtitle,
  hideRightIcons = false,
  transparent = false,
}) => {
  const navigation = useNavigation();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 24;
  
  const iconBg = isDarkMode && !transparent ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;
  const textColor = transparent ? '#fff' : theme.colors.text;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : theme.colors.background,
          paddingTop: safeTop + 10,
          borderBottomColor: transparent ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'),
        },
      ]}
    >
      <StatusBar
        barStyle={transparent ? 'light-content' : (isDarkMode ? 'light-content' : 'dark-content')}
        backgroundColor={transparent ? 'transparent' : theme.colors.background}
        translucent={transparent}
      />

      {/* ── LEFT ── */}
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={textColor} />
          </TouchableOpacity>
        ) : (
          <Image
            source={require('../assets/logo.jpeg')}
            style={styles.logo}
            resizeMode="cover"
          />
        )}

        <View style={styles.brandBlock}>
          <Text style={[styles.brandName, { color: textColor }]} numberOfLines={1}>
            {title || 'Kwickly'}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, transparent && {color: 'rgba(255,255,255,0.8)'}]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── RIGHT ── */}
      {!hideRightIcons && (
        <View style={styles.right}>
          {/* Shop Orders */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={() => navigation.navigate('CustomerShopOrders')}
            activeOpacity={0.7}
          >
            <Package size={20} color={textColor} />
          </TouchableOpacity>

          {/* Dark / Light Toggle */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDarkMode ? (
              <Sun size={20} color={textColor} />
            ) : (
              <Moon size={20} color={textColor} />
            )}
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <User size={20} color={textColor} />
          </TouchableOpacity>

          {/* Bell — with real unread count badge */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Bell size={20} color={textColor} />
            {badgeLabel ? (
              <View style={[styles.badge, { borderColor: theme.colors.background }]}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandBlock: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 10,
  },
});

export default AppBar;
