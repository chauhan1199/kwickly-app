import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, Briefcase, ShoppingBag, Wallet, Star } from 'lucide-react-native';
import AppBar from '../../components/AppBar';
import api from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const TYPE_CONFIG = {
  JOB:    { icon: Briefcase,   color: '#0e9aa7', bg: '#e0f7fa' },
  BID:    { icon: Briefcase,   color: '#7c3aed', bg: '#ede9fe' },
  ORDER:  { icon: ShoppingBag, color: '#d97706', bg: '#fef3c7' },
  WALLET: { icon: Wallet,      color: '#059669', bg: '#d1fae5' },
  RATING: { icon: Star,        color: '#f59e0b', bg: '#fef9c3' },
};

const NotificationsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/my');
      if (response.data?.status === 'success') {
        const notifs = response.data.data.notifications.map(n => ({
          id: n._id,
          title: n.title,
          body: n.message,
          type: n.targetRole === 'WORKER' ? 'JOB' : 'ORDER', // Simplified mapping based on existing roles
          time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: n.readBy?.includes(user?._id) || false,
        }));
        setNotifications(notifs);
      }
    } catch (error) {
      console.log('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.log('Failed to mark all as read', e);
    }
  };

  const markRead = async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.read) return; // already read

    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.log('Failed to mark as read', e);
    }
  };

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.JOB;
    const Icon = cfg.icon;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
          <Icon size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{item.time}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.appBarSub}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <CheckCheck size={16} color={theme.colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color={theme.colors.textDim} />
            <Text style={styles.emptyText}>{loading ? "Loading..." : "No notifications yet"}</Text>
            <Text style={styles.emptyDesc}>You'll see job alerts, order updates, and payment info here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: theme.colors.background },
  appBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  appBarTitle:      { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  appBarSub:        { fontSize: 13, color: theme.colors.textDim, fontWeight: '600', marginTop: 2 },
  markAllBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.primary + '15' },
  markAllText:      { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  list:             { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  notifCard:        { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
  notifCardUnread:  { borderColor: theme.colors.primary + '40', backgroundColor: theme.colors.primary + '08' },
  notifIcon:        { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifTitle:       { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  notifTitleUnread: { fontWeight: '900', color: theme.colors.text },
  notifBody:        { fontSize: 13, color: theme.colors.textDim, lineHeight: 18, marginBottom: 6 },
  notifTime:        { fontSize: 11, color: theme.colors.textDim, fontWeight: '600' },
  unreadDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 4, flexShrink: 0 },
  emptyState:       { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyText:        { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  emptyDesc:        { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', lineHeight: 20 },
});

export default NotificationsScreen;
