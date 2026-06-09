import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  TextInput
} from 'react-native';
import Theme from '../../constants/Theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { MapPin, ChevronDown, Bell, Search, Moon, Sun } from 'lucide-react-native';

const HomeHeader = ({ cityName = 'Mumbai, Maharashtra', onNotificationPress }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.locationContainer} activeOpacity={0.7}>
          <View style={styles.pinWrapper}>
            <MapPin size={18} color={Theme.colors.primary} />
          </View>
          <View style={styles.locationTextContainer}>
            <View style={styles.row}>
              <Text style={styles.locationTitle}>Your Location</Text>
              <ChevronDown size={14} color={Theme.colors.textMuted} />
            </View>
            <Text style={styles.cityName} numberOfLines={1}>{cityName}</Text>
          </View>
        </TouchableOpacity>

        <View style={{flexDirection: 'row', gap: 12}}>
          <TouchableOpacity 
            style={styles.notificationBtn} 
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDarkMode ? (
              <Sun size={24} color={Theme.colors.text} />
            ) : (
              <Moon size={24} color={Theme.colors.text} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.notificationBtn} 
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <Bell size={24} color={Theme.colors.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.9}>
          <Search size={20} color={Theme.colors.textDim} />
          <Text style={styles.searchPlaceholder}>Search for "AC cleaning"...</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    backgroundColor: Theme.colors.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pinWrapper: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  locationTextContainer: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: 10,
    color: Theme.colors.textDim,
    fontWeight: Theme.typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cityName: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.text,
    fontWeight: Theme.typography.weights.semiBold,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.danger,
    borderWidth: 1.5,
    borderColor: Theme.colors.card,
  },
  searchContainer: {
    marginBottom: Theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  searchPlaceholder: {
    marginLeft: Theme.spacing.sm,
    color: Theme.colors.textDim,
    fontSize: Theme.typography.sizes.md,
  },
});

export default HomeHeader;
