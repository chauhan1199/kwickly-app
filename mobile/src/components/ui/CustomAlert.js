import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

const CustomAlert = ({ visible, title, message, onConfirm, confirmText = 'OK', type = 'error' }) => {
  const { theme, isDarkMode } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.logoImage} />
          </View>
          
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.colors.textDim }]}>{message}</Text>
          
          <TouchableOpacity style={styles.btnShadow} onPress={onConfirm} activeOpacity={0.8}>
            <LinearGradient
              colors={['#8B5CF6', '#6C47FF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.btnGradient}
            >
              <Text style={styles.btnText}>{confirmText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#000',
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 16,
  },
  btnGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});

export default CustomAlert;
