import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout      from './layouts/AppLayout'
import Login          from './modules/auth/Login'
import Dashboard      from './modules/dashboard/Dashboard'
import Users          from './modules/users/Users'
import Workers        from './modules/workers/Workers'
import Jobs           from './modules/jobs/Jobs'
import KYC            from './modules/kyc/KYC'
import Settings       from './modules/settings/Settings'
import Categories     from './modules/categories/Categories'
import Notifications  from './modules/notifications/Notifications'
import Payouts        from './modules/payouts/Payouts'
import Subscriptions  from './modules/subscriptions/Subscriptions'
import AdminUsers     from './modules/admin-users/AdminUsers'
import Disputes       from './modules/disputes/Disputes'
import Suggestions    from './modules/suggestions/Suggestions'
import Ledger         from './modules/ledger/Ledger'
import Reports        from './modules/reports/Reports'
import Shops          from './modules/shops/Shops'
import Banners        from './modules/banners/Banners'
import Coupons        from './modules/coupons/Coupons'
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
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="ledger"       element={<Ledger />} />
          
          {/* Platform Ext */}
          <Route path="disputes"     element={<Disputes />} />
          <Route path="suggestions"  element={<Suggestions />} />
          
          {/* Marketing & Comms */}
          <Route path="banners"       element={<Banners />} />
          <Route path="coupons"       element={<Coupons />} />
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
