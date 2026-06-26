import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';

const PURPLE = '#6C47FF';

export const SearchBar = ({ 
  value, 
  onChangeText, 
  onFilterPress, 
  theme,
  placeholder = "Search for a service..."
}) => {
  return (
    <View style={[styles.searchBar, { backgroundColor: theme.colors.card }]}>
      <Search size={20} color={theme.colors.textMuted || '#9ca3af'} style={{ marginRight: 8 }} />
      <TextInput
        style={[styles.searchPlaceholder, { color: theme.colors.text, flex: 1, paddingVertical: 6, paddingHorizontal: 0 }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted || '#9ca3af'}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity style={styles.filterBtn} onPress={onFilterPress}>
        <SlidersHorizontal size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 14,
  },
  filterBtn: {
    backgroundColor: PURPLE,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
