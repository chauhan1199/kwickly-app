import React, { useState } from 'react'
import api from '../../services/api'
import Toast from '../Toast'

export default function WalletAdjuster({ targetId, entityType, currentBalance = 0, onSuccess }) {
  const [walletAmount, setWalletAmount] = useState('')
  const [walletDesc, setWalletDesc] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)

  const adjustWallet = async (debit) => {
    if (!walletAmount || isNaN(walletAmount)) {
      Toast.error('Please enter a valid amount')
      return
    }
    setWalletLoading(true)
    try {
      const endpoint = `/admin/wallets/adjust`
      const res = await api.post(endpoint, {
        targetId,
        entityType,
        amount: Number(walletAmount),
        debit,
        description: walletDesc || 'Admin Adjustment'
      })
      if (res.data.status === 'success') {
        Toast.success('Wallet adjusted successfully')
        setWalletAmount('')
        setWalletDesc('')
        if (onSuccess) onSuccess()
      } else {
        Toast.error(res.data.message || 'Failed to adjust wallet')
      }
    } catch (e) {
      Toast.error(e.response?.data?.message || 'Error adjusting wallet')
    } finally {
      setWalletLoading(false)
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>Manual Wallet Adjustment</span>
        <span style={{ color: currentBalance < 0 ? 'var(--danger)' : 'var(--success)' }}>
          Balance: ₹{currentBalance.toFixed(2)}
        </span>
      </div>
      <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <input 
          className="input" 
          type="number" 
          placeholder="Amount (₹)" 
          value={walletAmount} 
          onChange={e => setWalletAmount(e.target.value)} 
          style={{ width: '100%', marginBottom: 12 }} 
        />
        <input 
          className="input" 
          type="text" 
          placeholder="Reason for adjustment" 
          value={walletDesc} 
          onChange={e => setWalletDesc(e.target.value)} 
          style={{ width: '100%', marginBottom: 12 }} 
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn-primary" 
            style={{ flex: 1, fontSize: 12 }} 
            disabled={walletLoading || !walletAmount} 
            onClick={() => adjustWallet(false)}
          >
            {walletLoading ? '...' : '+ Credit'}
          </button>
          <button 
            className="btn-danger" 
            style={{ flex: 1, fontSize: 12 }} 
            disabled={walletLoading || !walletAmount} 
            onClick={() => adjustWallet(true)}
          >
            {walletLoading ? '...' : '- Debit'}
          </button>
        </div>
      </div>
    </div>
  )
}
