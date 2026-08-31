import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { jobService } from '../../services/jobService';

const LiveTrackingScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { worker: routeWorker, job } = route.params || {};

  // Don't mock a worker. Get worker either directly from route or from job object
  const w = routeWorker || job?.workerId;

  if (!w) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.textDim }}>Waiting for worker assignment...</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  const otp = job?.security?.arrivalOtp || '4729';

  const jobLat = job?.location?.coordinates?.[1] || 19.0760;
  const jobLng = job?.location?.coordinates?.[0] || 72.8777;
  const workerLat = w?.activeLocation?.coordinates?.[1] || 19.0800;
  const workerLng = w?.activeLocation?.coordinates?.[0] || 72.8800;

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; border-radius: 16px; overflow: hidden; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const lat = ${jobLat};
        const lng = ${jobLng};
        const wLat = ${workerLat};
        const wLng = ${workerLng};

        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc'
        }).addTo(map);

        // Job Pin
        const jobIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([lat, lng], {icon: jobIcon}).addTo(map).bindPopup("Job Location");

        // Worker Pin
        if (wLat && wLng) {
          const workerIcon = L.divIcon({
            html: '<div style="background-color: #0e9aa7; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });
          L.marker([wLat, wLng], {icon: workerIcon}).addTo(map).bindPopup("Worker").openPopup();
          
          const bounds = L.latLngBounds([[lat, lng], [wLat, wLng]]);
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      </script>
    </body>
    </html>
  `;

  const handleCancelJob = () => {
    Alert.alert(
      "Cancel Job",
      "Are you sure you want to cancel this job?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await jobService.cancelJob(job?._id);
              if (res.data?.status === 'success') {
                Alert.alert("Cancelled", "Your job has been cancelled.");
                navigation.goBack();
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to cancel job');
            }
          }
        }
      ]
    );
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Live Tracking</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>{w.name} is on the way</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Leaflet Map Area */}
        <View style={styles.mapArea}>
          <WebView 
            source={{ html: mapHTML }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
          <View style={styles.mapLabel}>
            <Text style={styles.mapLabelText}>⏱ ETA {w.eta || 'Calculating'} min</Text>
          </View>
        </View>

        {/* Worker Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>{w.name ? w.name[0] : 'W'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.workerName}>{w.name || 'Worker'}</Text>
              <Text style={styles.workerMuted}>★ {typeof w.rating === 'object' ? (w.rating?.average || 0) : (w.rating || 4.5)} · {w.dist}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{fontSize: 16}}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{fontSize: 16}}>💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OTP Section */}
        {(job?.status === 'ALLOCATED' || job?.status === 'ARRIVING' || !job?.status) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Arrival OTP</Text>
            <Text style={styles.cardSub}>Share with worker when they arrive</Text>
            <View style={styles.otpBox}>
              <Text style={styles.otpText}>{otp}</Text>
            </View>
          </View>
        )}
        {job?.status === 'IN_PROGRESS' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Work In Progress</Text>
            <Text style={styles.cardSub}>The worker is currently working on your job.</Text>
          </View>
        )}

        {/* Job Progress Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job Progress</Text>
          <View style={styles.timeline}>
            {/* Job Posted */}
            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotDone]} />
              <View style={styles.tlLineDone} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitle}>Job Posted</Text>
                <Text style={styles.tlSub}>Just now</Text>
              </View>
            </View>

            {/* Pro Accepted */}
            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotDone]} />
              <View style={styles.tlLineDone} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitle}>Pro Accepted</Text>
                <Text style={styles.tlSub}>{w.name}</Text>
              </View>
            </View>

            {/* On the Way */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot, 
                job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' ? styles.tlDotDone : styles.tlDotActive
              ]} />
              <View style={job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={[styles.tlTitle, (job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED') ? {} : {color: theme.colors.primary}]}>On the Way</Text>
                <Text style={styles.tlSub}>ETA {w.eta} min</Text>
              </View>
            </View>

            {/* Arrived (OTP) */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot, 
                job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' ? styles.tlDotDone : {}
              ]} />
              <View style={job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' ? styles.tlTitle : styles.tlTitleMuted}>Arrived (OTP)</Text>
              </View>
            </View>

            {/* Work in Progress */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot,
                job?.status === 'IN_PROGRESS' ? styles.tlDotActive : (job?.status === 'COMPLETED' ? styles.tlDotDone : {})
              ]} />
              <View style={job?.status === 'COMPLETED' ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={job?.status === 'IN_PROGRESS' ? [styles.tlTitle, {color: theme.colors.primary}] : (job?.status === 'COMPLETED' ? styles.tlTitle : styles.tlTitleMuted)}>Work in Progress</Text>
              </View>
            </View>

            {/* Payment & Rating */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot,
                job?.status === 'COMPLETED' ? styles.tlDotActive : {}
              ]} />
              <View style={styles.tlContent}>
                <Text style={job?.status === 'COMPLETED' ? [styles.tlTitle, {color: theme.colors.primary}] : styles.tlTitleMuted}>Payment & Rating</Text>
              </View>
            </View>

          </View>
        </View>

        {(job?.status === 'ALLOCATED' || job?.status === 'ARRIVING' || !job?.status) && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelJob}>
            <Text style={styles.cancelBtnText}>Cancel Job</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
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
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  mapArea: {
    height: 200,
    backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  mapRoute: {
    position: 'absolute',
    left: '20%',
    top: '30%',
    width: '60%',
    height: '40%',
    borderBottomWidth: 2,
    borderColor: theme.colors.primary,
    transform: [{ rotate: '-15deg' }],
  },
  mapPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  workerName: {
    fontWeight: '800',
    fontSize: 14,
    color: theme.colors.text,
  },
  workerMuted: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  otpBox: {
    marginTop: 12,
    backgroundColor: 'rgba(14, 154, 167, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 12,
    color: theme.colors.primary,
  },
  timeline: {
    marginTop: 14,
  },
  tlItem: {
    flexDirection: 'row',
    marginBottom: 0,
    position: 'relative',
    paddingBottom: 20,
  },
  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border,
    marginTop: 4,
    zIndex: 2,
  },
  tlDotDone: {
    backgroundColor: theme.colors.primary,
  },
  tlDotActive: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(14, 154, 167, 0.3)',
  },
  tlLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: theme.colors.border,
    zIndex: 1,
  },
  tlLineDone: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: theme.colors.primary,
    zIndex: 1,
  },
  tlContent: {
    marginLeft: 16,
    flex: 1,
  },
  tlTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tlTitleMuted: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  tlSub: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  simulateBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  simulateBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  }
});

export default LiveTrackingScreen;
