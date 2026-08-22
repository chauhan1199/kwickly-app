import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Moon, Sun, Package, User, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { KwicklyIcon } from './ui/KwicklyBrand';

/**
 * Universal AppBar for Kwickly customer screens.
 */
const AppBar = ({
  showBack = false,
  onBackPress,
  title,
  subtitle,
  hideRightIcons = false,
  transparent = false,
  showLogo = true,
  showCart = false,
  showProfile = false,
  showThemeToggle = true,
  showNotifications = true,
  customRight = null,
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
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  
  const iconBg = isDarkMode && !transparent ? 'rgba(255,255,255,0.08)' : (transparent ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)');
  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;
  const textColor = transparent ? '#FFF' : theme.colors.text;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : theme.colors.background,
          paddingTop: safeTop + 8,
          borderBottomColor: transparent ? 'transparent' : (isDarkMode ? '#1E293B' : '#EDF2F7'),
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
        ) : showLogo ? (
          <KwicklyIcon size={32} />
        ) : null}

        <View style={styles.brandBlock}>
          <Text style={[styles.brandName, { color: textColor }]} numberOfLines={1}>
            {title || (
              <Text>
                Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
              </Text>
            )}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: transparent ? 'rgba(255,255,255,0.85)' : theme.colors.textDim }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── RIGHT ── */}
      {!hideRightIcons && (
        <View style={styles.right}>
          {customRight ? (
            customRight
          ) : (
            <>
              {/* Shop Orders */}
              {showCart && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: iconBg }]}
                  onPress={() => navigation.navigate('CustomerShopOrders')}
                  activeOpacity={0.7}
                >
                  <Package size={18} color={textColor} />
                </TouchableOpacity>
              )}

              {/* Dark / Light Toggle */}
              {showThemeToggle && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: iconBg }]}
                  onPress={toggleTheme}
                  activeOpacity={0.7}
                >
                  {isDarkMode ? (
                    <Sun size={18} color="#F59E0B" />
                  ) : (
                    <Moon size={18} color={transparent ? '#FFF' : '#6C47FF'} />
                  )}
                </TouchableOpacity>
              )}

              {/* Profile */}
              {showProfile && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: iconBg }]}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.7}
                >
                  <User size={18} color={textColor} />
                </TouchableOpacity>
              )}

              {/* Bell — with real unread count badge */}
              {showNotifications && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: iconBg }]}
                  onPress={() => navigation.navigate('Notifications')}
                  activeOpacity={0.7}
                >
                  <Bell size={18} color={textColor} />
                  {badgeLabel ? (
                    <View style={[styles.badge, { borderColor: theme.colors.background }]}>
                      <Text style={styles.badgeText}>{badgeLabel}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
            </>
          )}
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    flexShrink: 0,
  },
  brandBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 17.5,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
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
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 10,
  },
});

export default AppBar;
