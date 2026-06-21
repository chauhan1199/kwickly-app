import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Package, Wallet, User } from 'lucide-react-native';
import Theme from '../../constants/Theme';

import ShopDashboardScreen from '../../features/shop/ShopDashboardScreen';
import ShopOrdersScreen from '../../features/shop/ShopOrdersScreen';
import ShopProductsScreen from '../../features/shop/ShopProductsScreen';
import ShopWalletScreen from '../../features/shop/ShopWalletScreen';
import ShopSettingsScreen from '../../features/shop/ShopSettingsScreen';
import ShopOrderDetailsScreen from '../../features/shop/ShopOrderDetailScreen';
import ShopNotificationsScreen from '../../features/shop/ShopNotificationsScreen';
import ShopDeliveryConfigScreen from '../../features/shop/ShopDeliveryConfigScreen';
import CreateShopScreen from '../../features/shop/CreateShopScreen';

const Tab = createBottomTabNavigator();

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        
        // Only show main tabs in the bottom bar
        const mainTabs = ['Dashboard', 'Orders', 'Products', 'Wallet', 'Settings'];
        if (!mainTabs.includes(route.name)) return null;

        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let Icon = Home;
        if (route.name === 'Orders') Icon = ShoppingBag;
        if (route.name === 'Products') Icon = Package;
        if (route.name === 'Wallet') Icon = Wallet;
        if (route.name === 'Settings') Icon = User;

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

const ShopTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={ShopDashboardScreen} />
      <Tab.Screen name="Orders" component={ShopOrdersScreen} />
      <Tab.Screen name="Products" component={ShopProductsScreen} />
      <Tab.Screen name="Wallet" component={ShopWalletScreen} />
      <Tab.Screen name="Settings" component={ShopSettingsScreen} />
      
      {/* Sub-screens registered here to keep the bottom tab bar visible */}
      <Tab.Screen name="ShopOrderDetails" component={ShopOrderDetailsScreen} />
      <Tab.Screen name="ShopNotifications" component={ShopNotificationsScreen} />
      <Tab.Screen name="ShopDeliveryConfig" component={ShopDeliveryConfigScreen} />
      <Tab.Screen name="CreateShop" component={CreateShopScreen} />
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
  }
});

export default ShopTabs;
