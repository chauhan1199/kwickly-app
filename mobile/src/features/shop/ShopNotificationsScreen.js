import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { shopService } from '../../services/shopService';
import { Bell, CheckCheck, ChevronLeft, CircleAlert } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function ShopNotificationsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await shopService.getMyNotifications();
      if (res.data?.status === 'success') {
        setNotifications(res.data.data.notifications || []);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await shopService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => 
        n._id === id ? { ...n, readBy: [...(n.readBy || []), user?._id] } : n
      ));
    } catch (e) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await shopService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({
        ...n,
        readBy: [...(n.readBy || []), user?._id]
      })));
    } catch (e) {
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = !item.readBy?.includes(user?._id);
    return (
      <TouchableOpacity 
        style={[styles.notifCard, isUnread && styles.notifCardUnread]} 
        onPress={() => isUnread && markAsRead(item._id)}
      >
        <View style={styles.iconBox}>
          {item.type === 'BROADCAST' ? <Bell size={20} color={theme.colors.primary} /> : <CircleAlert size={20} color={theme.colors.primary} />}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isUnread && styles.titleUnread]}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />
      <LinearGradient colors={['#7C3AED', '#6C47FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          {/* ── App Bar ── */}
          <View style={styles.appBar}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity 
                style={styles.backBtn} 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <ChevronLeft size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.appBarTitle} numberOfLines={1}>Notifications</Text>
                <Text style={styles.appBarSubtitle}>Your shop alerts</Text>
              </View>
            </View>
            <View style={styles.appBarActions}>
              <TouchableOpacity 
                style={styles.appBarIconBtn} 
                onPress={markAllAsRead}
                activeOpacity={0.7}
              >
                <CheckCheck size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' }}>
        {loading ? (
          <View style={styles.center}><Text style={{ color: theme.colors.textDim }}>Loading...</Text></View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}><Text style={{ color: theme.colors.textDim }}>No notifications yet.</Text></View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#6C47FF']}
                tintColor="#6C47FF"
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  appBarSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notifCardUnread: {
    backgroundColor: theme.colors.primary + '10', // Light tint
    borderColor: theme.colors.primary + '30',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  time: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
    marginTop: 6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
