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
  Alert,
  Image,
  Modal,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { jobService } from '../../services/jobService';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Receipt, 
  FileText, 
  Image as ImageIcon, 
  X, 
  AlertCircle,
  Navigation
} from 'lucide-react-native';

const WorkerJobDetailsScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { job } = route.params || {};
  
  const [price, setPrice] = useState(job?.budget ? String(job.budget) : '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fullAddress = job?.addressDetails?.fullAddress 
    || job?.addressDetails?.address 
    || (typeof job?.addressDetails === 'string' ? job?.addressDetails : null) 
    || 'Address not provided';

  const dateStr = job?.preferredDate 
    ? new Date(job.preferredDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
    : 'Today';

  const jobLat = Number(job?.location?.coordinates?.[1]) || 23.0350;
  const jobLng = Number(job?.location?.coordinates?.[0]) || 72.5293;
  const rawWLat = Number(user?.activeLocation?.coordinates?.[1]);
  const rawWLng = Number(user?.activeLocation?.coordinates?.[0]);
  const hasRawCoords = !isNaN(rawWLat) && !isNaN(rawWLng) && (rawWLat !== 0 || rawWLng !== 0);
  let initialWorkerLat = rawWLat;
  let initialWorkerLng = rawWLng;
  // Unknown location: park the draggable pin beside the job so the worker can drag it to where they are.
  // No distance/ETA is shown until it is a real position (saved location or a manual drag).
  if (!hasRawCoords) {
    initialWorkerLat = jobLat + 0.0072;
    initialWorkerLng = jobLng + 0.0055;
  }

  const [workerLat, setWorkerLat] = useState(initialWorkerLat);
  const [workerLng, setWorkerLng] = useState(initialWorkerLng);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);

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
        const lat = ${jobLat};
        const lng = ${jobLng};
        let wLat = ${initialWorkerLat};
        let wLng = ${initialWorkerLng};

        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
        
        const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        }).addTo(map);

        carto.on('tileerror', function() {
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        });

        setTimeout(function() { map.invalidateSize(); }, 200);

        // Job Pin
        const jobIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 22px; height: 22px; border-radius: 11px; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 11px;">🏠</div>',
          className: '', iconSize: [22, 22], iconAnchor: [11, 11]
        });
        L.marker([lat, lng], {icon: jobIcon}).addTo(map).bindPopup("<b>Customer Job Location</b>");

        // Worker Pin (Draggable)
        const workerIcon = L.divIcon({
          html: '<div style="background-color: #6C47FF; width: 24px; height: 24px; border-radius: 12px; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 12px;">📍</div>',
          className: '', iconSize: [24, 24], iconAnchor: [12, 12]
        });
        
        const workerMarker = L.marker([wLat, wLng], {icon: workerIcon, draggable: true}).addTo(map).bindPopup(${hasRawCoords ? '"<b>Your Location</b> (Drag to adjust)"' : '"<b>Drag me to your location</b>"'}).openPopup();
        
        // Connecting line
        const routeLine = L.polyline([[wLat, wLng], [lat, lng]], {
          color: '#6C47FF',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8'
        }).addTo(map);

        const bounds = L.latLngBounds([[lat, lng], [wLat, wLng]]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

        // Initial calculate trigger — only for a real saved location
        if (${hasRawCoords ? 'true' : 'false'}) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location_update', lat: wLat, lng: wLng }));
        }

        workerMarker.on('dragend', function (e) {
            const position = workerMarker.getLatLng();
            wLat = position.lat;
            wLng = position.lng;
            routeLine.setLatLngs([[wLat, wLng], [lat, lng]]);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location_update', lat: wLat, lng: wLng }));
        });
      </script>
    </body>
    </html>
  `;

  const canQuote = user?.kyc?.status === 'APPROVED' && (user?.wallet?.balance || 0) >= 100;

  const styles = createStyles(theme, isDarkMode);

  const handleSubmit = async () => {
    if (!price || !description) {
      return Alert.alert('Error', 'Please enter your quote price and a brief note.');
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
      if (res.data?.status === 'success' || res.data?.quote) {
        Alert.alert("Quote Sent! 🚀", "Your quote has been sent to the customer. You will receive an instant alert if accepted.", [
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
        title="Job Request Details"
        subtitle={job?.subcategory ? `${job.category || 'Service'} · ${job.subcategory}` : job?.category || 'Service Request'}
        showBack={true}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Customer & Location Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{job?.customerId?.name ? job.customerId.name[0] : 'C'}</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{job?.customerId?.name || 'Customer'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <MapPin size={13} color="#6C47FF" style={{ marginRight: 4 }} />
              <Text style={styles.customerLocation} numberOfLines={2}>{fullAddress}</Text>
            </View>
          </View>
        </View>

        {/* Schedule & Budget Quick Pill Card */}
        <View style={styles.scheduleCard}>
          <View style={styles.schedulePill}>
            <Calendar size={14} color="#6C47FF" style={{ marginRight: 6 }} />
            <Text style={styles.schedulePillText}>{dateStr}</Text>
          </View>
          <View style={styles.schedulePill}>
            <Clock size={14} color="#6C47FF" style={{ marginRight: 6 }} />
            <Text style={styles.schedulePillText}>{job?.timeSlot || 'Urgent / ASAP'}</Text>
          </View>
          <View style={[styles.schedulePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Receipt size={14} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={[styles.schedulePillText, { color: '#10B981' }]}>
              {job?.budget ? `Budget ₹${job.budget}` : 'Open to Quotes'}
            </Text>
          </View>
        </View>

        {/* Problem Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Problem Description</Text>
          <Text style={styles.problemText}>
            {job?.description ? `"${job.description}"` : 'No specific description provided by customer.'}
          </Text>
        </View>

        {/* Customer Media / Attached Photos */}
        {job?.media && job.media.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Customer Photos ({job.media.length})</Text>
            <Text style={styles.mediaHint}>Tap any photo to view full size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {job.media.map((url, i) => (
                <TouchableOpacity 
                  key={i} 
                  onPress={() => setSelectedPhoto(url)} 
                  style={styles.mediaThumbBox}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: url }} style={styles.mediaThumb} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Map & Distance Calculation */}
        <View style={[styles.sectionCard, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Dispatch Distance & Estimated Arrival</Text>
            <Text style={styles.mapSubText}>Drag the purple pin to recalculate distance from your current location.</Text>
          </View>
          
          <View style={styles.mapArea}>
            <WebView 
              key={`${jobLat.toFixed(4)}_${jobLng.toFixed(4)}_${initialWorkerLat.toFixed(4)}_${initialWorkerLng.toFixed(4)}`}
              source={{ html: mapHTML }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'location_update') {
                  setWorkerLat(data.lat);
                  setWorkerLng(data.lng);
                  // Haversine distance calc
                  const R = 6371; // Earth radius in km
                  const dLat = (data.lat - jobLat) * Math.PI / 180;
                  const dLon = (data.lng - jobLng) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.cos(jobLat * Math.PI / 180) * Math.cos(data.lat * Math.PI / 180) *
                            Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const dist = R * c;
                  const time = Math.round(dist * 2.5 + 5);
                  setDistance(dist.toFixed(1));
                  setEta(time);
                }
              }}
              scrollEnabled={false}
            />
            {distance && (
              <View style={styles.mapLabel}>
                <Text style={styles.mapLabelText}>📍 {distance} km away  ⏱ ~{eta} min arrival</Text>
              </View>
            )}
          </View>
        </View>

        {/* Submit Quote Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submit Your Quote</Text>
          
          {!canQuote && (
            <View style={styles.kycWarningBox}>
              <AlertCircle size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.kycWarningText}>
                Your KYC must be approved and you need at least ₹100 wallet balance to submit quotes.
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Your Quote Price (₹) *</Text>
          <TextInput 
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder={job?.budget ? `e.g. ${job.budget}` : "e.g. 450"}
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Service Note / Estimated Time *</Text>
          <TextInput 
            style={[styles.input, { height: 85, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Ready to arrive in 20 mins. Will bring all required spare parts."
            placeholderTextColor={theme.colors.textDim}
            editable={canQuote && !isSubmitting}
          />

          <TouchableOpacity 
            style={[styles.submitBtn, (!canQuote || isSubmitting) && { opacity: 0.5 }]} 
            onPress={handleSubmit}
            disabled={!canQuote || isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? 'Sending Quote...' : `Submit Quote · ₹${price || '0'}`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Photo Preview Modal */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalClose} onPress={() => setSelectedPhoto(null)}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image source={{ uri: selectedPhoto }} style={styles.photoModalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C47FF',
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
    marginLeft: 14,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  customerLocation: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    lineHeight: 16,
    flex: 1,
  },
  scheduleCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  schedulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  schedulePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  problemText: {
    fontSize: 14,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  mediaHint: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginBottom: 4,
  },
  mediaThumbBox: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  mapSubText: {
    fontSize: 12,
    color: theme.colors.textDim,
    lineHeight: 16,
  },
  mapArea: {
    height: 190,
    backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
    position: 'relative',
  },
  mapLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  mapLabelText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  kycWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  kycWarningText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '90%',
    height: '80%',
  },
});

export default WorkerJobDetailsScreen;
