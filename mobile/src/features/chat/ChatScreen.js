import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { chatService } from '../../services/chatService';
import { Send, Phone, MoreVertical, ChevronLeft, Image as ImageIcon } from 'lucide-react-native';

const ChatScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  // partnerId could be customer or admin, jobId if it's for a specific job
  const { partnerId, partnerName = 'User', partnerRole, jobId } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    // Here we would typically also set up Socket.io listeners
    // socket.on('NEW_MESSAGE', handleNewMessage);
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await chatService.getChatHistory({ partnerId, jobId });
      setMessages(res.data || []);
    } catch (error) {
      console.error('Failed to load chat', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await chatService.sendMessage({ receiverId: partnerId, jobId, text });
      setMessages(prev => [...prev, res.data]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    // Determine if message is mine
    // Assuming backend returns senderId object with _id, or just string. Let's assume we match logic.
    // If senderId matches partnerId, it's not mine. Else it is mine.
    const isPartner = item.senderId === partnerId || item.senderId?._id === partnerId;
    
    return (
      <View style={[styles.msgBubble, isPartner ? styles.msgPartner : styles.msgMine]}>
        <Text style={[styles.msgText, isPartner ? styles.msgTextPartner : styles.msgTextMine]}>
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.surface} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{partnerName}</Text>
          <Text style={styles.headerSub}>{partnerRole || 'Customer'}</Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Phone color={theme.colors.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MoreVertical color={theme.colors.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item._id || Math.random().toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No messages yet. Send a message to start!</Text>
            }
          />
        )}

        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.attachBtn}>
            <ImageIcon color={theme.colors.textDim} size={24} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textDim}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#001016" size="small" />
            ) : (
              <Send color="#001016" size={20} style={{marginLeft: -2}} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border
  },
  backBtn: { marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  headerSub: { fontSize: 13, color: theme.colors.textDim },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 18 },
  keyboardView: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  emptyText: { textAlign: 'center', color: theme.colors.textDim, marginTop: 40 },
  msgBubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 12 },
  msgPartner: { backgroundColor: theme.colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  msgMine: { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextPartner: { color: theme.colors.text },
  msgTextMine: { color: '#001016' },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border
  },
  attachBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: theme.colors.background,
    borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 16, color: theme.colors.text, marginHorizontal: 8, borderWidth: 1, borderColor: theme.colors.border
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center'
  }
});

export default ChatScreen;
