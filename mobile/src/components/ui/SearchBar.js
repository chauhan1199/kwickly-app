import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

const PURPLE = '#6C47FF';

export const SearchBar = ({ 
  value, 
  onChangeText, 
  onFilterPress, 
  theme,
  style,
  placeholder = "Search for a service..."
}) => {
  return (
    <View style={[styles.searchBar, { backgroundColor: theme?.colors?.card || '#fff', borderColor: theme?.colors?.border || '#E2E8F0', borderWidth: 1 }, style]}>
      <Search size={20} color={theme?.colors?.textMuted || '#9ca3af'} style={{ marginRight: 8 }} />
      <TextInput
        style={[styles.searchPlaceholder, { color: theme?.colors?.text || '#1E293B', flex: 1, paddingVertical: 6, paddingHorizontal: 0 }]}
        placeholder={placeholder}
        placeholderTextColor={theme?.colors?.textMuted || '#9ca3af'}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value && value.length > 0 ? (
        <TouchableOpacity 
          style={styles.clearBtn} 
          onPress={() => onChangeText('')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color={theme?.colors?.textMuted || '#64748B'} />
        </TouchableOpacity>
      ) : onFilterPress ? (
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: theme?.colors?.primary || PURPLE }]} onPress={onFilterPress}>
          <SlidersHorizontal size={16} color="#fff" />
        </TouchableOpacity>
      ) : null}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
