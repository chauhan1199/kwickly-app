import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  MapPin,
  Home,
  Briefcase,
  Building,
  Plus,
  Trash2,
  Edit3,
  Star,
  CheckCircle2,
  Navigation
} from 'lucide-react-native';
import AppBar from '../../components/AppBar';
import AddressMapModal from '../../components/AddressMapModal';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

export const SavedAddressesScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUnread } = useNotifications();
  const { user, fetchUser } = useAuth();
  const addresses = user?.addresses || [];
  const fromBooking = route.params?.fromBooking === true;

  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedEditAddress, setSelectedEditAddress] = useState(null);
  const [loadingActionId, setLoadingActionId] = useState(null);

  const handleSetPrimary = async (id) => {
    try {
      setLoadingActionId(id);
      await customerService.setPrimaryAddress(id);
      await fetchUser();
      refreshUnread();
    } catch (e) {
      Alert.alert('Error', 'Failed to set primary address');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDelete = async (id) => {
    const addr = addresses.find(a => a._id === id);
    if (addr?.isPrimary && addresses.length > 1) {
      Alert.alert('Cannot Delete Default', 'Please set another address as default before deleting this address.');
      return;
    }

    Alert.alert(
      'Delete Address',
      'Are you sure you want to remove this delivery address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingActionId(id);
              await customerService.deleteAddress(id);
              await fetchUser();
              refreshUnread();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete address');
            } finally {
              setLoadingActionId(null);
            }
          }
        }
      ]
    );
  };

  const handleOpenAdd = () => {
    setSelectedEditAddress(null);
    setShowMapModal(true);
  };

  const handleOpenEdit = (addr) => {
    setSelectedEditAddress(addr);
    setShowMapModal(true);
  };

  const handleSelectAddress = (addr) => {
    DeviceEventEmitter.emit('ADDRESS_SELECTED', addr);
    if (route.params?.onSelectAddress) {
      try {
        route.params.onSelectAddress(addr);
      } catch (e) {}
    }
    navigation.goBack();
  };

  const handleSaveAddressPayload = async (payload) => {
    let savedAddr = null;
    if (selectedEditAddress?._id) {
      const res = await customerService.updateAddress(selectedEditAddress._id, payload);
      savedAddr = res.data?.data || payload;
    } else {
      const res = await customerService.addAddress({
        ...payload,
        isPrimary: addresses.length === 0
      });
      savedAddr = res.data?.data || payload;
    }
    await fetchUser();
    refreshUnread();
    setShowMapModal(false);

    if (fromBooking && savedAddr) {
      handleSelectAddress(savedAddr);
    }
  };

  const getAddressIcon = (label) => {
    const l = (label || '').toLowerCase();
    if (l.includes('home')) return Home;
    if (l.includes('office') || l.includes('work')) return Briefcase;
    return Building;
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Header Gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <AppBar
          title={fromBooking ? 'Select Delivery Address' : 'Saved Addresses'}
          subtitle={fromBooking ? 'Tap an address to continue booking' : `${addresses.length} saved location${addresses.length === 1 ? '' : 's'}`}
          showBack={true}
          transparent={true}
          showLogo={false}
          showProfile={false}
          showCart={false}
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Top Add Address Button */}
        <TouchableOpacity
          style={styles.addNewCardBtn}
          onPress={handleOpenAdd}
          activeOpacity={0.88}
        >
          <View style={styles.addNewIconBox}>
            <Plus size={22} color="#6C47FF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.addNewTitle}>Add New Delivery Address</Text>
            <Text style={styles.addNewSub}>Pin your location on map or search locality</Text>
          </View>
          <View style={styles.addNewMapChip}>
            <MapPin size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.addNewMapChipText}>MAP</Text>
          </View>
        </TouchableOpacity>

        {/* Saved Address Cards */}
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MapPin size={36} color="#6C47FF" />
            </View>
            <Text style={styles.emptyTitle}>No Saved Addresses Yet</Text>
            <Text style={styles.emptySub}>
              Add your home, office, or other locations on the map for fast, one-tap orders.
            </Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={handleOpenAdd} activeOpacity={0.85}>
              <Text style={styles.emptyActionText}>+ Choose Location on Map</Text>
            </TouchableOpacity>
          </View>
        ) : (
          addresses.map((addr) => {
            const IconComp = getAddressIcon(addr.label);
            const isPrimary = !!addr.isPrimary;
            const isActionLoading = loadingActionId === addr._id;

            return (
              <View
                key={addr._id}
                style={[styles.addressCard, isPrimary && styles.addressCardPrimary]}
              >
                {/* Header Row: Icon, Label, Primary Badge */}
                <View style={styles.cardHeader}>
                  <View style={[styles.labelIconBox, isPrimary && styles.labelIconBoxPrimary]}>
                    <IconComp size={18} color={isPrimary ? '#6C47FF' : '#64748B'} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardLabel}>{addr.label || 'Home'}</Text>
                      {isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Star size={10} color="#D97706" fill="#D97706" style={{ marginRight: 4 }} />
                          <Text style={styles.primaryBadgeText}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Formatted Multi-line Address */}
                <TouchableOpacity
                  style={styles.addressBody}
                  activeOpacity={fromBooking ? 0.7 : 1}
                  onPress={() => fromBooking && handleSelectAddress(addr)}
                >
                  {!!addr.street && (
                    <Text style={styles.addressStreet} numberOfLines={2}>
                      {addr.street}
                    </Text>
                  )}
                  {!!addr.area && (
                    <Text style={styles.addressArea} numberOfLines={1}>
                      {addr.area}
                    </Text>
                  )}
                  <Text style={styles.addressCityPin}>
                    {addr.city || 'Ahmedabad'}{addr.pincode ? ` - ${addr.pincode}` : ''}
                  </Text>
                </TouchableOpacity>

                {/* Booking action (if opened from booking) */}
                {fromBooking && (
                  <TouchableOpacity
                    style={styles.selectForBookingBtn}
                    onPress={() => handleSelectAddress(addr)}
                    activeOpacity={0.85}
                  >
                    <Navigation size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.selectForBookingText}>Deliver to this address</Text>
                  </TouchableOpacity>
                )}

                {/* Actions Footer */}
                <View style={styles.cardActionsRow}>
                  {/* Default / Make Default Button */}
                  {isPrimary ? (
                    <View style={styles.defaultPill}>
                      <CheckCircle2 size={13} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.defaultPillText} numberOfLines={1}>Default</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => handleSetPrimary(addr._id)}
                      disabled={isActionLoading}
                      activeOpacity={0.7}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color="#6C47FF" />
                      ) : (
                        <>
                          <Star size={12} color="#6C47FF" style={{ marginRight: 3 }} />
                          <Text style={styles.actionBtnOutlineText} numberOfLines={1}>Set Default</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <View style={styles.rightActionsRow}>
                    {/* Edit Button */}
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleOpenEdit(addr)}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={15} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.iconActionBtnText}>Edit</Text>
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={[styles.iconActionBtn, styles.deleteActionBtn]}
                      onPress={() => handleDelete(addr._id)}
                      disabled={isActionLoading}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={styles.deleteActionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>

      {/* Interactive Map Modal */}
      <AddressMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSave={handleSaveAddressPayload}
        initialData={selectedEditAddress}
        theme={theme}
        isDarkMode={isDarkMode}
      />
    </View>
  );
};

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC'
    },
    headerGradient: {
      paddingBottom: 24,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: 'hidden',
      position: 'relative'
    },
    blob1: {
      position: 'absolute',
      top: -50,
      right: -30,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    blob2: {
      position: 'absolute',
      bottom: -60,
      left: -40,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16
    },
    addNewCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3
    },
    addNewIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#6C47FF1A',
      justifyContent: 'center',
      alignItems: 'center'
    },
    addNewTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    addNewSub: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2
    },
    addNewMapChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#6C47FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8
    },
    addNewMapChipText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800'
    },
    addressCard: {
      backgroundColor: isDarkMode ? '#1E293B' : '#fff',
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2
    },
    addressCardPrimary: {
      borderColor: '#6C47FF',
      borderWidth: 1.5,
      backgroundColor: isDarkMode ? '#1E1E38' : '#FAF8FF'
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10
    },
    labelIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center'
    },
    labelIconBoxPrimary: {
      backgroundColor: '#6C47FF1A'
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B'
    },
    primaryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#FDE68A'
    },
    primaryBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#B45309'
    },
    addressBody: {
      marginBottom: 14,
      paddingLeft: 2
    },
    addressStreet: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? '#E2E8F0' : '#334155',
      lineHeight: 20
    },
    addressArea: {
      fontSize: 13,
      color: '#64748B',
      marginTop: 2
    },
    addressCityPin: {
      fontSize: 13,
      fontWeight: '700',
      color: isDarkMode ? '#94A3B8' : '#475569',
      marginTop: 2
    },
    selectForBookingBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#6C47FF',
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 12
    },
    selectForBookingText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800'
    },
    cardActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#334155' : '#F1F5F9'
    },
    defaultPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#A7F3D0'
    },
    defaultPillText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#059669'
    },
    actionBtnOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#6C47FF33',
      backgroundColor: '#6C47FF0D'
    },
    actionBtnOutlineText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#6C47FF'
    },
    rightActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    },
    iconActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#334155' : '#F1F5F9'
    },
    iconActionBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: isDarkMode ? '#CBD5E1' : '#475569'
    },
    deleteActionBtn: {
      backgroundColor: '#FEF2F2'
    },
    deleteActionBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#EF4444'
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 24
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#6C47FF1A',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#1E293B',
      marginBottom: 8
    },
    emptySub: {
      fontSize: 13,
      color: '#64748B',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 20
    },
    emptyActionBtn: {
      backgroundColor: '#6C47FF',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14
    },
    emptyActionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800'
    }
  });

export default SavedAddressesScreen;
