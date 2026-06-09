import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Bell, FileText, Phone, CheckCircle2, Box, Truck } from 'lucide-react-native';

const ShopOrderDetailsScreen = ({ navigation, route }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const order = route.params?.order || {
    id: 'SO1023',
    customer: 'Anita S.',
    items: 3,
    total: 758,
    status: 'new' // 'new', 'packing', 'out', 'delivered'
  };

  const mockItems = [
    { name: 'Basmati Rice', price: 138 },
    { name: 'Sunflower Oil', price: 284 },
    { name: 'Sugar', price: 326 },
  ];

  // Map status to step index
  const statusToStep = {
    'new': 0,
    'packing': 1,
    'out': 2,
    'delivered': 3
  };
  const currentStepIndex = statusToStep[order.status] || 0;

  const timelineSteps = [
    { key: 'new', label: 'New Order', icon: FileText },
    { key: 'packing', label: 'Packing', icon: Box },
    { key: 'out', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  const renderTimeline = () => {
    return (
      <View style={styles.timelineContainer}>
        {timelineSteps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;
          
          let dotColor = '#CBD5E1'; // pending
          if (isActive) dotColor = '#0EA5E9'; // active brand color
          if (isPast) dotColor = '#10B981'; // completed green

          return (
            <View key={step.key} style={styles.timelineRow}>
              {/* Vertical line connecting dots */}
              {index !== timelineSteps.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: isPast ? '#10B981' : '#E2E8F0' }]} />
              )}
              
              <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                {isPast ? <CheckCircle2 size={12} color="#FFF" /> : null}
              </View>
              
              <View style={styles.timelineContent}>
                <Icon size={16} color={isActive ? theme.colors.text : theme.colors.textDim} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.timelineText, 
                  isActive && styles.timelineTextActive,
                  isPast && styles.timelineTextPast
                ]}>
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderActionButtons = () => {
    if (order.status === 'new') {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => {}}>
            <Text style={styles.primaryBtnText}>Start Packing →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => {}}>
            <Bell size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Notify Customer</Text>
          </TouchableOpacity>
        </>
      );
    } else if (order.status === 'packing') {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => {}}>
            <Text style={styles.primaryBtnText}>Mark Out for Delivery →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => {}}>
            <Bell size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Notify Customer</Text>
          </TouchableOpacity>
        </>
      );
    } else if (order.status === 'out') {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => {}}>
            <Text style={styles.primaryBtnText}>Mark Delivered</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => {}}>
            <Bell size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Notify Customer</Text>
          </TouchableOpacity>
        </>
      );
    }
    return null; // Delivered doesn't need these buttons usually
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.appBarTitle}>Order {order.id}</Text>
            <Text style={styles.appBarSubtitle}>{order.customer}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.appBarIconBtn}>
          <Bell size={20} color={theme.colors.text} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Timeline */}
        {renderTimeline()}

        {/* Customer Card */}
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>{order.customer.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{order.customer}</Text>
            <Text style={styles.customerRole}>Customer</Text>
          </View>
          <TouchableOpacity style={styles.phoneBtn}>
            <Phone size={18} color="#EC4899" />
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>Items ({mockItems.length})</Text>
        <View style={styles.itemsCard}>
          {mockItems.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{order.total}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {renderActionButtons()}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  appBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444', // Red or primary
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  scrollContent: {
    padding: 20,
  },
  timelineContainer: {
    paddingLeft: 12,
    marginBottom: 32,
    paddingTop: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 7.5, // Center under the 16px dot
    top: 16,
    bottom: -24,
    width: 2,
    zIndex: 0,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  timelineText: {
    fontSize: 15,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  timelineTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  timelineTextPast: {
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  customerRole: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCE7F3', // Light pink background
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    color: theme.colors.text,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0EA5E9', // Cyan color like in mockup
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  }
});

export default ShopOrderDetailsScreen;
