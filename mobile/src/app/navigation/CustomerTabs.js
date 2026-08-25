import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Home, ShoppingBag, Plus, MessageSquare, User, Wallet } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';

// Main tab screens
import HomeScreen              from '../../features/customer/HomeScreen';
import BookServiceScreen       from '../../features/customer/BookServiceScreen';
import ShopScreen              from '../../features/customer/ShopScreen';
import CustomerWalletScreen    from '../../features/customer/CustomerWalletScreen';
import ProfileScreen           from '../../features/customer/ProfileScreen';

// Sub-screens
import SubCategoriesScreen     from '../../features/customer/SubCategoriesScreen';
import DescribeJobScreen       from '../../features/customer/DescribeJobScreen';
import LiveBidsScreen          from '../../features/customer/LiveBidsScreen';
import LiveTrackingScreen      from '../../features/customer/LiveTrackingScreen';
import WorkCompletedScreen     from '../../features/customer/WorkCompletedScreen';
import RateExperienceScreen    from '../../features/customer/RateExperienceScreen';
import PastJobDetailsScreen    from '../../features/customer/PastJobDetailsScreen';
import WorkerProfileScreen     from '../../features/customer/WorkerProfileScreen';
import ShopOrderDetailsScreen  from '../../features/customer/ShopOrderDetailsScreen';
import CustomerShopOrdersScreen from '../../features/customer/CustomerShopOrdersScreen';
import EditProfileScreen       from '../../features/customer/EditProfileScreen';
import SavedAddressesScreen    from '../../features/customer/SavedAddressesScreen';
import PaymentMethodsScreen    from '../../features/customer/PaymentMethodsScreen';
import ReferEarnScreen         from '../../features/customer/ReferEarnScreen';
import HelpSupportScreen       from '../../features/customer/HelpSupportScreen';
import PrivacyScreen           from '../../features/customer/PrivacyScreen';
import CartScreen              from '../../features/customer/CartScreen';
import NotificationsScreen     from '../../features/shared/NotificationsScreen';
import ShopDetailScreen        from '../../features/customer/ShopDetailScreen';
import OrderTrackingScreen     from '../../features/customer/OrderTrackingScreen';
import OrderHistoryScreen      from '../../features/customer/OrderHistoryScreen';
import WalletTopupScreen       from '../../features/customer/WalletTopupScreen';
import QuotesScreen            from '../../features/customer/QuotesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* ──────────────────────────────────────────────
   Per-tab Stack navigators so goBack() works
────────────────────────────────────────────── */
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeMain"           component={HomeScreen} />
    {/* Booking flow — accessible from Home service cards */}
    <Stack.Screen name="SubCategories"      component={SubCategoriesScreen} />
    <Stack.Screen name="DescribeJob"        component={DescribeJobScreen} />
    <Stack.Screen name="SavedAddresses"     component={SavedAddressesScreen} />
    <Stack.Screen name="Quotes"             component={QuotesScreen} />
    <Stack.Screen name="LiveBids"           component={LiveBidsScreen} />
    <Stack.Screen name="LiveTracking"       component={LiveTrackingScreen} />
    <Stack.Screen name="WorkCompleted"      component={WorkCompletedScreen} />
    <Stack.Screen name="RateExperience"     component={RateExperienceScreen} />
    <Stack.Screen name="PastJobDetails"     component={PastJobDetailsScreen} />
    <Stack.Screen name="WorkerProfile"      component={WorkerProfileScreen} />
    <Stack.Screen name="CustomerShopOrders" component={CustomerShopOrdersScreen} />
    <Stack.Screen name="OrderTracking"      component={OrderTrackingScreen} />
    <Stack.Screen name="ShopDetail"         component={ShopDetailScreen} />
    <Stack.Screen name="Cart"               component={CartScreen} />
    <Stack.Screen name="ShopOrderDetails"   component={ShopOrderDetailsScreen} />
    <Stack.Screen name="Notifications"      component={NotificationsScreen} />
  </Stack.Navigator>
);

const ShopStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopMain"         component={ShopScreen} />
    <Stack.Screen name="CustomerShopOrders" component={CustomerShopOrdersScreen} />
    <Stack.Screen name="ShopDetail"       component={ShopDetailScreen} />
    <Stack.Screen name="Cart"             component={CartScreen} />
    <Stack.Screen name="ShopOrderDetails" component={ShopOrderDetailsScreen} />
    <Stack.Screen name="OrderTracking"    component={OrderTrackingScreen} />
    <Stack.Screen name="Notifications"    component={NotificationsScreen} />
  </Stack.Navigator>
);

const BookStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="BookMain"         component={BookServiceScreen} />
    <Stack.Screen name="SubCategories"    component={SubCategoriesScreen} />
    <Stack.Screen name="DescribeJob"      component={DescribeJobScreen} />
    <Stack.Screen name="SavedAddresses"   component={SavedAddressesScreen} />
    <Stack.Screen name="LiveBids"         component={LiveBidsScreen} />
    <Stack.Screen name="LiveTracking"     component={LiveTrackingScreen} />
    <Stack.Screen name="WorkCompleted"    component={WorkCompletedScreen} />
    <Stack.Screen name="RateExperience"   component={RateExperienceScreen} />
    <Stack.Screen name="WorkerProfile"    component={WorkerProfileScreen} />
    <Stack.Screen name="Quotes"           component={QuotesScreen} />
    <Stack.Screen name="Notifications"    component={NotificationsScreen} />
  </Stack.Navigator>
);

const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WalletMain"       component={CustomerWalletScreen} />
    <Stack.Screen name="WalletTopup"      component={WalletTopupScreen} />
    <Stack.Screen name="Notifications"    component={NotificationsScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain"         component={ProfileScreen} />
    <Stack.Screen name="EditProfile"         component={EditProfileScreen} />
    <Stack.Screen name="SavedAddresses"      component={SavedAddressesScreen} />
    <Stack.Screen name="PaymentMethods"      component={PaymentMethodsScreen} />
    <Stack.Screen name="CustomerShopOrders"  component={CustomerShopOrdersScreen} />
    <Stack.Screen name="OrderHistory"        component={OrderHistoryScreen} />
    <Stack.Screen name="OrderTracking"       component={OrderTrackingScreen} />
    <Stack.Screen name="ShopDetail"          component={ShopDetailScreen} />
    <Stack.Screen name="Cart"                component={CartScreen} />
    <Stack.Screen name="ShopOrderDetails"    component={ShopOrderDetailsScreen} />
    <Stack.Screen name="ReferEarn"           component={ReferEarnScreen} />
    <Stack.Screen name="HelpSupport"         component={HelpSupportScreen} />
    <Stack.Screen name="Privacy"             component={PrivacyScreen} />
    <Stack.Screen name="Notifications"       component={NotificationsScreen} />
  </Stack.Navigator>
);

/* ──────────────────────────────────────────────
   Custom Tab Bar
────────────────────────────────────────────── */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { theme, isDarkMode } = useTheme();

  return (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

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
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.fab, isFocused && styles.fabActive]}
                >
                  <Plus size={24} color="#fff" strokeWidth={2.5} />
                  <Text style={[styles.fabText, { color: '#fff' }]}>Book</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        }

        let Icon = Home;
        if (route.name === 'Home')    Icon = Home;
        if (route.name === 'Shop')    Icon = ShoppingBag;
        if (route.name === 'Wallet')  Icon = Wallet;
        if (route.name === 'Profile') Icon = User;

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
          >
            <Icon size={22} color={isFocused ? '#6C47FF' : theme.colors.textMuted} />
            <Text style={[styles.tabLabel, { color: isFocused ? '#6C47FF' : theme.colors.textMuted }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/* ──────────────────────────────────────────────
   CustomerTabs — main bottom tab navigator
────────────────────────────────────────────── */
const CustomerTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home"    component={HomeStack} />
    <Tab.Screen name="Shop"    component={ShopStack} />
    <Tab.Screen name="Book"    component={BookStack} />
    <Tab.Screen name="Wallet"  component={WalletStack} />
    <Tab.Screen name="Profile" component={ProfileStack} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 72,
    borderTopWidth: 1,
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

export default CustomerTabs;
