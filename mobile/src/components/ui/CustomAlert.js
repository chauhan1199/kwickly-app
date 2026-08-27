import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Info,
  Sparkles,
  X
} from 'lucide-react-native';

/**
 * CustomAlert - Modern, themed modal dialog for Kwickly
 * Replaces ugly native Alert.alert() with rich, themed, icon-based popups
 */
const CustomAlert = ({
  visible,
  title,
  message,
  type = 'info', // 'success' | 'error' | 'delete' | 'confirm' | 'warning' | 'info'
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
  onConfirm,
  onCancel,
  onRequestClose,
}) => {
  const { theme, isDarkMode } = useTheme();

  if (!visible) return null;

  // Icon & Colors configuration based on type
  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={36} color="#10B981" />,
          bgBadge: '#10B98118',
          borderBadge: '#10B98133',
          gradientColors: ['#10B981', '#059669'],
          defaultTitle: 'Success!',
        };
      case 'delete':
      case 'danger':
      case 'error':
        return {
          icon: type === 'delete' ? <Trash2 size={36} color="#EF4444" /> : <AlertCircle size={36} color="#EF4444" />,
          bgBadge: '#EF444418',
          borderBadge: '#EF444433',
          gradientColors: ['#EF4444', '#DC2626'],
          defaultTitle: type === 'delete' ? 'Remove Item' : 'Error',
        };
      case 'confirm':
      case 'warning':
        return {
          icon: <AlertTriangle size={36} color="#F59E0B" />,
          bgBadge: '#F59E0B18',
          borderBadge: '#F59E0B33',
          gradientColors: ['#F59E0B', '#D97706'],
          defaultTitle: 'Confirm Action',
        };
      case 'info':
      default:
        return {
          icon: <Sparkles size={36} color="#6C47FF" />,
          bgBadge: '#6C47FF18',
          borderBadge: '#6C47FF33',
          gradientColors: ['#7C3AED', '#6C47FF'],
          defaultTitle: 'Notification',
        };
    }
  };

  const config = getConfig();
  const displayTitle = title || config.defaultTitle;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose || onCancel || onConfirm}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContent,
          {
            backgroundColor: isDarkMode ? '#171B2B' : '#FFFFFF',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(108,71,255,0.12)',
          }
        ]}>
          {/* Circular Themed Icon Badge */}
          <View style={[
            styles.iconBadge,
            {
              backgroundColor: config.bgBadge,
              borderColor: config.borderBadge,
            }
          ]}>
            {config.icon}
          </View>

          {/* Title & Message */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {displayTitle}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: theme.colors.textDim }]}>
              {message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View style={[styles.btnRow, showCancel && styles.btnRowTwo]}>
            {showCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#24293E' : '#F1F5F9',
                    borderColor: isDarkMode ? '#333B56' : '#E2E8F0',
                  }
                ]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btnShadow, showCancel && { flex: 1 }]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={config.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 15,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  btnRow: {
    width: '100%',
    flexDirection: 'row',
  },
  btnRowTwo: {
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  btnShadow: {
    width: '100%',
    borderRadius: 14,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradient: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

export default CustomAlert;
