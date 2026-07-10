# Kwickly Mobile Application Documentation

This document provides a comprehensive technical overview of the Kwickly Mobile App, built with React Native and React Navigation. It acts as the primary client for Customers, Workers, and Shops.

---

## 1. Project Structure & Architecture

The mobile application uses a feature-based architecture, grouping screens by persona to keep role-specific logic isolated.

```text
/mobile/src
├── /assets         // Static images, logos, and service icons (3D assets)
├── /components     // Reusable UI blocks (AppBar, HeroHeader, Button)
├── /context        // React Contexts (Auth, Theme, Cart, Notification)
├── /features       // Persona-driven screen groupings (Auth, Customer, Worker, Shop)
├── /hooks          // Custom hooks (e.g., useSocket.js)
├── /services       // Axios API wrappers (authService, jobService, etc.)
└── /utils          // Helpers and standard formatters
```

---

## 2. Navigation

Navigation is handled via `react-navigation`. The root navigator conditionally renders different stack/tab trees based on the authenticated user's role stored in the `AuthContext`.

*   **Auth Stack**: `SplashScreen` -> `LoginScreen` -> `OTPVerifyScreen` -> `RoleSelection`.
*   **Customer Tabs**: `HomeScreen`, `BookServiceScreen`, `CartScreen`, `OrderHistoryScreen`, `ProfileScreen`.
*   **Worker Tabs**: `WorkerDashboard`, `WorkerActiveJobScreen`, `WorkerEarningsScreen`, `WorkerProfileScreen`.
*   **Shop Tabs**: `ShopDashboardScreen`, `ShopProductsScreen`, `ShopOrdersScreen`.

When `authContext.user` changes, the navigation tree automatically swaps to the correct persona view, preventing privilege escalation.

---

## 3. State Management

*   **Global State**: Handled natively using React Context API.
    *   `AuthContext.js`: Stores the JWT, user profile, active role, and handles global logout routines.
    *   `CartContext.js`: Manages transient e-commerce state for shop orders before checkout.
    *   `NotificationContext.js`: Stores unread notification counts and active FCM payloads.
    *   `ThemeContext.js`: Manages light/dark mode overrides.
*   **Local State**: Screens use standard `useState` and `useEffect` hooks to manage loading states, form inputs, and modal visibility.

---

## 4. API Calls & Network Layer

All network interactions are decoupled from UI components and stored in `src/services/`.
*   **Core API Client (`api.js`)**: An Axios instance configured with a base URL (pointing to the Node.js backend). It uses interceptors to inject the JWT token into the `Authorization` header.
*   **Domain Services**: Files like `jobService.js`, `customerService.js`, and `walletService.js` export async functions (e.g., `jobService.startJob(jobId, coords)`), allowing components to remain clean and focused on rendering.

---

## 5. Authentication & Offline Storage

*   **Authentication Flow**: 
    1. User submits phone number (`LoginScreen`).
    2. Enters OTP (`OTPVerifyScreen`).
    3. Backend returns a JWT.
    4. JWT is saved securely via `AsyncStorage` (React Native's asynchronous, unencrypted key-value store).
*   **Offline Persistence**: When the app boots (`SplashScreen`), `AuthContext` checks `AsyncStorage` for `kwickly_token`. If present, it bypasses the Auth Stack and routes the user directly to their respective persona dashboard.

---

## 6. Push Notifications & Real-time Sockets

*   **Push Notifications (FCM)**: Configured via Firebase Cloud Messaging. Used to wake up the app and notify users when they are offline (e.g., "New Job Available in your area").
*   **WebSockets (`useSocket.js`)**: Uses `socket.io-client`. When the app is in the foreground, it connects to the backend socket server, authenticates with the JWT, and listens to persona-specific rooms.
    *   **Workers** listen for `NEW_JOB_ALERT` to instantly render the `LiveBidsScreen`.
    *   **Customers** listen for `JOB_STARTED` and `LOCATION_UPDATE` to track the worker on a map in `LiveTrackingScreen`.

---

## 7. UI & Reusable Components

The app follows a modern, "glassmorphism" aesthetic dictated by `Theme.js`.
*   **`GlassCard.js`**: A translucent, blurred container used extensively for job listings and wallet balances.
*   **`ServiceCard.js`**: Standardized clickable cards for the home screen category grid.
*   **Forms**: Standardized `<Input />` components handle auto-focus, keyboard types (numpad for phone numbers), and client-side error styling.

---

## 8. Validation

*   **Client-Side**: Before firing API calls, forms perform basic regex validations (e.g., 10-digit phone number checks, OTP length checks, empty string checks).
*   **Server-Side Rejection Handling**: If the backend returns a Joi validation error or a 400 Bad Request, the UI catches it via Axios and displays a user-friendly Toast or Alert (e.g., "Minimum balance required").

---

## 9. Business Logic Breakdown by Persona

### Customer Screens
*   **BookServiceScreen**: Heavy map integration. Allows users to drop a pin, extract coordinates, pick a time slot, and broadcast a job.
*   **LiveTrackingScreen**: Uses React Native Maps to plot the worker's live coordinates (fed via Sockets) against the job location pin.
*   **RateExperienceScreen**: Triggered after job completion to rate the worker out of 5 stars.

### Worker Screens
*   **WorkerDashboard**: Evaluates the 8 strict eligibility criteria. If a worker lacks balance or an active subscription, the dashboard renders "Lock" screens pushing them to `WorkerEarningsScreen` (Wallet Top-up).
*   **WorkerArrivalOTPScreen**: Before starting a job, the worker must physically arrive and input an OTP provided by the customer. The app captures the GPS coordinates here to send to the backend to prevent GPS spoofing.
*   **WorkerMyQuotesScreen**: Interface to view the status of their active bids (Pending, Accepted, Rejected).

### Shop Screens
*   **ShopDashboardScreen**: Overview of daily orders and revenue.
*   **ShopProductsScreen**: CRUD interface for managing inventory, prices, and toggling product availability.
*   **ShopOrderDetailsScreen**: Allows the shop owner to update the status of an order from 'RECEIVED' to 'PREPARING' to 'READY_FOR_DELIVERY'.

---

## 10. Performance Considerations

*   **Image Caching**: External images (profile pictures, category icons) are cached to prevent heavy network re-fetching on the `HomeScreen` list.
*   **FlatList Optimization**: Long lists (like Order History or Chat Messages) use `FlatList` with `initialNumToRender` and `keyExtractor` to ensure smooth 60fps scrolling without memory leaks.
*   **Debounced Location Updates**: The `LiveTrackingScreen` debounces socket emits to prevent battering the network with excessive coordinate updates.
