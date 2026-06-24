import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  RefreshControl,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
  Dimensions
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import api from '../../services/api';
import LinearGradient from 'react-native-linear-gradient';

const HomeScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { userToken } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeJobs, setActiveJobs] = useState([]);
  const [activeShopOrders, setActiveShopOrders] = useState([]);
  const [pastJobs, setPastJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // Fetch categories
      const catRes = await jobService.getCategories();
      if (catRes.data?.status === 'success') {
        const mappedCats = catRes.data.data.map(c => ({
          id: c._id,
          icon: c.icon,
          label: c.name,
          name: c.name,
          color: c.color,
          subs: c.subcategories.map(s => s.name)
        }));
        setCategories(mappedCats);
      }

      // Fetch Banners
      try {
        const bannerRes = await api.get('/promotions/banners');
        if (bannerRes.data?.status === 'success') {
          setBanners(bannerRes.data.data.filter(b => b.position === 'HOME_TOP'));
        }
      } catch (err) {
        console.log('Error fetching banners:', err);
      }

      // Fetch jobs only if authenticated
      if (userToken) {
        const jobsRes = await jobService.getMyJobs();
        if (jobsRes.data?.status === 'success') {
          const allJobs = jobsRes.data.data;
          const active = [];
          const past = [];
          
          allJobs.forEach(job => {
            if (['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'].includes(job.status)) {
              active.push({
                id: job._id,
                title: `${job.category}${job.subcategory ? ' — ' + job.subcategory : ''}`,
                category: job.category,
                subcategory: job.subcategory,
                address: job.addressDetails,
                worker: job.workerId?.name || null,
                status: job.status,
                sub: job.status === 'BROADCASTING' ? 'Awaiting quotes...' : 
                     job.status === 'QUOTES_RECEIVED' ? 'Quotes received — tap to accept!' :
                     job.status === 'COMPLETED' ? 'Work completed — tap to pay!' :
                     'Worker assigned',
                price: job.payment?.amount || 0,
                fromPrice: '300',
                progress: job.status === 'BROADCASTING' ? 20 : 
                          job.status === 'QUOTES_RECEIVED' ? 45 :
                          job.status === 'ALLOCATED' ? 60 :
                          job.status === 'IN_PROGRESS' ? 80 : 
                          job.status === 'COMPLETED' ? 95 : 50,
                isIP: job.status === 'IN_PROGRESS' || job.status === 'ARRIVING' || job.status === 'ALLOCATED',
                isCompleted: job.status === 'COMPLETED',
                hasQuotes: job.status === 'QUOTES_RECEIVED',
                rawJob: job
              });
            } else {
              past.push({
                id: job._id,
                title: job.category,
                worker: job.workerId?.name || 'Unknown Worker',
                price: job.price || 0,
                rating: (typeof job.rating === 'object' ? Math.round(job.rating.average || 5) : Math.round(job.rating || 5)) || 5,
                date: new Date(job.createdAt).toLocaleDateString()
              });
            }
          });
          
          setActiveJobs(active);
          setPastJobs(past);
        }

        try {
          const ordersRes = await api.get('/shoporders/customer');
          if (ordersRes.data?.status === 'success') {
            const list = ordersRes.data.data.orders || ordersRes.data.data;
            const activeOrders = list.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED');
            setActiveShopOrders(activeOrders);
          }
        } catch(err) {
          console.error('Error fetching shop orders:', err);
        }

      } else {
        setActiveJobs([]);
        setActiveShopOrders([]);
        setPastJobs([]);
      }
    } catch (e) {
      console.error('Error fetching home data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchData();
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.logoBox}>
          <View style={styles.logoK}>
            <View style={styles.logoLine1} />
            <View style={styles.logoLine2} />
            <View style={styles.logoLine3} />
          </View>
        </View>
        <Text style={styles.appBarTitle} numberOfLines={1}>Kwickly</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Text style={{fontSize: 16}}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.content}
      >
        {/* Dynamic Banners */}
        {banners.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {banners.map((banner, index) => (
              <TouchableOpacity key={banner._id || index} style={styles.bannerImageContainer} onPress={() => {
                if (banner.linkType === 'SHOP') navigation.navigate('Shop');
                if (banner.linkType === 'CATEGORY') navigation.navigate('Book');
              }}>
                <Image source={{ uri: banner.imageUrl }} style={styles.bannerImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  {banner.subtitle ? <Text style={styles.bannerSubText}>{banner.subtitle}</Text> : null}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <LinearGradient 
            colors={['#1a237e', '#283593', '#1565c0']} 
            start={{x: 0, y: 0}} 
            end={{x: 1, y: 1}} 
            style={styles.heroBanner}
          >
            <View style={styles.heroDeco1} />
            <View style={styles.heroDeco2} />
            <Text style={styles.heroTitle}>What do you need fixed? 🔧</Text>
            <Text style={styles.heroSub}>Verified workers • Transparent pricing • Same-day</Text>
            <View style={styles.searchRow}>
              <TextInput 
                placeholder="Search plumber, electrician, AC..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={styles.searchInput}
                onFocus={() => navigation.navigate('Book')}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Book')}>
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* Shop Quick Link */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Shop')}>
          <LinearGradient 
            colors={['#0f2027', '#203a43', '#2c5364']}
            start={{x: 0, y: 0}} 
            end={{x: 1, y: 1}} 
            style={styles.shopBanner}
          >
            <View style={styles.shopIconBox}>
              <Text style={{fontSize: 22}}>🛒</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.shopTitle}>Shop Products & Services</Text>
              <Text style={styles.shopSub}>LED bulbs, tools, plumbing & more</Text>
            </View>
            <Text style={styles.shopArrow}>→</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Active Jobs */}
        <View style={styles.sectionHeader}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>Active Jobs</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{activeJobs.length}</Text>
            </View>
            <TouchableOpacity style={styles.bellBtn}>
              <Text style={{fontSize: 14}}>🔔</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.newRequestBtn} onPress={() => navigation.navigate('Book')}>
            <Text style={styles.newRequestText}>+ New Request</Text>
          </TouchableOpacity>
        </View>

        {activeJobs.map(job => {
          const statusColor = job.isIP ? theme.colors.primary : theme.colors.warning;
          return (
            <TouchableOpacity 
              key={job.id} 
              style={styles.jobCard}
              onPress={() => {
                if (job.isCompleted) {
                  navigation.navigate('WorkCompleted', {
                    worker: { name: job.worker, rating: 4.8, jobs: 312 },
                    job: job.rawJob
                  });
                } else if (job.isIP) {
                  navigation.navigate('LiveTracking', {
                    worker: { name: job.worker, rating: 4.8, jobs: 312, eta: 12, dist: '1.2 km' },
                    job: job.rawJob
                  });
                } else {
                  navigation.navigate('LiveBids', {
                    jobId: job.id,
                    category: { name: job.category || 'Service' },
                    subcategory: job.subcategory || 'General',
                    address: job.address || '',
                    timeSlot: 'ASAP',
                    budget: job.fromPrice
                  });
                }
              }}
            >
              <View style={[styles.row, {marginBottom: 8, alignItems: 'flex-start'}]}>
                <View style={[styles.jobIconBox, {backgroundColor: job.isIP ? theme.colors.primary + '26' : theme.colors.warning + '26'}]}>
                  <Text style={{fontSize: 22}}>{job.isIP ? '❄️' : '🔧'}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.jobSub}>{job.sub}</Text>
                </View>
                <View style={[styles.statusBadge, {backgroundColor: job.isIP ? theme.colors.primary + '2E' : job.hasQuotes ? '#10b98126' : theme.colors.warning + '2E'}]}>
                  <Text style={[styles.statusText, {color: job.isIP ? theme.colors.primary : job.hasQuotes ? '#10b981' : theme.colors.warning}]}>
                    {job.hasQuotes ? '💬 QUOTES' : job.status === 'ALLOCATED' ? 'ACCEPTED' : job.status}
                  </Text>
                </View>
              </View>

              <View style={styles.progBarBg}>
                <LinearGradient 
                  colors={job.isIP ? [theme.colors.primary, '#43e3eb'] : [theme.colors.warning, '#fbbf24']}
                  start={{x:0, y:0}} end={{x:1, y:0}}
                  style={[styles.progBarFill, {width: `${job.progress}%`}]} 
                />
                <View style={styles.jobWorkerRow}>
                  <View style={styles.jobWorkerAvatar}>
                    <Text style={{fontSize: 10}}>👤</Text>
                  </View>
                  <Text style={styles.jobWorkerName}>{job.worker || 'Pending Assign'}</Text>
                </View>
                <Text style={styles.jobPrice}>From Rs. {job.fromPrice}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Active Shop Orders */}
        {activeShopOrders.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.row}>
                <Text style={styles.sectionTitle}>Active Shop Orders</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{activeShopOrders.length}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.newRequestBtn} onPress={() => navigation.navigate('CustomerShopOrders')}>
                <Text style={styles.newRequestText}>View All</Text>
              </TouchableOpacity>
            </View>

            {activeShopOrders.map(order => (
              <TouchableOpacity 
                key={order._id}
                style={styles.jobCard}
                onPress={() => navigation.navigate('ShopOrderDetails', { orderId: order._id })}
              >
                <View style={[styles.row, {marginBottom: 8, alignItems: 'flex-start'}]}>
                  <View style={[styles.jobIconBox, {backgroundColor: '#10b98126'}]}>
                    <Text style={{fontSize: 22}}>📦</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.jobTitle}>Order {order.rawId || order._id.substring(0, 6).toUpperCase()}</Text>
                    <Text style={styles.jobSub}>{order.items?.length || 0} items • ₹{order.totalAmount}</Text>
                  </View>
                  <View style={[styles.statusBadge, {backgroundColor: '#10b98126'}]}>
                    <Text style={[styles.statusText, {color: '#10b981'}]}>
                      {order.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.progBarBg}>
                  <LinearGradient 
                    colors={['#10b981', '#34d399']}
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={[styles.progBarFill, {
                      width: order.status === 'NEW' ? '25%' : 
                             order.status === 'PACKING' ? '50%' : 
                             order.status === 'OUT_FOR_DELIVERY' ? '85%' : '10%'
                    }]}
                  />
                </View>
                
                <View style={[styles.row, {marginTop: 12}]}>
                  <View style={styles.jobWorkerRow}>
                    <View style={[styles.jobWorkerAvatar, {backgroundColor: '#f59e0b26'}]}>
                      <Text style={{fontSize: 10}}>🏪</Text>
                    </View>
                    <Text style={styles.jobWorkerName}>{order.shopId?.name || 'Shop'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Browse Services */}
        <View style={[styles.row, {justifyContent: 'space-between', marginTop: 12, marginBottom: 12}]}>
          <Text style={styles.sectionTitle}>Browse Services</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Book')}>
            <Text style={styles.viewAllBtn}>View All ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainer}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              style={styles.gridItem} 
              onPress={() => navigation.navigate('SubCategories', cat)}
            >
              <View style={[styles.gridIconBox, { backgroundColor: cat.color + '2E' }]}>
                <Text style={{fontSize: 22}}>{cat.icon}</Text>
              </View>
              <Text style={styles.gridLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Past Jobs */}
        <View style={[styles.row, {justifyContent: 'space-between', marginBottom: 10}]}>
          <Text style={styles.sectionTitle}>Past Jobs</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllBtn}>View All ›</Text>
          </TouchableOpacity>
        </View>

        {pastJobs.map(job => (
          <TouchableOpacity 
            key={job.id} 
            style={styles.pastJobItem}
            onPress={() => navigation.navigate('PastJobDetails', { job })}
          >
            <View style={styles.pastIconBox}>
              <Text style={{fontSize: 18}}>✅</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.pastTitle}>{job.title}</Text>
              <Text style={styles.pastSub}>{job.worker} · {job.date}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.pastPrice}>₹{job.price}</Text>
              <Text style={styles.pastRating}>{'★'.repeat(job.rating)}{'☆'.repeat(5 - job.rating)}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0E9AA7',
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoK: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  logoLine1: {
    position: 'absolute',
    left: 2, top: 0, width: 4, height: 20,
    backgroundColor: '#fff', borderRadius: 2,
  },
  logoLine2: {
    position: 'absolute',
    left: 6, top: 8, width: 12, height: 4,
    backgroundColor: '#fff', borderRadius: 2,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: -6 }],
  },
  logoLine3: {
    position: 'absolute',
    left: 6, top: 8, width: 12, height: 4,
    backgroundColor: '#fff', borderRadius: 2,
    transform: [{ rotate: '45deg' }, { translateX: 4 }, { translateY: 4 }],
  },
  appBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    marginLeft: 8,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  heroBanner: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  heroDeco1: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50,
  },
  heroDeco2: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 30,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginBottom: 12,
  },
  bannerImageContainer: {
    width: Dimensions.get('window').width - 28,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
    position: 'relative',
    backgroundColor: '#1a237e'
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 32,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  searchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#001016',
  },
  shopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  shopIconBox: {
    width: 42,
    height: 42,
    backgroundColor: 'rgba(67,227,235,0.15)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopTitle: {
    fontWeight: '700',
    color: '#fff',
    fontSize: 14,
  },
  shopSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  shopArrow: {
    color: '#43e3eb',
    fontSize: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  countBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    marginRight: 8,
  },
  countText: {
    color: '#001016',
    fontSize: 11,
    fontWeight: '800',
  },
  bellBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    borderRadius: 14,
  },
  newRequestBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newRequestText: {
    color: '#001016',
    fontWeight: '700',
    fontSize: 12,
  },
  jobCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  jobIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: theme.colors.text,
  },
  jobSub: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progBarBg: {
    height: 6,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  jobWorkerText: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  jobPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  viewAllBtn: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    paddingVertical: 8,
    borderRadius: 14,
  },
  gridIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '500',
  },
  pastJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  pastIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pastTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 2,
  },
  pastSub: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  pastPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  pastRating: {
    fontSize: 12,
    color: '#f5b300',
    marginTop: 2,
  }
});

export default HomeScreen;
