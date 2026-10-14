import { PermissionsAndroid, Platform, Linking, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  requestLocationPermission,
  getCurrentPosition,
  getCurrentCoordinates,
  watchCurrentPosition,
} from '../src/utils/currentLocation';

const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
const fix = { coords: { latitude: 23.05, longitude: 72.58, accuracy: 12 } };

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  Linking.openSettings = jest.fn(() => Promise.resolve());
});

const grant = (fine, coarse) =>
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({ [FINE]: fine, [COARSE]: coarse });

describe('requestLocationPermission', () => {
  it('asks for fine and coarse together', async () => {
    const spy = grant(GRANTED, GRANTED);
    await expect(requestLocationPermission()).resolves.toBe('fine');
    expect(spy).toHaveBeenCalledWith([FINE, COARSE]);
  });

  it('accepts approximate location unless precise is required', async () => {
    grant(DENIED, GRANTED);
    await expect(requestLocationPermission()).resolves.toBe('coarse');
    await expect(requestLocationPermission({ precise: true })).rejects.toThrow(/Precise/);
  });

  it('offers the app settings after "never ask again"', async () => {
    grant(NEVER_ASK_AGAIN, NEVER_ASK_AGAIN);
    await expect(requestLocationPermission()).rejects.toThrow();
    const buttons = Alert.alert.mock.calls[0][2];
    buttons.find(b => b.text === 'Open Settings').onPress();
    expect(Linking.openSettings).toHaveBeenCalled();
  });
});

describe('getCurrentPosition', () => {
  it('returns [lng, lat] with accuracy', async () => {
    grant(GRANTED, GRANTED);
    Geolocation.getCurrentPosition.mockImplementation((ok) => ok(fix));
    await expect(getCurrentPosition()).resolves.toEqual({ coordinates: [72.58, 23.05], accuracy: 12 });
    await expect(getCurrentCoordinates()).resolves.toEqual([72.58, 23.05]);
  });

  it('falls back to a fresh (<=10s) network fix when GPS fails', async () => {
    grant(GRANTED, GRANTED);
    Geolocation.getCurrentPosition
      .mockImplementationOnce((ok, fail) => fail({ code: 3 }))
      .mockImplementationOnce((ok) => ok(fix));
    await getCurrentPosition();
    const networkOptions = Geolocation.getCurrentPosition.mock.calls[1][2];
    expect(networkOptions).toMatchObject({ enableHighAccuracy: false, maximumAge: 10000 });
  });
});

describe('watchCurrentPosition', () => {
  it('watches GPS at 25 m and switches to network on error, and stops cleanly', () => {
    let gpsError;
    Geolocation.watchPosition
      .mockImplementationOnce((ok, fail) => { gpsError = fail; return 1; })
      .mockImplementationOnce(() => 2);
    const onPos = jest.fn();
    const stop = watchCurrentPosition(onPos);
    expect(Geolocation.watchPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, distanceFilter: 25 });
    gpsError({ code: 2 });
    expect(Geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(Geolocation.watchPosition.mock.calls[1][2]).toMatchObject({ enableHighAccuracy: false });
    stop();
    expect(Geolocation.clearWatch).toHaveBeenLastCalledWith(2);
  });
});
