import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { Bell, CheckCheck, ChevronLeft, CircleAlert } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function ShopNotificationsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme);
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/my');
      if (res.data?.status === 'success') {
        setNotifications(res.data.data.notifications || []);
      }
    } catch (e) {
      console.log('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => 
        n._id === id ? { ...n, readBy: [...(n.readBy || []), user?._id] } : n
      ));
    } catch (e) {
      console.log('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({
        ...n,
        readBy: [...(n.readBy || []), user?._id]
      })));
    } catch (e) {
      console.log('Error marking all as read:', e);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Notifications</Text>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
          <CheckCheck size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

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
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 4,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  markAllBtn: {
    padding: 4,
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
