import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageSquare, Wallet, Wrench, User } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// Screens
import WorkerDashboard        from '../../features/worker/WorkerDashboard';
import WorkerMyQuotesScreen     from '../../features/worker/WorkerMyQuotesScreen';
import WorkerEarningsScreen   from '../../features/worker/WorkerEarningsScreen';
import WorkerManageServicesScreen from '../../features/worker/WorkerManageServicesScreen';
import WorkerProfileScreen    from '../../features/worker/WorkerProfileScreen';

// Sub-screens (registered but not shown in tab bar)
import WorkerJobDetailsScreen  from '../../features/worker/WorkerJobDetailsScreen';
import WorkerNavigateJobScreen from '../../features/worker/WorkerNavigateJobScreen';
import WorkerArrivalOTPScreen  from '../../features/worker/WorkerArrivalOTPScreen';
import WorkerActiveJobScreen   from '../../features/worker/WorkerActiveJobScreen';
import WorkerJobCompleteScreen from '../../features/worker/WorkerJobCompleteScreen';
import WorkerRateCustomerScreen from '../../features/worker/WorkerRateCustomerScreen';
import WorkerJobCanceledScreen from '../../features/worker/WorkerJobCanceledScreen';
import NotificationsScreen     from '../../features/shared/NotificationsScreen';
import HelpSupportScreen       from '../../features/customer/HelpSupportScreen';

const Tab = createBottomTabNavigator();

const MAIN_TABS = ['Dashboard', 'Quotes', 'Power', 'Earnings', 'Profile'];

const TAB_ICONS = {
  Dashboard: Home,
  Quotes: MessageSquare,
  Earnings: Wallet,
  Profile: User,
};

const CustomWorkerTabBar = ({ state, descriptors, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // Duty status is typically managed via context or a global store. 
  // For this UI, we can toggle it visually or dispatch an event.
  // Actually, standard practice here is to dispatch a 'TOGGLE_DUTY_STATUS' event 
  // or use the auth context if isOnline is there. 
  // Since we don't have the context here easily, we'll just emit an event or rely on the dashboard.
  
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
      {state.routes.map((route, index) => {
        if (!MAIN_TABS.includes(route.name) && route.name !== 'Power') return null;

        const isFocused = state.index === index;
        const Icon = TAB_ICONS[route.name] || Home;

        if (route.name === 'Power') {
          const isOnline = user?.isOnline || false;
          return (
            <View key={route.key} style={styles.fabWrapper}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => {
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('toggleDutyStatus');
              }}>
                <LinearGradient
                  colors={isOnline ? ['#6C47FF', '#8B6FFF'] : ['#9CA3AF', '#D1D5DB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.fab]}
                >
                  <View style={{width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center'}}>
                    <View style={{width: 2, height: 10, backgroundColor: '#fff', position: 'absolute', top: -2}} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={[styles.tabLabel, { color: theme.colors.textDim }]}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
            </View>
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
            accessibilityRole="button"
          >
            <Icon size={22} color={isFocused ? '#6C47FF' : theme.colors.textDim} strokeWidth={isFocused ? 2.5 : 2} />
            <Text style={[styles.tabLabel, { color: isFocused ? '#6C47FF' : theme.colors.textDim }]}>
              {route.name === 'Dashboard' ? 'Home' : route.name === 'Quotes' ? 'Jobs' : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const WorkerTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomWorkerTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    {/* Main Tabs */}
    <Tab.Screen name="Dashboard"  component={WorkerDashboard}           />
    <Tab.Screen name="Quotes"     component={WorkerMyQuotesScreen}        />
    <Tab.Screen name="Power"      component={View} /* Dummy component for the button */ />
    <Tab.Screen name="Earnings"   component={WorkerEarningsScreen}      />
    <Tab.Screen name="Profile"    component={WorkerProfileScreen}       />

    {/* Sub-screens */}
    <Tab.Screen name="Services"            component={WorkerManageServicesScreen} />
    <Tab.Screen name="WorkerJobDetails"    component={WorkerJobDetailsScreen}   />
    <Tab.Screen name="WorkerNavigateJob"   component={WorkerNavigateJobScreen}  />
    <Tab.Screen name="WorkerArrivalOTP"    component={WorkerArrivalOTPScreen}   />
    <Tab.Screen name="WorkerActiveJob"     component={WorkerActiveJobScreen}    />
    <Tab.Screen name="WorkerJobComplete"   component={WorkerJobCompleteScreen}  />
    <Tab.Screen name="WorkerRateCustomer"  component={WorkerRateCustomerScreen} />
    <Tab.Screen name="WorkerJobCanceled"   component={WorkerJobCanceledScreen}  />
    <Tab.Screen name="HelpSupport"         component={HelpSupportScreen}        />
    <Tab.Screen name="Notifications"       component={NotificationsScreen}      />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  tabItemActive: {
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  fabWrapper: {
    flex: 0,
    flexBasis: 68,
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
    position: 'relative',
    marginTop: -20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 4,
  },
  fabActive: {
  }
});

export default WorkerTabs;
