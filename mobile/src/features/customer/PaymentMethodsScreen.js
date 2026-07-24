import React, { useState } from 'react';
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
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';
import { useNotifications } from '../../context/NotificationContext';

const PaymentMethodsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUnread } = useNotifications();
  const { user, fetchUser } = useAuth();

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const loadedMethods = [];
    if (user?.wallet?.upiId) {
      loadedMethods.push({
        id: 'upi',
        type: 'UPI',
        details: user.wallet.upiId,
        icon: '📱',
        isDefault: !user?.wallet?.bankDetails
      });
    }
    if (user?.wallet?.bankDetails) {
      loadedMethods.push({
        id: 'bank',
        type: user.wallet.bankDetails.bankName || 'Bank Account',
        details: '****' + (user.wallet.bankDetails.accountNumber || '').slice(-4),
        icon: '🏦',
        isDefault: !!user?.wallet?.bankDetails
      });
    }
    setMethods(loadedMethods);
  }, [user]);

  const saveMethods = async (newMethods) => {
    setMethods(newMethods);
    try {
      await AsyncStorage.setItem('mockPaymentMethods', JSON.stringify(newMethods));
    } catch (e) {
    }
  };

  const handleSetDefault = (id) => {
    const updated = methods.map(m => ({
      ...m,
      isDefault: m.id === id
    }));
    saveMethods(updated);
  };

  const handleRemove = async (id) => {
    try {
      setLoading(true);
      const updatedWallet = {
        upiId: id === 'upi' ? '' : user?.wallet?.upiId,
        bankDetails: id === 'bank' ? null : user?.wallet?.bankDetails
      };
      
      await customerService.updateProfile({ wallet: updatedWallet });
      await fetchUser();
      
      customerService.triggerNotification({ title: 'Payment Method Removed', message: 'Payment method successfully deleted.' })
        .then(() => refreshUnread())
        .catch(()=>{});
    } catch (e) {
      Alert.alert('Error', 'Failed to remove payment method');
    } finally {
      setLoading(false);
    }
  };

  const [editMethodId, setEditMethodId] = useState(null);

  const handleEdit = (id) => {
    const method = methods.find(m => m.id === id);
    if (method) {
      setEditMethodId(id);
      if (id === 'upi') {
        setNewMethodType('UPI');
        setNewUpiId(user?.wallet?.upiId || '');
      } else {
        setNewMethodType('BANK');
        setNewBankName(user?.wallet?.bankDetails?.bankName || 'HDFC Bank');
        setNewAccNumber(user?.wallet?.bankDetails?.accountNumber || '');
        setNewIfsc(user?.wallet?.bankDetails?.ifscCode || '');
      }
      setShowAddModal(true);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState('UPI'); // 'UPI' or 'BANK'
  const [newUpiId, setNewUpiId] = useState('');
  const [newBankName, setNewBankName] = useState('HDFC Bank');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newIfsc, setNewIfsc] = useState('');

  const submitNewMethod = async () => {
    let updatedWallet = {
      upiId: user?.wallet?.upiId,
      bankDetails: user?.wallet?.bankDetails
    };

    if (newMethodType === 'UPI') {
      if (!newUpiId || !newUpiId.includes('@')) {
        return Alert.alert('Invalid', 'Please enter a valid UPI ID (e.g. name@upi)');
      }
      updatedWallet.upiId = newUpiId;
    } else {
      if (!newAccNumber && !editMethodId) {
        return Alert.alert('Invalid', 'Please enter a valid Account Number (min 6 digits)');
      }
      if (newAccNumber && newAccNumber.length < 6) {
        return Alert.alert('Invalid', 'Account Number must be at least 6 digits');
      }
      if (!newIfsc || newIfsc.length < 4) {
        return Alert.alert('Invalid', 'Please enter a valid IFSC Code');
      }
      
      updatedWallet.bankDetails = {
        bankName: newBankName,
        accountNumber: newAccNumber || user?.wallet?.bankDetails?.accountNumber,
        ifscCode: newIfsc
      };
    }

    try {
      setLoading(true);
      await customerService.updateProfile({ wallet: updatedWallet });
      await fetchUser();
      
      const title = editMethodId ? 'Payment Method Updated' : 'Payment Method Added';
      const msg = editMethodId ? 'Your payment method has been updated.' : 'A new payment method has been successfully added.';
      
      customerService.triggerNotification({ title, message: msg })
        .then(() => refreshUnread())
        .catch(()=>{});
        
      setShowAddModal(false);
      setNewUpiId('');
      setNewAccNumber('');
      setNewIfsc('');
      setEditMethodId(null);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to save payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditMethodId(null);
    setNewMethodType('UPI');
    setNewUpiId('');
    setNewBankName('HDFC Bank');
    setNewAccNumber('');
    setNewIfsc('');
    setShowAddModal(true);
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Payment Methods"
          subtitle={`${methods.length} methods`}
          showBack={true}
          transparent={true} 
          showLogo={false} 
          onBackPress={() => navigation.navigate('Profile')}
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {methods.map(method => (
          <View key={method.id} style={[styles.card, method.isDefault && styles.cardDefault]}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Text style={{fontSize: 20}}>{method.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.methodType}>{method.type}</Text>
                  {method.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.methodDetails}>{method.details}</Text>
              </View>
            </View>
            
            <View style={styles.actionRow}>
              {method.isDefault ? (
                <View style={[styles.actionBtn, styles.actionBtnActive]}>
                  <Text style={styles.actionBtnTextActive}>✓ Default method</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => handleSetDefault(method.id)}
                >
                  <Text style={styles.actionBtnText}>★ Set Default</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(method.id)}>
                <Text style={styles.actionBtnText}>🖊 Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={() => handleRemove(method.id)}>
                <Text style={styles.removeBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>+ Add Payment Method</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Payment Method Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editMethodId ? 'Edit Payment Method' : 'Add Payment Method'}</Text>
            
            <View style={styles.methodToggleRow}>
              <TouchableOpacity 
                style={[styles.toggleBtn, newMethodType === 'UPI' && styles.toggleBtnActive]}
                onPress={() => setNewMethodType('UPI')}
              >
                <Text style={[styles.toggleBtnText, newMethodType === 'UPI' && styles.toggleBtnTextActive]}>UPI</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleBtn, newMethodType === 'BANK' && styles.toggleBtnActive]}
                onPress={() => setNewMethodType('BANK')}
              >
                <Text style={[styles.toggleBtnText, newMethodType === 'BANK' && styles.toggleBtnTextActive]}>Bank Account</Text>
              </TouchableOpacity>
            </View>

            {newMethodType === 'UPI' ? (
              <View>
                <Text style={styles.modalLabel}>UPI ID</Text>
                <TextInput 
                  style={styles.modalInput}
                  placeholder="Enter UPI ID (e.g. name@upi)"
                  placeholderTextColor={theme.colors.textDim}
                  value={newUpiId}
                  onChangeText={setNewUpiId}
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <>
                <Text style={styles.modalLabel}>Select Bank</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankScroll}>
                  {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank'].map(bank => (
                    <TouchableOpacity 
                      key={bank} 
                      style={[styles.bankChip, newBankName === bank && styles.bankChipActive]}
                      onPress={() => setNewBankName(bank)}
                    >
                      <Text style={[styles.bankChipText, newBankName === bank && styles.bankChipTextActive]}>{bank}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={[styles.modalLabel, { marginTop: 12 }]}>Account Number</Text>
                <TextInput 
                  style={styles.modalInput}
                  placeholder={editMethodId ? "Leave blank to keep existing" : "e.g. 50100234567"}
                  placeholderTextColor={theme.colors.textDim}
                  value={newAccNumber}
                  onChangeText={setNewAccNumber}
                  keyboardType="number-pad"
                />
                
                <Text style={[styles.modalLabel, { marginTop: 12 }]}>IFSC Code</Text>
                <TextInput 
                  style={styles.modalInput}
                  placeholder="e.g. HDFC0001234"
                  placeholderTextColor={theme.colors.textDim}
                  value={newIfsc}
                  onChangeText={(text) => setNewIfsc(text.toUpperCase())}
                  autoCapitalize="characters"
                />
              </>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)} disabled={loading}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={submitNewMethod} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>{editMethodId ? 'Save' : 'Add'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardDefault: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodType: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#001016',
    textTransform: 'uppercase',
  },
  methodDetails: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  actionBtnTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  removeBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  removeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 20,
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  toggleBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.text,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 8,
    fontWeight: '600',
  },
  bankScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  bankChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  bankChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(14, 154, 167, 0.1)',
  },
  bankChipText: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  bankChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    color: theme.colors.textDim,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  modalSaveText: {
    color: '#001016',
    fontWeight: '800',
  }
});

export default PaymentMethodsScreen;
