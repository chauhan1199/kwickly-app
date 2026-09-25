import React, { useRef, useState, useEffect } from 'react';
import { FlatList, TouchableOpacity, Image, Text, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../../utils/helpers';

const BannerCarousel = ({ 
  banners, 
  itemWidth, 
  itemHeight = 160, 
  autoPlayInterval = 2000, 
  style, 
  contentContainerStyle = { paddingHorizontal: 14 } 
}) => {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const directionRef = useRef(1);
  const navigation = useNavigation();

  // Sync ref whenever state changes
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      let nextIndex = currentIndexRef.current + directionRef.current;
      if (nextIndex >= banners.length) {
        directionRef.current = -1;
        nextIndex = Math.max(0, banners.length - 2);
      } else if (nextIndex < 0) {
        directionRef.current = 1;
        nextIndex = Math.min(1, banners.length - 1);
      }

      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);

      flatListRef.current?.scrollToOffset({
        offset: nextIndex * (itemWidth + 10),
        animated: true,
      });
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [banners?.length, autoPlayInterval, itemWidth]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (itemWidth + 10));
    if (index !== currentIndexRef.current && index >= 0 && index < banners.length) {
      currentIndexRef.current = index;
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.bannerContainer, { width: itemWidth, height: itemHeight }]} 
      activeOpacity={0.9}
      onPress={() => {
        if (item.linkType === 'SHOP') navigation.navigate('Shop');
        if (item.linkType === 'CATEGORY') navigation.navigate('Book');
      }}
    >
      <Image source={{ uri: getImageUrl(item.imageUrl) }} style={styles.image} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.overlay}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (!banners || banners.length === 0) return null;

  return (
    <View style={[{ height: itemHeight }, style]}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderItem}
        keyExtractor={(item, index) => item._id || item.id || index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + 10}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        style={{ height: itemHeight }}
        contentContainerStyle={contentContainerStyle}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      />
      {banners.length > 1 && (
        <View style={styles.paginationDots} pointerEvents="none">
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                currentIndex === i ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a237e',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  paginationDots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});

export default BannerCarousel;
