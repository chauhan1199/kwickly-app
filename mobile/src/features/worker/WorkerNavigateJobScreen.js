import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  StatusBar,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Phone, MessageCircle, Navigation } from 'lucide-react-native';
import { jobService } from '../../services/jobService';
import { distanceKm, estimateEtaMinutes, formatDistance } from '../../utils/geo';

const WorkerNavigateJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 0;
  const safeTop = Math.max(insets.top, androidHeight, Platform.OS === 'android' ? 36 : 16);
  const styles = createStyles(theme, isDarkMode, safeTop);

  const { jobId, job: initialJob, quoteAmount } = route.params || {};
  const [currentJob, setCurrentJob] = useState(initialJob || null);
  const targetJobId = currentJob?._id || initialJob?._id || jobId;

  useEffect(() => {
    if (targetJobId && (!currentJob || !currentJob.location?.coordinates)) {
      jobService.getJobById(targetJobId).then(res => {
        if (res.data?.data) setCurrentJob(res.data.data);
      }).catch(() => {});
    }
  }, [targetJobId]);

  const job = currentJob || initialJob;

  const amount = quoteAmount || job?.payment?.amount || 0;
  const commission = 0;
  const earning = amount;

  const jobLat = Number(job?.location?.coordinates?.[1]) || 23.0350;
  const jobLng = Number(job?.location?.coordinates?.[0]) || 72.5293;
  const rawWLat = Number(user?.activeLocation?.coordinates?.[1]);
  const rawWLng = Number(user?.activeLocation?.coordinates?.[0]);
  const hasRawCoords = !isNaN(rawWLat) && !isNaN(rawWLng) && (rawWLat !== 0 || rawWLng !== 0);
  // Real position only: when the worker's location is unknown we draw no worker pin and no ETA
  const wLat = hasRawCoords ? rawWLat : null;
  const wLng = hasRawCoords ? rawWLng : null;
  const routeKm = hasRawCoords ? distanceKm({ lat: wLat, lng: wLng }, { lat: jobLat, lng: jobLng }) : null;
  const eta = estimateEtaMinutes(routeKm);
  const distance = formatDistance(routeKm);

  // B1/M1 FIX: Transition job to ARRIVING when worker starts navigating to the job
  useEffect(() => {
    if (targetJobId && (job?.status === 'ALLOCATED' || !job?.status)) {
      jobService.arriveJob(targetJobId).catch((err) => {
        console.log('[WorkerNavigate] arriveJob notice:', err?.response?.data?.message || err.message);
      });
    }
  }, [targetJobId, job?.status]);

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; }
        .leaflet-control-attribution { display: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${jobLat}, ${jobLng}], 14);

        const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        }).addTo(map);

        carto.on('tileerror', function() {
          if (window.__osmFallback) return; window.__osmFallback = true;
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        });

        setTimeout(function() { map.invalidateSize(); }, 200);

        const jobIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 22px; height: 22px; border-radius: 11px; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 11px;">🏠</div>',
          className: '', iconSize: [22, 22], iconAnchor: [11, 11]
        });
        const workerIcon = L.divIcon({
          html: '<div style="background-color: #6C47FF; width: 24px; height: 24px; border-radius: 12px; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px;">🛵</div>',
          className: '', iconSize: [24, 24], iconAnchor: [12, 12]
        });

        const jobMarker = L.marker([${jobLat}, ${jobLng}], {icon: jobIcon}).addTo(map).bindPopup("<b>Customer Address</b>");

        if (${hasRawCoords ? 'true' : 'false'}) {
          L.marker([${wLat}, ${wLng}], {icon: workerIcon}).addTo(map).bindPopup("<b>Your Location</b>").openPopup();

          // Polyline route
          L.polyline([[${wLat}, ${wLng}], [${jobLat}, ${jobLng}]], {
            color: '#6C47FF',
            weight: 4,
            opacity: 0.85,
            dashArray: '6, 8'
          }).addTo(map);

          const bounds = L.latLngBounds([[${jobLat}, ${jobLng}], [${wLat}, ${wLng}]]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } else {
          jobMarker.openPopup();
        }
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Navigate to Job</Text>
          <Text style={styles.appBarSub}>{job?.customerId?.name || 'Customer'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Map */}
        <View style={styles.mapContainer}>
          <WebView 
            key={`${jobLat.toFixed(4)}_${jobLng.toFixed(4)}_${hasRawCoords ? `${wLat.toFixed(4)}_${wLng.toFixed(4)}` : 'nopos'}`}
            source={{ html: mapHTML, baseUrl: 'https://kwickly.app/' }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
          />
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>{eta ? `🚗 ${eta} min - ${distance}` : '📍 Your location is not available yet'}</Text>
          </View>
        </View>

        {/* Customer Info Box */}
        <View style={styles.customerBox}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{job?.customerId?.name?.[0] || 'C'}</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{job?.customerId?.name || 'Customer'}</Text>
            <Text style={styles.customerLocation} numberOfLines={1}>
              📍 {typeof job?.addressDetails === 'string' ? job.addressDetails : (job?.addressDetails?.fullAddress || job?.addressDetails?.address || job?.addressDetails?.city || 'Customer Location')}
            </Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                const phone = job?.customerId?.phone;
                if (phone) {
                  Linking.openURL(`tel:${phone}`);
                } else {
                  Alert.alert('Unavailable', 'Customer phone number is not available.');
                }
              }}
            >
              <Phone size={18} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { marginLeft: 8, backgroundColor: '#eff6ff' }]}
              onPress={() => {
                if (jobLat && jobLng) {
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${jobLat},${jobLng}`);
                } else {
                  Alert.alert('Notice', 'Destination coordinates unavailable.');
                }
              }}
            >
              <Navigation size={18} color="#2563eb" />
            </TouchableOpacity>
          </View>

        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingBox}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Job amount</Text>
              <Text style={styles.priceSub}>0% Commission (100% Worker Payout)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceValPositive}>₹{amount}</Text>
              <Text style={styles.priceValNegative}>-₹{commission}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <Text style={styles.earningLabel}>Your earning</Text>
            <Text style={styles.earningVal}>₹{earning}</Text>
          </View>
        </View>

        {/* Arrived Action */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('WorkerArrivalOTP', { jobId })}>
          <Text style={styles.actionBtnText}>✓ I've Arrived → Enter OTP</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode, safeTop = 16) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: safeTop + 8, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  mapContainer: {
    height: 200, backgroundColor: '#DBEAFE', borderRadius: 24,
    marginBottom: 20, overflow: 'hidden', position: 'relative'
  },
  mapLine: {
    position: 'absolute', width: '55%', height: 2, backgroundColor: '#64748B',
    top: '50%', left: '25%', transform: [{ rotate: '-30deg' }]
  },
  mapPin: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    borderWidth: 3, borderColor: 'white',
    transform: [{ translateX: -10 }, { translateY: -10 }]
  },
  etaBadge: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  etaText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  customerBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#0ea5e9',
    justifyContent: 'center', alignItems: 'center'
  },
  avatarText: { color: 'white', fontSize: 20, fontWeight: '800' },
  customerInfo: { flex: 1, marginLeft: 16 },
  customerName: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  customerLocation: { fontSize: 13, color: theme.colors.textDim, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center'
  },
  pricingBox: {
    backgroundColor: theme.colors.surface, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 24
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  priceSub: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
  priceValPositive: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  priceValNegative: { fontSize: 13, fontWeight: '600', color: '#ef4444', marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  earningLabel: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  earningVal: { fontSize: 20, fontWeight: '800', color: theme.colors.primary },
  actionBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center'
  },
  actionBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerNavigateJobScreen;
