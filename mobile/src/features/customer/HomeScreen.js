import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  TextInput,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import api from '../../services/api';
import LinearGradient from 'react-native-linear-gradient';
import { Search, SlidersHorizontal, ChevronRight, Star, Zap, MapPin, Bell, Sun, Moon } from 'lucide-react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/ui/SearchBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Purple accent (exact match reference design) ──
const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';
const BG = '#fff';

// ── Local bundled service images (category-name matched) ──
// Key = lowercase trimmed category name keywords → local require
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
  pet:             require('../../assets/services/pet_care.jpeg'),
  dj:              require('../../assets/services/dj_event.jpeg'),
  event:           require('../../assets/services/dj_event.jpeg'),
};

// Find the best matching local image for a category name
const getServiceImage = (categoryName) => {
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

const getServiceRating = (name) => {
  const lower = name?.toLowerCase() || '';
  for (const [key, val] of Object.entries(SERVICE_RATINGS)) {
    if (lower.includes(key)) return val;
  }
  return SERVICE_RATINGS.default;
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { userToken, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [activeShopOrders, setActiveShopOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);

      // Fetch categories from backend
      const catRes = await jobService.getCategories();
      if (catRes.data?.status === 'success') {
        setCategories(catRes.data.data.map(c => ({
          id: c._id,
          icon: c.icon,
          label: c.name,
          name: c.name,
          color: c.color,
          imageUrl: c.imageUrl || null,
          subs: c.subcategories?.map(s => ({
            id: s._id,
            name: s.name,
            imageUrl: s.imageUrl || null
          })) || [],
          localImage: getServiceImage(c.name),
        })));
      }

      if (userToken) {
        // Jobs
        const jobsRes = await jobService.getMyJobs();
        if (jobsRes.data?.status === 'success') {
          const active = jobsRes.data.data.filter(j =>
            ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'].includes(j.status)
          ).map(j => ({
            id: j._id,
            title: `${j.category}${j.subcategory ? ' — ' + j.subcategory : ''}`,
            category: j.category,
            subcategory: j.subcategory,
            worker: j.workerId?.name || null,
            status: j.status,
            fromPrice: j.payment?.amount || '300',
            progress:
              j.status === 'BROADCASTING' ? 20 :
              j.status === 'QUOTES_RECEIVED' ? 45 :
              j.status === 'ALLOCATED' ? 60 :
              j.status === 'IN_PROGRESS' ? 80 : 50,
            isIP: ['IN_PROGRESS', 'ARRIVING', 'ALLOCATED'].includes(j.status),
            isCompleted: j.status === 'COMPLETED',
            hasQuotes: j.status === 'QUOTES_RECEIVED',
            rawJob: j,
          }));
          setActiveJobs(active);
        }

        // Shop orders
        try {
          const oRes = await api.get('/shoporders/customer');
          if (oRes.data?.status === 'success') {
            const list = oRes.data.data.orders || oRes.data.data;
            setActiveShopOrders(list.filter(o => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)));
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('Home fetch error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const displayLocation = primaryAddress 
    ? `${primaryAddress.area ? primaryAddress.area + ', ' : ''}${primaryAddress.city || ''}`
    : (user?.city || 'Select Location');

  // ── Service card: white bg, image on top, text below ──
  const ServiceCard = ({ cat, index }) => {
    const { rating, reviews } = getServiceRating(cat.label);
    // Resolve image: admin-uploaded URL > local bundled > fallback
    const hasNetworkImg = !!cat.imageUrl;
    const localImg = cat.localImage;

    return (
      <TouchableOpacity
        style={[
          styles.serviceCard, 
          { 
            backgroundColor: theme.colors.card, 
            borderColor: theme.colors.border,
            marginRight: (index + 1) % 3 !== 0 ? 12 : 0 
          }
        ]}
        onPress={() => navigation.navigate('SubCategories', cat)}
        activeOpacity={0.88}
      >
        {/* Image area */}
        <View style={[styles.serviceCardImgBox, { backgroundColor: theme.colors.card }]}>
          {hasNetworkImg ? (
            <Image
              source={{ uri: cat.imageUrl.startsWith('http') ? cat.imageUrl.replace('localhost', '10.0.2.2') : `http://10.0.2.2:5000${cat.imageUrl}` }}
              style={styles.serviceCardImg}
              resizeMode="contain"
            />
          ) : localImg ? (
            <Image source={localImg} style={styles.serviceCardImg} resizeMode="cover" />
          ) : (
            // Fallback: blank image box
            <View style={[styles.serviceCardImgFallback, { backgroundColor: theme.colors.surface2 }]} />
          )}
        </View>

        {/* Text row below image */}
        <View style={styles.serviceCardFooter}>
          <Text style={[styles.serviceCardName, { color: theme.colors.text }]} numberOfLines={2}>{cat.label}</Text>
          <View style={styles.serviceCardRatingRow}>
            <Star size={12} color="#F5A623" fill="#F5A623" />
            <Text style={styles.serviceCardRating}> {rating} ({reviews})</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={PURPLE} />}
      >
        {/* ═══════════════════════════════════════
            PURPLE HERO HEADER
        ═══════════════════════════════════════ */}
        <LinearGradient
          colors={[PURPLE, '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: Math.max(insets.top, 16) + 16 }]}
        >
          {/* Top row: location + bell */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.locationRow} activeOpacity={0.8} onPress={() => navigation.navigate('Profile')}>
              <MapPin size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
              <Text style={styles.locationCaret}>  ⌄</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={[styles.bellBtn, { marginRight: 12 }]} activeOpacity={0.8} onPress={toggleTheme}>
                {isDarkMode ? <Sun size={20} color="#fff" /> : <Moon size={20} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
                <Bell size={20} color="#fff" />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting + mascot row */}
          <View style={styles.heroMiddleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>Hi, {firstName}!</Text>
              <Text style={styles.heroSubtitle}>Services + Products available in local services</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              {user?.profileImage ? (
                <Image 
                  source={{ uri: user.profileImage.startsWith('http') ? user.profileImage.replace('localhost', '10.0.2.2') : `http://10.0.2.2:5000${user.profileImage}` }}
                  style={styles.heroMascot} 
                  resizeMode="cover" 
                />
              ) : (
                <View style={[styles.heroMascot, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>{firstName[0]?.toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Search bar component */}
          <SearchBar 
            value={searchQuery}
            onChangeText={setSearchQuery}
            theme={theme}
            onFilterPress={() => navigation.navigate('Book')}
          />
        </LinearGradient>

        {/* ═══════════════════════════════════════
            BODY
        ═══════════════════════════════════════ */}
        <View style={[styles.body, { backgroundColor: theme.colors.background }]}>

          {/* ── TOP SERVICES ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Services</Text>
            <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Book')}>
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={14} color={PURPLE} />
            </TouchableOpacity>
          </View>

          {/* 3-column service grid */}
          <View style={styles.serviceGrid}>
            {categories
              .filter(c => !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase()))
              .slice(0, 6)
              .map((cat, index) => (
              <ServiceCard key={cat.id || index} cat={cat} index={index} />
            ))}
          </View>

          {/* ── BROWSE SHOPS ── */}
          <View style={[styles.sectionHeader, { marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Browse Shops</Text>
            <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Shop')}>
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={14} color={PURPLE} />
            </TouchableOpacity>
          </View>

          <View style={styles.shopGrid}>
            {SHOP_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.shopItem, { backgroundColor: theme.colors.card }]}
                onPress={() => navigation.navigate('Shop')}
                activeOpacity={0.8}
              >
                <View style={[styles.shopIconBox, { backgroundColor: cat.color + '18' }]}>
                  <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                </View>
                <Text style={[styles.shopLabel, { color: theme.colors.text }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── PROMO BANNER ── */}
          <LinearGradient
            colors={[PURPLE, '#9575FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.promoBanner}
          >
            <View style={styles.promoDiscCircle}>
              <Text style={styles.promoDiscText}>%</Text>
            </View>
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <Text style={styles.promoLine1}>
                Get <Text style={{ fontWeight: '900', color: '#FFE082' }}>20% OFF</Text> on your first service!
              </Text>
              <Text style={styles.promoLine2}>Use code:  <Text style={styles.promoCode}>WELCOME20</Text></Text>
            </View>
            <TouchableOpacity style={styles.promoBookBtn} onPress={() => navigation.navigate('Book')}>
              <Text style={styles.promoBookBtnText}>Book Now</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* ── WHY CHOOSE US ── */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Why Choose Us?</Text>
          </View>
          <View style={styles.trustRow}>
            {TRUST_ITEMS.map((item, i) => (
              <View key={i} style={styles.trustItem}>
                <View style={[styles.trustIconCircle, { borderColor: theme.colors.border }]}>
                  <Text style={styles.trustIcon}>{item.icon}</Text>
                </View>
                <Text style={[styles.trustLabel, { color: theme.colors.text }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── ACTIVE JOBS ── */}
          {activeJobs.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Active Jobs</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{activeJobs.length}</Text>
                  </View>
                </View>
              </View>
              {activeJobs.map(job => (
                <ActiveJobCard key={job.id} job={job} navigation={navigation} theme={theme} />
              ))}
            </>
          )}

          {/* ── ACTIVE SHOP ORDERS ── */}
          {activeShopOrders.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Active Shop Orders</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{activeShopOrders.length}</Text>
                  </View>
                </View>
              </View>
              {activeShopOrders.map(order => (
                <TouchableOpacity
                  key={order._id}
                  style={[styles.jobCard, { backgroundColor: theme.colors.card, borderLeftColor: '#10b981' }]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order._id })}
                >
                  <View style={styles.jobCardTop}>
                    <View style={[styles.jobIconBox, { backgroundColor: '#10b98118' }]}>
                      <Text style={{ fontSize: 22 }}>📦</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>Order from {order.shopId?.name || 'Shop'}</Text>
                      <Text style={styles.jobSub}>Status: {order.status}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#10b98118' }]}>
                      <Text style={[styles.statusPillText, { color: '#10b981' }]}>TRACK</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── NEW REQUEST (when no active jobs) ── */}
          {activeJobs.length === 0 && (
            <TouchableOpacity
              style={styles.bookNowBlock}
              onPress={() => navigation.navigate('Book')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[PURPLE, '#9575FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bookNowInner}
              >
                <Zap size={18} color="#fff" />
                <Text style={styles.bookNowText}>Book a New Service</Text>
                <ChevronRight size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ height: 36 }} />
        </View>
      </ScrollView>
    </View>
  );
};

// ── Active Job Card ──────────────────────────────────────
const ActiveJobCard = ({ job, navigation, theme }) => {
  const accentColor = job.isIP ? PURPLE : job.hasQuotes ? '#10b981' : '#f59e0b';
  return (
    <TouchableOpacity
      style={[styles.jobCard, { backgroundColor: theme.colors.card, borderLeftColor: accentColor }]}
      activeOpacity={0.8}
      onPress={() => {
        if (job.isCompleted) navigation.navigate('WorkCompleted', { worker: { name: job.worker }, job: job.rawJob });
        else if (job.isIP) navigation.navigate('LiveTracking', { worker: { name: job.worker, rating: 4.8, jobs: 312, eta: 12, dist: '1.2 km' }, job: job.rawJob });
        else navigation.navigate('LiveBids', { jobId: job.id, category: { name: job.category }, subcategory: job.subcategory || '', address: '', timeSlot: 'ASAP', budget: job.fromPrice });
      }}
    >
      <View style={styles.jobCardTop}>
        <View style={[styles.jobIconBox, { backgroundColor: accentColor + '18' }]}>
          <Text style={{ fontSize: 22 }}>{job.isIP ? '❄️' : '🔧'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.jobSub}>
            {job.hasQuotes ? 'Quotes received — tap to accept!' :
             job.isIP ? 'Worker on the way...' : 'Finding workers...'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: accentColor + '18' }]}>
          <Text style={[styles.statusPillText, { color: accentColor }]}>
            {job.hasQuotes ? 'QUOTES' : job.isIP ? 'ACTIVE' : 'PENDING'}
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={job.isIP ? [PURPLE, '#a78bfa'] : job.hasQuotes ? ['#10b981', '#34d399'] : ['#f59e0b', '#fbbf24']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${job.progress}%` }]}
        />
      </View>
      <View style={styles.jobCardBottom}>
        <Text style={[styles.workerName, { color: theme.colors.text }]}>{job.worker || 'Pending assignment'}</Text>
        <Text style={[styles.jobPrice, { color: theme.colors.text }]}>From ₹{job.fromPrice}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Fallback categories removed as requested (dynamic only) ─────────


// ── Shop categories ─────────
const SHOP_CATEGORIES = [
  { id: 1, label: 'Groceries', icon: '🥬', color: '#10b981' },
  { id: 2, label: 'Pharmacy', icon: '💊', color: '#ef4444' },
  { id: 3, label: 'Dairy', icon: '🥛', color: '#3b82f6' },
  { id: 4, label: 'Bakery', icon: '🍞', color: '#f5b300' },
  { id: 5, label: 'Snacks', icon: '🍫', color: '#8b5cf6' },
];

// ── Trust items ─────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: '✔', label: 'Verified\nProfessionals' },
  { icon: '⏰', label: 'On-Time\nService' },
  { icon: '🔒', label: 'Secure\nPayments' },
  { icon: '🎧', label: '24/7 Customer\nSupport' },
];

// ── Styles ──────────────────────────────────────────────

// Calculate width for 3 items: Screen Width - padding (16*2) - gap between 3 items (min 12*2) = Total available space, divide by 3
const CARD_W = Math.floor((SCREEN_WIDTH - 32 - 24) / 3);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Hero ──
  heroGradient: {
    paddingTop: (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  locationCaret: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: PURPLE,
  },
  heroMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroMascot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 12,
  },
  heroGreeting: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
  },
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

  // ── Body ──
  body: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.3,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Service Cards (3-col, white bg, image top, text bottom) ──
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 24,
  },
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

  // ── Shop Grid ──
  shopGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  shopItem: {
    alignItems: 'center',
    width: '18%',
  },
  shopIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  shopLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },

  // ── Promo Banner ──
  promoBanner: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  promoDiscCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoDiscText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  promoLine1: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  promoLine2: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  promoCode: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  promoBookBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 10,
  },
  promoBookBtnText: {
    color: PURPLE,
    fontWeight: '800',
    fontSize: 13,
  },

  // ── Why Choose Us ──
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  trustItem: {
    alignItems: 'center',
    flex: 1,
  },
  trustIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: PURPLE + '40',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  trustIcon: {
    fontSize: 20,
  },
  trustLabel: {
    fontSize: 10,
    color: '#555',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },

  // ── Count badge ──
  countBadge: {
    backgroundColor: PURPLE,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Active Job Card ──
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  jobSub: {
    fontSize: 12,
    color: '#888',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#F0EEFF',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  jobCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 12,
    color: '#888',
  },
  jobPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a1a2e',
  },

  // ── Book Now block ──
  bookNowBlock: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bookNowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  bookNowText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default HomeScreen;
