import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  StatusBar,
  Linking,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Phone, MessageCircle } from 'lucide-react-native';

const WorkerNavigateJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);

  const { jobId, job, quoteAmount } = route.params || {};

  const amount = quoteAmount || job?.payment?.amount || 0;
  const commission = 0;
  const earning = amount;

  const jobLat = job?.location?.coordinates?.[1] || 19.0760;
  const jobLng = job?.location?.coordinates?.[0] || 72.8777;
  const wLat = user?.activeLocation?.coordinates?.[1] || 19.0800;
  const wLng = user?.activeLocation?.coordinates?.[0] || 72.8800;

  const [distance, setDistance] = useState('...');
  const [eta, setEta] = useState('...');

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${jobLat}, ${jobLng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc' }).addTo(map);

        const jobIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 8px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [16, 16], iconAnchor: [8, 8]
        });
        const workerIcon = L.divIcon({
          html: '<div style="background-color: #0e9aa7; width: 16px; height: 16px; border-radius: 8px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [16, 16], iconAnchor: [8, 8]
        });

        L.marker([${jobLat}, ${jobLng}], {icon: jobIcon}).addTo(map).bindPopup("Customer");
        L.marker([${wLat}, ${wLng}], {icon: workerIcon}).addTo(map).bindPopup("You");

        const bounds = L.latLngBounds([[${jobLat}, ${jobLng}], [${wLat}, ${wLng}]]);
        map.fitBounds(bounds, { padding: [40, 40] });

        // Basic Distance Calc for display
        const R = 6371;
        const dLat = (${wLat} - ${jobLat}) * Math.PI / 180;
        const dLon = (${wLng} - ${jobLng}) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(${jobLat} * Math.PI / 180) * Math.cos(${wLat} * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = (R * c).toFixed(1);
        const time = Math.round(dist * 2 + 5);

        window.ReactNativeWebView.postMessage(JSON.stringify({ dist, time }));
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
            source={{ html: mapHTML }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            onMessage={(e) => {
                const data = JSON.parse(e.nativeEvent.data);
                setDistance(data.dist);
                setEta(data.time);
            }}
          />
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>🚗 {eta} min - {distance} km</Text>
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
