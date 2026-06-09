import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Dimensions, 
  Image,
  TouchableOpacity
} from 'react-native';
import Theme from '../../constants/Theme';

const { width } = Dimensions.get('window');
const CAROUSEL_WIDTH = width - (Theme.spacing.lg * 2);

const BannerCarousel = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (data.length > 0) {
      const interval = setInterval(() => {
        const nextIndex = (activeIndex + 1) % data.length;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setActiveIndex(nextIndex);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeIndex, data.length]);

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.bannerWrapper}>
      <View style={[styles.banner, { backgroundColor: item.color || Theme.colors.card }]}>
        <View style={styles.bannerContent}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge || 'PROMO'}</Text>
          </View>
          <Text style={styles.bannerTitle}>{item.title}</Text>
          <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{item.cta || 'Book Now'}</Text>
          </View>
        </View>
        {/* We'll use a placeholder or the actual image if available */}
        <View style={styles.imageOverlay} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_WIDTH);
          setActiveIndex(index);
        }}
        keyExtractor={(item) => item._id}
        snapToAlignment="center"
        decelerationRate="fast"
      />
      
      <View style={styles.pagination}>
        {data.map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.dot, 
              index === activeIndex && styles.activeDot
            ]} 
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Theme.spacing.md,
  },
  bannerWrapper: {
    width: CAROUSEL_WIDTH,
    marginHorizontal: Theme.spacing.lg,
  },
  banner: {
    height: 160,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    padding: Theme.spacing.lg,
    flexDirection: 'row',
  },
  bannerContent: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.xs,
  },
  badgeText: {
    color: Theme.colors.white,
    fontSize: 10,
    fontWeight: Theme.typography.weights.bold,
  },
  bannerTitle: {
    color: Theme.colors.white,
    fontSize: Theme.typography.sizes.xl,
    fontWeight: Theme.typography.weights.extraBold,
    lineHeight: 24,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Theme.typography.sizes.sm,
    marginTop: 4,
  },
  cta: {
    backgroundColor: Theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.md,
    alignSelf: 'flex-start',
    marginTop: Theme.spacing.sm,
  },
  ctaText: {
    color: Theme.colors.black,
    fontSize: 12,
    fontWeight: Theme.typography.weights.bold,
  },
  imageOverlay: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Theme.spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.border,
  },
  activeDot: {
    width: 20,
    backgroundColor: Theme.colors.primary,
  },
});

export default BannerCarousel;
