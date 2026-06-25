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
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { customerService } from '../../services/customerService';
import { useNotifications } from '../../context/NotificationContext';

const PaymentMethodsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUnread } = useNotifications();

  const [methods, setMethods] = useState([]);

  React.useEffect(() => {
    const loadMethods = async () => {
      try {
        const stored = await AsyncStorage.getItem('mockPaymentMethods');
        if (stored) {
          setMethods(JSON.parse(stored));
        } else {
          const defaultMethods = [
            { id: 1, type: 'UPI', details: 'anita@upi', icon: '📱', isDefault: true },
            { id: 2, type: 'HDFC Debit Card', details: '****4321', icon: '💳', isDefault: false },
          ];
          setMethods(defaultMethods);
          await AsyncStorage.setItem('mockPaymentMethods', JSON.stringify(defaultMethods));
        }
      } catch (e) {
        console.log(e);
      }
    };
    loadMethods();
  }, []);

  const saveMethods = async (newMethods) => {
    setMethods(newMethods);
    try {
      await AsyncStorage.setItem('mockPaymentMethods', JSON.stringify(newMethods));
    } catch (e) {
      console.log(e);
    }
  };

  const handleSetDefault = (id) => {
    const updated = methods.map(m => ({
      ...m,
      isDefault: m.id === id
    }));
    saveMethods(updated);
  };

  const handleRemove = (id) => {
    const method = methods.find(m => m.id === id);
    if (method.isDefault && methods.length > 1) {
      Alert.alert('Action Required', 'Please set another payment method as default before removing this one.');
      return;
    }
    const updated = methods.filter(m => m.id !== id);
    saveMethods(updated);
    customerService.triggerNotification({ title: 'Payment Method Removed', message: 'Payment method successfully deleted.' })
      .then(() => refreshUnread())
      .catch(e=>console.log(e));
  };

  const [editMethodId, setEditMethodId] = useState(null);

  const handleEdit = (id) => {
    const method = methods.find(m => m.id === id);
    if (method) {
      setEditMethodId(id);
      if (method.type === 'UPI') {
        setNewMethodType('UPI');
        setNewUpiId(method.details);
      } else {
        setNewMethodType('BANK');
        setNewBankName(method.type);
        setNewAccNumber(''); // Cannot reverse '****1234', prompt to re-enter
      }
      setShowAddModal(true);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState('UPI'); // 'UPI' or 'BANK'
  const [newUpiId, setNewUpiId] = useState('');
  const [newBankName, setNewBankName] = useState('HDFC Bank');
  const [newAccNumber, setNewAccNumber] = useState('');

  const submitNewMethod = () => {
    let type = '';
    let details = '';
    let icon = '';

    if (newMethodType === 'UPI') {
      if (!newUpiId.includes('@')) {
        return Alert.alert('Invalid', 'Please enter a valid UPI ID (e.g. name@upi)');
      }
      type = 'UPI';
      details = newUpiId;
      icon = '📱';
    } else {
      if (newAccNumber.length > 0 && newAccNumber.length < 6) {
        return Alert.alert('Invalid', 'Please enter a valid Account Number (min 6 digits)');
      }
      if (!newAccNumber && !editMethodId) {
        return Alert.alert('Invalid', 'Please enter a valid Account Number (min 6 digits)');
      }
      type = newBankName;
      details = newAccNumber ? ('****' + newAccNumber.slice(-4)) : methods.find(m => m.id === editMethodId)?.details;
      icon = '🏦';
    }

    if (editMethodId) {
      const updated = methods.map(m => m.id === editMethodId ? { ...m, type, details, icon } : m);
      saveMethods(updated);
      customerService.triggerNotification({ title: 'Payment Method Updated', message: 'Your payment method has been updated.' })
        .then(() => refreshUnread())
        .catch(e=>console.log(e));
    } else {
      const updated = [...methods, { id: Date.now(), type, details, icon, isDefault: methods.length === 0 }];
      saveMethods(updated);
      customerService.triggerNotification({ title: 'Payment Method Added', message: 'A new payment method has been successfully added.' })
        .then(() => refreshUnread())
        .catch(e=>console.log(e));
    }
    
    setShowAddModal(false);
    setNewUpiId('');
    setNewAccNumber('');
    setEditMethodId(null);
  };

  const handleAdd = () => {
    setEditMethodId(null);
    setNewMethodType('UPI');
    setNewUpiId('');
    setNewBankName('HDFC Bank');
    setNewAccNumber('');
    setShowAddModal(true);
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Payment Methods</Text>
          <Text style={styles.appBarSub}>{methods.length} methods</Text>
        </View>
      </View>

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
              <TextInput 
                style={styles.modalInput}
                placeholder="Enter UPI ID (e.g. name@upi)"
                placeholderTextColor={theme.colors.textDim}
                value={newUpiId}
                onChangeText={setNewUpiId}
                autoCapitalize="none"
              />
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
                <TextInput 
                  style={styles.modalInput}
                  placeholder={editMethodId ? "Leave blank to keep existing account" : "Account Number"}
                  placeholderTextColor={theme.colors.textDim}
                  value={newAccNumber}
                  onChangeText={setNewAccNumber}
                  keyboardType="number-pad"
                />
              </>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={submitNewMethod}>
                <Text style={styles.modalSaveText}>{editMethodId ? 'Save' : 'Add'}</Text>
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
