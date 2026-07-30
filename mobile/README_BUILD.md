# Kwickly Mobile App - Build Instructions

## 📱 Overview

The Kwickly mobile app is built with **React Native 0.85.0** and supports both Android and iOS platforms.

---

## ✅ Prerequisites

### For Android Development

1. **Node.js** (v22.11.0 or higher)
   ```bash
   node --version  # Should be v22.11.0+
   ```

2. **Android Studio** (Latest)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 33 or higher)
   - Install Android SDK Build-Tools
   - Install Android Emulator (recommended)

3. **Java Development Kit** (JDK 17)
   ```bash
   java -version  # Should be 17
   ```

4. **React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

### For iOS Development (macOS Only)

1. **Xcode** (Latest) - Install from Mac App Store
2. **CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```
3. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

---

## 🚀 Setup Instructions

### Step 1: Clone Repository

```bash
git clone https://github.com/chauhan1199/kwickly-app.git
cd kwickly-app/mobile
```

### Step 2: Install Dependencies

```bash
# Install all npm packages
npm install

# For iOS, install pods
cd ios
pod install
cd ..
```

**Note:** If you encounter peer dependency errors:
```bash
npm install --legacy-peer-deps
```

### Step 3: Configure Environment

Edit `src/config/env.js`:

```javascript
export const IS_PROD = false; // true for production

const DEV_URL = 'http://10.0.2.2:5000'; // Android emulator localhost
// OR for physical device:
const DEV_URL = 'http://YOUR_LAPTOP_IP:5000'; // e.g., 'http://192.168.1.100:5000'

const PROD_URL = 'https://YOUR_PRODUCTION_API_URL'; // HTTPS required
```

### Step 4: Start Metro Bundler

```bash
npm start  # or: npx react-native start
```

**Clear cache if needed:**
```bash
npm start -- --reset-cache
```

---

## 📱 Running the App

### Android Emulator

1. **Create Emulator** (if not exists):
   - Open Android Studio → AVD Manager
   - Create Virtual Device (Pixel 6, API 33+)

2. **Start Emulator** and run:
   ```bash
   npm run android
   ```

3. **Build and install automatically:**
   ```bash
   npx react-native run-android
   ```

### Physical Android Device

1. **Enable USB Debugging:**
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

2. **Connect Device via USB**

3. **Run:**
   ```bash
   npm run android
   ```

### iOS Simulator (macOS Only)

```bash
npm run ios
```

Or specify simulator:
```bash
npx react-native run-ios --simulator="iPhone 15"
```

### Physical iOS Device

1. Open `ios/KwicklyMobile.xcworkspace` in Xcode
2. Select your device from the device list
3. Click "Run" (▶️ button)

---

## 🔧 Build Commands

### Development Builds

```bash
# Android Debug APK
npx react-native build-android --variant=debug

# or
cd android && ./gradlew assembleDebug
```

### Production Builds

```bash
# Android Release APK (Optimized)
cd android
./gradlew assembleRelease

# Android App Bundle (for Play Store)
./gradlew bundleRelease

# iOS Archive (for App Store)
# Open in Xcode → Product → Archive
```

### Build Output Locations

- **Android Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Android Release APK:** `android/app/build/outputs/apk/release/app-release.apk`
- **Android AAB:** `android/app/build/outputs/bundle/release/app-release.aab`
- **iOS App:** Generated via Xcode Archive

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Unable to load script"

```bash
# Clear Metro cache
npm start -- --reset-cache

# Rebuild
npx react-native run-android
```

#### 2. "Build failed with error 65001" (iOS)

```bash
cd ios
pod deintegrate
pod install
cd ..
```

#### 3. Metro Bundler Not Starting

```bash
# Kill all node processes
killall -9 node

# Restart
npm start
```

#### 4. Android Studio Cannot Find SDK

```bash
# Add to android/local.properties:
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk  # macOS
# or
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk  # Windows
```

#### 5. Gradle Build Timeout

```bash
# In android/gradle.properties:
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.jvmargs=-Xmx4g
```

#### 6. "Cannot resolve com.android.support" (Dependency Error)

```bash
# In android/build.gradle:
buildscript {
    repositories {
        google()
        mavenCentral()
    }
}
```

---

## 📊 App Architecture

### Key Dependencies

- **Navigation:** React Navigation 7.x
- **State Management:** React Context API
- **HTTP Client:** Axios
- **Real-time:** Socket.IO Client
- **Maps:** React Native Maps
- **Icons:** Lucide React Native
- **Payments:** Razorpay

### Folder Structure

```
mobile/
├── src/
│   ├── app/
│   │   ├── navigation/      # Navigation stacks
│   │   └── App.js           # Root component
│   ├── components/          # Reusable components
│   ├── context/             # React Context providers
│   ├── features/            # Feature screens
│   │   ├── auth/
│   │   ├── customer/
│   │   ├── worker/
│   │   └── shop/
│   ├── services/            # API services
│   ├── utils/               # Utilities & helpers
│   └── config/              # Configuration files
├── android/                 # Android native code
├── ios/                     # iOS native code
├── App.js                   # Entry point
└── package.json
```

---

## 🔐 API Configuration

The mobile app connects to the backend API defined in `src/config/env.js`.

### Development

```javascript
API_BASE_URL = 'http://10.0.2.2:5000/api/v1'  // Android Emulator
API_BASE_URL = 'http://localhost:5000/api/v1'  // iOS Simulator
```

### Production (MUST use HTTPS)

```javascript
API_BASE_URL = 'https://api.kwickly.com/api/v1'
```

---

## 📦 Publishing

### Google Play Store

1. **Generate Signed APK/AAB:**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

2. **Create Keystore (if first time):**
   ```bash
   keytool -genkey -v -keystore kwickly-release-key.keystore \
     -alias kwickly -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Configure signing** in `android/app/build.gradle`

4. **Upload** AAB to Google Play Console

### Apple App Store

1. **Open in Xcode** → Product → Archive

2. **Distribute** → App Store Connect

3. **Fill metadata** in App Store Connect

4. **Submit** for review

---

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Test on Real Devices

**Android USB Debugging:**
```bash
adb devices  # List connected devices
adb logcat   # View logs
```

**iOS:**
- Use Xcode Device Console
- Enable Web Inspector in Safari for remote debugging

---

## 🔑 Test Credentials

Use these accounts for testing:

**Customer:** (password: `customer123`)
- `9000000001` - Rahul Sharma
- `9000000003` - Priya Singh
- `9000000004` - Arjun Patel
- `9000000005` - Sneha Reddy

**Worker:** (password: `worker123`)
- `9876543210` - Amit Kumar (KYC Approved)
- `9876543211` - Rajan Verma (KYC Pending)
- `9876543213` - Suresh Yadav (KYC Approved)

**Shop:** (password: `shop123`)
- `9000000002` - Kwickly Mart
- `9000000006` - Fresh Groceries
- `9000000007` - Electronics Hub

---

## 📈 Performance Optimization

### Enable Hermes Engine (Android)

In `android/app/build.gradle`:
```gradle
def enableHermes = true
```

### ProGuard Rules (Android Release)

In `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

---

## 🆘 Support

### Documentation

- React Native: https://reactnative.dev
- React Navigation: https://reactnavigation.org

### Project Docs

- Backend API: `/workspace/KWICKLY_PLATFORM_DOCS.md`
- Mobile API Tests: `/workspace/MOBILE_APP_TEST_REPORT.md`

---

## ✅ Pre-Launch Checklist

- [ ] Backend server running and accessible
- [ ] Environment configured correctly
- [ ] All dependencies installed
- [ ] App builds without errors
- [ ] Login/Signup works
- [ ] All role-specific flows tested
- [ ] Push notifications configured (optional)
- [ ] Crash reporting enabled (Sentry/Firebase)
- [ ] Performance tested on real devices
- [ ] Store metadata prepared

---

**Last Updated:** 2026-07-30  
**React Native Version:** 0.85.0  
**Backend API:** v1
