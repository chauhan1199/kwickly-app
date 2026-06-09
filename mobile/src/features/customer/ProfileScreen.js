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
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const ProfileScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const styles = createStyles(theme, isDarkMode);

  // Generate initials
  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const menuItems = [
    { id: 1, title: 'Saved Addresses', sub: '2 saved', icon: '📍', color: '#ef4444' },
    { id: 2, title: 'Payment Methods', sub: '2 methods', icon: '💳', color: '#3b82f6' },
    { id: 3, title: 'Refer & Earn', sub: '₹100 per friend', icon: '🎁', color: '#f5b300' },
    { id: 4, title: 'Help & Support', sub: '24/7 available', icon: '💬', color: '#ec4899' },
    { id: 5, title: 'T&C / Privacy', sub: '', icon: '📄', color: '#f97316' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>My Profile</Text>
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
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.profileImage ? (
              <Image source={{ uri: 'http://10.0.2.2:5000' + user.profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
            )}
            <View style={styles.proBadge}>
              <Text style={{fontSize: 10}}>👑</Text>
            </View>
          </View>
          
          <Text style={styles.name}>{user?.name || 'New Customer'}</Text>
          <Text style={styles.phone}>Customer since {new Date(user?.createdAt || Date.now()).getFullYear()} · {user?.phone || '+91 00000 00000'}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.jobs?.length || 0}</Text>
              <Text style={styles.statLabel}>Jobs</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.rating?.average || '0.0'}★</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>New</Text>
              <Text style={styles.statLabel}>Member</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editBtnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuItem}
              onPress={() => {
                if (item.id === 1) {
                  navigation.navigate('SavedAddresses');
                } else if (item.id === 2) {
                  navigation.navigate('PaymentMethods');
                } else if (item.id === 3) {
                  navigation.navigate('ReferEarn');
                } else if (item.id === 4) {
                  navigation.navigate('HelpSupport');
                } else if (item.id === 5) {
                  navigation.navigate('Privacy');
                }
              }}
            >
              <View style={styles.menuRow}>
                <View style={[styles.menuIconBox, { backgroundColor: item.color + '1A' }]}>
                  <Text style={{fontSize: 20}}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {!!item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity style={[styles.menuContainer, { marginTop: -8 }]} onPress={signOut}>
          <View style={styles.menuItem}>
            <View style={styles.menuRow}>
              <View style={[styles.menuIconBox, { backgroundColor: '#ef44441A' }]}>
                <Text style={{fontSize: 20}}>🚪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuTitle, { color: '#ef4444' }]}>Log Out</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </View>
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
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#86efac',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#064e3b',
  },
  proBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  editBtn: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  menuContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  menuSub: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  menuArrow: {
    fontSize: 24,
    color: theme.colors.textDim,
  },
  logoutBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  }
});

export default ProfileScreen;
