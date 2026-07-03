import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import Toast from '../../components/Toast';
import { io } from 'socket.io-client';
import './SupportChats.css';

const SupportChats = () => {
  const token = localStorage.getItem('kwickly_admin_token');
  const user = JSON.parse(localStorage.getItem('kwickly_admin_user') || '{}');
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchThreads();
    setupSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const setupSocket = () => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, { auth: { token } });
    
    socket.on('connect', () => {
      socket.emit('JOIN_ADMIN_ROOM');
    });

    const handleIncomingMessage = (message) => {
      fetchThreads();
      setActiveThread(prevActive => {
        if (prevActive && message.senderId && (
          message.senderId._id === prevActive.user._id ||
          message.senderId === prevActive.user._id ||
          message.receiverId === prevActive.user._id ||
          (message.receiverId && message.receiverId._id === prevActive.user._id)
        )) {
          setMessages(prev => {
            if (prev.find(m => m._id === message._id)) return prev;
            return [...prev, message];
          });
          setTimeout(scrollToBottom, 100);
        }
        return prevActive;
      });
    };

    socket.on('SUPPORT_MESSAGE_RECEIVED', handleIncomingMessage);
    socket.on('ADMIN_MESSAGE_SENT', handleIncomingMessage);

    socketRef.current = socket;
  };

  const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    return `${baseUrl}${url}`;
  };

  const fetchThreads = async () => {
    try {
      const res = await api.get('/chat/support/threads');
      setThreads(res.data?.data || []);
    } catch (err) {
      console.error(err);
      Toast.error('Failed to load support threads');
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadChat = async (thread) => {
    setActiveThread(thread);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await api.get('/chat/history', { params: { partnerId: thread.user._id } });
      setMessages(res.data?.data || []);
      setTimeout(scrollToBottom, 100);
      
      // Mark as read
      await api.post('/chat/mark-read', { partnerId: thread.user._id }).catch(console.error);

      setThreads(prev => prev.map(t => 
        t.user._id === thread.user._id ? { ...t, unreadCount: 0 } : t
      ));
    } catch (err) {
      console.error(err);
      Toast.error('Failed to load chat history');
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if ((!textToSend && !imageFile) || !activeThread) return;

    setSending(true);
    try {
      let mediaUrl = null;
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadRes = await api.post('/admin/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = uploadRes.data?.data?.url;
        if (!mediaUrl) throw new Error('Upload succeeded but no URL returned');
      }

      const res = await api.post('/chat/send', {
        receiverId: activeThread.user._id,
        text: textToSend || '',
        mediaUrl: mediaUrl || undefined,
      });

      const newMsg = res.data?.data;
      if (newMsg) {
        setMessages(prev => {
          if (prev.find(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
      setInputText('');
      removeImage();
      setTimeout(scrollToBottom, 100);
      fetchThreads();
    } catch (err) {
      console.error('[SupportChats] Send error:', err?.response?.data || err.message);
      Toast.error('Failed to send: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="support-chats-container">
      <div className="threads-sidebar">
        <div className="threads-header">
          <h2>Support Inbox</h2>
          <button className="refresh-btn" onClick={fetchThreads} title="Refresh">↻</button>
        </div>
        
        <div className="threads-list">
          {loadingThreads ? (
            <div className="loading-state">Loading...</div>
          ) : threads.length === 0 ? (
            <div className="empty-state">No support threads found.</div>
          ) : (
            threads.map((thread) => {
              const u = thread.user || {};
              const isActive = activeThread?.user?._id === u._id;
              
              return (
                <div 
                  key={u._id} 
                  className={`thread-item ${isActive ? 'active' : ''} ${thread.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => loadChat(thread)}
                >
                  <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.name}&background=random`} alt="avatar" className="thread-avatar" />
                  <div className="thread-content">
                    <div className="thread-top">
                      <span className="thread-name">{u.name || 'Unknown User'}</span>
                      <span className="thread-time">{formatTime(thread.latestMessage?.createdAt)}</span>
                    </div>
                    <div className="thread-bottom">
                      <span className="thread-preview">{thread.latestMessage?.text || 'Sent an attachment'}</span>
                      {thread.unreadCount > 0 && (
                        <span className="unread-badge">{thread.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="chat-area">
        {activeThread ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <img src={activeThread.user.profileImage || `https://ui-avatars.com/api/?name=${activeThread.user.name}&background=random`} alt="avatar" className="chat-header-avatar" />
                <div>
                  <h3 className="chat-header-name">{activeThread.user.name}</h3>
                  <span className="chat-header-role badge">{activeThread.user.role}</span>
                </div>
              </div>
            </div>

            <div className="messages-list">
              {loadingMessages ? (
                <div className="loading-state">Loading chat history...</div>
              ) : messages.length === 0 ? (
                <div className="empty-state">No messages yet.</div>
              ) : (
                messages.map((msg) => {
                  const isAdminMsg = !msg.senderId || (msg.senderId._id && msg.senderId._id === user?._id);
                  return (
                    <div key={msg._id} className={`message-wrapper ${isAdminMsg ? 'sent' : 'received'}`}>
                      <div className="message-bubble">
                        {msg.mediaUrl && (
                          <img src={getMediaUrl(msg.mediaUrl)} alt="Attachment" className="message-image" />
                        )}
                        {msg.text && <p className="message-text">{msg.text}</p>}
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              {imagePreview && (
                <div className="image-preview-wrapper">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="remove-image-btn" onClick={removeImage}>✕</button>
                </div>
              )}
              <form onSubmit={handleSend} className="chat-form">
                <label className="attach-btn" title="Attach Image">
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                  📎
                </label>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={sending}
                  className="chat-input"
                />
                <button type="submit" disabled={sending || (!inputText.trim() && !imageFile)} className="send-btn">
                  {sending ? '...' : 'Send'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon">💬</div>
            <p>Select a thread to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportChats;
