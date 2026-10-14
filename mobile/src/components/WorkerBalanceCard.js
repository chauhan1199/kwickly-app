import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, EyeOff, Plus, Landmark, Wallet } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const WorkerBalanceCard = ({ balance = 0, onTopUp, onWithdraw, showTopUpOnly = false }) => {
  const { theme, isDarkMode } = useTheme();
  const [showBalance, setShowBalance] = useState(true);

  const numBalance = typeof balance === 'number' ? balance : parseFloat(balance || 0) || 0;
  const formattedBalance = numBalance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDarkMode ? '#334155' : '#EEF2F6',
        }
      ]}
    >
      <View style={styles.content}>
        {/* Header row: Label + Eye Toggle */}
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <View style={styles.walletIconCircle}>
              <Wallet size={14} color="#6C47FF" />
            </View>
            <Text style={[styles.label, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Available Balance
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowBalance(!showBalance)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.eyeBtn}
          >
            {showBalance ? (
              <Eye size={16} color={isDarkMode ? '#94A3B8' : '#94A3B8'} />
            ) : (
              <EyeOff size={16} color={isDarkMode ? '#94A3B8' : '#94A3B8'} />
            )}
          </TouchableOpacity>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceContainer}>
          <Text style={[styles.balance, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1} adjustsFontSizeToFit>
            {showBalance ? `₹${formattedBalance}` : '••••••••'}
          </Text>
          <View style={styles.zeroCommissionBadge}>
            <Text style={styles.zeroCommissionText}>0% Commission • 100% Payout</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.topUpBtnWrapper}
            onPress={onTopUp}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#5830E0', '#7447FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topUpBtn}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.topUpText}>Add Money</Text>
            </LinearGradient>
          </TouchableOpacity>

          {!showTopUpOnly && (
            <TouchableOpacity
              style={[
                styles.withdrawBtn,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                }
              ]}
              onPress={onWithdraw}
              activeOpacity={0.8}
            >
              <Landmark size={15} color={isDarkMode ? '#CBD5E1' : '#475569'} />
              <Text style={[styles.withdrawText, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                Withdraw
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    maxWidth: 720,
    alignSelf: 'center',
    width: '92%',
    borderWidth: 1.2,
    shadowColor: '#5830E0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    marginTop: -16,
    zIndex: 100,
  },
  content: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  eyeBtn: {
    padding: 4,
  },
  balanceContainer: {
    marginBottom: 14,
  },
  balance: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  zeroCommissionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginTop: 3,
  },
  zeroCommissionText: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topUpBtnWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#5830E0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  topUpBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  topUpText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  withdrawBtn: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  withdrawText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});

export default WorkerBalanceCard;
