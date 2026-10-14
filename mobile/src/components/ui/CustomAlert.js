import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Sparkles,
  X,
  LogOut,
} from 'lucide-react-native';

/**
 * Auto-detect alert type based on title, message, and button styles
 */
export const detectAlertType = (title = '', message = '', buttons = []) => {
  const t = (String(title || '') + ' ' + String(message || '')).toLowerCase();
  
  if (t.includes('log out') || t.includes('logout') || t.includes('sign out') || t.includes('signout')) {
    return 'logout';
  }
  if (t.includes('delete') || t.includes('remove')) {
    return 'delete';
  }
  if (buttons.some(b => b?.style === 'destructive')) {
    return 'danger';
  }
  if (
    t.includes('error') ||
    t.includes('fail') ||
    t.includes('invalid') ||
    t.includes('denied') ||
    t.includes('rejected') ||
    t.includes('unavailable') ||
    t.includes('declined') ||
    t.includes('❌')
  ) {
    return 'error';
  }
  if (
    t.includes('success') ||
    t.includes('saved') ||
    t.includes('updated') ||
    t.includes('completed') ||
    t.includes('submitted') ||
    t.includes('added') ||
    t.includes('verified') ||
    t.includes('approved') ||
    t.includes('copied') ||
    t.includes('congratulations') ||
    t.includes('🎉') ||
    t.includes('✅')
  ) {
    return 'success';
  }
  if (
    t.includes('confirm') ||
    t.includes('are you sure') ||
    t.includes('warning') ||
    t.includes('caution') ||
    t.includes('blocked') ||
    t.includes('required') ||
    t.includes('missing') ||
    t.includes('⚠️')
  ) {
    return 'warning';
  }
  return 'info';
};

/**
 * CustomAlert - Modern, themed modal dialog for Kwickly
 * Replaces native Alert.alert() with rich, themed, icon-based popups with visible 'X' close button and working buttons.
 */
const CustomAlert = ({
  visible,
  title = '',
  message = '',
  type = null, // auto-detected if null
  buttons = null, // [{ text, style: 'default' | 'cancel' | 'destructive', onPress }]
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
  onConfirm,
  onCancel,
  onRequestClose,
  onButtonPress,
}) => {
  const { isDarkMode } = useTheme();

  if (!visible) return null;

  // Derive active buttons
  let activeButtons = [];
  if (Array.isArray(buttons) && buttons.length > 0) {
    activeButtons = buttons;
  } else if (showCancel) {
    activeButtons = [
      { text: cancelText || 'Cancel', style: 'cancel', onPress: onCancel },
      { text: confirmText || 'OK', style: 'default', onPress: onConfirm },
    ];
  } else {
    activeButtons = [
      { text: confirmText || 'OK', style: 'default', onPress: onConfirm },
    ];
  }

  // Derive alert type
  const activeType = type || detectAlertType(title, message, activeButtons);

  // Configuration based on active type
  const getConfig = () => {
    switch (activeType) {
      case 'success':
        return {
          icon: <CheckCircle2 size={36} color="#10B981" strokeWidth={2.4} />,
          haloBg: 'rgba(16, 185, 129, 0.08)',
          bgBadge: 'rgba(16, 185, 129, 0.16)',
          borderBadge: 'rgba(16, 185, 129, 0.32)',
          gradientColors: ['#10B981', '#059669'],
          defaultTitle: 'Success!',
          accentColor: '#10B981',
        };
      case 'logout':
        return {
          icon: <LogOut size={34} color="#EF4444" strokeWidth={2.4} />,
          haloBg: 'rgba(239, 68, 68, 0.08)',
          bgBadge: 'rgba(239, 68, 68, 0.16)',
          borderBadge: 'rgba(239, 68, 68, 0.32)',
          gradientColors: ['#EF4444', '#DC2626'],
          defaultTitle: 'Log Out',
          accentColor: '#EF4444',
        };
      case 'delete':
      case 'danger':
        return {
          icon: activeType === 'delete' 
            ? <Trash2 size={34} color="#EF4444" strokeWidth={2.4} /> 
            : <AlertCircle size={36} color="#EF4444" strokeWidth={2.4} />,
          haloBg: 'rgba(239, 68, 68, 0.08)',
          bgBadge: 'rgba(239, 68, 68, 0.16)',
          borderBadge: 'rgba(239, 68, 68, 0.32)',
          gradientColors: ['#EF4444', '#DC2626'],
          defaultTitle: activeType === 'delete' ? 'Remove Item' : 'Notice',
          accentColor: '#EF4444',
        };
      case 'error':
        return {
          icon: <AlertCircle size={36} color="#EF4444" strokeWidth={2.4} />,
          haloBg: 'rgba(239, 68, 68, 0.08)',
          bgBadge: 'rgba(239, 68, 68, 0.16)',
          borderBadge: 'rgba(239, 68, 68, 0.32)',
          gradientColors: ['#EF4444', '#DC2626'],
          defaultTitle: 'Error',
          accentColor: '#EF4444',
        };
      case 'confirm':
      case 'warning':
        return {
          icon: <AlertTriangle size={36} color="#F59E0B" strokeWidth={2.4} />,
          haloBg: 'rgba(245, 158, 11, 0.08)',
          bgBadge: 'rgba(245, 158, 11, 0.16)',
          borderBadge: 'rgba(245, 158, 11, 0.32)',
          gradientColors: ['#F59E0B', '#D97706'],
          defaultTitle: 'Confirmation',
          accentColor: '#F59E0B',
        };
      case 'info':
      default:
        return {
          icon: <Sparkles size={36} color="#7447FF" strokeWidth={2.4} />,
          haloBg: 'rgba(116, 71, 255, 0.08)',
          bgBadge: 'rgba(116, 71, 255, 0.16)',
          borderBadge: 'rgba(116, 71, 255, 0.32)',
          gradientColors: ['#5830E0', '#7447FF'],
          defaultTitle: 'Information',
          accentColor: '#7447FF',
        };
    }
  };

  const config = getConfig();
  const displayTitle = title || config.defaultTitle;

  const closeAlert = () => {
    if (onRequestClose) {
      onRequestClose();
    } else if (onCancel) {
      onCancel();
    } else if (onConfirm) {
      onConfirm();
    } else if (onButtonPress) {
      onButtonPress({ text: 'Close', style: 'cancel' });
    } else if (activeButtons[0]?.onPress) {
      activeButtons[0].onPress();
    }
  };

  const handlePress = (btn) => {
    if (onButtonPress) {
      onButtonPress(btn);
    } else {
      if (onRequestClose) {
        onRequestClose();
      } else if (btn?.style === 'cancel' && onCancel) {
        onCancel();
      } else if (onConfirm) {
        onConfirm();
      }
      if (btn?.onPress) {
        setTimeout(() => {
          btn.onPress();
        }, 50);
      }
    }
  };

  const handleBackdropPress = () => {
    closeAlert();
  };

  const isTwoButtons = activeButtons.length === 2;
  const isMultiButtons = activeButtons.length > 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeAlert}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.modalContent,
              {
                backgroundColor: isDarkMode ? '#131927' : '#FFFFFF',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(108, 71, 255, 0.12)',
              }
            ]}>
              {/* Explicit Top-Right "X" Close Icon */}
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
                  }
                ]}
                onPress={closeAlert}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close Alert"
                accessibilityRole="button"
              >
                <X size={18} color={isDarkMode ? '#CBD5E1' : '#64748B'} strokeWidth={2.4} />
              </TouchableOpacity>

              {/* Circular Themed Icon Badge with glowing halo */}
              <View style={[styles.haloContainer, { backgroundColor: config.haloBg }]}>
                <View style={[
                  styles.iconBadge,
                  {
                    backgroundColor: config.bgBadge,
                    borderColor: config.borderBadge,
                  }
                ]}>
                  {config.icon}
                </View>
              </View>

              {/* Title & Message */}
              <Text style={[styles.title, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                {displayTitle}
              </Text>
              {message ? (
                <ScrollView style={styles.messageScroll} bounces={false} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.message, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {typeof message === 'string' ? message : String(message)}
                  </Text>
                </ScrollView>
              ) : null}

              {/* Action Buttons */}
              {isTwoButtons ? (
                /* Two Buttons: Side-by-Side (Cancel on left, Action on right) */
                <View style={styles.twoBtnRow}>
                  {activeButtons.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel' || (idx === 0 && btn.style !== 'destructive');
                    const isDestructive = btn.style === 'destructive';
                    
                    if (isCancel && !isDestructive) {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.cancelBtn,
                            {
                              backgroundColor: isDarkMode ? '#1E2638' : '#F1F5F9',
                              borderColor: isDarkMode ? '#333F58' : '#E2E8F0',
                            }
                          ]}
                          onPress={() => handlePress(btn)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.cancelBtnText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                            {btn.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    }

                    const btnGradients = isDestructive 
                      ? ['#EF4444', '#DC2626'] 
                      : config.gradientColors;

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.twoBtnConfirmWrapper}
                        onPress={() => handlePress(btn)}
                        activeOpacity={0.88}
                      >
                        <LinearGradient
                          colors={btnGradients}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.btnGradient}
                        >
                          <Text style={styles.confirmBtnText}>{btn.text}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : isMultiButtons ? (
                /* 3+ Buttons: Vertically Stacked with Cancel at Bottom */
                <View style={styles.stackedBtnContainer}>
                  {activeButtons.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';
                    const isPrimary = idx === 0 && !isCancel;

                    if (isCancel) {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.stackedCancelBtn,
                            {
                              backgroundColor: isDarkMode ? '#1E2638' : '#F8FAFC',
                              borderColor: isDarkMode ? '#333F58' : '#E2E8F0',
                            }
                          ]}
                          onPress={() => handlePress(btn)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.cancelBtnText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                            {btn.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    }

                    if (isPrimary) {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.stackedBtn}
                          onPress={() => handlePress(btn)}
                          activeOpacity={0.88}
                        >
                          <LinearGradient
                            colors={isDestructive ? ['#EF4444', '#DC2626'] : config.gradientColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.btnGradient}
                          >
                            <Text style={styles.confirmBtnText}>{btn.text}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.stackedSecondaryBtn,
                          {
                            backgroundColor: isDarkMode ? '#1C2333' : '#F8FAFC',
                            borderColor: isDarkMode ? 'rgba(116,71,255,0.3)' : 'rgba(116,71,255,0.2)',
                          }
                        ]}
                        onPress={() => handlePress(btn)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.stackedSecondaryBtnText, { color: isDarkMode ? '#A78BFA' : '#6C47FF' }]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                /* Single Button: Full Width Gradient Pill with Fixed Height */
                <View style={styles.singleBtnContainer}>
                  <TouchableOpacity
                    style={styles.singleConfirmBtn}
                    onPress={() => handlePress(activeButtons[0])}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={config.gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGradient}
                    >
                      <Text style={styles.confirmBtnText}>{activeButtons[0]?.text || 'OK'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 25, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  haloContainer: {
    padding: 6,
    borderRadius: 44,
    marginBottom: 16,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
  messageScroll: {
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
  },
  message: {
    fontSize: 14.5,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  singleBtnContainer: {
    width: '100%',
    marginTop: 4,
  },
  singleConfirmBtn: {
    width: '100%',
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  twoBtnRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  twoBtnConfirmWrapper: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  btnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stackedBtnContainer: {
    width: '100%',
    gap: 10,
  },
  stackedBtn: {
    width: '100%',
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
  },
  stackedSecondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 15,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedSecondaryBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  stackedCancelBtn: {
    width: '100%',
    height: 46,
    borderRadius: 15,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});

export default CustomAlert;
