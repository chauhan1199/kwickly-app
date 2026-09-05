import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Home, ShoppingBag, Plus, MessageSquare, User, Wallet } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  
  // Safe bottom inset calculation: handles on-screen 3-button navigation, gesture bars, and custom Android ROMs
  const windowDiff = Platform.OS === 'android' 
    ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height)
    : 0;
  const bottomInset = insets.bottom > 0 
    ? insets.bottom 
    : (windowDiff > 20 ? windowDiff : (Platform.OS === 'android' ? 14 : 8));

  return (
    <View 
      style={[
        styles.tabBar, 
        { 
          backgroundColor: theme.colors.surface, 
          borderTopColor: theme.colors.border,
          paddingBottom: bottomInset,
          height: 60 + bottomInset,
        }
      ]}
    >
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
            <TouchableOpacity
              key={index}
              activeOpacity={0.85}
              onPress={onPress}
              style={styles.centerTabItem}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.fab,
                  { borderColor: theme.colors.surface },
                  isFocused && styles.fabActive,
                ]}
              >
                <Plus size={24} color="#fff" strokeWidth={2.8} />
              </LinearGradient>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? '#6C47FF' : theme.colors.textMuted,
                    fontWeight: isFocused ? '800' : '600',
                  },
                ]}
              >
                Book
              </Text>
            </TouchableOpacity>
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
            <Icon size={22} color={isFocused ? '#6C47FF' : theme.colors.textMuted} strokeWidth={isFocused ? 2.4 : 1.8} />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isFocused ? '#6C47FF' : theme.colors.textMuted,
                  fontWeight: isFocused ? '800' : '600',
                },
              ]}
            >
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
  tabItemActive: {
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
  fabActive: {
    shadowOpacity: 0.55,
    elevation: 9,
    transform: [{ scale: 1.05 }],
  }
});

export default CustomerTabs;
