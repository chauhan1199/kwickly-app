import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageSquare, Wallet, Wrench, User } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';

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

const CustomWorkerTabBar = ({ state, descriptors, navigation }) => (
  <View style={styles.tabBar}>
    {state.routes.map((route, index) => {
      if (!MAIN_TABS.includes(route.name)) return null;

      const isFocused = state.index === index;
      const Icon = TAB_ICONS[route.name] || Home;

      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
      };

      return (
        <TouchableOpacity
          key={route.name}
          style={[styles.tabItem, isFocused && styles.tabItemActive]}
          onPress={onPress}
          accessibilityRole="button"
        >
          {isFocused && (
            <View style={styles.activeIndicator} />
          )}
          <Icon size={22} color={isFocused ? Theme.colors.primary : Theme.colors.textDim} />
          <Text style={[styles.tabLabel, { color: isFocused ? Theme.colors.primary : Theme.colors.textDim }]}>
            {route.name}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

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
    flexDirection:   'row',
    height:          72,
    backgroundColor: Theme.colors.surface,
    borderTopWidth:  1,
    borderTopColor:  Theme.colors.border,
    alignItems:      'center',
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position:       'relative',
  },
  tabItemActive: {
    backgroundColor: Theme.colors.primary + '10',
    borderRadius:    12,
    marginHorizontal: 4,
  },
  activeIndicator: {
    position:        'absolute',
    top:             0,
    width:           24,
    height:          3,
    backgroundColor: Theme.colors.primary,
    borderBottomLeftRadius:  3,
    borderBottomRightRadius: 3,
  },
  tabLabel: {
    fontSize:   10,
    fontWeight: '700',
    marginTop:  4,
  },
});

export default WorkerTabs;
