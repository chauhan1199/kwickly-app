import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Home, ShoppingBag, Package, Wallet, User } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

// Main screens
import ShopDashboardScreen    from '../../features/shop/ShopDashboardScreen';
import ShopOrdersScreen       from '../../features/shop/ShopOrdersScreen';
import ShopProductsScreen     from '../../features/shop/ShopProductsScreen';
import ShopWalletScreen       from '../../features/shop/ShopWalletScreen';
import ShopSettingsScreen     from '../../features/shop/ShopSettingsScreen';

// Sub-screens
import ShopOrderDetailScreen  from '../../features/shop/ShopOrderDetailScreen';
import ShopNotificationsScreen from '../../features/shop/ShopNotificationsScreen';
import ShopDeliveryConfigScreen from '../../features/shop/ShopDeliveryConfigScreen';
import CreateShopScreen       from '../../features/shop/CreateShopScreen';
import HelpSupportScreen      from '../../features/customer/HelpSupportScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* ──────────────────────────────────────────────
   Per-tab Stack navigators
   Each main tab has its own stack so goBack() works
────────────────────────────────────────────── */
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopDashboard"   component={ShopDashboardScreen} />
    <Stack.Screen name="CreateShop"      component={CreateShopScreen} />
    <Stack.Screen name="ShopOrderDetails" component={ShopOrderDetailScreen} />
    <Stack.Screen name="ShopNotifications" component={ShopNotificationsScreen} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopOrders"      component={ShopOrdersScreen} />
    <Stack.Screen name="ShopOrderDetails" component={ShopOrderDetailScreen} />
    <Stack.Screen name="ShopNotifications" component={ShopNotificationsScreen} />
  </Stack.Navigator>
);

const ProductsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopProducts"    component={ShopProductsScreen} />
    <Stack.Screen name="ShopNotifications" component={ShopNotificationsScreen} />
  </Stack.Navigator>
);

const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopWallet"      component={ShopWalletScreen} />
    <Stack.Screen name="ShopNotifications" component={ShopNotificationsScreen} />
  </Stack.Navigator>
);

const SettingsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ShopSettings"       component={ShopSettingsScreen} />
    <Stack.Screen name="ShopDeliveryConfig"  component={ShopDeliveryConfigScreen} />
    <Stack.Screen name="ShopNotifications"   component={ShopNotificationsScreen} />
    <Stack.Screen name="HelpSupport"         component={HelpSupportScreen} />
  </Stack.Navigator>
);

/* ──────────────────────────────────────────────
   Custom Tab Bar
────────────────────────────────────────────── */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let Icon = Home;
        if (route.name === 'Orders')   Icon = ShoppingBag;
        if (route.name === 'Products') Icon = Package;
        if (route.name === 'Wallet')   Icon = Wallet;
        if (route.name === 'Settings') Icon = User;

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={[styles.tabItem, isFocused && { backgroundColor: theme.colors.primary + '10' }]}
          >
            <Icon size={22} color={isFocused ? theme.colors.primary : theme.colors.textDim} />
            <Text style={[styles.tabLabel, { color: isFocused ? theme.colors.primary : theme.colors.textDim }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/* ──────────────────────────────────────────────
   ShopTabs — main bottom tab navigator
────────────────────────────────────────────── */
const ShopTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Dashboard" component={DashboardStack} />
    <Tab.Screen name="Orders"    component={OrdersStack} />
    <Tab.Screen name="Products"  component={ProductsStack} />
    <Tab.Screen name="Wallet"    component={WalletStack} />
    <Tab.Screen name="Settings"  component={SettingsStack} />
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
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  }
});

export default ShopTabs;
