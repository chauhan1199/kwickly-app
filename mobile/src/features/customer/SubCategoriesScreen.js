import React from 'react';
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

const SubCategoriesScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  
  // Provide default values so it doesn't crash if accessed directly
  const { 
    id = 'cleaning', 
    name = 'Cleaning', 
    icon = '🧹', 
    subs = ['Home Cleaning', 'Sofa Cleaning', 'Kitchen Deep Clean', 'Bathroom Cleaning'] 
  } = route.params || {};

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Choose service type</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {subs.map((sub, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.listItem}
            onPress={() => navigation.navigate('DescribeJob', { 
              category: route.params, 
              subcategory: sub 
            })}
          >
            <View style={styles.listIconBox}>
              <Text style={styles.listIconText}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{sub}</Text>
              <Text style={styles.listDesc}>Starting ₹199 · Avg 30-60 min</Text>
            </View>
            <Text style={styles.listArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.suggestBtn}>
          <Text style={styles.suggestBtnText}>+ Missing? Suggest one</Text>
        </TouchableOpacity>

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
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  listIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  listIconText: {
    fontSize: 22,
    color: theme.colors.primary,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  listDesc: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  listArrow: {
    fontSize: 22,
    color: theme.colors.primary,
    marginLeft: 8,
  },
  suggestBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },
  suggestBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  }
});

export default SubCategoriesScreen;
