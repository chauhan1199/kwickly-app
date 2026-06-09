import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingCart, Plus, MessageSquare, User, Wallet } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';
import HomeScreen from '../../features/customer/HomeScreen';
import BookServiceScreen from '../../features/customer/BookServiceScreen';

import SubCategoriesScreen from '../../features/customer/SubCategoriesScreen';
import DescribeJobScreen from '../../features/customer/DescribeJobScreen';
import LiveBidsScreen from '../../features/customer/LiveBidsScreen';
import LiveTrackingScreen from '../../features/customer/LiveTrackingScreen';
import WorkCompletedScreen from '../../features/customer/WorkCompletedScreen';
import RateExperienceScreen from '../../features/customer/RateExperienceScreen';
import PastJobDetailsScreen from '../../features/customer/PastJobDetailsScreen';
import ShopScreen from '../../features/customer/ShopScreen';
import WorkerProfileScreen from '../../features/customer/WorkerProfileScreen';
import QuotesScreen from '../../features/customer/QuotesScreen';
import ShopOrderDetailsScreen from '../../features/customer/ShopOrderDetailsScreen';
import ProfileScreen from '../../features/customer/ProfileScreen';
import EditProfileScreen from '../../features/customer/EditProfileScreen';
import SavedAddressesScreen from '../../features/customer/SavedAddressesScreen';
import PaymentMethodsScreen from '../../features/customer/PaymentMethodsScreen';
import ReferEarnScreen from '../../features/customer/ReferEarnScreen';
import HelpSupportScreen from '../../features/customer/HelpSupportScreen';
import PrivacyScreen from '../../features/customer/PrivacyScreen';
import CustomerWalletScreen from '../../features/customer/CustomerWalletScreen';
import CartScreen from '../../features/customer/CartScreen';
import NotificationsScreen from '../../features/shared/NotificationsScreen';

const Tab = createBottomTabNavigator();

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        
        // Only render the 5 main tabs in the bottom bar
        const mainTabs = ['Home', 'Shop', 'Book', 'Wallet', 'Profile'];
        if (!mainTabs.includes(route.name)) return null;

        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;
        const isCenter = route.name === 'Book';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isCenter) {
          return (
            <View key={index} style={styles.fabWrapper}>
              <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
                <LinearGradient
                  colors={['#0e9aa7', '#43e3eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.fab, isFocused && styles.fabActive]}
                >
                  <Plus size={24} color="#001016" strokeWidth={2.5} />
                  <Text style={styles.fabText}>Book</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        }

        let Icon = Home;
        if (route.name === 'Shop')   Icon = ShoppingCart;
        if (route.name === 'Wallet') Icon = Wallet;
        if (route.name === 'Quotes') Icon = MessageSquare;
        if (route.name === 'Profile') Icon = User;

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
          >
            <Icon size={22} color={isFocused ? Theme.colors.primary : Theme.colors.textDim} />
            <Text style={[styles.tabLabel, { color: isFocused ? Theme.colors.primary : Theme.colors.textDim }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const CustomerTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"   component={HomeScreen} />
      <Tab.Screen name="Shop"   component={ShopScreen} />
      <Tab.Screen name="Book"   component={BookServiceScreen} />
      <Tab.Screen name="Wallet" component={CustomerWalletScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      
      {/* Sub-screens registered here so they have the bottom tab bar */}
      <Tab.Screen name="SubCategories" component={SubCategoriesScreen} />
      <Tab.Screen name="DescribeJob" component={DescribeJobScreen} />
      <Tab.Screen name="LiveBids" component={LiveBidsScreen} />
      <Tab.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Tab.Screen name="WorkCompleted" component={WorkCompletedScreen} />
      <Tab.Screen name="RateExperience" component={RateExperienceScreen} />
      <Tab.Screen name="PastJobDetails" component={PastJobDetailsScreen} />
      <Tab.Screen name="WorkerProfile" component={WorkerProfileScreen} />
      <Tab.Screen name="ShopOrderDetails" component={ShopOrderDetailsScreen} />
      <Tab.Screen name="EditProfile" component={EditProfileScreen} />
      <Tab.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Tab.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Tab.Screen name="ReferEarn"      component={ReferEarnScreen}       />
      <Tab.Screen name="HelpSupport"     component={HelpSupportScreen}     />
      <Tab.Screen name="Privacy"         component={PrivacyScreen}         />
      <Tab.Screen name="Cart"            component={CartScreen}            />
      <Tab.Screen name="Notifications"   component={NotificationsScreen}   />
      <Tab.Screen name="Quotes"          component={QuotesScreen}          />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: Theme.colors.primary + '10',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
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
    borderColor: Theme.colors.surface,
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
    // Optionally dim the FAB when active
  }
});

export default CustomerTabs;
