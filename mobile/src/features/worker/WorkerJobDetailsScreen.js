import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { jobService } from '../../services/jobService';

const WorkerJobDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { job } = route.params || {};
  
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(job?.addressDetails || 'Address not provided');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jobLat = job?.location?.coordinates?.[1] || 19.0760;
  const jobLng = job?.location?.coordinates?.[0] || 72.8777;
  const initialWorkerLat = user?.activeLocation?.coordinates?.[1] || 19.0800;
  const initialWorkerLng = user?.activeLocation?.coordinates?.[0] || 72.8800;

  const [workerLat, setWorkerLat] = useState(initialWorkerLat);
  const [workerLng, setWorkerLng] = useState(initialWorkerLng);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);

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
        const lat = ${jobLat};
        const lng = ${jobLng};
        let wLat = ${initialWorkerLat};
        let wLng = ${initialWorkerLng};

        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

        // Job Pin
        const jobIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 7px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([lat, lng], {icon: jobIcon}).addTo(map).bindPopup("Job Location");

        // Worker Pin (Draggable)
        const workerIcon = L.divIcon({
          html: '<div style="background-color: #0e9aa7; width: 18px; height: 18px; border-radius: 9px; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>',
          className: '', iconSize: [18, 18], iconAnchor: [9, 9]
        });
        
        const workerMarker = L.marker([wLat, wLng], {icon: workerIcon, draggable: true}).addTo(map).bindPopup("Drag me!").openPopup();
        
        const bounds = L.latLngBounds([[lat, lng], [wLat, wLng]]);
        map.fitBounds(bounds, { padding: [40, 40] });

        // Initial calculate trigger
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location_update', lat: wLat, lng: wLng }));

        workerMarker.on('dragend', function (e) {
            const position = workerMarker.getLatLng();
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'location_update', 
                lat: position.lat, 
                lng: position.lng 
            }));
        });
      </script>
    </body>
    </html>
  `;

  const canQuote = user?.kyc?.status === 'APPROVED' && (user?.wallet?.balance || 0) >= 100;

  const styles = createStyles(theme, isDarkMode);

  const handleSubmit = async () => {
    if (!price || !description) {
      return Alert.alert('Error', 'Please fill in all details');
    }
    if (!canQuote) {
      return Alert.alert('Blocked', 'You must have an approved KYC and at least ₹100 in your wallet to quote.');
    }

    setIsSubmitting(true);
    try {
      const res = await jobService.placeQuote({
        jobId: job?._id,
        amount: Number(price),
        description
      });
      if (res.data.status === 'success') {
        Alert.alert("Success", "Your quote has been submitted successfully.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to submit quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <AppBar
        title="Job Details"
        subtitle={job?.subcategory ? `${job.category || 'Service'} · ${job.subcategory}` : job?.category || 'Job Details'}
        showBack={true}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Customer Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{job?.customerId?.name ? job.customerId.name[0] : 'C'}</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{job?.customerId?.name || 'Customer'}</Text>
            <Text style={styles.customerLocation}>{job?.addressDetails?.address || job?.addressDetails || 'Address not provided'}</Text>
          </View>
        </View>

        {/* Problem Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Problem Description</Text>
          <Text style={styles.problemText}>"{job?.description || 'No description provided'}"</Text>
        </View>

        {/* Media */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Customer Media</Text>
          <View style={styles.mediaRow}>
            {job?.media && job.media.length > 0 ? (
                job.media.map((url, i) => (
                    <View key={i} style={[styles.mediaBox, { backgroundColor: '#6366f1' }]} />
                ))
            ) : (
                <Text style={styles.problemText}>No media attached</Text>
            )}
          </View>
        </View>

        {/* Map & Distance Calculation */}
        <View style={[styles.sectionCard, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Dispatch Location & ETA</Text>
            <Text style={styles.problemText}>Drag the blue pin to adjust your starting location.</Text>
          </View>
          
          <View style={styles.mapArea}>
            <WebView 
              source={{ html: mapHTML }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'location_update') {
                  setWorkerLat(data.lat);
                  setWorkerLng(data.lng);
                  // Basic Haversine distance calc for instant feedback
                  const R = 6371; // Earth radius in km
                  const dLat = (data.lat - jobLat) * Math.PI / 180;
                  const dLon = (data.lng - jobLng) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.cos(jobLat * Math.PI / 180) * Math.cos(data.lat * Math.PI / 180) *
                            Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const distance = R * c;
                  const time = Math.round(distance * 2 + 5); // 2 mins per km + 5 min buffer
                  setDistance(distance.toFixed(1));
                  setEta(time);
                }
              }}
              scrollEnabled={false}
            />
            {distance && (
              <View style={styles.mapLabel}>
                <Text style={styles.mapLabelText}>📍 {distance} km away  ⏱ ~{eta} min</Text>
              </View>
            )}
          </View>
        </View>

        {/* Submit Quote Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submit Your Quote</Text>
          
          {!canQuote && (
            <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700' }}>
                Your KYC must be approved and you need at least ₹100 in your wallet to quote on jobs.
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Your price (₹)</Text>
          <TextInput 
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="e.g. 500"
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Description / Notes</Text>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Full service including gas refilling."
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <TouchableOpacity 
            style={[styles.submitBtn, (!canQuote || isSubmitting) && { opacity: 0.5 }]} 
            onPress={handleSubmit}
            disabled={!canQuote || isSubmitting}
          >
            <Text style={styles.submitBtnText}>{isSubmitting ? 'Submitting...' : 'Submit Quote'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  statusBox: {
    backgroundColor: theme.colors.primary + '26',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBoxText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  customerLocation: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  problemText: {
    fontSize: 15,
    color: theme.colors.textDim,
    fontStyle: 'italic',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    opacity: 0.8,
  },
  inputLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  mapArea: {
    height: 180,
    backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
    position: 'relative',
  },
  mapLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  mapLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  locationInputRow: {
    flexDirection: 'row',
  },
  gpsBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 1,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textDim,
  }
});

export default WorkerJobDetailsScreen;
