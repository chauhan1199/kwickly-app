import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, DeviceEventEmitter, Platform, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { Home, Briefcase, Wallet, User, Power } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// Screens
import WorkerDashboard              from '../../features/worker/WorkerDashboard';
import WorkerMyQuotesScreen         from '../../features/worker/WorkerMyQuotesScreen';
import WorkerEarningsScreen         from '../../features/worker/WorkerEarningsScreen';
import WorkerManageServicesScreen   from '../../features/worker/WorkerManageServicesScreen';
import WorkerProfileScreen          from '../../features/worker/WorkerProfileScreen';

// Sub-screens (registered but not shown in tab bar)
import WorkerJobDetailsScreen       from '../../features/worker/WorkerJobDetailsScreen';
import WorkerNavigateJobScreen      from '../../features/worker/WorkerNavigateJobScreen';
import WorkerArrivalOTPScreen       from '../../features/worker/WorkerArrivalOTPScreen';
import WorkerActiveJobScreen        from '../../features/worker/WorkerActiveJobScreen';
import WorkerJobCompleteScreen      from '../../features/worker/WorkerJobCompleteScreen';
import WorkerRateCustomerScreen     from '../../features/worker/WorkerRateCustomerScreen';
import WorkerJobCanceledScreen      from '../../features/worker/WorkerJobCanceledScreen';
import NotificationsScreen          from '../../features/shared/NotificationsScreen';
import HelpSupportScreen            from '../../features/customer/HelpSupportScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* ──────────────────────────────────────────────
   Per-tab Stack navigators so goBack() works
────────────────────────────────────────────── */
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WorkerDashboard"   component={WorkerDashboard} />
    <Stack.Screen name="WorkerJobDetails"  component={WorkerJobDetailsScreen} />
    <Stack.Screen name="WorkerNavigateJob" component={WorkerNavigateJobScreen} />
    <Stack.Screen name="WorkerArrivalOTP"  component={WorkerArrivalOTPScreen} />
    <Stack.Screen name="WorkerActiveJob"   component={WorkerActiveJobScreen} />
    <Stack.Screen name="WorkerJobComplete" component={WorkerJobCompleteScreen} />
    <Stack.Screen name="WorkerRateCustomer" component={WorkerRateCustomerScreen} />
    <Stack.Screen name="WorkerJobCanceled" component={WorkerJobCanceledScreen} />
    <Stack.Screen name="Notifications"     component={NotificationsScreen} />
    <Stack.Screen name="Services"          component={WorkerManageServicesScreen} />
  </Stack.Navigator>
);

const QuotesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WorkerMyQuotes"    component={WorkerMyQuotesScreen} />
    <Stack.Screen name="WorkerJobDetails"  component={WorkerJobDetailsScreen} />
    <Stack.Screen name="WorkerNavigateJob" component={WorkerNavigateJobScreen} />
    <Stack.Screen name="WorkerArrivalOTP"  component={WorkerArrivalOTPScreen} />
    <Stack.Screen name="WorkerActiveJob"   component={WorkerActiveJobScreen} />
    <Stack.Screen name="WorkerJobComplete" component={WorkerJobCompleteScreen} />
    <Stack.Screen name="WorkerRateCustomer" component={WorkerRateCustomerScreen} />
    <Stack.Screen name="WorkerJobCanceled" component={WorkerJobCanceledScreen} />
  </Stack.Navigator>
);

const EarningsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WorkerEarnings" component={WorkerEarningsScreen} />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WorkerProfile"   component={WorkerProfileScreen} />
    <Stack.Screen name="Services"        component={WorkerManageServicesScreen} />
    <Stack.Screen name="HelpSupport"     component={HelpSupportScreen} />
    <Stack.Screen name="Notifications"   component={NotificationsScreen} />
  </Stack.Navigator>
);

/* ──────────────────────────────────────────────
   Custom Tab Bar
────────────────────────────────────────────── */
const MAIN_TABS = ['Dashboard', 'Quotes', 'Power', 'Earnings', 'Profile'];

const TAB_ICONS = {
  Dashboard: Home,
  Quotes: Briefcase,
  Earnings: Wallet,
  Profile: User,
};

const CustomWorkerTabBar = ({ state, descriptors, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 6 : 8);

  return (
    <View 
      style={[
        styles.tabBar, 
        { 
          backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', 
          borderTopColor: isDarkMode ? '#1E293B' : '#F1F5F9',
          paddingBottom: bottomInset,
          height: 58 + bottomInset,
        }
      ]}
    >
      {state.routes.map((route, index) => {
        if (!MAIN_TABS.includes(route.name) && route.name !== 'Power') return null;

        const isFocused = state.index === index;
        const Icon = TAB_ICONS[route.name] || Home;

        if (route.name === 'Power') {
          const isOnline = user?.isOnline || false;
          return (
            <TouchableOpacity 
              key={route.key} 
              style={styles.centerTabItem}
              activeOpacity={0.88} 
              onPress={() => {
                DeviceEventEmitter.emit('toggleDutyStatus');
              }}
            >
              <LinearGradient
                colors={isOnline ? ['#10B981', '#059669'] : ['#475569', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.fab, 
                  { 
                    borderColor: isOnline ? 'rgba(16, 185, 129, 0.4)' : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                    shadowColor: isOnline ? '#10B981' : '#000000',
                    elevation: isOnline ? 8 : 4,
                  }
                ]}
              >
                <Power size={22} color="#FFFFFF" strokeWidth={2.8} />
              </LinearGradient>
              <Text style={[
                styles.tabLabel, 
                { 
                  color: isOnline ? '#10B981' : (isDarkMode ? '#94A3B8' : '#64748B'),
                  fontWeight: '800'
                }
              ]}>
                {isOnline ? 'On Duty' : 'Off Duty'}
              </Text>
            </TouchableOpacity>
          );
        }

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={[styles.tabItem]}
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Icon size={22} color={isFocused ? '#6C47FF' : (isDarkMode ? '#64748B' : '#94A3B8')} strokeWidth={isFocused ? 2.5 : 1.8} />
            <Text style={[
              styles.tabLabel, 
              { 
                color: isFocused ? '#6C47FF' : (isDarkMode ? '#64748B' : '#94A3B8'), 
                fontWeight: isFocused ? '800' : '600' 
              }
            ]}>
              {route.name === 'Dashboard' ? 'Home' : route.name === 'Quotes' ? 'Jobs' : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const DummyScreen = () => null;

/* ──────────────────────────────────────────────
   WorkerTabs — main bottom tab navigator
────────────────────────────────────────────── */
const WorkerTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomWorkerTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Dashboard" component={DashboardStack} />
    <Tab.Screen name="Quotes"    component={QuotesStack} />
    <Tab.Screen name="Power"     component={DummyScreen} />
    <Tab.Screen name="Earnings"  component={EarningsStack} />
    <Tab.Screen name="Profile"   component={ProfileStack} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'flex-start',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.1,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 1,
  },
});

export default WorkerTabs;
