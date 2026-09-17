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
  Keyboard,
  Dimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import api from '../../services/api';
import { Send, ChevronLeft, Image as ImageIcon, X, ShieldCheck } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import io from 'socket.io-client';
import { SOCKET_URL, API_BASE_URL } from '../../config/env';
import { getImageUrl } from '../../utils/helpers';

const { width } = Dimensions.get('window');

// ─── Upload helper — base64 JSON ─────────────────────────────────────────────
const uploadImageBase64 = async (imageAsset, apiInstance) => {
  if (!imageAsset.base64) {
    throw new Error('No base64 data on image asset. Make sure includeBase64: true is set.');
  }
  const mimeType = imageAsset.type || 'image/jpeg';
  const res = await apiInstance.post('/chat/upload-base64', {
    base64: `data:${mimeType};base64,${imageAsset.base64}`,
    mimeType,
    fileName: imageAsset.fileName || 'chat_image.jpg',
  });
  if (res.data?.status !== 'success') throw new Error(res.data?.message || 'Upload failed');
  return res.data.data.url;
};

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
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const flatListRef = useRef(null);
  const socketRef = useRef(null);

  // ─── Load history ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await chatService.getChatHistory({ partnerId, jobId });
      setMessages(res.data?.data || []);
      
      try {
        await chatService.markRead(partnerId);
      } catch (e) {
        // Non-critical, silently ignore
      }
    } catch (err) {
      console.log('[ChatScreen] Load error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [partnerId, jobId]);

  // ─── Socket setup ────────────────────────────────────────────────────────────
  const setupSocket = useCallback(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {});

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

    // Auto-scroll when mobile keyboard pops up
    const kbSub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      socket?.disconnect();
      kbSub.remove();
    };
  }, [fetchHistory, setupSocket]);

  // ─── Image picker ────────────────────────────────────────────────────────────
  const selectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: true,
      maxWidth: 1200,
      maxHeight: 1200,
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

      if (imageFile) {
        setUploadProgress(0);
        try {
          mediaUrl = await uploadImageBase64(imageFile, api);
        } catch (uploadErr) {
          Alert.alert('Upload Failed', `Could not upload image: ${uploadErr.message}`);
          setSending(false);
          setUploadProgress(null);
          return;
        }
        setUploadProgress(null);
        setImageFile(null);
      }

      const payload = {
        receiverId: partnerId,
        jobId: jobId || undefined,
        text: textToSend || '',
        mediaUrl: mediaUrl || undefined,
      };

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
      Alert.alert('Error', `Failed to send: ${errMsg}`);
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  const renderMessage = ({ item }) => {
    const myId = user?._id;
    const senderId = item.senderId?._id || item.senderId;
    const isMine = senderId && senderId === myId;

    return (
      <View style={[styles.msgWrapper, isMine ? styles.wrapMine : styles.wrapOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.mediaUrl ? (
            <Pressable 
              onPress={() => setSelectedImage(getImageUrl(item.mediaUrl))}
              style={styles.imageBubblePressable}
            >
              <Image
                source={{ uri: getImageUrl(item.mediaUrl) }}
                style={styles.msgImage}
                resizeMode="cover"
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      {/* Notch-Safe Gradient Header */}
      <LinearGradient 
        colors={['#5535d4', '#6C47FF', '#8B6FFF']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView style={styles.safeHeaderRow}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{partnerName}</Text>
              <ShieldCheck size={14} color="#a7f3d0" />
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>{partnerRole}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Keyboard Avoiding Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#6C47FF" size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, i) => item._id || String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No messages yet. Send a message to get assistance! 👋</Text>
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
                activeOpacity={0.8}
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
            <TouchableOpacity 
              style={styles.attachBtn} 
              onPress={selectImage}
              activeOpacity={0.7}
            >
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
              activeOpacity={0.85}
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
    </View>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 12 : 12,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    safeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: { 
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12 
    },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { color: theme.colors.textDim, textAlign: 'center', fontSize: 14 },
    chatList: { padding: 16, flexGrow: 1, paddingBottom: 12 },

    msgWrapper: { width: '100%', marginBottom: 12 },
    wrapMine: { alignItems: 'flex-end' },
    wrapOther: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    bubbleMine: {
      backgroundColor: '#6C47FF',
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: isDarkMode ? '#1e1e2e' : '#f0f2f5',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imageBubblePressable: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 6,
    },
    msgImage: { 
      width: Math.min(240, width * 0.65), 
      height: 160, 
      borderRadius: 12 
    },
    msgText: { fontSize: 15, lineHeight: 21 },
    textMine: { color: '#fff' },
    textOther: { color: theme.colors.text },
    msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    timeMine: { color: 'rgba(255,255,255,0.7)' },
    timeOther: { color: theme.colors.textDim },

    inputArea: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    previewWrap: {
      position: 'relative',
      marginBottom: 10,
      alignSelf: 'flex-start',
    },
    preview: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderColor: '#6C47FF' },
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
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f2f5',
      borderRadius: 21,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
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
      backgroundColor: '#6C47FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseBtn: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 25,
      right: 20,
      zIndex: 10,
      padding: 10,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    modalImage: {
      width: '94%',
      height: '80%',
    },
  });

export default ChatScreen;
