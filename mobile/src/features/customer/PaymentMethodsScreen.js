import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import {
  CreditCard,
  Building2,
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  Star,
  CheckCircle2,
  X,
  AlertCircle,
  Check
} from 'lucide-react-native';
import AppBar from '../../components/AppBar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';
import { useNotifications } from '../../context/NotificationContext';

const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Other Bank'
];

const POPULAR_UPI_HANDLES = [
  '@okhdfcbank',
  '@okicici',
  '@oksbi',
  '@paytm',
  '@ybl',
  '@upi'
];

// Validation Regex
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const ACCOUNT_NUM_REGEX = /^\d{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const PaymentMethodsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUnread } = useNotifications();
  const { user, fetchUser } = useAuth();

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMethodId, setEditMethodId] = useState(null);
  const [methodType, setMethodType] = useState('UPI'); // 'UPI' | 'BANK'

  // Form Fields
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // Inline Validation Errors
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const loadedMethods = [];
    if (user?.wallet?.upiId) {
      loadedMethods.push({
        id: 'upi',
        type: 'UPI',
        title: 'UPI Virtual Payment',
        details: user.wallet.upiId,
        icon: Smartphone,
        isDefault: !user?.wallet?.bankDetails
      });
    }
    if (user?.wallet?.bankDetails && user.wallet.bankDetails.accountNumber) {
      const bank = user.wallet.bankDetails;
      loadedMethods.push({
        id: 'bank',
        type: 'BANK',
        title: bank.bankName || 'Bank Account',
        details: `Account: •••• ${bank.accountNumber.slice(-4)}  |  IFSC: ${bank.ifscCode || 'N/A'}`,
        accountNumber: bank.accountNumber,
        ifscCode: bank.ifscCode,
        bankName: bank.bankName,
        icon: Building2,
        isDefault: !!user?.wallet?.bankDetails && !user?.wallet?.upiId
      });
    }
    setMethods(loadedMethods);
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (methodType === 'UPI') {
      const cleanUpi = upiId.trim();
      if (!cleanUpi) {
        newErrors.upiId = 'UPI ID is required (e.g. name@okhdfcbank)';
      } else if (!UPI_REGEX.test(cleanUpi)) {
        newErrors.upiId = 'Invalid UPI ID format. Must include valid handle (e.g. name@okhdfcbank, 9876543210@paytm)';
      }
    } else {
      // Bank Account validation
      if (!bankName) {
        newErrors.bankName = 'Please select your bank';
      }

      const cleanAcc = accountNumber.trim();
      if (!cleanAcc && !editMethodId) {
        newErrors.accountNumber = 'Account number is required (9 to 18 digits)';
      } else if (cleanAcc && !ACCOUNT_NUM_REGEX.test(cleanAcc)) {
        newErrors.accountNumber = 'Account number must be 9 to 18 digits (numeric only)';
      }

      if (!editMethodId && cleanAcc && confirmAccountNumber.trim() !== cleanAcc) {
        newErrors.confirmAccountNumber = 'Account numbers do not match';
      }

      const cleanIfsc = ifscCode.trim().toUpperCase();
      if (!cleanIfsc) {
        newErrors.ifscCode = 'IFSC Code is required (11 characters)';
      } else if (cleanIfsc.length !== 11) {
        newErrors.ifscCode = `IFSC must be 11 characters (Current length: ${cleanIfsc.length})`;
      } else if (cleanIfsc.charAt(4) !== '0') {
        newErrors.ifscCode = "5th character of IFSC must be '0' (zero), e.g. HDFC0001234";
      } else if (!IFSC_REGEX.test(cleanIfsc)) {
        newErrors.ifscCode = 'Invalid IFSC format. Must start with 4 letters followed by 0 and 6 alphanumeric digits';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenAdd = () => {
    setEditMethodId(null);
    setMethodType('UPI');
    setUpiId('');
    setBankName('HDFC Bank');
    setAccountHolderName(user?.name || '');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode('');
    setErrors({});
    setShowAddModal(true);
  };

  const handleOpenEdit = (method) => {
    setEditMethodId(method.id);
    setErrors({});
    if (method.id === 'upi') {
      setMethodType('UPI');
      setUpiId(user?.wallet?.upiId || '');
    } else {
      setMethodType('BANK');
      setBankName(user?.wallet?.bankDetails?.bankName || 'HDFC Bank');
      setAccountHolderName(user?.name || '');
      setAccountNumber(user?.wallet?.bankDetails?.accountNumber || '');
      setConfirmAccountNumber(user?.wallet?.bankDetails?.accountNumber || '');
      setIfscCode(user?.wallet?.bankDetails?.ifscCode || '');
    }
    setShowAddModal(true);
  };

  const handleSetDefault = async (id) => {
    const updated = methods.map(m => ({
      ...m,
      isDefault: m.id === id
    }));
    setMethods(updated);
    try {
      await AsyncStorage.setItem('mockPaymentMethods', JSON.stringify(updated));
      Alert.alert('Default Updated', `${id === 'upi' ? 'UPI ID' : 'Bank Account'} set as default payment method.`);
    } catch (_) {}
  };

  const handleRemove = async (id) => {
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove this ${id === 'upi' ? 'UPI ID' : 'Bank Account'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const updatedWallet = {
                upiId: id === 'upi' ? '' : (user?.wallet?.upiId || ''),
                bankDetails: id === 'bank' ? { accountNumber: '', ifscCode: '', bankName: '' } : (user?.wallet?.bankDetails || null)
              };

              // Optimistic update
              setMethods(prev => prev.filter(m => m.id !== id));

              await customerService.updateProfile({ wallet: updatedWallet });
              await fetchUser();

              customerService
                .triggerNotification({
                  title: 'Payment Method Removed',
                  message: 'Payment method successfully deleted.'
                })
                .then(() => refreshUnread())
                .catch(() => {});

              Alert.alert('Removed', `${id === 'upi' ? 'UPI ID' : 'Bank Account'} has been removed.`);
            } catch (e) {
              await fetchUser();
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove payment method');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const submitPaymentMethod = async () => {
    if (!validateForm()) {
      return;
    }

    let updatedWallet = {
      upiId: user?.wallet?.upiId,
      bankDetails: user?.wallet?.bankDetails
    };

    if (methodType === 'UPI') {
      updatedWallet.upiId = upiId.trim();
    } else {
      updatedWallet.bankDetails = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim() || user?.wallet?.bankDetails?.accountNumber,
        ifscCode: ifscCode.trim().toUpperCase()
      };
    }

    try {
      setLoading(true);
      await customerService.updateProfile({ wallet: updatedWallet });
      await fetchUser();

      const title = editMethodId ? 'Payment Method Updated' : 'Payment Method Added';
      const msg = editMethodId
        ? 'Your payment details have been successfully updated.'
        : 'Your new payment method has been verified and saved.';

      customerService
        .triggerNotification({ title, message: msg })
        .then(() => refreshUnread())
        .catch(() => {});

      setShowAddModal(false);
      Alert.alert('Success', msg);
    } catch (e) {
      Alert.alert('Save Error', e.response?.data?.message || e.message || 'Failed to save payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleAppendUpiHandle = (handle) => {
    const prefix = upiId.split('@')[0].trim();
    if (prefix) {
      setUpiId(`${prefix}${handle}`);
    } else {
      setUpiId(`user${handle}`);
    }
    if (errors.upiId) {
      setErrors(prev => ({ ...prev, upiId: null }));
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />

      {/* Header Gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <AppBar
          title="Payment Methods"
          subtitle={`${methods.length} saved method${methods.length === 1 ? '' : 's'}`}
          showBack={true}
          transparent={true}
          showLogo={false}
          showProfile={false}
          showCart={false}
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Add Payment Method Button */}
        <TouchableOpacity
          style={styles.addNewCardBtn}
          onPress={handleOpenAdd}
          activeOpacity={0.88}
        >
          <View style={styles.addNewIconBox}>
            <Plus size={22} color="#6C47FF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.addNewTitle}>Add Payment Method</Text>
            <Text style={styles.addNewSub}>Link UPI ID or Bank Account for refunds & payouts</Text>
          </View>
        </TouchableOpacity>

        {/* Methods List */}
        {methods.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <CreditCard size={36} color="#6C47FF" />
            </View>
            <Text style={styles.emptyTitle}>No Payment Methods Added</Text>
            <Text style={styles.emptySub}>
              Link your UPI ID or Bank Account for seamless refunds, cashback, and wallet withdrawals.
            </Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={handleOpenAdd} activeOpacity={0.85}>
              <Text style={styles.emptyActionText}>+ Add UPI / Bank Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          methods.map((method) => {
            const IconComp = method.icon;
            const isDefault = method.isDefault;

            return (
              <View
                key={method.id}
                style={[styles.methodCard, isDefault && styles.methodCardDefault]}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, isDefault && styles.iconBoxDefault]}>
                    <IconComp size={20} color={isDefault ? '#6C47FF' : '#64748B'} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.methodTitle}>{method.title}</Text>
                      {isDefault && (
                        <View style={styles.defaultBadge}>
                          <Star size={10} color="#059669" fill="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.methodDetails}>{method.details}</Text>
                  </View>
                </View>

                {/* Footer Actions */}
                <View style={styles.cardActionsRow}>
                  {isDefault ? (
                    <View style={styles.defaultPill}>
                      <CheckCircle2 size={14} color="#059669" style={{ marginRight: 5 }} />
                      <Text style={styles.defaultPillText}>Default Method</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => handleSetDefault(method.id)}
                      activeOpacity={0.7}
                    >
                      <Star size={13} color="#6C47FF" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnOutlineText}>Set Default</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.rightActionsRow}>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleOpenEdit(method)}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={15} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.iconActionBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconActionBtn, styles.deleteActionBtn]}
                      onPress={() => handleRemove(method.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={styles.deleteActionBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add / Edit Payment Method Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1, width: '100%' }}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContent}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {editMethodId ? 'Edit Payment Method' : 'Add Payment Method'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Toggle UPI vs Bank */}
              <View style={styles.methodToggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, methodType === 'UPI' && styles.toggleBtnActive]}
                  onPress={() => {
                    setMethodType('UPI');
                    setErrors({});
                  }}
                >
                  <Smartphone size={16} color={methodType === 'UPI' ? '#fff' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.toggleBtnText, methodType === 'UPI' && styles.toggleBtnTextActive]}>
                    UPI ID
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, methodType === 'BANK' && styles.toggleBtnActive]}
                  onPress={() => {
                    setMethodType('BANK');
                    setErrors({});
                  }}
                >
                  <Building2 size={16} color={methodType === 'BANK' ? '#fff' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.toggleBtnText, methodType === 'BANK' && styles.toggleBtnTextActive]}>
                    Bank Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* UPI Form */}
              {methodType === 'UPI' ? (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>UPI ID (VPA) *</Text>
                  <TextInput
                    style={[styles.modalInput, errors.upiId && styles.modalInputError]}
                    placeholder="e.g. mobile@okhdfcbank or user@paytm"
                    placeholderTextColor="#94A3B8"
                    value={upiId}
                    onChangeText={(t) => {
                      setUpiId(t.toLowerCase().trim());
                      if (errors.upiId) setErrors(prev => ({ ...prev, upiId: null }));
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {errors.upiId && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={14} color="#EF4444" style={{ marginRight: 5 }} />
                      <Text style={styles.errorText}>{errors.upiId}</Text>
                    </View>
                  )}

                  {/* Popular UPI Handles */}
                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>QUICK SELECT HANDLE</Text>
                  <View style={styles.handleChipsRow}>
                    {POPULAR_UPI_HANDLES.map((handle) => (
                      <TouchableOpacity
                        key={handle}
                        style={styles.handleChip}
                        onPress={() => handleAppendUpiHandle(handle)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.handleChipText}>{handle}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                /* Bank Account Form */
                <View style={styles.formSection}>
                  {/* Select Bank */}
                  <Text style={styles.inputLabel}>SELECT BANK *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.bankChipsScroll}
                    contentContainerStyle={{ paddingVertical: 4 }}
                  >
                    {POPULAR_BANKS.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.bankChip, bankName === b && styles.bankChipActive]}
                        onPress={() => {
                          setBankName(b);
                          if (errors.bankName) setErrors(prev => ({ ...prev, bankName: null }));
                        }}
                      >
                        <Text style={[styles.bankChipText, bankName === b && styles.bankChipTextActive]}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Account Number */}
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>ACCOUNT NUMBER (9 - 18 DIGITS) *</Text>
                  <TextInput
                    style={[styles.modalInput, errors.accountNumber && styles.modalInputError]}
                    placeholder={editMethodId ? "Enter new account number (or keep existing)" : "e.g. 50100234567890"}
                    placeholderTextColor="#94A3B8"
                    value={accountNumber}
                    onChangeText={(t) => {
                      setAccountNumber(t.replace(/\D/g, '').slice(0, 18));
                      if (errors.accountNumber) setErrors(prev => ({ ...prev, accountNumber: null }));
                    }}
                    keyboardType="number-pad"
                    maxLength={18}
                  />
                  {errors.accountNumber && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={14} color="#EF4444" style={{ marginRight: 5 }} />
                      <Text style={styles.errorText}>{errors.accountNumber}</Text>
                    </View>
                  )}

                  {/* Confirm Account Number (for new adds) */}
                  {!editMethodId && (
                    <>
                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>CONFIRM ACCOUNT NUMBER *</Text>
                      <TextInput
                        style={[styles.modalInput, errors.confirmAccountNumber && styles.modalInputError]}
                        placeholder="Re-enter account number"
                        placeholderTextColor="#94A3B8"
                        value={confirmAccountNumber}
                        onChangeText={(t) => {
                          setConfirmAccountNumber(t.replace(/\D/g, '').slice(0, 18));
                          if (errors.confirmAccountNumber) setErrors(prev => ({ ...prev, confirmAccountNumber: null }));
                        }}
                        keyboardType="number-pad"
                        maxLength={18}
                      />
                      {errors.confirmAccountNumber && (
                        <View style={styles.errorBanner}>
                          <AlertCircle size={14} color="#EF4444" style={{ marginRight: 5 }} />
                          <Text style={styles.errorText}>{errors.confirmAccountNumber}</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* IFSC Code */}
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>IFSC CODE (11 CHARACTERS) *</Text>
                  <TextInput
                    style={[styles.modalInput, errors.ifscCode && styles.modalInputError]}
                    placeholder="e.g. HDFC0001234 or SBIN0001234"
                    placeholderTextColor="#94A3B8"
                    value={ifscCode}
                    onChangeText={(t) => {
                      setIfscCode(t.toUpperCase().trim().slice(0, 11));
                      if (errors.ifscCode) setErrors(prev => ({ ...prev, ifscCode: null }));
                    }}
                    autoCapitalize="characters"
                    maxLength={11}
                  />
                  {errors.ifscCode && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={14} color="#EF4444" style={{ marginRight: 5 }} />
                      <Text style={styles.errorText}>{errors.ifscCode}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Save / Cancel Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                  disabled={loading}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={submitPaymentMethod}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#6C47FF', '#8B6FFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Check size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.modalSaveText}>
                          {editMethodId ? 'Update Method' : 'Save Method'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC'
    },
    headerGradient: {
      paddingBottom: 24,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: 'hidden',
      position: 'relative'
    },
    blob1: {
      position: 'absolute',
      top: -50,
      right: -30,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    blob2: {
      position: 'absolute',
      bottom: -60,
      left: -40,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16
    },
    addNewCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3
    },
    addNewIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#6C47FF1A',
      justifyContent: 'center',
      alignItems: 'center'
    },
    addNewTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    addNewSub: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2
    },
    methodCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2
    },
    methodCardDefault: {
      borderColor: '#6C47FF',
      borderWidth: 1.5,
      backgroundColor: isDarkMode ? '#1E1E38' : '#FAF8FF'
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center'
    },
    iconBoxDefault: {
      backgroundColor: '#6C47FF1A'
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    methodTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    defaultBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#A7F3D0'
    },
    defaultBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#059669'
    },
    methodDetails: {
      fontSize: 13,
      color: '#64748B',
      marginTop: 4,
      fontWeight: '500'
    },
    cardActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#334155' : '#F1F5F9'
    },
    defaultPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#A7F3D0'
    },
    defaultPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#059669'
    },
    actionBtnOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#6C47FF33',
      backgroundColor: '#6C47FF0D'
    },
    actionBtnOutlineText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6C47FF'
    },
    rightActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6
    },
    iconActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9'
    },
    iconActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDarkMode ? '#CBD5E1' : '#475569'
    },
    deleteActionBtn: {
      backgroundColor: '#FEF2F2'
    },
    deleteActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#EF4444'
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 24
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#6C47FF1A',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B',
      marginBottom: 8
    },
    emptySub: {
      fontSize: 13,
      color: '#64748B',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 20
    },
    emptyActionBtn: {
      backgroundColor: '#6C47FF',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14
    },
    emptyActionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end'
    },
    modalContent: {
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      maxHeight: '90%'
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center'
    },
    methodToggleRow: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      borderRadius: 14,
      padding: 4,
      marginBottom: 18
    },
    toggleBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 12
    },
    toggleBtnActive: {
      backgroundColor: '#6C47FF',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3
    },
    toggleBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDarkMode ? '#94A3B8' : '#64748B'
    },
    toggleBtnTextActive: {
      color: '#fff',
      fontWeight: '800'
    },
    formSection: {
      marginBottom: 16
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: isDarkMode ? '#94A3B8' : '#64748B',
      letterSpacing: 0.5,
      marginBottom: 6
    },
    modalInput: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 14,
      color: isDarkMode ? '#F8FAFC' : '#0F172A',
      marginBottom: 4
    },
    modalInputError: {
      borderColor: '#EF4444',
      backgroundColor: '#FEF2F20D'
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 8,
      paddingHorizontal: 2
    },
    errorText: {
      fontSize: 11,
      color: '#EF4444',
      fontWeight: '600',
      flex: 1
    },
    handleChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4
    },
    handleChip: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8
    },
    handleChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6C47FF'
    },
    bankChipsScroll: {
      marginBottom: 6
    },
    bankChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      marginRight: 8
    },
    bankChipActive: {
      borderColor: '#6C47FF',
      backgroundColor: '#6C47FF1A'
    },
    bankChipText: {
      fontSize: 12,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      fontWeight: '600'
    },
    bankChipTextActive: {
      color: '#6C47FF',
      fontWeight: '800'
    },
    modalActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 10
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0'
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDarkMode ? '#94A3B8' : '#64748B'
    },
    modalSaveBtn: {
      flex: 2,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 4
    },
    modalSaveGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14
    },
    modalSaveText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800'
    }
  });

export default PaymentMethodsScreen;
