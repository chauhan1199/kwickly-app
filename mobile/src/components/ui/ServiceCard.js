import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, useWindowDimensions } from 'react-native';
import { Star } from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';

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

// Real customer rating for a category, as sent by GET /categories ({ average, count }).
// Returns null when the category has no reviews yet so callers show "New" instead of a number.
export const getServiceRating = (cat) => {
  const r = cat?.rating;
  const average = Number(r?.average) || 0;
  const count = Number(r?.count) || 0;
  if (average <= 0 || count <= 0) return null;
  return { rating: Math.round(average * 10) / 10, reviews: count };
};

export const ServiceCard = ({ cat, index, theme, isLast, onPress, style }) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = style?.width || Math.min(145, Math.max(96, Math.floor((windowWidth - 32 - 24) / 3)));
  const realRating = getServiceRating(cat);
  const [imgError, setImgError] = React.useState(false);
  const resolvedNetworkImg = !imgError && cat.imageUrl ? getImageUrl(cat.imageUrl) : null;
  const localImg = cat.localImage || getServiceImage(cat.name || cat.label);

  return (
    <TouchableOpacity
      style={[
        styles.serviceCard, 
        { 
          width: cardWidth,
          backgroundColor: theme.colors.card, 
          borderColor: theme.colors.border,
          marginRight: isLast ? 0 : 12 
        },
        style
      ]}
      onPress={() => onPress(cat)}
      activeOpacity={0.88}
    >
      <View style={[styles.serviceCardImgBox, { height: cardWidth * 0.95, backgroundColor: theme.colors.card }]}>
        {resolvedNetworkImg ? (
          <Image
            source={{ uri: resolvedNetworkImg }}
            style={styles.serviceCardImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
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
          {realRating ? (
            <>
              <Star size={12} color="#F5A623" fill="#F5A623" />
              <Text style={styles.serviceCardRating}> {realRating.rating.toFixed(1)} ({realRating.reviews})</Text>
            </>
          ) : (
            <Text style={styles.serviceCardRating}>New</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  serviceCard: {
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
    height: 72,
    justifyContent: 'space-between',
  },
  serviceCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 17,
    height: 34,
    marginBottom: 4,
  },
  serviceCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
  },
  serviceCardRating: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
});
