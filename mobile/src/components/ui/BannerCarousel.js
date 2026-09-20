import React, { useRef, useState, useEffect } from 'react';
import { FlatList, TouchableOpacity, Image, Text, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../../utils/helpers';

const BannerCarousel = ({ 
  banners, 
  itemWidth, 
  itemHeight = 160, 
  autoPlayInterval = 3000, 
  style, 
  contentContainerStyle = { paddingHorizontal: 14 } 
}) => {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigation = useNavigation();

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, banners, autoPlayInterval]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (itemWidth + 10)); // 10 is the separator width
    if (index !== currentIndex && index >= 0 && index < banners.length) {
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
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.overlay}>
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
        keyExtractor={(item, index) => item._id || index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + 10}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        style={{ height: itemHeight }}
        contentContainerStyle={contentContainerStyle}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      />
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
  }
});

export default BannerCarousel;
