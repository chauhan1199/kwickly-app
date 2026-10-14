import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useSocket from '../../hooks/useSocket';
import { jobService } from '../../services/jobService';
import { distanceKm, estimateEtaMinutes, formatDistance, getRealRating } from '../../utils/geo';

const LiveTrackingScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();

  const { worker: routeWorker, job: initialJob, jobId } = route.params || {};

  const [currentJob, setCurrentJob] = useState(initialJob || null);
  const [liveWorkerCoords, setLiveWorkerCoords] = useState(null);
  const targetJobId = currentJob?._id || initialJob?._id || jobId;

  // Poll backend every 3.5 seconds to keep screen synchronized with worker status changes
  const fetchJobStatus = useCallback(async () => {
    if (!targetJobId) return;
    try {
      const res = await jobService.getJobById(targetJobId);
      if (res.data?.data) {
        setCurrentJob(res.data.data);
      }
    } catch (e) {
      // Non-blocking poll
    }
  }, [targetJobId]);

  useEffect(() => {
    fetchJobStatus();
    const interval = setInterval(fetchJobStatus, 3500);
    return () => clearInterval(interval);
  }, [fetchJobStatus]);

  useSocket({
    role: user?.role || 'CUSTOMER',
    userId: user?._id || user?.id,
    onEvent: (event, data) => {
      if (event === 'WORKER_LOCATION' && (data?.jobId === targetJobId || !data?.jobId)) {
        const cLat = data?.coords?.latitude ?? data?.coords?.lat ?? data?.coords?.[1];
        const cLng = data?.coords?.longitude ?? data?.coords?.lng ?? data?.coords?.[0];
        if (cLat && cLng) {
          setLiveWorkerCoords({ lat: Number(cLat), lng: Number(cLng) });
        }
      } else if (event === 'JOB_STATUS_CHANGED' || event === 'JOB_UPDATED' || event === 'JOB_COMPLETED') {
        fetchJobStatus();
      }
    }
  });

  const job = currentJob || initialJob;
  const status = job?.status || 'ALLOCATED';

  // Don't mock a worker. Get worker either directly from route or from job object
  const workerObj = typeof job?.workerId === 'object' ? job.workerId : null;
  const w = { ...(workerObj || {}), ...(routeWorker || {}) };
  const workerName = w.name || (typeof job?.workerName === 'string' ? job.workerName : 'Technician');

  if (!w || (!w.name && !w._id && !job?.workerId)) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.textDim }}>Waiting for worker assignment...</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  const isEnRoute = status === 'ALLOCATED' || status === 'ARRIVING';
  const isInProgress = status === 'IN_PROGRESS';
  const isCompleted = status === 'COMPLETED';
  const isSettled = status === 'PAID' || status === 'CLOSED';

  const otp = job?.security?.arrivalOtp || null;

  // Job coordinates: prefer job location coordinates, fallback to Ahmedabad Vastrapur
  const jobLat = Number(job?.location?.coordinates?.[1]) || 23.0350;
  const jobLng = Number(job?.location?.coordinates?.[0]) || 72.5293;

  // Worker coordinates: live socket update first, then the worker's last known activeLocation.
  // When neither exists we show no worker pin and no ETA rather than inventing a position.
  const rawWLat = liveWorkerCoords?.lat || Number(w?.activeLocation?.coordinates?.[1] || workerObj?.activeLocation?.coordinates?.[1]);
  const rawWLng = liveWorkerCoords?.lng || Number(w?.activeLocation?.coordinates?.[0] || workerObj?.activeLocation?.coordinates?.[0]);
  const hasWorkerCoords = !isNaN(rawWLat) && !isNaN(rawWLng) && (rawWLat !== 0 || rawWLng !== 0);
  const workerLat = hasWorkerCoords ? rawWLat : null;
  const workerLng = hasWorkerCoords ? rawWLng : null;

  const hasJobCoords = Array.isArray(job?.location?.coordinates) && job.location.coordinates.length === 2;
  const liveDistanceKm = hasWorkerCoords && hasJobCoords
    ? distanceKm({ lat: workerLat, lng: workerLng }, { lat: jobLat, lng: jobLng })
    : null;
  const etaMins = estimateEtaMinutes(liveDistanceKm);
  const distLabel = formatDistance(liveDistanceKm);
  const workerRating = getRealRating(w.rating);

  // App Bar and Status Badge labels
  let appBarTitle = 'Live Tracking';
  let appBarSub = `${workerName} is on the way`;
  let mapPillText = etaMins ? `⏱ ETA ~${etaMins} min · ${distLabel}` : '📍 Waiting for live location';

  if (isInProgress) {
    appBarTitle = 'Service In Progress';
    appBarSub = `${workerName} is at your location`;
    mapPillText = '⚡ Service In Progress';
  } else if (isCompleted) {
    appBarTitle = 'Work Completed';
    appBarSub = 'Please review work and verify';
    mapPillText = '✓ Work Completed';
  } else if (isSettled) {
    appBarTitle = 'Job Closed';
    appBarSub = 'Service finished & paid';
    mapPillText = '✓ Completed & Paid';
  }

  // Generate Flow-Aware Leaflet Map HTML
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background: #f3f4f6; }
        html, body, #map { height: 100%; width: 100%; border-radius: 16px; overflow: hidden; }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        .pulse-beacon {
          animation: pulse 2s infinite ease-in-out;
        }
        .leaflet-control-attribution { display: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const lat = ${jobLat};
        const lng = ${jobLng};
        const hasWorker = ${hasWorkerCoords ? 'true' : 'false'};
        const wLat = ${hasWorkerCoords ? workerLat : 'null'};
        const wLng = ${hasWorkerCoords ? workerLng : 'null'};
        const status = "${status}";

        const map = L.map('map', { zoomControl: false, attributionControl: false });

        // OpenStreetMap tiles (CARTO raster tiles now return an "API key required" image)
        const carto = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(map);

        carto.on('tileerror', function() {
            if (window.__osmFallback) return; window.__osmFallback = true;
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        });

        setTimeout(function() { map.invalidateSize(); }, 200);

        if (status === 'IN_PROGRESS') {
          // On Site: Single animated service beacon centered directly at job location
          map.setView([lat, lng], 17);

          const inProgressIcon = L.divIcon({
            html: '<div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">' +
                  '<div class="pulse-beacon" style="position:absolute; width:48px; height:48px; border-radius:24px; background:rgba(108,71,255,0.35);"></div>' +
                  '<div style="background-color: #6C47FF; width: 30px; height: 30px; border-radius: 15px; border: 3px solid white; box-shadow: 0 4px 10px rgba(108,71,255,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index:2;">🔧</div>' +
                  '</div>',
            className: '',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
          });
          L.marker([lat, lng], {icon: inProgressIcon}).addTo(map).bindPopup("<b>Service In Progress</b><br/>${workerName} is at your location").openPopup();

        } else if (status === 'COMPLETED') {
          // Completed: Centered on job location with completion checkmark
          map.setView([lat, lng], 16);

          const completedIcon = L.divIcon({
            html: '<div style="background-color: #10B981; width: 30px; height: 30px; border-radius: 15px; border: 3px solid white; box-shadow: 0 4px 10px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; font-size: 15px;">✅</div>',
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          L.marker([lat, lng], {icon: completedIcon}).addTo(map).bindPopup("<b>Work Completed</b><br/>Please verify & pay").openPopup();

        } else if (status === 'PAID' || status === 'CLOSED') {
          // Closed & Paid: Centered with verified shield
          map.setView([lat, lng], 16);

          const closedIcon = L.divIcon({
            html: '<div style="background-color: #059669; width: 30px; height: 30px; border-radius: 15px; border: 3px solid white; box-shadow: 0 4px 10px rgba(5,150,105,0.5); display: flex; align-items: center; justify-content: center; font-size: 15px;">🛡️</div>',
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          L.marker([lat, lng], {icon: closedIcon}).addTo(map).bindPopup("<b>Job Completed & Paid ✓</b><br/>Service finished successfully").openPopup();

        } else {
          // En Route (ALLOCATED / ARRIVING): Customer & Worker pins with dashed route
          map.setView([lat, lng], 15);

          const jobIcon = L.divIcon({
            html: '<div style="background-color: #6C47FF; width: 26px; height: 26px; border-radius: 13px; border: 3px solid white; box-shadow: 0 3px 8px rgba(108,71,255,0.45); display: flex; align-items: center; justify-content: center; font-size: 13px;">🏠</div>',
            className: '',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          L.marker([lat, lng], {icon: jobIcon}).addTo(map).bindPopup("<b>Your Location</b>");

          // Worker pin + route only once we know where the worker really is
          if (hasWorker) {
            const workerIcon = L.divIcon({
              html: '<div style="background-color: #10B981; width: 26px; height: 26px; border-radius: 13px; border: 3px solid white; box-shadow: 0 3px 8px rgba(16,185,129,0.45); display: flex; align-items: center; justify-content: center; font-size: 13px;">🛵</div>',
              className: '',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            L.marker([wLat, wLng], {icon: workerIcon}).addTo(map).bindPopup("<b>${workerName} (${status === 'ARRIVING' ? 'En Route' : 'Assigned'})</b>").openPopup();

            // Connect with route path
            L.polyline([[wLat, wLng], [lat, lng]], {
              color: '#6C47FF',
              weight: 4,
              opacity: 0.85,
              dashArray: '6, 8'
            }).addTo(map);

            const bounds = L.latLngBounds([[lat, lng], [wLat, wLng]]);
            map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
          }
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

  const handleCall = () => {
    if (w.phone) {
      Linking.openURL(`tel:${w.phone}`);
    } else {
      Alert.alert('Call unavailable', `${workerName}'s phone number is not available yet. Try chat instead.`);
    }
  };

  const handleChat = () => {
    if (w._id) {
      navigation.navigate('Chat', {
        jobId: job?._id,
        recipientId: w._id,
        recipientName: workerName
      });
    } else {
      Alert.alert('Chat', 'Opening chat with ' + workerName);
    }
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
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>{appBarTitle}</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>{appBarSub}</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={fetchJobStatus}>
          <Text style={{fontSize: 16}}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Leaflet Map Area */}
        <View style={styles.mapArea}>
          <WebView 
            key={`${status}_${jobLat.toFixed(4)}_${jobLng.toFixed(4)}_${hasWorkerCoords ? `${workerLat.toFixed(4)}_${workerLng.toFixed(4)}` : 'nopos'}`}
            source={{ html: mapHTML, baseUrl: 'https://kwickly.app/' }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
          <View style={styles.mapLabel}>
            <Text style={styles.mapLabelText}>{mapPillText}</Text>
          </View>
        </View>

        {/* Worker Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>{workerName ? workerName[0] : 'W'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.workerName}>{workerName}</Text>
              <Text style={styles.workerMuted}>{workerRating ? `★ ${workerRating.toFixed(1)}` : 'New'} · {w.category || job?.category || 'Professional'}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
              <Text style={{fontSize: 16}}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleChat}>
              <Text style={{fontSize: 16}}>💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Specific Cards */}
        {isEnRoute && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Arrival OTP</Text>
            <Text style={styles.cardSub}>Share this 4-digit OTP with {workerName} upon arrival</Text>
            {otp ? (
              <View style={styles.otpBox}>
                <Text style={styles.otpText}>{otp}</Text>
              </View>
            ) : (
              <View style={[styles.otpBox, { backgroundColor: 'transparent' }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.cardSub, { marginTop: 6 }]}>Fetching OTP...</Text>
              </View>
            )}
          </View>
        )}

        {isInProgress && (
          <View style={[styles.card, { borderColor: theme.colors.primary, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>⚡</Text>
              <Text style={styles.cardTitle}>Work In Progress</Text>
            </View>
            <Text style={[styles.cardSub, { marginTop: 4 }]}>
              {workerName} has arrived and is currently working on your {job?.category || 'service'}.
            </Text>
          </View>
        )}

        {isCompleted && (
          <View style={[styles.card, { borderColor: '#10B981', borderWidth: 1.5 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginRight: 8 }}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: '#10B981' }]}>Work Completed!</Text>
                <Text style={styles.cardSub}>{workerName} has finished the job. Please verify and complete payment.</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.simulateBtn, { marginTop: 16 }]}
              onPress={() => navigation.navigate('WorkCompleted', { worker: w, job: currentJob || job })}
            >
              <Text style={styles.simulateBtnText}>Review Work & Make Payment →</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSettled && (
          <View style={[styles.card, { borderColor: '#10B981', borderWidth: 1 }]}>
            <Text style={[styles.cardTitle, { color: '#10B981' }]}>Job Completed & Paid ✓</Text>
            <Text style={styles.cardSub}>This service has been successfully completed and paid for.</Text>
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
                <Text style={styles.tlSub}>Category: {job?.category || 'Service'}</Text>
              </View>
            </View>

            {/* Pro Accepted */}
            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotDone]} />
              <View style={styles.tlLineDone} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitle}>Pro Accepted</Text>
                <Text style={styles.tlSub}>{workerName}</Text>
              </View>
            </View>

            {/* On the Way */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot, 
                (!isEnRoute) ? styles.tlDotDone : styles.tlDotActive
              ]} />
              <View style={(!isEnRoute) ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={[styles.tlTitle, isEnRoute ? {color: theme.colors.primary} : {}]}>On the Way</Text>
                <Text style={styles.tlSub}>{isEnRoute ? (etaMins ? `ETA ~${etaMins} min` : 'Waiting for live location') : 'Completed'}</Text>
              </View>
            </View>

            {/* Arrived (OTP) */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot, 
                (!isEnRoute) ? styles.tlDotDone : {}
              ]} />
              <View style={(!isEnRoute) ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={(!isEnRoute) ? styles.tlTitle : styles.tlTitleMuted}>Arrived (OTP)</Text>
                <Text style={styles.tlSub}>{(!isEnRoute) ? 'OTP Verified' : 'Pending arrival'}</Text>
              </View>
            </View>

            {/* Work in Progress */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot,
                isInProgress ? styles.tlDotActive : (isCompleted || isSettled ? styles.tlDotDone : {})
              ]} />
              <View style={isCompleted || isSettled ? styles.tlLineDone : styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={isInProgress ? [styles.tlTitle, {color: theme.colors.primary}] : ((isCompleted || isSettled) ? styles.tlTitle : styles.tlTitleMuted)}>Work in Progress</Text>
                <Text style={styles.tlSub}>{isInProgress ? 'Active' : ((isCompleted || isSettled) ? 'Completed' : 'Pending')}</Text>
              </View>
            </View>

            {/* Payment & Rating */}
            <View style={styles.tlItem}>
              <View style={[
                styles.tlDot,
                isCompleted ? styles.tlDotActive : (isSettled ? styles.tlDotDone : {})
              ]} />
              <View style={styles.tlContent}>
                <Text style={isCompleted ? [styles.tlTitle, {color: theme.colors.primary}] : (isSettled ? styles.tlTitle : styles.tlTitleMuted)}>Payment & Rating</Text>
                <Text style={styles.tlSub}>{isSettled ? 'Paid & Rated' : (isCompleted ? 'Pending payment' : 'Pending')}</Text>
              </View>
            </View>

          </View>
        </View>

        {isEnRoute && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelJob}>
            <Text style={styles.cancelBtnText}>Cancel Job</Text>
          </TouchableOpacity>
        )}

        {isSettled && (
          <Button 
            title="Back to Home" 
            onPress={() => navigation.navigate('Home', { screen: 'HomeMain', params: { refresh: Date.now() } })}
            style={{ marginTop: 16 }}
          />
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
    paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) + 14, 46) : 14,
    paddingBottom: 14,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  }
});

export default LiveTrackingScreen;
