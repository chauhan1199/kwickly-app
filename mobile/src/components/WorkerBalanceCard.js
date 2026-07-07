import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, Plus, CreditCard, Landmark } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const WorkerBalanceCard = ({ balance, onTopUp, onWithdraw, showTopUpOnly = false }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.label}>Available Balance</Text>
          <Eye size={14} color="#8a99ad" style={{ marginLeft: 6 }} />
        </View>

        <Text style={styles.balance}>₹{balance?.toFixed(2) || '0.00'}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.topUpBtn} onPress={onTopUp}>
            <Plus size={16} color="#fff" />
            <Text style={styles.topUpText}>Add Money</Text>
          </TouchableOpacity>

          {!showTopUpOnly && (
            <TouchableOpacity style={styles.withdrawBtn} onPress={onWithdraw}>
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.graphicContainer}>
        <CreditCard size={64} color={theme.colors.textDim} strokeWidth={1.5} style={{ transform: [{ rotate: '15deg' }], opacity: 0.1 }} />
      </View>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    marginTop: -20, // Overlap the header
    zIndex: 100,
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  balance: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topUpBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  topUpText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  withdrawBtn: {
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  graphicContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 120,
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 16,
    zIndex: 1,
    overflow: 'hidden',
    borderBottomRightRadius: 24,
  }
});

export default WorkerBalanceCard;
