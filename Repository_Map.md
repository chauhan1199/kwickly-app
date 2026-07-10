# Repository Map: Kwickly

This document provides a comprehensive architectural and structural map of the Kwickly repository.

---

## 1. Complete Folder Tree

```text
/admin
  /src
    /components (Shared UI elements)
    /contexts (React Context providers)
    /layouts (Page wrappers)
    /modules (Feature-specific pages: auth, dashboard, users, etc.)
    /services (API integration)
/backend
  /logs (Server logs)
  /scripts (Utility & seeder scripts)
  /src
    /config (Database and core configurations)
    /constants (Static app messages)
    /cron (Scheduled jobs)
    /helpers (Utility functions)
    /middleware (Express middlewares)
    /modules (Domain-driven feature modules)
    /services (External service wrappers)
    /sockets (WebSocket event handlers)
    /validators (Joi validation schemas)
    /workers (Background processing)
    /__tests__ (Unit and integration tests)
/mobile
  /android (Native Android code)
  /ios (Native iOS code)
  /src
    /app (Navigation and store)
    /assets (Images and icons)
    /components (Shared UI elements)
    /constants (Theme and static data)
    /context (Global React Contexts)
    /features (Role-based screens: auth, customer, shop, worker)
    /hooks (Custom React hooks)
    /services (API clients)
    /utils (Helper functions)
  /__mocks__ (Jest mocks)
  /__tests__ (Mobile unit tests)
```

---

## 2. Purpose of Every Folder

### Root
* **`/admin`**: Contains the source code for the administrative web dashboard.
* **`/backend`**: Contains the source code for the backend REST API, websockets, and background tasks.
* **`/mobile`**: Contains the source code for the cross-platform React Native mobile application.

### Admin (`/admin`)
* **`/src/components`**: Reusable React components (Buttons, Modals, Tables, Forms).
* **`/src/contexts`**: React Context providers (e.g., `ThemeContext.jsx`).
* **`/src/layouts`**: Structural layout components wrapping application pages (e.g., `AppLayout.jsx`).
* **`/src/modules`**: The core application views, separated by feature domains (e.g., dashboard, orders, users).
* **`/src/services`**: Axios configurations and API communication files.

### Backend (`/backend`)
* **`/src/config`**: Core configuration like database connections (`db.js`).
* **`/src/constants`**: Application-wide constants like response messages.
* **`/src/cron`**: Scheduled jobs running periodically (e.g., subscriptions).
* **`/src/helpers`**: Reusable utility functions for common tasks (e.g., redis, socket, razorpay).
* **`/src/middleware`**: Express middlewares handling auth, rate-limiting, uploads, and error catching.
* **`/src/modules`**: Domain-driven feature modules. Each module encapsulates its controller, routes, and models.
* **`/src/services`**: Abstractions for third-party services (e.g., `sms.service.js`).
* **`/src/sockets`**: WebSocket implementations for real-time features (chat, live tracking).
* **`/src/validators`**: Joi-based request validation schemas.
* **`/src/workers`**: Background task processors and cron engines.
* **`/__tests__`**: Test suites for all backend modules.

### Mobile (`/mobile`)
* **`/src/app/navigation`**: Navigation stack definitions (AuthStack, CustomerTabs, WorkerTabs).
* **`/src/assets`**: Static files like images and service icons.
* **`/src/components`**: Universal UI components (AppBars, Buttons, Cards) used across features.
* **`/src/context`**: Global state containers for Auth, Cart, Notification, and Theme.
* **`/src/features`**: Primary application screens grouped by user flows (`auth`, `chat`, `customer`, `shop`, `worker`).
* **`/src/hooks`**: Reusable React hooks (e.g., `useSocket.js`).
* **`/src/services`**: Domain-specific API service wrappers interacting with the backend.

---

## 3. Purpose of Every File

*(Note: Files are grouped by their structural patterns for readability.)*

### Root Files
* **`.gitignore`**: Defines files excluded from source control.
* **`cats.json` / `logo.jpeg`**: Root-level static test assets.
* **`README.md`**: Primary repository documentation.

### Admin Files
* **`vite.config.js`**: Build and development server configuration for Vite.
* **`package.json`**: Admin dependencies and npm scripts.
* **`src/main.jsx`**: Entry point for the React application.
* **`src/App.jsx`**: Root application component handling routing and context wrapping.
* **`src/index.css`**: Global stylesheet.
* **`src/services/api.js`**: Axios instance configuration with interceptors.
* **`src/modules/[Feature]/[Feature].jsx`**: Main view components for specific admin domains (e.g., `Dashboard.jsx`, `Orders.jsx`).

### Backend Files
* **`server.js`**: Application entry point; initializes Express, DB connection, and server listening.
* **`src/app.js`**: Express application setup, global middleware, and route mounting.
* **`package.json`**: Backend dependencies and npm scripts.
* **`seed*.js` & `dump*.js`**: Utility scripts for database seeding, dumping, and fixing structures.
* **`src/modules/[Feature]/[Feature].controller.js`**: Contains business logic and request handling for the feature.
* **`src/modules/[Feature]/[Feature].routes.js`**: Defines API endpoints and attaches middleware/controllers.
* **`src/modules/[Feature]/[Feature].model.js`**: Mongoose database schemas and models.
* **`src/validators/[Feature].validator.js`**: Joi validation rules for incoming requests.

### Mobile Files
* **`index.js`**: React Native application entry point.
* **`App.tsx`**: Root mobile component; wraps navigation and contexts.
* **`metro.config.js`**: React Native Metro bundler configuration.
* **`babel.config.js`**: Babel compiler configuration.
* **`package.json`**: Mobile dependencies and scripts.
* **`src/features/[Role]/[Screen].js`**: Screen components specific to a user role (e.g., `WorkerDashboard.js`, `CustomerWalletScreen.js`).
* **`src/services/[Domain]Service.js`**: API interaction functions for specific domains (e.g., `authService.js`).

---

## 4. Technology Stack

* **Backend**: Node.js, Express.js, MongoDB (Mongoose), Redis, Socket.io
* **Admin Frontend**: React.js, Vite, React Router, Recharts, Leaflet
* **Mobile Frontend**: React Native, React Navigation, React Native Maps
* **Testing**: Jest, Supertest

---

## 5. Framework Versions

* **Node.js**: >= 22.11.0 (specified in mobile engine)
* **React Native**: 0.85.0
* **React (Admin)**: 18.2.0
* **React (Mobile)**: 19.2.3
* **Express**: 5.2.1
* **Mongoose**: 9.4.1
* **Vite**: 5.2.0

---

## 6. Build Tools

* **Backend**: Nodemon (dev)
* **Admin**: Vite (build & dev server)
* **Mobile**: Metro Bundler, Gradle (Android), CocoaPods/XcodeBuild (iOS)

---

## 7. Package Managers

* **npm**: Used across all three projects (indicated by `package-lock.json` files).

---

## 8. Environment Files

* **Admin**: `.env`, `.env.example`
* **Backend**: `.env`, `.env.example`
* **Mobile**: `.env`, `.env.example`

---

## 9. Configuration Files

* **Admin**: `vite.config.js`, `.eslintrc.js`
* **Backend**: `src/config/db.js` (MongoDB setup)
* **Mobile**: `metro.config.js`, `babel.config.js`, `jest.config.js`, `tsconfig.json`, `.prettierrc.js`, `.eslintrc.js`, `app.json`

---

## 10. Third-Party Integrations

* **Payment Gateway**: Razorpay (`razorpay` in backend, `react-native-razorpay` in mobile).
* **Push Notifications & Messaging**: Firebase Cloud Messaging (FCM) & Twilio (referenced in `.env.example`).
* **Mapping/Location**: Leaflet (Admin), React Native Maps / Geolocation (Mobile).
* **Real-time Communication**: Socket.io (Backend & Clients).
* **File Uploads**: Multer (Backend), React Native Image Picker (Mobile).

---

## 11. Shared Libraries

* **Socket.io-client**: Shared by both Admin (`4.8.3`) and Mobile (`4.8.3`).
* **Axios**: Used by Admin (`1.6.8`), Backend (`1.18.0` in dev), and Mobile (`1.8.1`).
* **Lucide Icons**: `lucide-react` (Admin) and `lucide-react-native` (Mobile).

---

## 12. Code Ownership (Backend/Admin/Mobile)

* **Backend**: Exclusively handles all business logic, database queries, background tasks, and real-time socket broadcasting. Acts as the single source of truth.
* **Admin**: Consumes Backend APIs to manage platform operations (KYC, Disputes, Ledger, Categories, Workers, Users).
* **Mobile**: Consumes Backend APIs and Sockets to provide user interfaces for three distinct personas:
  * **Customers**: Booking jobs, viewing shops, tracking orders.
  * **Workers**: Managing active jobs, accepting quotes, earnings.
  * **Shops**: Managing products, orders, and delivery configurations.

---

## 13. Dependencies Between Modules

* **Auth**: Foundational module; required by almost all other modules via `auth.middleware.js` and `role.middleware.js`.
* **User/Role modules** (`Customer`, `Worker`, `Shop`, `Admin`): Dependent on `Auth` for identity.
* **Jobs & Quotes**: Dependent on `Customer`, `Worker`, `Category`, and `Chat` (for negotiation).
* **Shop Orders**: Dependent on `Shop`, `Customer`, `Product`, `DeliveryStaff`, and `Cart`.
* **Payments & Wallets**: Dependent on `Jobs`, `ShopOrders`, and `Razorpay` for capturing settlements and payouts.
* **Notifications & Chat**: Cross-cutting dependencies used by `Jobs`, `ShopOrders`, and `Disputes`.

---

## 14. External Services

* **MongoDB**: Primary persistent data store.
* **Redis (ioredis)**: Caching layer and potentially Socket.io adapter / rate limiting.
* **Razorpay**: Financial transactions, payments, and payouts.
* **Twilio**: OTP and SMS services.
* **Firebase (FCM)**: Mobile push notifications.

---

## 15. Missing Files If Any

* **Mobile `.env`**: While `.env.example` exists and `.env` is listed in the tree, ensure the actual valid keys are populated during local setup (ignored by Git).
* **Backend Test Mocks**: The repository relies on `mongodb-memory-server` but lacks specific stub files for `Razorpay` or `Twilio`, meaning tests might trigger live/sandbox external networks if not mocked via Jest natively.
* **Admin Linting Setup**: `eslint` dependencies exist, but `.eslintrc` config files are missing from the admin root structure (only defined inline in `package.json` scripts).
