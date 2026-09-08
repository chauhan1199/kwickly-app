import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  StatusBar, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  Image,
  Linking,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../context/ThemeContext';
import { jobService } from '../../services/jobService';
import { launchImageLibrary } from 'react-native-image-picker';
import { 
  ArrowLeft,
  Clock, 
  CheckCircle2, 
  CheckSquare, 
  Square, 
  Camera, 
  Video, 
  Image as ImageIcon, 
  Phone, 
  MapPin, 
  Navigation as NavigationIcon, 
  Copy, 
  Check, 
  Briefcase, 
  ShieldCheck, 
  Sparkles, 
  FileText, 
  AlertCircle
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const QUICK_NOTES = [
  'All components tested & verified',
  'Area thoroughly cleaned up',
  'Demonstrated operation to customer',
  'Replaced parts handed over'
];

const WorkerActiveJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);
  
  const { jobId, job: initialJob, quoteAmount: initialQuoteAmount } = route.params || {};
  
  const [job, setJob] = useState(initialJob || null);
  const [loadingJob, setLoadingJob] = useState(!initialJob);
  const [seconds, setSeconds] = useState(1458); 
  const [completing, setCompleting] = useState(false);
  const [report, setReport] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  
  // Media slots: before, after, video
  const [mediaUrls, setMediaUrls] = useState({
    before: null,
    after: null,
    video: null
  });
  
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Inspect & diagnose issue with customer', checked: true },
    { id: 2, text: 'Execute service & technical repairs', checked: false },
    { id: 3, text: 'Perform safety & functionality tests', checked: false },
    { id: 4, text: 'Customer demonstration & sign-off', checked: false },
  ]);

  // Fetch full/latest job details on mount
  useEffect(() => {
    let isMounted = true;
    if (jobId) {
      jobService.getJobById(jobId)
        .then(res => {
          if (isMounted && res?.data?.status === 'success' && res.data.data) {
            setJob(res.data.data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingJob(false);
        });
    }
    return () => { isMounted = false; };
  }, [jobId]);

  // Elapsed Session Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const completedCount = checklist.filter(c => c.checked).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  const pickAndUploadMedia = async (slot, mediaType) => {
    try {
      setUploadingSlot(slot);
      const result = await launchImageLibrary({
        mediaType: mediaType === 'video' ? 'video' : 'photo',
        quality: 0.8,
      });
      
      if (result.didCancel || !result.assets?.length) {
        setUploadingSlot(null);
        return;
      }

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('media', {
        uri: file.uri,
        type: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        name: file.fileName || `${slot}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      });

      const res = await jobService.uploadMedia(formData);
      if (res.data?.status === 'success' && res.data.data?.url) {
        setMediaUrls(prev => ({ ...prev, [slot]: res.data.data.url }));
      }
    } catch (e) {
      Alert.alert('Upload Failed', e.response?.data?.message || 'Could not upload media.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleCompleteJob = async () => {
    const allChecked = checklist.every(item => item.checked);
    if (!allChecked) {
      return Alert.alert(
        'Checklist Incomplete', 
        'Please complete all safety and service checklist items before marking this job complete.'
      );
    }

    const uploadedList = [mediaUrls.before, mediaUrls.after, mediaUrls.video].filter(Boolean);

    setCompleting(true);
    try {
      await jobService.completeJob(jobId, {
        media: uploadedList,
        report: report.trim()
      });
      
      const payoutAmount = initialQuoteAmount || job?.payment?.workerPayout || job?.payment?.amount || job?.budget || 0;
      navigation.navigate('WorkerJobComplete', { 
        job: job || initialJob, 
        quoteAmount: payoutAmount 
      });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to mark job as complete.');
    } finally {
      setCompleting(false);
    }
  };

  const getJobAddress = () => {
    const addr = job?.addressDetails || initialJob?.addressDetails;
    if (typeof addr === 'string' && addr.trim()) return addr.trim();
    if (typeof addr === 'object' && addr) {
      return addr.fullAddress || addr.address || addr.city || job?.location?.addressDetails?.city || 'Local Area';
    }
    return job?.location?.addressDetails?.city || 'Customer Location';
  };

  const completionOtp = job?.security?.completionOtp || initialJob?.security?.completionOtp || '1234';
  const customerName = job?.customerId?.name || initialJob?.customerId?.name || 'Customer';
  const customerPhone = job?.customerId?.phone || initialJob?.customerId?.phone || '';
  const serviceCategory = job?.category || initialJob?.category || 'Service';
  const subcategory = job?.subcategory || initialJob?.subcategory || '';
  const payoutAmount = initialQuoteAmount || job?.payment?.workerPayout || job?.payment?.amount || job?.budget || 0;

  const copyOtp = () => {
    Clipboard.setString(String(completionOtp));
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleCall = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`);
    } else {
      Alert.alert('Notice', 'Customer contact number is not provided.');
    }
  };

  const handleDirections = () => {
    const coords = job?.location?.coordinates || initialJob?.location?.coordinates;
    if (coords && coords.length >= 2) {
      const lat = coords[1];
      const lng = coords[0];
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else {
      Alert.alert('Notice', 'Exact coordinates are not available for navigation.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* ═══════════════════════════════════════
          APP BAR (STATUS-BAR AWARE)
      ═══════════════════════════════════════ */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
        </TouchableOpacity>
        
        <View style={styles.appBarCenter}>
          <View style={styles.statusLivePill}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusLiveText}>IN PROGRESS</Text>
          </View>
          <Text style={styles.appBarSub}>
            Job #{jobId ? String(jobId).substring(0, 6).toUpperCase() : '------'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.callHeaderBtn} 
          onPress={handleCall}
          activeOpacity={0.8}
        >
          <Phone size={18} color="#10B981" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* ═══════════════════════════════════════
            CUSTOMER & SERVICE CONTEXT CARD
        ═══════════════════════════════════════ */}
        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <View style={styles.categoryBadge}>
              <Briefcase size={13} color="#6C47FF" style={{ marginRight: 4 }} />
              <Text style={styles.categoryBadgeText}>
                {serviceCategory}{subcategory ? ` • ${subcategory}` : ''}
              </Text>
            </View>

            <View style={styles.payoutBadge}>
              <Text style={styles.payoutBadgeLabel}>Quote Payout</Text>
              <Text style={styles.payoutBadgeVal}>₹{payoutAmount}</Text>
            </View>
          </View>

          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {customerName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.customerDetails}>
              <Text style={styles.customerNameText}>{customerName}</Text>
              <View style={styles.addressRow}>
                <MapPin size={13} color={isDarkMode ? '#94A3B8' : '#64748B'} style={{ marginRight: 3, flexShrink: 0 }} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {getJobAddress()}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Action Chips */}
          <View style={styles.contextActionsRow}>
            <TouchableOpacity 
              style={styles.contextActionBtn} 
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Phone size={15} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={[styles.contextActionText, { color: '#10B981' }]}>Call Customer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contextActionBtn} 
              onPress={handleDirections}
              activeOpacity={0.8}
            >
              <NavigationIcon size={15} color="#6C47FF" style={{ marginRight: 6 }} />
              <Text style={[styles.contextActionText, { color: '#6C47FF' }]}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════════════════════════════
            WORK SESSION DIGITAL STOPWATCH
        ═══════════════════════════════════════ */}
        <LinearGradient
          colors={isDarkMode ? ['#1E1B4B', '#0F172A'] : ['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.timerCard}
        >
          <View style={styles.timerHeaderRow}>
            <View style={styles.timerPulsePill}>
              <View style={styles.timerRedDot} />
              <Text style={styles.timerPulseText}>WORK SESSION ACTIVE</Text>
            </View>
            <Clock size={16} color="rgba(255,255,255,0.7)" />
          </View>

          {/* Digital Timer Display */}
          <View style={styles.digitalTimerRow}>
            <View style={styles.timeDigitBox}>
              <Text style={styles.timeDigitNumber}>{String(hours).padStart(2, '0')}</Text>
              <Text style={styles.timeDigitUnit}>HRS</Text>
            </View>

            <Text style={styles.timeDigitSeparator}>:</Text>

            <View style={styles.timeDigitBox}>
              <Text style={styles.timeDigitNumber}>{String(mins).padStart(2, '0')}</Text>
              <Text style={styles.timeDigitUnit}>MIN</Text>
            </View>

            <Text style={styles.timeDigitSeparator}>:</Text>

            <View style={styles.timeDigitBox}>
              <Text style={styles.timeDigitNumber}>{String(secs).padStart(2, '0')}</Text>
              <Text style={styles.timeDigitUnit}>SEC</Text>
            </View>
          </View>

          <Text style={styles.timerFooterText}>
            Keep timer active • Live session tracked for customer invoice
          </Text>
        </LinearGradient>

        {/* ═══════════════════════════════════════
            INTERACTIVE JOB CHECKLIST
        ═══════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderBetween}>
            <View>
              <Text style={styles.sectionTitle}>Job Checklist</Text>
              <Text style={styles.sectionSub}>Tap items as you complete them</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>{completedCount}/{checklist.length} ({progressPercent}%)</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Checklist Items */}
          <View style={styles.checklistList}>
            {checklist.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={[
                  styles.checkItemCard,
                  item.checked && styles.checkItemCardDone
                ]}
                onPress={() => toggleCheck(item.id)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.checkIndicator, 
                  item.checked ? styles.checkIndicatorDone : styles.checkIndicatorPending
                ]}>
                  {item.checked ? (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  ) : null}
                </View>
                <Text style={[
                  styles.checkItemText, 
                  item.checked && styles.checkItemTextDone
                ]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════
            COMPLETION PROOF & MEDIA
        ═══════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Work Proof & Media</Text>
          <Text style={styles.sectionSub}>Upload before/after work photos or video</Text>
          
          <View style={styles.mediaGrid}>
            {/* Before Photo */}
            <TouchableOpacity
              style={[styles.mediaSlot, mediaUrls.before && styles.mediaSlotDone]}
              onPress={() => pickAndUploadMedia('before', 'photo')}
              activeOpacity={0.8}
            >
              {uploadingSlot === 'before' ? (
                <ActivityIndicator size="small" color="#6C47FF" />
              ) : mediaUrls.before ? (
                <View style={styles.mediaSlotFilled}>
                  <Image source={{ uri: mediaUrls.before }} style={styles.mediaThumbnail} resizeMode="cover" />
                  <View style={styles.mediaCheckBadge}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <Text style={styles.mediaSlotTitleDone}>✓ Before</Text>
                </View>
              ) : (
                <View style={styles.mediaSlotEmpty}>
                  <Camera size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  <Text style={styles.mediaSlotTitle}>+ Before</Text>
                  <Text style={styles.mediaSlotHint}>Initial state</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* After Photo */}
            <TouchableOpacity
              style={[styles.mediaSlot, mediaUrls.after && styles.mediaSlotDone]}
              onPress={() => pickAndUploadMedia('after', 'photo')}
              activeOpacity={0.8}
            >
              {uploadingSlot === 'after' ? (
                <ActivityIndicator size="small" color="#6C47FF" />
              ) : mediaUrls.after ? (
                <View style={styles.mediaSlotFilled}>
                  <Image source={{ uri: mediaUrls.after }} style={styles.mediaThumbnail} resizeMode="cover" />
                  <View style={styles.mediaCheckBadge}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <Text style={styles.mediaSlotTitleDone}>✓ After</Text>
                </View>
              ) : (
                <View style={styles.mediaSlotEmpty}>
                  <Sparkles size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  <Text style={styles.mediaSlotTitle}>+ After</Text>
                  <Text style={styles.mediaSlotHint}>Fixed work</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Work Video */}
            <TouchableOpacity
              style={[styles.mediaSlot, mediaUrls.video && styles.mediaSlotDone]}
              onPress={() => pickAndUploadMedia('video', 'video')}
              activeOpacity={0.8}
            >
              {uploadingSlot === 'video' ? (
                <ActivityIndicator size="small" color="#6C47FF" />
              ) : mediaUrls.video ? (
                <View style={styles.mediaSlotFilled}>
                  <LinearGradient colors={['#8B5CF6', '#6C47FF']} style={styles.mediaThumbnail}>
                    <Video size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.mediaCheckBadge}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <Text style={styles.mediaSlotTitleDone}>✓ Video</Text>
                </View>
              ) : (
                <View style={styles.mediaSlotEmpty}>
                  <Video size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  <Text style={styles.mediaSlotTitle}>+ Video</Text>
                  <Text style={styles.mediaSlotHint}>Optional clip</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════════════════════════════
            CUSTOMER COMPLETION OTP / PIN CARD
        ═══════════════════════════════════════ */}
        <View style={styles.otpCard}>
          <View style={styles.otpCardTop}>
            <View style={styles.otpIconBadge}>
              <ShieldCheck size={20} color="#6C47FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.otpCardTitle}>Customer Completion PIN</Text>
              <Text style={styles.otpCardSub}>
                Ask customer to enter this PIN in their app to confirm work & release payout.
              </Text>
            </View>
          </View>

          {/* 4-Box PIN Display */}
          <View style={styles.otpBoxesContainer}>
            {String(completionOtp).padEnd(4, '0').slice(0, 4).split('').map((digit, idx) => (
              <View key={idx} style={styles.otpDigitBox}>
                <Text style={styles.otpDigitText}>{digit}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.copyPillBtn} 
            onPress={copyOtp}
            activeOpacity={0.8}
          >
            {copiedOtp ? (
              <>
                <Check size={14} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={[styles.copyPillText, { color: '#10B981' }]}>PIN Copied!</Text>
              </>
            ) : (
              <>
                <Copy size={14} color="#6C47FF" style={{ marginRight: 6 }} />
                <Text style={styles.copyPillText}>Tap to Copy PIN</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════
            COMPLETION NOTES / REPORT
        ═══════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <FileText size={17} color="#6C47FF" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Completion Notes</Text>
          </View>
          <Text style={styles.sectionSub}>Add any remarks or warranty details for the customer</Text>
          
          <TextInput
            style={styles.textInput}
            placeholder="Type your notes, replaced parts or remarks here..."
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            multiline
            numberOfLines={3}
            value={report}
            onChangeText={setReport}
          />

          {/* Quick Chip Suggestions */}
          <View style={styles.quickChipsRow}>
            {QUICK_NOTES.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickChip}
                onPress={() => setReport(prev => prev ? `${prev}. ${q}` : q)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>+ {q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════
            MARK JOB COMPLETE ACTION
        ═══════════════════════════════════════ */}
        <TouchableOpacity 
          style={styles.completeBtnContainer}
          onPress={handleCompleteJob}
          disabled={completing}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.completeGradientBtn}
          >
            {completing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={styles.completeBtnText}>Mark Job Complete</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom padding to completely avoid tab bar / On Duty button */}
        <View style={{ height: 130 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (theme, isDarkMode, safeTop) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' 
  },

  // App Bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: safeTop + 8,
    paddingBottom: 12,
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#EEF2F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarCenter: {
    alignItems: 'center',
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 2,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  statusLiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  appBarSub: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#CBD5E1' : '#334155',
  },
  callHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: { 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },

  // Customer Context Card
  contextCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  },
  payoutBadge: {
    alignItems: 'flex-end',
  },
  payoutBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textTransform: 'uppercase',
  },
  payoutBadgeVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C47FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  customerDetails: {
    flex: 1,
  },
  customerNameText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    flex: 1,
    lineHeight: 16,
  },
  contextActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  contextActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  contextActionText: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Stopwatch Timer Card
  timerCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  timerPulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timerRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  timerPulseText: {
    color: '#34D399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  digitalTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  timeDigitBox: {
    alignItems: 'center',
    minWidth: 64,
  },
  timeDigitNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timeDigitUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 1,
  },
  timeDigitSeparator: {
    fontSize: 32,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
    marginBottom: 12,
  },
  timerFooterText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  sectionSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  progressPill: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6C47FF',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },

  // Checklist Items
  checklistList: {
    gap: 8,
  },
  checkItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  checkItemCardDone: {
    backgroundColor: isDarkMode ? '#064E3B18' : '#F0FDF4',
    borderColor: '#10B98133',
  },
  checkIndicator: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIndicatorPending: {
    borderWidth: 1.8,
    borderColor: isDarkMode ? '#64748B' : '#94A3B8',
  },
  checkIndicatorDone: {
    backgroundColor: '#10B981',
  },
  checkItemText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    flex: 1,
  },
  checkItemTextDone: {
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textDecorationLine: 'line-through',
  },

  // Media Grid
  mediaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  mediaSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mediaSlotDone: {
    borderStyle: 'solid',
    borderColor: '#10B981',
  },
  mediaSlotEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  mediaSlotTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: isDarkMode ? '#E2E8F0' : '#334155',
    marginTop: 6,
  },
  mediaSlotHint: {
    fontSize: 9.5,
    color: isDarkMode ? '#64748B' : '#94A3B8',
    marginTop: 1,
  },
  mediaSlotFilled: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSlotTitleDone: {
    position: 'absolute',
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // OTP Card
  otpCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#6C47FF33',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  otpCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  otpIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  otpCardSub: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  otpDigitBox: {
    width: 54,
    height: 58,
    borderRadius: 14,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  otpDigitText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#6C47FF',
    fontVariant: ['tabular-nums'],
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  copyPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6C47FF',
  },

  // Notes Input
  textInput: {
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    fontSize: 13.5,
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: isDarkMode ? '#CBD5E1' : '#475569',
  },

  // Mark Job Complete Button
  completeBtnContainer: {
    marginTop: 4,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  completeGradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  }
});

export default WorkerActiveJobScreen;
