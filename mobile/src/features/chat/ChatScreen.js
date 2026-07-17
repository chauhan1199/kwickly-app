import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import api from '../../services/api';
import { Send, ChevronLeft, Image as ImageIcon, X } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import io from 'socket.io-client';

const BACKEND_URL = 'http://10.0.2.2:5000';
const API_URL = `${BACKEND_URL}/api/v1`;

// ─── Upload helper — base64 JSON (most reliable in React Native) ──────────────
const uploadImageBase64 = async (imageAsset, apiInstance) => {
  if (!imageAsset.base64) {
    throw new Error('No base64 data on image asset. Make sure includeBase64: true is set.');
  }
  const res = await apiInstance.post('/chat/upload-base64', {
    base64: imageAsset.base64,
    mimeType: imageAsset.type || 'image/jpeg',
    fileName: imageAsset.fileName || 'chat_image.jpg',
  });
  if (res.data?.status !== 'success') throw new Error(res.data?.message || 'Upload failed');
  return res.data.data.url;
};

// ─── Component ────────────────────────────────────────────────────────────────
const ChatScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { userToken: token, user } = useAuth();

  const {
    partnerId = 'admin',
    partnerName = 'Kwickly Support',
    partnerRole = 'Support Team',
    jobId,
  } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null | 0-100
  const [imageFile, setImageFile] = useState(null);

  const flatListRef = useRef(null);
  const socketRef = useRef(null);

  // ─── Load history ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await chatService.getChatHistory({ partnerId, jobId });
      setMessages(res.data?.data || []);
      
      // Mark as read
      try {
        const { default: apiInstance } = await import('../../services/api');
        await apiInstance.post('/chat/mark-read', { partnerId });
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    } catch (err) {
      console.error('[Chat] fetchHistory error:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [partnerId, jobId]);

  // ─── Socket setup ────────────────────────────────────────────────────────────
  const setupSocket = useCallback(() => {
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connect error:', err.message);
    });

    // Admin reply lands here
    socket.on('NEW_MESSAGE', (message) => {
      const fromAdmin = !message.senderId;
      const fromPartner =
        message.senderId &&
        (message.senderId === partnerId || message.senderId?._id === partnerId);

      if (fromAdmin || fromPartner) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    socketRef.current = socket;
    return socket;
  }, [token, partnerId]);

  useEffect(() => {
    fetchHistory();
    const socket = setupSocket();
    return () => {
      socket?.disconnect();
    };
  }, [fetchHistory, setupSocket]);

  // ─── Image picker ────────────────────────────────────────────────────────────
  const selectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
      includeBase64: true, // Required for base64 upload
      maxWidth: 1024,
      maxHeight: 1024,
    });
    if (!result.didCancel && result.assets?.length > 0) {
      setImageFile(result.assets[0]);
    }
  };

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend && !imageFile) return;

    setInputText('');
    setSending(true);

    try {
      let mediaUrl = null;

      // Step 1: Upload image if selected
      if (imageFile) {
        setUploadProgress(0);
        console.log('[Chat] Uploading image as base64…');
        try {
          mediaUrl = await uploadImageBase64(imageFile, api);
          console.log('[Chat] Upload success, url:', mediaUrl);
        } catch (uploadErr) {
          console.error('[Chat] Image upload failed:', uploadErr.message);
          Alert.alert('Upload Failed', `Could not upload image: ${uploadErr.message}`);
          setSending(false);
          setUploadProgress(null);
          return;
        }
        setUploadProgress(null);
        setImageFile(null);
      }

      // Step 2: Send message (text + optional mediaUrl)
      const payload = {
        receiverId: partnerId,
        jobId: jobId || undefined,
        text: textToSend || '',
        mediaUrl: mediaUrl || undefined,
      };

      console.log('[Chat] Sending message:', payload);
      const res = await chatService.sendMessage(payload);
      const newMsg = res.data?.data;

      if (newMsg) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message;
      console.error('[Chat] Send failed:', errMsg);
      Alert.alert('Error', `Failed to send: ${errMsg}`);
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  // ─── Render a single message bubble ─────────────────────────────────────────
  const getMediaUrl = (url) => {
    if (!url) return null;
    // If it's a relative URL, just prepend BACKEND_URL (which is 10.0.2.2)
    if (!url.startsWith('http')) return `${BACKEND_URL}${url}`;
    
    // If the backend sent an absolute URL with 'localhost', replace it with 10.0.2.2 for the emulator
    if (Platform.OS === 'android' && url.includes('localhost')) {
      return url.replace('localhost', '10.0.2.2');
    }
    
    return url;
  };

  const renderMessage = ({ item }) => {
    const myId = user?._id;
    const senderId = item.senderId?._id || item.senderId;
    const isMine = senderId && senderId === myId;

    return (
      <View style={[styles.msgWrapper, isMine ? styles.wrapMine : styles.wrapOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.mediaUrl ? (
            <Pressable onPress={() => setSelectedImage(getMediaUrl(item.mediaUrl))}>
              <Image
                source={{ uri: getMediaUrl(item.mediaUrl) }}
                style={styles.msgImage}
                resizeMode="cover"
                onError={(e) => console.log('[Chat] Image Load Error:', e.nativeEvent.error)}
              />
            </Pressable>
          ) : null}
          {!!item.text && item.text !== '📸 Image' ? (
            <Text style={[styles.msgText, isMine ? styles.textMine : styles.textOther]}>
              {item.text}
            </Text>
          ) : null}
          <Text style={[styles.msgTime, isMine ? styles.timeMine : styles.timeOther]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient 
        colors={['#6C47FF', '#8B6FFF']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{partnerName}</Text>
          <Text style={styles.headerSub}>{partnerRole}</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, i) => item._id || String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />
        )}

        {/* Input area */}
        <View style={styles.inputArea}>
          {/* Image preview */}
          {imageFile ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageFile.uri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.removeImg}
                onPress={() => setImageFile(null)}
              >
                <X color="#fff" size={14} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Upload progress */}
          {uploadProgress !== null ? (
            <Text style={styles.uploadingText}>Uploading image…</Text>
          ) : null}

          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={selectImage}>
              <ImageIcon color={theme.colors.textDim} size={24} />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor={theme.colors.textDim}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                !inputText.trim() && !imageFile ? styles.sendBtnDisabled : null,
              ]}
              onPress={handleSend}
              disabled={(!inputText.trim() && !imageFile) || sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Send color="#fff" size={18} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop:
        Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10,
    },
    backBtn: { marginRight: 12 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { color: theme.colors.textDim, textAlign: 'center', fontSize: 14 },
    chatList: { padding: 16, flexGrow: 1, paddingBottom: 8 },

    // message bubbles
    msgWrapper: { width: '100%', marginBottom: 12 },
    wrapMine: { alignItems: 'flex-end' },
    wrapOther: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '80%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
    },
    bubbleMine: {
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: isDarkMode ? '#1e1e2e' : '#f0f2f5',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
    msgText: { fontSize: 15, lineHeight: 21 },
    textMine: { color: '#fff' },
    textOther: { color: theme.colors.text },
    msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    timeMine: { color: 'rgba(255,255,255,0.6)' },
    timeOther: { color: theme.colors.textDim },

    // input
    inputArea: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    },
    previewWrap: {
      position: 'relative',
      marginBottom: 10,
      alignSelf: 'flex-start',
    },
    preview: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.primary },
    removeImg: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: '#e53935',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadingText: { color: theme.colors.textDim, fontSize: 12, marginBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
    attachBtn: {
      width: 42,
      height: 42,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      backgroundColor: isDarkMode ? '#1a1a24' : '#f0f2f5',
      borderRadius: 21,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      fontSize: 15,
      color: theme.colors.text,
      marginHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseBtn: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20,
      right: 20,
      zIndex: 10,
      padding: 10,
    },
    modalCloseText: {
      color: '#fff',
      fontSize: 28,
      fontWeight: 'bold',
    },
    modalImage: {
      width: '100%',
      height: '80%',
    },
  });

export default ChatScreen;
