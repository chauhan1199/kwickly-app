# Kwickly Admin Panel Documentation

This document provides a comprehensive technical overview of the Admin Panel frontend, a React Single Page Application (SPA) built with Vite that interfaces with the Kwickly backend.

---

## 1. Project Structure

The frontend code is located in `admin/src` and follows a highly modular, component-first architecture:

```text
/admin/src
├── /components     // Reusable UI components (Table, Modal, FormInput, Toast)
├── /contexts       // React Contexts (ThemeContext)
├── /layouts        // Structural page wrappers (AppLayout)
├── /modules        // Domain-specific page components (jobs, users, dashboard)
├── /services       // Global configurations (api.js, axios setup)
├── App.jsx         // Root router
└── main.jsx        // React DOM entry point
```

---

## 2. Navigation & Layout

### Routing (`App.jsx`)
Routing is powered by `react-router-dom`. The application is split into two primary zones:
*   **Public Zone**: The `/login` route, accessible only when unauthenticated.
*   **Protected Zone**: Wrapped by `<AppLayout />`. Access requires a valid `kwickly_admin_token` in `localStorage`. If missing, the app redirects to `/login`.
*   **Standalone Routes**: E.g., `/receipt/:id` which renders a printable view without the heavy sidebar layout.

### Layout (`AppLayout.jsx`)
The main layout consists of:
*   **Sidebar Navigation**: Grouped into logical sections: Overview, Management, Platform, Finance, and System. Includes active route highlighting and notification badges (fetched from `/admin/badges`).
*   **Topbar**: Features breadcrumbs, a Theme Toggle (Dark/Light mode), and a real-time Notification Bell dropdown.
*   **Main Content Area**: An `<Outlet />` that dynamically renders the selected module component.

---

## 3. Core Architecture

### API Calls (`services/api.js`)
All network requests go through a configured Axios instance.
*   **Interceptors**: A request interceptor automatically attaches the `Bearer <token>` to the `Authorization` header.
*   **Global Error Handling**: A response interceptor watches for `401 Unauthorized` errors. If triggered, it instantly flushes `localStorage` and forces a hard redirect to `/login`.
*   **Connected Backend**: Interfaces primarily with the backend routes mounted at `/api/v1/admin/...` (e.g., `/admin/stats`, `/admin/jobs/all`).

### State Management
*   **Global**: Uses React Context (`ThemeContext`) for visual states and `localStorage` for session persistence.
*   **Module-Level**: Relies on standard React hooks (`useState`, `useEffect`). Lists are fetched into local arrays and operated on in-memory (for fast searching and filtering) or re-fetched when paginating heavily.
*   **Real-Time Data**: The layout connects to the backend Socket.io namespace `admin_dashboard`. It listens for `DASHBOARD_UPDATE` (to refresh stats/badges) and `NEW_NOTIFICATION` (to populate the top-bar dropdown).

---

## 4. Components & UI Patterns

### Tables
Data grids rely on the reusable `<Table />` component.
*   **Implementation**: Modules pass an array of `columns` defining headers and custom `render` functions. For instance, the `Jobs.jsx` module renders custom badges for Job Statuses and action icons for row-level operations.
*   **Pagination**: Controlled via a generic `<Pagination />` component handling `page`, `totalPages`, and `PAGE_SIZE`.

### Forms & Validation
*   Forms utilize `<FormRow />` and `<TextInput />` wrappers.
*   Validation is primarily handled natively or manually within the module's submit handler before initiating the Axios `POST`/`PATCH`.

### Overlays
*   **Modals**: Used for focused tasks (e.g., Reassigning a Worker via `<Modal />`).
*   **Drawers**: Used for deep-dives into single records without losing context of the list (e.g., clicking a Job row opens a right-side drawer with quotes, addresses, and impersonation tokens).
*   **Confirmations**: `<ConfirmModal />` prevents accidental destructive actions (e.g., Cancelling a Job).
*   **Toasts**: `<Toast />` provides ephemeral feedback (Success/Error) on async actions.

### Charts
Charts (like the Dashboard's Weekly Performance) are built with CSS rather than heavy external libraries. They dynamically render vertical bars by calculating percentages against the `Math.max()` of the dataset, mapping over API data.

---

## 5. Module Breakdown & Business Logic

### Dashboard (`/`)
*   **Purpose**: High-level system overview.
*   **Logic**: Fetches metrics (`/admin/stats?range=week`). Renders dynamic CSS charts toggling between Jobs and Revenue. Displays a live-feed of platform activity and a Top Performers table.

### Job Management (`/jobs`)
*   **Purpose**: Oversight of active and past service requests.
*   **Logic**: Fetches jobs. Admin can cancel active jobs on behalf of a user, open a detailed drawer to view worker quotes, or reassign a job from one worker to another.
*   **Customer Impersonation**: Admins can generate a short-lived JWT impersonation token from the Job Drawer, allowing them to log into the Customer mobile app to debug issues.

### User & Worker Management (`/users`, `/workers`)
*   **Purpose**: CRM interface for all registered accounts.
*   **Logic**: Displays wallet balances, active locations, and allows Admins to toggle account suspension (Ban/Unban).

### KYC Queue (`/kyc`)
*   **Purpose**: Manual approval flow for Worker onboarding.
*   **Logic**: Lists pending KYC applications. Admins can view uploaded identity documents and click Approve or Reject (triggering backend KYC state updates and FCM notifications to the worker).

### Financial Modules (`/payouts`, `/wallets`, `/ledger`, `/admin-wallet`)
*   **Purpose**: Revenue tracking and liability management.
*   **Logic**: Displays detailed transactional histories. The Payouts module handles worker withdrawal requests, integrating with backend logic (and potentially RazorpayX) to settle funds to bank accounts.

### Notifications (`/notifications`)
*   **Purpose**: System-wide alerting history.
*   **Logic**: Combines WebSocket real-time alerts with historical fetching, allowing the Admin to see exactly what automated messages were pushed to users.

---

## 6. Permissions & Role Restrictions

*   **Platform Level**: There is currently a single Admin scope. If you have the token, you have access.
*   The API enforces `authorize('ADMIN')` on all `/api/v1/admin/*` routes to ensure compromised customer or worker tokens cannot execute dashboard commands.
*   **Admin-Users Module**: Allows super-admins to provision new admin accounts, acting as the security gateway for team expansion.
