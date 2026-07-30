import React, { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout      from './layouts/AppLayout'
import { ToastContainer } from './components/Toast'

const Login          = lazy(() => import('./modules/auth/Login'))
const Dashboard      = lazy(() => import('./modules/dashboard/Dashboard'))
const Users          = lazy(() => import('./modules/users/Users'))
const Workers        = lazy(() => import('./modules/workers/Workers'))
const Jobs           = lazy(() => import('./modules/jobs/Jobs'))
const JobReceipt     = lazy(() => import('./modules/jobs/JobReceipt'))
const KYC            = lazy(() => import('./modules/kyc/KYC'))
const Settings       = lazy(() => import('./modules/settings/Settings'))
const Categories     = lazy(() => import('./modules/categories/Categories'))
const Notifications  = lazy(() => import('./modules/notifications/Notifications'))
const Payouts        = lazy(() => import('./modules/payouts/Payouts'))
const Subscriptions  = lazy(() => import('./modules/subscriptions/Subscriptions'))
const AdminUsers     = lazy(() => import('./modules/admin-users/AdminUsers'))
const Disputes       = lazy(() => import('./modules/disputes/Disputes'))
const Ledger         = lazy(() => import('./modules/ledger/Ledger'))
const Reports        = lazy(() => import('./modules/reports/Reports'))
const Shops          = lazy(() => import('./modules/shops/Shops'))
const Promotions     = lazy(() => import('./modules/promotions/Promotions'))
const Settlements    = lazy(() => import('./modules/settlements/Settlements'))
const Orders         = lazy(() => import('./modules/orders/Orders'))
const Wallets        = lazy(() => import('./modules/wallets/Wallets'))
const AdminWallet    = lazy(() => import('./modules/admin-wallet/AdminWallet'))
const SupportChats   = lazy(() => import('./modules/support/SupportChats'))
import './index.css'

function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('kwickly_admin_token'))
  
  const handleLogin  = () => { 
    setAuthed(true)  
  }
  
  const handleLogout = () => { 
    localStorage.removeItem('kwickly_admin_token')
    localStorage.removeItem('kwickly_admin_user')
    setAuthed(false) 
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>Loading module...</div>}>
        <Routes>
          <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
          
          {/* Printable Receipt Route - No Layout */}
          <Route path="/receipt/:id" element={<JobReceipt />} />

          <Route element={authed ? <AppLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
            {/* Platform */}
            <Route index               element={<Dashboard />} />
            <Route path="users"        element={<Users />} />
            <Route path="workers"      element={<Workers />} />
            <Route path="shops"        element={<Shops />} />
            <Route path="jobs"         element={<Jobs />} />
            <Route path="kyc"          element={<KYC />} />
            <Route path="categories"   element={<Categories />} />
            
            {/* Finance */}
            <Route path="payouts"      element={<Payouts />} />
            <Route path="wallets"      element={<Wallets />} />
            <Route path="admin-wallet" element={<AdminWallet />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="ledger"       element={<Ledger />} />
            
            {/* Platform Ext */}
            <Route path="orders"      element={<Orders />} />
            <Route path="settlements" element={<Settlements />} />
            <Route path="promotions"  element={<Promotions />} />
            <Route path="disputes"     element={<Disputes />} />
            
            {/* Communications */}
            <Route path="notifications" element={<Notifications />} />
            <Route path="support-chats" element={<SupportChats />} />
            
            {/* System & Analytics */}
            <Route path="reports"      element={<Reports />} />
            <Route path="admin-users"  element={<AdminUsers />} />
            <Route path="settings"     element={<Settings />} />
            
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      <ToastContainer />
    </BrowserRouter>
  )
}

export default App
