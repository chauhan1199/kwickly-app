import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  Dimensions
} from 'react-native';
import Theme from '../../constants/Theme';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - (Theme.spacing.lg * 2) - (Theme.spacing.md * 2)) / 3;

const CategoryGrid = ({ data, onCategoryPress }) => {
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.categoryItem} 
      onPress={() => onCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' || Theme.colors.card }]}>
        <Text style={styles.iconText}>{item.icon || '🛠️'}</Text>
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Categories</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        numColumns={3}
        scrollEnabled={false}
        columnWrapperStyle={styles.columnWrapper}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontSize: Theme.typography.sizes.lg,
    fontWeight: Theme.typography.weights.bold,
    color: Theme.colors.text,
  },
  seeAll: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.primary,
    fontWeight: Theme.typography.weights.medium,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  categoryItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  iconContainer: {
    width:ITEM_WIDTH * 0.8,
    height: ITEM_WIDTH * 0.8,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  iconText: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.text,
    textAlign: 'center',
    fontWeight: Theme.typography.weights.medium,
    width: '100%',
  },
});

export default CategoryGrid;
