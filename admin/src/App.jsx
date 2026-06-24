import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout      from './layouts/AppLayout'
import Login          from './modules/auth/Login'
import Dashboard      from './modules/dashboard/Dashboard'
import Users          from './modules/users/Users'
import Workers        from './modules/workers/Workers'
import Jobs           from './modules/jobs/Jobs'
import JobReceipt     from './modules/jobs/JobReceipt'
import KYC            from './modules/kyc/KYC'
import Settings       from './modules/settings/Settings'
import Categories     from './modules/categories/Categories'
import Notifications  from './modules/notifications/Notifications'
import Payouts        from './modules/payouts/Payouts'
import Subscriptions  from './modules/subscriptions/Subscriptions'
import AdminUsers     from './modules/admin-users/AdminUsers'
import Disputes       from './modules/disputes/Disputes'
import Ledger         from './modules/ledger/Ledger'
import Reports        from './modules/reports/Reports'
import Shops          from './modules/shops/Shops'
import Promotions     from './modules/promotions/Promotions'
import Settlements    from './modules/settlements/Settlements'
import Orders         from './modules/orders/Orders'
import Wallets        from './modules/wallets/Wallets'
import AdminWallet    from './modules/admin-wallet/AdminWallet'
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
          
          {/* System & Analytics */}
          <Route path="reports"      element={<Reports />} />
          <Route path="admin-users"  element={<AdminUsers />} />
          <Route path="settings"     element={<Settings />} />
          
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
