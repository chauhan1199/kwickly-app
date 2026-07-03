import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageSquare, Wallet, Wrench, User } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';

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

const MAIN_TABS = ['Jobs', 'Quotes', 'Earnings', 'Services', 'Profile'];

const TAB_ICONS = {
  Jobs:     Home,
  Quotes:     MessageSquare,
  Earnings: Wallet,
  Services: Wrench,
  Profile:  User,
};

const CustomWorkerTabBar = ({ state, descriptors, navigation }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
      {state.routes.map((route, index) => {
        if (!MAIN_TABS.includes(route.name)) return null;

        const isFocused = state.index === index;
        const isCenter = route.name === 'Earnings';
        const Icon = TAB_ICONS[route.name] || Home;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (isCenter) {
          return (
            <View key={route.key} style={styles.fabWrapper}>
              <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.fab, isFocused && styles.fabActive]}
                >
                  <Wallet size={24} color="#fff" strokeWidth={2.5} />
                  <Text style={[styles.fabText, { color: '#fff' }]}>Earnings</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
            onPress={onPress}
            accessibilityRole="button"
          >
            <Icon size={22} color={isFocused ? '#6C47FF' : theme.colors.textDim} />
            <Text style={[styles.tabLabel, { color: isFocused ? '#6C47FF' : theme.colors.textDim }]}>
              {route.name}
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
    <Tab.Screen name="Jobs"     component={WorkerDashboard}           />
    <Tab.Screen name="Quotes"     component={WorkerMyQuotesScreen}        />
    <Tab.Screen name="Earnings" component={WorkerEarningsScreen}      />
    <Tab.Screen name="Services" component={WorkerManageServicesScreen} />
    <Tab.Screen name="Profile"  component={WorkerProfileScreen}       />

    {/* Sub-screens */}
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
    justifyContent: 'flex-end',
    height: '100%',
    position: 'relative',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 10,
    left: -29,
    shadowColor: '#0e9aa7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    color: '#001016',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  fabActive: {
  }
});

export default WorkerTabs;
