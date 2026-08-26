import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Star } from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.floor((SCREEN_WIDTH - 32 - 24) / 3);

// ── Local bundled service images (category-name matched) ──
const SERVICE_IMAGES = {
  cleaning:        require('../../assets/services/cleaning.jpeg'),
  housekeeping:    require('../../assets/services/cleaning.jpeg'),
  ac:              require('../../assets/services/ac_repair.jpeg'),
  hvac:            require('../../assets/services/ac_repair.jpeg'),
  plumb:           require('../../assets/services/plumbing.jpeg'),
  car:             require('../../assets/services/car_wash.jpeg'),
  wash:            require('../../assets/services/car_wash.jpeg'),
  paint:           require('../../assets/services/painting.jpeg'),
  salon:           require('../../assets/services/salon.jpeg'),
  beauty:          require('../../assets/services/salon.jpeg'),
  yoga:            require('../../assets/services/yoga_fitness.jpeg'),
  fitness:         require('../../assets/services/yoga_fitness.jpeg'),
  gym:             require('../../assets/services/yoga_fitness.jpeg'),
  baby:            require('../../assets/services/babysitter.jpeg'),
  child:           require('../../assets/services/babysitter.jpeg'),
  nanny:           require('../../assets/services/babysitter.jpeg'),
  tutor:           require('../../assets/services/home_tutor.jpeg'),
  education:       require('../../assets/services/home_tutor.jpeg'),
  electric:        require('../../assets/services/electrician.jpeg'),
  carpenter:       require('../../assets/services/carpenter.jpeg'),
  furniture:       require('../../assets/services/carpenter.jpeg'),
  pest:            require('../../assets/services/pest_control.jpeg'),
  sofa:            require('../../assets/services/sofa_cleaning.jpeg'),
  laundry:         require('../../assets/services/laundry.jpeg'),
  cctv:            require('../../assets/services/cctv.jpeg'),
  security:        require('../../assets/services/security.jpeg'),
  packer:          require('../../assets/services/packers_movers.jpeg'),
  mover:           require('../../assets/services/packers_movers.jpeg'),
  ro:              require('../../assets/services/ro_service.jpeg'),
  water:           require('../../assets/services/ro_service.jpeg'),
  laptop:          require('../../assets/services/laptop_repair.jpeg'),
  computer:        require('../../assets/services/computer_repair.jpeg'),
  mobile:          require('../../assets/services/laptop_repair.jpeg'),
  repair:          require('../../assets/services/appliance_repair.jpeg'),
  appliance:       require('../../assets/services/appliance_repair.jpeg'),
  massage:         require('../../assets/services/massage_spa.jpeg'),
  spa:             require('../../assets/services/massage_spa.jpeg'),
  cook:            require('../../assets/services/home_cook.jpeg'),
  chef:            require('../../assets/services/home_cook.jpeg'),
  astro:           require('../../assets/services/astrology.jpeg'),
  garden:          require('../../assets/services/gardening.jpeg'),
  interior:        require('../../assets/services/interior_design.jpeg'),
  waterproof:      require('../../assets/services/waterproofing.jpeg'),
  elder:           require('../../assets/services/elder_care.jpeg'),
  driver:          require('../../assets/services/driver.jpeg'),
  photo:           require('../../assets/services/photography.jpeg'),
  bike:            require('../../assets/services/car_repair_photo.png'),
  wheeler:         require('../../assets/services/car_repair_photo.png'),
  motorcycle:      require('../../assets/services/car_repair_photo.png'),
  scooter:         require('../../assets/services/car_repair_photo.png'),
  two:             require('../../assets/services/car_repair_photo.png'),
  vehicle:         require('../../assets/services/car_service_3d.jpeg'),
  mechanic:        require('../../assets/services/car_service_3d.jpeg'),
  auto:            require('../../assets/services/car_service_3d.jpeg'),
  dj:              require('../../assets/services/dj_event.jpeg'),
  event:           require('../../assets/services/dj_event.jpeg'),
};

export const getServiceImage = (categoryName) => {
  if (!categoryName) return null;
  const lower = categoryName.toLowerCase();
  for (const [key, img] of Object.entries(SERVICE_IMAGES)) {
    if (lower.includes(key)) return img;
  }
  return null;
};

// Ratings data per service
const SERVICE_RATINGS = {
  default: { rating: 4.8, reviews: 230 },
  cleaning: { rating: 4.8, reviews: 250 },
  plumbing: { rating: 4.7, reviews: 210 },
  car: { rating: 4.8, reviews: 180 },
  'home cook': { rating: 4.8, reviews: 165 },
  astrology: { rating: 4.7, reviews: 130 },
  'yoga & fitness': { rating: 4.9, reviews: 150 },
};

export const getServiceRating = (name) => {
  const lower = name?.toLowerCase() || '';
  for (const [key, val] of Object.entries(SERVICE_RATINGS)) {
    if (lower.includes(key)) return val;
  }
  return SERVICE_RATINGS.default;
};

export const ServiceCard = ({ cat, index, theme, isLast, onPress, style }) => {
  const { rating, reviews } = getServiceRating(cat.label || cat.name);
  const hasNetworkImg = !!cat.imageUrl;
  const localImg = cat.localImage || getServiceImage(cat.name || cat.label);

  return (
    <TouchableOpacity
      style={[
        styles.serviceCard, 
        { 
          backgroundColor: theme.colors.card, 
          borderColor: theme.colors.border,
          marginRight: isLast ? 0 : 12 
        },
        style
      ]}
      onPress={() => onPress(cat)}
      activeOpacity={0.88}
    >
      <View style={[styles.serviceCardImgBox, { backgroundColor: theme.colors.card }]}>
        {hasNetworkImg ? (
          <Image
            source={{ uri: getImageUrl(cat.imageUrl) }}
            style={styles.serviceCardImg}
            resizeMode="contain"
          />
        ) : localImg ? (
          <Image source={localImg} style={styles.serviceCardImg} resizeMode="cover" />
        ) : (
          <View style={[styles.serviceCardImgFallback, { backgroundColor: theme.colors.surface2 }]} />
        )}
      </View>
      <View style={styles.serviceCardFooter}>
        <Text style={[styles.serviceCardName, { color: theme.colors.text }]} numberOfLines={2}>{cat.label || cat.name}</Text>
        <View style={styles.serviceCardRatingRow}>
          <Star size={12} color="#F5A623" fill="#F5A623" />
          <Text style={styles.serviceCardRating}> {rating} ({reviews})</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  serviceCard: {
    width: CARD_W,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  serviceCardImgBox: {
    width: '100%',
    height: CARD_W * 0.95,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  serviceCardImg: {
    width: '100%',
    height: '100%',
  },
  serviceCardImgFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCardFooter: {
    padding: 10,
    paddingBottom: 12,
  },
  serviceCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 16,
    marginBottom: 4,
  },
  serviceCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceCardRating: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
});
