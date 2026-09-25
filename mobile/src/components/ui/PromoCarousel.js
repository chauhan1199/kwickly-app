import React, { useRef, useState, useEffect } from 'react';
import {
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const GRADIENTS = [
  ['#6C47FF', '#9575FF'],
  ['#FF6B4A', '#FF9F7A'],
  ['#0D9488', '#2DD4BF'],
  ['#2563EB', '#60A5FA'],
];

const DEFAULT_PROMOS = [
  {
    code: 'WELCOME20',
    title: 'Welcome 20% Discount',
    description: 'Get 20% OFF on your first service!',
    type: 'PERCENTAGE_DISCOUNT',
    value: 20,
  },
];

export const PromoCarousel = ({
  promos = [],
  itemWidth,
  autoPlayInterval = 2000,
  onPress,
  style,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = itemWidth || (windowWidth - 32);
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const directionRef = useRef(1);

  const displayPromos = Array.isArray(promos) && promos.length > 0 ? promos : DEFAULT_PROMOS;

  useEffect(() => {
    if (displayPromos.length <= 1) return;

    const interval = setInterval(() => {
      let nextIndex = currentIndex + directionRef.current;
      if (nextIndex >= displayPromos.length) {
        directionRef.current = -1;
        nextIndex = Math.max(0, displayPromos.length - 2);
      } else if (nextIndex < 0) {
        directionRef.current = 1;
        nextIndex = Math.min(1, displayPromos.length - 1);
      }

      try {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentIndex(nextIndex);
      } catch (_) {
        flatListRef.current?.scrollToOffset({ offset: nextIndex * (cardWidth + 10), animated: true });
        setCurrentIndex(nextIndex);
      }
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, displayPromos, autoPlayInterval, cardWidth]);

  const getItemLayout = (_, index) => ({
    length: cardWidth + 10,
    offset: (cardWidth + 10) * index,
    index,
  });

  const onScrollToIndexFailed = (info) => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * (cardWidth + 10),
        animated: true,
      });
    }, 80);
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (cardWidth + 10));
    if (index !== currentIndex && index >= 0 && index < displayPromos.length) {
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item, index }) => {
    const gradientColors = GRADIENTS[index % GRADIENTS.length];
    const iconChar =
      item.type === 'FREE_DELIVERY' ? '🚚' :
      item.type === 'FLAT_DISCOUNT' ? '₹' :
      item.type === 'FIRST_ORDER' ? '🎁' : '%';

    const discountText =
      item.type === 'PERCENTAGE_DISCOUNT' ? `${item.value}% OFF` :
      item.type === 'FLAT_DISCOUNT' ? `₹${item.value} OFF` :
      item.type === 'FREE_DELIVERY' ? 'FREE DELIVERY' :
      'SPECIAL OFFER';

    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.promoBanner, { width: cardWidth }]}
      >
        <View style={styles.promoDiscCircle}>
          <Text style={styles.promoDiscText}>{iconChar}</Text>
        </View>
        <View style={styles.promoContent}>
          <Text style={styles.promoLine1} numberOfLines={1}>
            {item.description || item.title || `Get ${discountText}!`}
          </Text>
          <Text style={styles.promoLine2}>
            Use code: <Text style={styles.promoCode}>{item.code}</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.promoBookBtn}
          onPress={() => onPress && onPress(item)}
          activeOpacity={0.85}
        >
          <Text style={styles.promoBookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        data={displayPromos}
        renderItem={renderItem}
        keyExtractor={(item, index) => item._id || item.code || index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 10}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      />

      {displayPromos.length > 1 && (
        <View style={styles.dotsRow}>
          {displayPromos.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                currentIndex === i ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 16,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  promoDiscCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoDiscText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  promoContent: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 6,
  },
  promoLine1: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  promoLine2: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 3,
  },
  promoCode: {
    fontWeight: '900',
    color: '#FFE082',
    letterSpacing: 0.5,
  },
  promoBookBtn: {
    backgroundColor: '#fff',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  promoBookBtnText: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  activeDot: {
    width: 16,
    backgroundColor: '#6C47FF',
  },
  inactiveDot: {
    width: 5,
    backgroundColor: '#D1D5DB',
  },
});

export default PromoCarousel;
