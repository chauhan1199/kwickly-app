import React, { useState, useEffect } from 'react'
import api, { SERVER_URL } from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, TextArea, FormRow, validators } from '../../components/FormInput'
import MapPicker from '../../components/MapPicker'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Package, Store, Copy, Upload, Wallet, FileText, Clock, Truck, CreditCard, User, Banknote } from 'lucide-react'

const PAGE_SIZE = 15
const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const SHOP_FORM_TABS = [
  { key: 'shop', label: 'Shop', icon: Store },
  { key: 'owner', label: 'Owner', icon: User },
  { key: 'hours', label: 'Hours', icon: Clock },
  { key: 'delivery', label: 'Delivery', icon: Truck },
  { key: 'subscription', label: 'Plan', icon: CreditCard },
]
const SUBSCRIPTION_PLANS = ['FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']
const PRODUCT_UNITS = [
  { value: 'Kg', label: 'Kg (Kilogram)' },
  { value: 'Gram', label: 'Gram' },
  { value: 'Quintal', label: 'Quintal (100 Kg)' },
  { value: 'Ton', label: 'Ton' },
  { value: 'Liter', label: 'Liter' },
  { value: 'Milliliter', label: 'Milliliter (ml)' },
  { value: 'Piece', label: 'Piece' },
  { value: 'Dozen', label: 'Dozen (12 pcs)' },
  { value: 'Pack', label: 'Pack' },
  { value: 'Box', label: 'Box' },
  { value: 'Bundle', label: 'Bundle' },
  { value: 'Pair', label: 'Pair' },
  { value: 'Set', label: 'Set' },
  { value: 'Bottle', label: 'Bottle' },
  { value: 'Pouch', label: 'Pouch' },
  { value: 'Bag', label: 'Bag' },
  { value: 'Roll', label: 'Roll' },
  { value: 'Sheet', label: 'Sheet' },
  { value: 'Carton', label: 'Carton' },
  { value: 'Bar', label: 'Bar' },
]
const validateAccountNumber = (val) => {
  if (!val) return 'Account number is required'
  const cleaned = val.replace(/\s/g, '')
  if (!/^\d{9,18}$/.test(cleaned)) return 'Account number must be 9-18 digits'
  return null
}
const validateIfsc = (val) => {
  if (!val) return 'IFSC code is required'
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val.trim().toUpperCase())) return 'Enter valid IFSC (e.g. HDFC0001234)'
  return null
}
const validateUpi = (val) => {
  if (!val) return 'UPI ID is required'
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(val.trim())) return 'Enter valid UPI (e.g. name@oksbi)'
  return null
}

export default function Shops() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kycFilter, setKycFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [shopProducts, setShopProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [showShopForm, setShowShopForm] = useState(false)
  const [editShop, setEditShop] = useState(null)
  const [shopFormTab, setShopFormTab] = useState('shop')
  const [shopForm, setShopForm] = useState({
    name: '', category: 'General', description: '', address: '',
    street: '', landmark: '', city: '', state: '', pincode: '',
    latitude: '', longitude: '',
    ownerName: '', ownerPhone: '', ownerEmail: '',
    businessHoursMonFri: '9 AM - 10 PM', businessHoursSat: '9 AM - 10 PM', businessHoursSun: 'Closed',
    deliveryRadius: 3, deliveryFee: 40, deliveryFreeAbove: 1000,
    subscriptionPlan: 'FREE_TRIAL',
  })
  const [shopFormErrors, setShopFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [shopLogo, setShopLogo] = useState(null)

  const [showWalletModal, setShowWalletModal] = useState(false)
  const [walletAction, setWalletAction] = useState('credit')
  const [walletAmount, setWalletAmount] = useState('')
  const [walletDesc, setWalletDesc] = useState('')
  const [savingWallet, setSavingWallet] = useState(false)
  const [adminWalletBalance, setAdminWalletBalance] = useState(null)

  const [showKycDocModal, setShowKycDocModal] = useState(false)
  const [kycDocName, setKycDocName] = useState('')
  const [kycDocFile, setKycDocFile] = useState(null)
  const [savingKycDoc, setSavingKycDoc] = useState(false)
  const [previewDoc, setPreviewDoc] = useState(null)

  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece', minQty: 1, brand: '', description: '', attributes: [], image: null, isActive: true })
  const [productFormErrors, setProductFormErrors] = useState({})
  const [savingProduct, setSavingProduct] = useState(false)

  const [impersonateToken, setImpersonateToken] = useState(null)

  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ type: 'BANK', label: '', accountNumber: '', ifscCode: '', upiId: '' })
  const [payoutErrors, setPayoutErrors] = useState({})
  const [savingPayout, setSavingPayout] = useState(false)

  const [showEditPayoutModal, setShowEditPayoutModal] = useState(false)
  const [editPayoutMethod, setEditPayoutMethod] = useState(null)
  const [editPayoutForm, setEditPayoutForm] = useState({ type: 'BANK', label: '', accountNumber: '', ifscCode: '', upiId: '' })
  const [editPayoutErrors, setEditPayoutErrors] = useState({})
  const [savingEditPayout, setSavingEditPayout] = useState(false)

  const [showEditKycDocModal, setShowEditKycDocModal] = useState(false)
  const [editKycDocIndex, setEditKycDocIndex] = useState(null)
  const [editKycDocName, setEditKycDocName] = useState('')
  const [editKycDocType, setEditKycDocType] = useState('OTHER')
  const [editKycDocFile, setEditKycDocFile] = useState(null)
  const [savingEditKycDoc, setSavingEditKycDoc] = useState(false)

  const [showOwnerEditModal, setShowOwnerEditModal] = useState(false)
  const [ownerEditForm, setOwnerEditForm] = useState({ name: '', phone: '', email: '' })
  const [savingOwner, setSavingOwner] = useState(false)

  const [showHoursEditModal, setShowHoursEditModal] = useState(false)
  const [hoursEditForm, setHoursEditForm] = useState({ monFri: '', sat: '', sun: '' })
  const [savingHours, setSavingHours] = useState(false)

  const [showDeliveryEditModal, setShowDeliveryEditModal] = useState(false)
  const [deliveryEditForm, setDeliveryEditForm] = useState({ radiusKm: 3, fee: 40, freeAbove: 1000 })
  const [savingDelivery, setSavingDelivery] = useState(false)

  const [showSubEditModal, setShowSubEditModal] = useState(false)
  const [subEditPlan, setSubEditPlan] = useState('FREE_TRIAL')
  const [savingSub, setSavingSub] = useState(false)

  useEffect(() => { fetchShops() }, [])

  const fetchShops = async () => {
    setLoading(true)
    try {
      const res = await api.get('/shops?limit=0')
      if (res.data.status === 'success') {
        setShops(res.data.data?.shops || res.data.data || [])
      }
    } catch {
      showToast('Failed to load shops', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = shops.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.ownerId?.name?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())
    const matchKyc = kycFilter === 'all' || s.kyc?.status === kycFilter.toUpperCase()
    return matchSearch && matchKyc
  })


  const columns = [
    { header: 'Shop', render: (s) => (
      <>
        <div className="cell-primary">{s.name}</div>
        <div className="cell-muted">Since {new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
      </>
    )},
    { header: 'Category', render: (s) => <Badge label={s.category || 'General'} variant="info" /> },
    { header: 'Owner', render: (s) => (
      <>
        <div className="cell-primary">{s.ownerId?.name || '—'}</div>
        <div className="cell-muted">{s.ownerId?.phone || '—'}</div>
      </>
    )},
    { header: 'Location', render: (s) => <div className="cell-muted" style={{ maxWidth: 140 }}>{s.address || '—'}</div> },
    { header: 'Orders', render: (s) => <strong>{s.totalOrders ?? 0}</strong> },
    { header: 'Wallet', render: (s) => <strong>₹{(s.wallet?.balance ?? 0).toLocaleString('en-IN')}</strong> },
    { header: 'KYC', render: (s) => <Badge label={s.kyc?.status || 'PENDING'} variant={KYC_VARIANT[s.kyc?.status] ? KYC_VARIANT[s.kyc?.status].toLowerCase() : 'neutral'} /> },
    { header: 'Status', render: (s) => <Badge label={s.isOnline ? 'Online' : 'Offline'} variant={s.isOnline ? 'success' : 'neutral'} /> },
    { header: 'Actions', render: (s) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View" onClick={() => openDetail(s)}><Eye size={15} /></button>
        <button className="btn-icon" title="Edit" onClick={() => openEditShop(s)}><Edit3 size={15} /></button>
        {s.kyc?.status === 'PENDING' && (
          <>
            <button className="btn-icon success" title="Approve KYC" onClick={() => handleKycAction(s._id, 'APPROVED')}><CheckCircle size={15} /></button>
            <button className="btn-icon danger" title="Reject KYC" onClick={() => handleKycAction(s._id, 'REJECTED')}><Ban size={15} /></button>
          </>
        )}
        <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete_shop', id: s._id, name: s.name })}><Trash2 size={15} /></button>
      </div>
    )}
  ];

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, kycFilter])

  const openAddShop = () => {
    setEditShop(null)
    setShopForm({
      name: '', category: 'General', description: '', address: '',
      street: '', landmark: '', city: '', state: '', pincode: '',
      latitude: '', longitude: '',
      ownerName: '', ownerPhone: '', ownerEmail: '',
      businessHoursMonFri: '9 AM - 10 PM', businessHoursSat: '9 AM - 10 PM', businessHoursSun: 'Closed',
      deliveryRadius: 3, deliveryFee: 40, deliveryFreeAbove: 1000,
      subscriptionPlan: 'FREE_TRIAL',
    })
    setShopFormErrors({})
    setShopLogo(null)
    setShopFormTab('shop')
    setShowShopForm(true)
  }

  const parseAddress = (addr) => {
    if (!addr) return { street: '', landmark: '', city: '', state: '', pincode: '' }
    const parts = addr.split(',').map(p => p.trim())
    return {
      street: parts[0] || '',
      landmark: parts[1] || '',
      city: parts[2] || '',
      state: parts[3] || '',
      pincode: parts[4] || '',
    }
  }

  const openEditShop = (shop) => {
    const addr = parseAddress(shop.address)
    const loc = shop.location?.coordinates || [0, 0]
    setEditShop(shop)
    setShopForm({
      name: shop.name || '', category: shop.category || 'General', description: shop.description || '', address: shop.address || '',
      street: addr.street, landmark: addr.landmark, city: addr.city, state: addr.state, pincode: addr.pincode,
      latitude: loc[1] ? String(loc[1]) : '', longitude: loc[0] ? String(loc[0]) : '',
      ownerName: shop.ownerId?.name || '', ownerPhone: shop.ownerId?.phone || '', ownerEmail: shop.ownerId?.email || '',
      businessHoursMonFri: shop.businessHours?.monFri || '9 AM - 10 PM', businessHoursSat: shop.businessHours?.sat || '9 AM - 10 PM', businessHoursSun: shop.businessHours?.sun || 'Closed',
      deliveryRadius: shop.delivery?.radiusKm || 3, deliveryFee: shop.delivery?.fee || 40, deliveryFreeAbove: shop.delivery?.freeAbove || 1000,
      subscriptionPlan: shop.subscription?.plan || 'FREE_TRIAL',
    })
    setShopFormErrors({})
    setShopLogo(null)
    setShopFormTab('shop')
    setShowShopForm(true)
  }

  const handleShopFieldChange = (field, value) => {
    setShopForm(prev => ({ ...prev, [field]: value }))
    if (shopFormErrors[field]) setShopFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const saveShop = async (e) => {
    e.preventDefault()
    const fullAddress = [shopForm.street, shopForm.landmark, shopForm.city, shopForm.state, shopForm.pincode].filter(Boolean).join(', ')
    const errors = {
      name: validators.shopName(shopForm.name),
      category: validators.required(shopForm.category, 'Category'),
      street: validators.required(shopForm.street, 'Street Address'),
      city: validators.required(shopForm.city, 'City'),
      state: validators.required(shopForm.state, 'State'),
      pincode: validators.pincode(shopForm.pincode),
    }
    if (!editShop) {
      errors.ownerPhone = validators.phone(shopForm.ownerPhone)
      if (shopForm.ownerEmail) errors.ownerEmail = validators.email(shopForm.ownerEmail)
    }
    setShopFormErrors(errors)
    if (Object.values(errors).some(v => v)) {
      const missingFields = Object.entries(errors).filter(([, v]) => v).map(([k, v]) => {
        const labels = { name: 'Shop Name', category: 'Category', street: 'Street Address', city: 'City', state: 'State', pincode: 'Pincode', ownerPhone: 'Owner Phone', ownerEmail: 'Owner Email' }
        return v
      })
      showToast(`Please fix: ${Object.entries(errors).filter(([, v]) => v).map(([k]) => {
        const labels = { name: 'Shop Name', category: 'Category', street: 'Street', city: 'City', state: 'State', pincode: 'Pincode', ownerPhone: 'Phone', ownerEmail: 'Email' }
        return labels[k] || k
      }).join(', ')}`, 'error')
      if (errors.ownerPhone || errors.ownerEmail) setShopFormTab('owner')
      else setShopFormTab('shop')
      return
    }

    setSaving(true)
    try {
      const loc = (shopForm.latitude && shopForm.longitude)
        ? { type: 'Point', coordinates: [Number(shopForm.longitude), Number(shopForm.latitude)] }
        : undefined
      if (editShop) {
        const payload = {
          name: shopForm.name.trim(),
          category: shopForm.category.trim(),
          address: fullAddress.trim(),
          description: shopForm.description.trim(),
          businessHours: {
            monFri: shopForm.businessHoursMonFri,
            sat: shopForm.businessHoursSat,
            sun: shopForm.businessHoursSun,
          },
          delivery: {
            radiusKm: Number(shopForm.deliveryRadius),
            fee: Number(shopForm.deliveryFee),
            freeAbove: Number(shopForm.deliveryFreeAbove),
          },
          subscription: { plan: shopForm.subscriptionPlan },
        }
        if (loc) payload.location = loc
        if (shopLogo) {
          const fd = new FormData()
          Object.entries(payload).forEach(([k, v]) => fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v))
          fd.append('logo', shopLogo)
          const res = await api.patch(`/admin/shops/${editShop._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          if (res.data.status === 'success') setShops(prev => prev.map(s => s._id === editShop._id ? { ...s, ...res.data.data } : s))
        } else {
          const res = await api.patch(`/admin/shops/${editShop._id}`, payload)
          if (res.data.status === 'success') setShops(prev => prev.map(s => s._id === editShop._id ? { ...s, ...res.data.data } : s))
        }
        showToast('Shop updated successfully')
        try { await api.post('/admin/notifications/broadcast', { title: 'Shop Updated', message: `Admin updated shop "${shopForm.name.trim()}"`, targetRole: 'SHOP' }) } catch {}
      } else {
        const payload = {
          name: shopForm.name.trim(),
          category: shopForm.category.trim(),
          address: fullAddress.trim(),
          description: shopForm.description.trim(),
          ownerPhone: shopForm.ownerPhone.trim(),
          ownerName: shopForm.ownerName.trim() || 'Shop Owner',
          ownerEmail: shopForm.ownerEmail.trim(),
          businessHours: {
            monFri: shopForm.businessHoursMonFri,
            sat: shopForm.businessHoursSat,
            sun: shopForm.businessHoursSun,
          },
          delivery: {
            radiusKm: Number(shopForm.deliveryRadius),
            fee: Number(shopForm.deliveryFee),
            freeAbove: Number(shopForm.deliveryFreeAbove),
          },
          subscription: { plan: shopForm.subscriptionPlan },
        }
        if (loc) payload.location = loc
        await api.post('/admin/shops', payload)
        showToast('Shop created successfully')
        try { await api.post('/admin/notifications/broadcast', { title: 'New Shop Created', message: `Admin created shop "${shopForm.name.trim()}" for owner "${shopForm.ownerName.trim() || 'Shop Owner'}"`, targetRole: 'SHOP' }) } catch {}
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
      setShowShopForm(false)
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteShop = async (id) => {
    const shopName = detail?._id === id ? detail.name : shops.find(s => s._id === id)?.name || 'Shop'
    try {
      const res = await api.delete(`/admin/shops/${id}`)
      if (res.data.status === 'success') {
        setShops(prev => prev.filter(s => s._id !== id))
        showToast('Shop deleted')
        if (detail?._id === id) setDetail(null)
        try { await api.post('/admin/notifications/broadcast', { title: 'Shop Deleted', message: `Admin deleted shop "${shopName}". All products and data have been removed.`, targetRole: 'SHOP' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch {
      showToast('Failed to delete shop', 'error')
    }
    setConfirm(null)
  }

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/admin/shops/${id}/toggle`)
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === id ? res.data.data : s))
        if (detail?._id === id) setDetail(res.data.data)
        const shopName = res.data.data?.name || 'Shop'
        const actionText = res.data.data?.isOnline ? 'activated' : 'blocked'
        showToast(`Shop ${actionText}`)
        try { await api.post('/admin/notifications/broadcast', { title: `Shop ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`, message: `Shop "${shopName}" was ${actionText} by admin`, targetRole: 'SHOP' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch {
      showToast('Failed to toggle shop', 'error')
    }
    setConfirm(null)
  }

  const handleKycAction = async (id, status) => {
    const shopName = detail?._id === id ? detail.name : shops.find(s => s._id === id)?.name || 'Unknown Shop'
    try {
      const res = await api.patch(`/admin/shops/${id}/kyc`, { status })
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === id ? res.data.data : s))
        if (detail?._id === id) setDetail(res.data.data)
        showToast(`KYC ${status.toLowerCase()}`)
        try { await api.post('/admin/notifications/broadcast', { title: `Shop KYC ${status}`, message: `KYC for shop "${shopName}" has been ${status.toLowerCase()} by admin`, targetRole: 'SHOP' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch {
      showToast('Failed to update KYC', 'error')
    }
    setConfirm(null)
  }

  const handleImpersonate = async (ownerId) => {
    if (!ownerId) { showToast('No owner linked', 'error'); return }
    try {
      const res = await api.post(`/admin/users/${ownerId}/impersonate`)
      if (res.data.status === 'success') {
        setImpersonateToken(res.data.data.token)
        showToast('Token generated')
      }
    } catch {
      showToast('Failed to generate token', 'error')
    }
  }

  const copyToken = (token) => {
    navigator.clipboard.writeText(token)
    showToast('Token copied to clipboard')
  }

  const openDetail = async (shop) => {
    setDetail(shop)
    setShopProducts([])
    setImpersonateToken(null)
    setLoadingProducts(true)
    setAdminWalletBalance(null)
    try {
      const [prodRes, walletRes] = await Promise.all([
        api.get(`/products?shopId=${shop._id}`),
        api.get('/admin/admin-wallet/balance')
      ])
      if (prodRes.data.status === 'success') setShopProducts(prodRes.data.data || [])
      if (walletRes.data?.data?.balance != null) setAdminWalletBalance(walletRes.data.data.balance)
    } catch { /* silent */ } finally {
      setLoadingProducts(false)
    }
  }

  const openProductAdd = () => { setEditProduct(null); setProductForm({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece', minQty: 1, brand: '', description: '', attributes: [], image: null, existingImage: '', isActive: true }); setProductFormErrors({}); setShowProductForm(true) }
  const openProductEdit = (p) => { setEditProduct(p); setProductForm({ name: p.name || '', price: p.price || '', category: p.category || 'General', stock: p.stock || 0, unit: p.unit || 'Piece', minQty: p.minQty || 1, brand: p.brand || '', description: p.description || '', attributes: p.attributes || [], image: null, existingImage: p.imageUrl || '', isActive: p.isActive !== false }); setProductFormErrors({}); setShowProductForm(true) }

  const handleProductFieldChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }))
    if (productFormErrors[field]) setProductFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const saveProduct = async (e) => {
    e.preventDefault()
    const errors = {
      name: validators.required(productForm.name, 'Product name'),
      price: validators.price(productForm.price),
      stock: validators.number(productForm.stock, 'Stock', 0),
      unit: validators.required(productForm.unit, 'Unit'),
      category: validators.required(productForm.category, 'Category'),
      minQty: validators.number(productForm.minQty, 'Min Qty', 1)
    }
    setProductFormErrors(errors)
    if (errors.name || errors.price || errors.stock || errors.unit || errors.category || errors.minQty) {
      const missing = []
      if (errors.name) missing.push('Product Name')
      if (errors.price) missing.push('Price')
      if (errors.stock) missing.push('Stock')
      if (errors.unit) missing.push('Unit')
      if (errors.category) missing.push('Category')
      if (errors.minQty) missing.push('Min Qty')
      showToast(`Missing required: ${missing.join(', ')}`, 'error')
      return
    }

    setSavingProduct(true)
    try {
      const fd = new FormData()
      fd.append('name', productForm.name.trim())
      fd.append('price', Number(productForm.price))
      fd.append('category', productForm.category.trim())
      fd.append('stock', Number(productForm.stock))
      fd.append('unit', productForm.unit.trim())
      fd.append('minQty', Number(productForm.minQty))
      fd.append('brand', productForm.brand.trim())
      fd.append('description', productForm.description.trim())
      fd.append('isActive', productForm.isActive)
      fd.append('shopId', detail._id)
      if (productForm.attributes.length > 0) fd.append('attributes', JSON.stringify(productForm.attributes))
      if (productForm.image) fd.append('image', productForm.image)
      if (editProduct) {
        await api.patch(`/products/${editProduct._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      showToast('Product saved')
      try { await api.post('/admin/notifications/broadcast', { title: editProduct ? 'Product Updated' : 'Product Added', message: `"${productForm.name.trim()}" ${editProduct ? 'updated' : 'added'} for shop "${detail.name}"`, targetRole: 'ALL' }) } catch {}
      setShowProductForm(false)
      window.dispatchEvent(new Event('admin-action'))
      openDetail(detail)
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save product', 'error')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleProductImageChange = (e) => { const file = e.target.files?.[0]; if (file) setProductForm(prev => ({ ...prev, image: file })) }
  const addAttribute = () => { setProductForm(prev => ({ ...prev, attributes: [...prev.attributes, { name: '', value: '' }] })) }
  const removeAttribute = (index) => { setProductForm(prev => ({ ...prev, attributes: prev.attributes.filter((_, i) => i !== index) })) }
  const updateAttribute = (index, field, val) => { setProductForm(prev => { const newAttrs = [...prev.attributes]; newAttrs[index] = { ...newAttrs[index], [field]: val }; return { ...prev, attributes: newAttrs } }) }
  const deleteProduct = async (id) => { try { await api.delete(`/products/${id}`); showToast('Product deleted'); try { await api.post('/admin/notifications/broadcast', { title: 'Product Deleted', message: `Product "${confirm?.name || ''}" deleted from shop "${detail?.name || ''}"`, targetRole: 'ALL' }) } catch {}; window.dispatchEvent(new Event('admin-action')); openDetail(detail) } catch { showToast('Failed to delete product', 'error') }; setConfirm(null) }

  const handleWalletSubmit = async () => {
    if (!walletAmount || isNaN(walletAmount) || Number(walletAmount) <= 0) { showToast('Enter a valid amount greater than 0', 'error'); return }
    if (!walletDesc || !walletDesc.trim()) { showToast('Enter a description/reason for this adjustment', 'error'); return }
    const shopId = detail?._id
    if (!shopId) { showToast('Shop not found. Close and reopen the drawer.', 'error'); return }
    setSavingWallet(true)
    try {
      const data = { amount: Number(walletAmount), description: walletDesc.trim() }
      const actionLabel = walletAction === 'credit' ? 'credited' : 'debited'
      let adminBal = null
      if (walletAction === 'credit') {
        const res = await api.post(`/admin/shops/${shopId}/wallet/credit`, data)
        adminBal = res.data?.data?.adminBalance
      } else {
        const res = await api.post(`/admin/shops/${shopId}/wallet/debit`, data)
        adminBal = res.data?.data?.adminBalance
      }
      const adminMsg = adminBal != null ? ` | Admin Wallet: ₹${Number(adminBal).toLocaleString('en-IN')}` : ''
      showToast(`₹${walletAmount} ${actionLabel} successfully${adminMsg}`)
      if (adminBal != null) setAdminWalletBalance(adminBal)
      setShowWalletModal(false)
      setWalletAmount('')
      setWalletDesc('')
      try {
        const freshShop = await api.get(`/admin/shops/${shopId}`)
        const updated = freshShop.data?.data?.shop
        if (updated) {
          setDetail(updated)
          setShops(prev => prev.map(s => s._id === shopId ? updated : s))
        }
      } catch (e) { console.error('Refresh failed:', e) }
      try { await api.post('/admin/notifications/broadcast', { title: `Wallet ${walletAction === 'credit' ? 'Credited' : 'Debited'}`, message: `₹${walletAmount} ${actionLabel} to "${detail.name}" wallet. ${walletDesc.trim()}`, targetRole: 'SHOP' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) {
      console.error('Wallet error:', err)
      showToast(err.response?.data?.message || 'Wallet operation failed. Check console for details.', 'error')
    } finally {
      setSavingWallet(false)
    }
  }

  const handleKycDocUpload = async () => {
    if (!kycDocName || !kycDocName.trim()) { showToast('Enter document name (e.g. GST Certificate, Shop License)', 'error'); return }
    if (!kycDocFile) { showToast('Select a file to upload (image or PDF)', 'error'); return }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(kycDocFile.type)) { showToast('Only JPG, PNG, and PDF files are allowed', 'error'); return }
    if (kycDocFile.size > 5 * 1024 * 1024) { showToast('File size must be under 5 MB', 'error'); return }
    setSavingKycDoc(true)
    try {
      const fd = new FormData()
      fd.append('document', kycDocFile)
      fd.append('name', kycDocName.trim())
      const res = await api.post(`/admin/shops/${detail._id}/kyc-doc`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      try { await api.post('/admin/notifications/broadcast', { title: 'KYC Document Uploaded', message: `Admin uploaded "${kycDocName.trim()}" for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      showToast('KYC document uploaded successfully')
      setShowKycDocModal(false); setKycDocName(''); setKycDocFile(null)
      const updatedShop = res.data.data
      if (updatedShop) {
        setDetail(prev => ({ ...prev, ...updatedShop }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updatedShop } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to upload document', 'error') } finally { setSavingKycDoc(false) }
  }

  const handleDeleteKycDoc = async (docIndex) => {
    const docName = detail.kyc?.documents?.[docIndex]?.name || 'document'
    try {
      await api.delete(`/admin/shops/${detail._id}/kyc-doc/${docIndex}`)
      showToast('Document deleted')
      try { await api.post('/admin/notifications/broadcast', { title: 'KYC Document Removed', message: `Admin removed KYC document "${docName}" from shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to delete document', 'error') }
    setConfirm(null)
  }

  const handleAddPayout = async () => {
    const errs = {}
    if (!payoutForm.label || !payoutForm.label.trim()) errs.label = 'Label is required (e.g. SBI Savings)'
    if (payoutForm.type === 'BANK') {
      errs.accountNumber = validateAccountNumber(payoutForm.accountNumber)
      errs.ifscCode = validateIfsc(payoutForm.ifscCode)
    } else {
      errs.upiId = validateUpi(payoutForm.upiId)
    }
    if (errs.label || errs.accountNumber || errs.ifscCode || errs.upiId) {
      setPayoutErrors(errs)
      const msgs = Object.values(errs).filter(Boolean)
      showToast(msgs[0], 'error')
      return
    }
    setPayoutErrors({})
    setSavingPayout(true)
    try {
      const payload = {
        type: payoutForm.type,
        label: payoutForm.label.trim(),
        detail: payoutForm.type === 'BANK' ? `${payoutForm.accountNumber.trim()} IFSC: ${payoutForm.ifscCode.trim().toUpperCase()}` : payoutForm.upiId.trim(),
      }
      await api.post(`/admin/shops/${detail._id}/payout-methods`, payload)
      try { await api.post('/admin/notifications/broadcast', { title: 'Payout Method Added', message: `Admin added ${payoutForm.type} payout method "${payoutForm.label.trim()}" for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      showToast('Payout method added successfully')
      setShowPayoutModal(false)
      setPayoutForm({ type: 'BANK', label: '', accountNumber: '', ifscCode: '', upiId: '' })
      setPayoutErrors({})
      await refreshDetail()
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to add payout method', 'error') } finally { setSavingPayout(false) }
  }

  const handleDeletePayout = async (methodId) => {
    try {
      await api.delete(`/admin/shops/${detail._id}/payout-methods/${methodId}`)
      showToast('Payout method deleted')
      try { await api.post('/admin/notifications/broadcast', { title: 'Payout Method Removed', message: `Admin removed a payout method from shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to delete payout method', 'error') }
    setConfirm(null)
  }

  const openEditPayout = (pm) => {
    setEditPayoutMethod(pm)
    const isBank = pm.type === 'BANK'
    const parts = isBank ? (pm.detail || '').split('IFSC:') : []
    setEditPayoutForm({
      type: pm.type,
      label: pm.label || '',
      accountNumber: isBank ? (parts[0] || '').trim() : '',
      ifscCode: isBank ? (parts[1] || '').trim() : '',
      upiId: !isBank ? (pm.detail || '') : '',
    })
    setEditPayoutErrors({})
    setShowEditPayoutModal(true)
  }

  const handleEditPayout = async () => {
    const errs = {}
    if (!editPayoutForm.label || !editPayoutForm.label.trim()) errs.label = 'Label is required'
    if (editPayoutForm.type === 'BANK') {
      errs.accountNumber = validateAccountNumber(editPayoutForm.accountNumber)
      errs.ifscCode = validateIfsc(editPayoutForm.ifscCode)
    } else {
      errs.upiId = validateUpi(editPayoutForm.upiId)
    }
    if (errs.label || errs.accountNumber || errs.ifscCode || errs.upiId) {
      setEditPayoutErrors(errs)
      showToast(Object.values(errs).filter(Boolean)[0], 'error')
      return
    }
    setEditPayoutErrors({})
    setSavingEditPayout(true)
    try {
      const payload = {
        type: editPayoutForm.type,
        label: editPayoutForm.label.trim(),
        detail: editPayoutForm.type === 'BANK' ? `${editPayoutForm.accountNumber.trim()} IFSC: ${editPayoutForm.ifscCode.trim().toUpperCase()}` : editPayoutForm.upiId.trim(),
      }
      await api.patch(`/admin/shops/${detail._id}/payout-methods/${editPayoutMethod._id}`, payload)
      showToast('Payout method updated')
      setShowEditPayoutModal(false)
      setEditPayoutMethod(null)
      await refreshDetail()
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update payout method', 'error') } finally { setSavingEditPayout(false) }
  }

  const openEditKycDoc = (doc, index) => {
    setEditKycDocIndex(index)
    setEditKycDocName(doc.name || '')
    setEditKycDocType(doc.docType || 'OTHER')
    setEditKycDocFile(null)
    setShowEditKycDocModal(true)
  }

  const handleEditKycDoc = async () => {
    if (!editKycDocName || !editKycDocName.trim()) { showToast('Document name is required', 'error'); return }
    setSavingEditKycDoc(true)
    try {
      const fd = new FormData()
      fd.append('name', editKycDocName.trim())
      fd.append('docType', editKycDocType)
      if (editKycDocFile) fd.append('document', editKycDocFile)
      await api.patch(`/admin/shops/${detail._id}/kyc-doc/${editKycDocIndex}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      showToast('KYC document updated')
      setShowEditKycDocModal(false)
      setEditKycDocIndex(null)
      await refreshDetail()
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update document', 'error') } finally { setSavingEditKycDoc(false) }
  }

  const handleUpdateOwner = async () => {
    if (!ownerEditForm.name) { showToast('Name is required', 'error'); return }
    setSavingOwner(true)
    try {
      await api.patch(`/admin/shops/${detail._id}/owner`, ownerEditForm)
      showToast('Owner updated')
      try { await api.post('/admin/notifications/broadcast', { title: 'Owner Profile Updated', message: `Admin updated owner details for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      setShowOwnerEditModal(false)
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update owner', 'error') } finally { setSavingOwner(false) }
  }

  const handleUpdateHours = async () => {
    setSavingHours(true)
    try {
      await api.patch(`/admin/shops/${detail._id}`, { businessHours: { monFri: hoursEditForm.monFri, sat: hoursEditForm.sat, sun: hoursEditForm.sun } })
      showToast('Business hours updated')
      try { await api.post('/admin/notifications/broadcast', { title: 'Business Hours Updated', message: `Admin updated business hours for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      setShowHoursEditModal(false)
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update hours', 'error') } finally { setSavingHours(false) }
  }

  const handleUpdateDelivery = async () => {
    setSavingDelivery(true)
    try {
      await api.patch(`/admin/shops/${detail._id}`, { delivery: { radiusKm: Number(deliveryEditForm.radiusKm), fee: Number(deliveryEditForm.fee), freeAbove: Number(deliveryEditForm.freeAbove) } })
      showToast('Delivery settings updated')
      try { await api.post('/admin/notifications/broadcast', { title: 'Delivery Settings Updated', message: `Admin updated delivery settings for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      setShowDeliveryEditModal(false)
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update delivery', 'error') } finally { setSavingDelivery(false) }
  }

  const handleUpdateSubscription = async () => {
    setSavingSub(true)
    try {
      await api.patch(`/admin/shops/${detail._id}`, { subscription: { plan: subEditPlan } })
      showToast('Subscription updated')
      try { await api.post('/admin/notifications/broadcast', { title: 'Subscription Updated', message: `Admin changed subscription plan to "${subEditPlan}" for shop "${detail.name}"`, targetRole: 'SHOP' }) } catch {}
      setShowSubEditModal(false)
      const fresh = await api.get(`/admin/shops/${detail._id}`)
      const updated = fresh.data?.data?.shop
      if (updated) {
        setDetail(prev => ({ ...prev, ...updated }))
        setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s))
      }
      fetchShops()
      window.dispatchEvent(new Event('admin-action'))
    } catch (err) { showToast(err.response?.data?.message || 'Failed to update subscription', 'error') } finally { setSavingSub(false) }
  }

  const refreshDetail = async () => {
    try { const fresh = await api.get(`/admin/shops/${detail._id}`); const updated = fresh.data.data?.shop; if (updated) { setDetail(prev => ({ ...prev, ...updated })); setShops(prev => prev.map(s => s._id === detail._id ? { ...s, ...updated } : s)); } } catch { /* silent */ }
  }

  const stats = {
    total: shops.length,
    approved: shops.filter(s => s.kyc?.status === 'APPROVED').length,
    pending: shops.filter(s => s.kyc?.status === 'PENDING').length,
    online: shops.filter(s => s.isOnline).length,
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Shop Management</div>
          <div className="page-subtitle">Manage all registered shops — view, verify KYC, manage products and visibility</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={openAddShop}><Plus size={16} /> Add Shop</button>
          <button className="btn-secondary" onClick={fetchShops}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Shops', value: stats.total, color: '#2EF7F0' },
          { label: 'KYC Approved', value: stats.approved, color: '#10B981' },
          { label: 'Pending Review', value: stats.pending, color: '#F59E0B' },
          { label: 'Online Now', value: stats.online, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search shops, owner, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {[
            { value: 'all', label: 'All' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'REJECTED', label: 'Rejected' },
          ].map(f => (
            <button key={f.value} className={`filter-tab ${kycFilter === f.value ? 'active' : ''}`} onClick={() => setKycFilter(f.value)}>{f.label}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="table-loading"><span>Loading shops...</span></div>
        ) : paged.length === 0 ? (
          <EmptyState icon="🏪" title="No shops found" description={search ? 'Try a different search term' : 'No shops registered yet'} action={<button className="btn-primary" onClick={openAddShop}><Plus size={16} /> Add First Shop</button>} />
        ) : (
          <>
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No shops registered yet"} />
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* ═══════════ Detail Drawer ═══════════ */}
      {detail && (
        <>
          <div className="drawer-overlay" onClick={() => { setDetail(null); setImpersonateToken(null); }} />
          <div className="drawer" style={{ width: 540 }}>
            <div className="drawer-header">
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Shop Details</div>
                <div className="cell-muted">{detail._id}</div>
              </div>
              <button className="modal-close" onClick={() => { setDetail(null); setImpersonateToken(null); }}>✕</button>
            </div>
            <div className="drawer-body">
              {/* Shop Info Header */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, #F97316, #DC2626)', borderRadius: 12 }}>
                  <Store size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{detail.name}</div>
                  <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{detail.category || 'General'} · {detail.address || 'No address'}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${KYC_VARIANT[detail.kyc?.status] || 'gray'}`}>KYC: {detail.kyc?.status}</span>
                    <span className={`badge ${detail.isOnline ? 'badge-success' : 'badge-gray'}`}>{detail.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="divider" />

              {/* Owner Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <User size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Owner Info
                </div>
                <button className="btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => { setOwnerEditForm({ name: detail.ownerId?.name || '', phone: detail.ownerId?.phone || '', email: detail.ownerId?.email || '' }); setShowOwnerEditModal(true) }}>
                  <Edit3 size={12} /> Edit
                </button>
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span>Name</span><strong>{detail.ownerId?.name || '—'}</strong></div>
                <div className="detail-row"><span>Phone</span><strong>{detail.ownerId?.phone || '—'}</strong></div>
                <div className="detail-row"><span>Email</span><strong>{detail.ownerId?.email || '—'}</strong></div>
              </div>

              {/* Shop Details */}
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                <Store size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Shop Details
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span>Address</span><strong>{detail.address || '—'}</strong></div>
                {detail.location?.coordinates?.[0] !== 0 && (
                  <div className="detail-row"><span>GPS</span><strong>{detail.location?.coordinates?.[1]}, {detail.location?.coordinates?.[0]}</strong></div>
                )}
                <div className="detail-row"><span>Description</span><strong>{detail.description || '—'}</strong></div>
                <div className="detail-row"><span>Total Orders</span><strong>{detail.totalOrders ?? 0}</strong></div>
                <div className="detail-row"><span>Wallet</span><strong>₹{(detail.wallet?.balance ?? 0).toLocaleString('en-IN')}</strong></div>
                <div className="detail-row"><span>Rating</span><strong>{detail.rating ? `${detail.rating} ★` : 'No ratings'}</strong></div>
              </div>

              {/* Business Hours */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Business Hours
                </div>
                <button className="btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => { setHoursEditForm({ monFri: detail.businessHours?.monFri || '9 AM - 10 PM', sat: detail.businessHours?.sat || '9 AM - 10 PM', sun: detail.businessHours?.sun || 'Closed' }); setShowHoursEditModal(true) }}>
                  <Edit3 size={12} /> Edit
                </button>
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span>Mon – Fri</span><strong>{detail.businessHours?.monFri || '9 AM - 10 PM'}</strong></div>
                <div className="detail-row"><span>Saturday</span><strong>{detail.businessHours?.sat || '9 AM - 10 PM'}</strong></div>
                <div className="detail-row"><span>Sunday</span><strong>{detail.businessHours?.sun || 'Closed'}</strong></div>
              </div>

              {/* Delivery Settings */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Truck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Delivery Settings
                </div>
                <button className="btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => { setDeliveryEditForm({ radiusKm: detail.delivery?.radiusKm || 3, fee: detail.delivery?.fee || 40, freeAbove: detail.delivery?.freeAbove || 1000 }); setShowDeliveryEditModal(true) }}>
                  <Edit3 size={12} /> Edit
                </button>
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span>Radius</span><strong>{detail.delivery?.radiusKm || 3} km</strong></div>
                <div className="detail-row"><span>Delivery Fee</span><strong>₹{detail.delivery?.fee || 40}</strong></div>
                <div className="detail-row"><span>Free Above</span><strong>₹{detail.delivery?.freeAbove || 1000}</strong></div>
              </div>

              {/* Subscription */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <CreditCard size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Subscription
                </div>
                <button className="btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => { setSubEditPlan(detail.subscription?.plan || 'FREE_TRIAL'); setShowSubEditModal(true) }}>
                  <Edit3 size={12} /> Change
                </button>
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span>Plan</span><strong>{detail.subscription?.plan || 'FREE_TRIAL'}</strong></div>
                {detail.subscription?.validUntil && <div className="detail-row"><span>Valid Until</span><strong>{new Date(detail.subscription.validUntil).toLocaleDateString('en-IN')}</strong></div>}
              </div>

              {/* Actions */}
              <div className="divider" />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={detail.isOnline ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }} onClick={() => setConfirm({ type: 'toggle_shop', id: detail._id, name: detail.name })}>
                  {detail.isOnline ? 'Block Shop' : 'Activate Shop'}
                </button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { openEditShop(detail); setDetail(null); }}>
                  <Edit3 size={14} /> Edit Shop
                </button>
                <button className="btn-danger" onClick={() => setConfirm({ type: 'delete_shop', id: detail._id, name: detail.name })}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* KYC Documents */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  KYC Documents ({detail.kyc?.documents?.length || 0})
                </div>
                <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setShowKycDocModal(true)}>
                  <Upload size={14} /> Upload
                </button>
              </div>
              {detail.kyc?.documents?.length > 0 ? (
                <div style={{ maxHeight: 160, overflowY: 'auto', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12 }}>
                  {detail.kyc.documents.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{doc.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{doc.docType || 'Document'}</div>
                      </div>
                      <div className="action-btns">
                        {doc.url && <button className="btn-icon" title="View" onClick={() => setPreviewDoc(doc)}><Eye size={14} /></button>}
                        <button className="btn-icon" title="Edit" onClick={() => openEditKycDoc(doc, i)}><Edit3 size={14} /></button>
                        <button className="btn-icon danger" onClick={() => setConfirm({ type: 'delete_kyc_doc', docIndex: i, name: doc.name })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12, fontStyle: 'italic', marginBottom: 12 }}>No documents uploaded</div>
              )}

              {/* Wallet Management */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Wallet size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Wallet — ₹{(detail.wallet?.balance ?? 0).toLocaleString('en-IN')}
                  {adminWalletBalance != null && (
                    <span style={{ marginLeft: 12, color: '#059669', fontWeight: 600 }}>
                      Admin: ₹{Number(adminWalletBalance).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => { setWalletAction('credit'); setShowWalletModal(true); }}>
                  Adjust Balance
                </button>
              </div>

              {/* Payout Methods */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Banknote size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Payout Methods ({detail.payoutMethods?.length || 0})
                </div>
                <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setShowPayoutModal(true)}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {detail.payoutMethods?.length > 0 ? (
                <div style={{ maxHeight: 140, overflowY: 'auto', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12 }}>
                  {detail.payoutMethods.map((pm, i) => (
                    <div key={pm._id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < detail.payoutMethods.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{pm.label || (pm.type === 'UPI' ? 'UPI' : 'Bank Account')} {pm.isPrimary && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>(Primary)</span>}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{pm.type} · {pm.type === 'UPI' ? pm.detail : `****${pm.detail?.slice(-4) || '****'}`}</div>
                      </div>
                      <div className="action-btns">
                        <button className="btn-icon" title="Edit" onClick={() => openEditPayout(pm)}><Edit3 size={14} /></button>
                        <button className="btn-icon danger" onClick={() => setConfirm({ type: 'delete_payout', methodId: pm._id, name: pm.label || pm.type })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12, fontStyle: 'italic', marginBottom: 12 }}>No payout methods added</div>
              )}

              {/* Impersonate */}
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Impersonate Shop Owner</div>
              {impersonateToken ? (
                <div style={{ background: 'var(--bg-dark)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, fontWeight: 600 }}>Temporary Login Token (1h):</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', userSelect: 'all', background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                    {impersonateToken}
                  </div>
                  <button className="btn-secondary" style={{ width: '100%', height: 32, fontSize: 12 }} onClick={() => copyToken(impersonateToken)}>
                    <Copy size={12} /> Copy Token
                  </button>
                </div>
              ) : (
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleImpersonate(detail.ownerId?._id)}>
                  Generate Login Token
                </button>
              )}

              {/* Products */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Package size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Products ({shopProducts.length})
                </div>
                <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={openProductAdd}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {loadingProducts ? (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12 }}>Loading products...</div>
              ) : shopProducts.length === 0 ? (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12, fontStyle: 'italic' }}>No products yet</div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  {shopProducts.map(p => (
                    <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl.startsWith('http') ? p.imageUrl : `${SERVER_URL}${p.imageUrl}`} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.target.style.display = 'none' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📦</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name} {!p.isActive && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>(Inactive)</span>}</div>
                          <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{p.category} · Stock: {p.stock} · Min: {p.minQty || 1} · {p.unit}</div>
                          {p.brand && <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 1 }}>Brand: {p.brand}</div>}
                          {p.attributes?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {p.attributes.map((a, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg)', borderRadius: 4, color: 'var(--mid)' }}>{a.name}: {a.value}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginRight: 14 }}>₹{p.price}</div>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openProductEdit(p)} title="Edit"><Edit3 size={14} /></button>
                        <button className="btn-icon danger" onClick={() => setConfirm({ type: 'delete_product', id: p._id, name: p.name })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ Add/Edit Shop Modal (Tabbed) ═══════════ */}
      <Modal open={showShopForm} onClose={() => !saving && setShowShopForm(false)} title={editShop ? 'Edit Shop' : 'Add New Shop'} width="560px">
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0, overflowX: 'auto' }}>
          {SHOP_FORM_TABS.map(tab => {
            const Icon = tab.icon
            const disabled = editShop && tab.key === 'owner'
            return (
              <button key={tab.key} type="button" onClick={() => !disabled && setShopFormTab(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', border: 'none', borderBottom: shopFormTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: shopFormTab === tab.key ? 'var(--primary)' : 'var(--mid)', fontWeight: 700, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
        <form onSubmit={saveShop}>
          {shopFormTab === 'shop' && (
            <>
              <TextInput label="Shop Name *" value={shopForm.name} onChange={e => handleShopFieldChange('name', e.target.value)} placeholder="e.g. Sharma Grocery Store" required error={shopFormErrors.name} disabled={saving} maxLength={100} />
              <FormRow>
                <TextInput label="Category *" value={shopForm.category} onChange={e => handleShopFieldChange('category', e.target.value)} placeholder="e.g. Grocery" required error={shopFormErrors.category} disabled={saving} maxLength={50} />
              </FormRow>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 8 }}>
                Shop Address
              </div>
              <TextInput label="Street Address *" value={shopForm.street} onChange={e => handleShopFieldChange('street', e.target.value)} placeholder="e.g. 123, Main Market Road" required error={shopFormErrors.street} disabled={saving} maxLength={200} />
              <TextInput label="Landmark / Area" value={shopForm.landmark} onChange={e => handleShopFieldChange('landmark', e.target.value)} placeholder="e.g. Near Bus Stand, Opp. SBI Bank" disabled={saving} maxLength={200} />
              <FormRow>
                <TextInput label="City *" value={shopForm.city} onChange={e => handleShopFieldChange('city', e.target.value)} placeholder="e.g. Ahmedabad" required error={shopFormErrors.city} disabled={saving} maxLength={100} />
                <TextInput label="State *" value={shopForm.state} onChange={e => handleShopFieldChange('state', e.target.value)} placeholder="e.g. Gujarat" required error={shopFormErrors.state} disabled={saving} maxLength={100} />
              </FormRow>
              <TextInput label="Pincode *" value={shopForm.pincode} onChange={e => handleShopFieldChange('pincode', e.target.value)} placeholder="e.g. 380001" required error={shopFormErrors.pincode} disabled={saving} maxLength={6} inputMode="numeric" hint="6-digit Indian pincode" />

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 12 }}>
                GPS Coordinates (Optional)
              </div>
              <MapPicker
                latitude={shopForm.latitude}
                longitude={shopForm.longitude}
                onChange={({ latitude, longitude }) => {
                  handleShopFieldChange('latitude', latitude)
                  handleShopFieldChange('longitude', longitude)
                }}
              />

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 12 }}>
                More Details
              </div>
              <TextArea label="Description" value={shopForm.description} onChange={e => handleShopFieldChange('description', e.target.value)} placeholder="Brief description of the shop..." rows={3} disabled={saving} maxLength={500} />
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Shop Logo</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--mid)', background: 'var(--input-bg)' }}>
                    <input type="file" accept="image/*" onChange={(e) => setShopLogo(e.target.files?.[0] || null)} style={{ display: 'none' }} disabled={saving} />
                    {shopLogo ? shopLogo.name : 'Choose logo image...'}
                  </label>
                  {shopLogo && <button type="button" className="btn-secondary" style={{ height: 36, fontSize: 12 }} onClick={() => setShopLogo(null)} disabled={saving}>Remove</button>}
                </div>
              </div>
            </>
          )}

          {shopFormTab === 'owner' && (
            <>
              {editShop ? (
                <div style={{ padding: 20, background: 'var(--bg)', borderRadius: 10, textAlign: 'center', color: 'var(--mid)', fontSize: 13 }}>
                  <User size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Owner profile can be edited from the Shop Details drawer</div>
                  <div>Click "Edit" next to Owner Info in the detail panel</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, padding: 10, background: 'var(--primary-light)', borderRadius: 8, fontSize: 12, color: 'var(--primary)' }}>
                    A new owner account will be created with password: <strong>shop123</strong>
                  </div>
                  <TextInput label="Owner Name *" value={shopForm.ownerName} onChange={e => handleShopFieldChange('ownerName', e.target.value)} placeholder="e.g. Rajesh Sharma" disabled={saving} maxLength={100} />
                  <TextInput label="Owner Phone *" value={shopForm.ownerPhone} onChange={e => handleShopFieldChange('ownerPhone', e.target.value)} placeholder="10-digit mobile number" required error={shopFormErrors.ownerPhone} disabled={saving} maxLength={10} inputMode="tel" hint="10-digit Indian mobile number starting with 6-9" />
                  <TextInput label="Owner Email" value={shopForm.ownerEmail} onChange={e => handleShopFieldChange('ownerEmail', e.target.value)} placeholder="e.g. owner@example.com" error={shopFormErrors.ownerEmail} disabled={saving} maxLength={100} inputMode="email" hint="Optional — for sending notifications" />
                </>
              )}
            </>
          )}

          {shopFormTab === 'hours' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 12 }}>Set the shop's operating hours</div>
              </div>
              <TextInput label="Monday – Friday" value={shopForm.businessHoursMonFri} onChange={e => handleShopFieldChange('businessHoursMonFri', e.target.value)} placeholder="e.g. 9 AM - 10 PM" disabled={saving} maxLength={50} />
              <TextInput label="Saturday" value={shopForm.businessHoursSat} onChange={e => handleShopFieldChange('businessHoursSat', e.target.value)} placeholder="e.g. 9 AM - 10 PM" disabled={saving} maxLength={50} />
              <TextInput label="Sunday" value={shopForm.businessHoursSun} onChange={e => handleShopFieldChange('businessHoursSun', e.target.value)} placeholder="e.g. Closed" disabled={saving} maxLength={50} />
            </>
          )}

          {shopFormTab === 'delivery' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 12 }}>Configure delivery options</div>
              </div>
              <FormRow>
                <TextInput label="Radius (km)" value={shopForm.deliveryRadius} onChange={e => handleShopFieldChange('deliveryRadius', e.target.value)} type="number" disabled={saving} />
                <TextInput label="Delivery Fee (₹)" value={shopForm.deliveryFee} onChange={e => handleShopFieldChange('deliveryFee', e.target.value)} type="number" disabled={saving} />
              </FormRow>
              <TextInput label="Free Delivery Above (₹)" value={shopForm.deliveryFreeAbove} onChange={e => handleShopFieldChange('deliveryFreeAbove', e.target.value)} type="number" disabled={saving} />
            </>
          )}

          {shopFormTab === 'subscription' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 12 }}>Select subscription plan</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SUBSCRIPTION_PLANS.map(plan => (
                  <button key={plan} type="button" onClick={() => handleShopFieldChange('subscriptionPlan', plan)} style={{ padding: '14px 12px', border: shopForm.subscriptionPlan === plan ? '2px solid var(--primary)' : '2px solid var(--border)', borderRadius: 10, background: shopForm.subscriptionPlan === plan ? 'var(--primary-light)' : 'var(--input-bg)', cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: 13, color: shopForm.subscriptionPlan === plan ? 'var(--primary)' : 'var(--dark)' }}>
                    {plan.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowShopForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving...' : editShop ? 'Update Shop' : 'Create Shop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ Inline Edit Modals ═══════════ */}

      {/* Owner Edit Modal */}
      <Modal open={showOwnerEditModal} onClose={() => !savingOwner && setShowOwnerEditModal(false)} title="Edit Owner Profile" width="420px">
        <TextInput label="Name *" value={ownerEditForm.name} onChange={e => setOwnerEditForm(p => ({ ...p, name: e.target.value }))} disabled={savingOwner} />
        <TextInput label="Phone" value={ownerEditForm.phone} onChange={e => setOwnerEditForm(p => ({ ...p, phone: e.target.value }))} disabled={savingOwner} />
        <TextInput label="Email" value={ownerEditForm.email} onChange={e => setOwnerEditForm(p => ({ ...p, email: e.target.value }))} disabled={savingOwner} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowOwnerEditModal(false)} disabled={savingOwner}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleUpdateOwner} disabled={savingOwner}>{savingOwner ? 'Saving...' : 'Save Owner'}</button>
        </div>
      </Modal>

      {/* Business Hours Edit Modal */}
      <Modal open={showHoursEditModal} onClose={() => !savingHours && setShowHoursEditModal(false)} title="Edit Business Hours" width="420px">
        <TextInput label="Monday – Friday" value={hoursEditForm.monFri} onChange={e => setHoursEditForm(p => ({ ...p, monFri: e.target.value }))} placeholder="e.g. 9 AM - 10 PM" disabled={savingHours} />
        <TextInput label="Saturday" value={hoursEditForm.sat} onChange={e => setHoursEditForm(p => ({ ...p, sat: e.target.value }))} placeholder="e.g. 9 AM - 10 PM" disabled={savingHours} />
        <TextInput label="Sunday" value={hoursEditForm.sun} onChange={e => setHoursEditForm(p => ({ ...p, sun: e.target.value }))} placeholder="e.g. Closed" disabled={savingHours} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowHoursEditModal(false)} disabled={savingHours}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleUpdateHours} disabled={savingHours}>{savingHours ? 'Saving...' : 'Save Hours'}</button>
        </div>
      </Modal>

      {/* Delivery Edit Modal */}
      <Modal open={showDeliveryEditModal} onClose={() => !savingDelivery && setShowDeliveryEditModal(false)} title="Edit Delivery Settings" width="420px">
        <TextInput label="Radius (km)" value={deliveryEditForm.radiusKm} onChange={e => setDeliveryEditForm(p => ({ ...p, radiusKm: e.target.value }))} type="number" disabled={savingDelivery} />
        <TextInput label="Delivery Fee (₹)" value={deliveryEditForm.fee} onChange={e => setDeliveryEditForm(p => ({ ...p, fee: e.target.value }))} type="number" disabled={savingDelivery} />
        <TextInput label="Free Delivery Above (₹)" value={deliveryEditForm.freeAbove} onChange={e => setDeliveryEditForm(p => ({ ...p, freeAbove: e.target.value }))} type="number" disabled={savingDelivery} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeliveryEditModal(false)} disabled={savingDelivery}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleUpdateDelivery} disabled={savingDelivery}>{savingDelivery ? 'Saving...' : 'Save Delivery'}</button>
        </div>
      </Modal>

      {/* Subscription Edit Modal */}
      <Modal open={showSubEditModal} onClose={() => !savingSub && setShowSubEditModal(false)} title="Change Subscription Plan" width="420px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {SUBSCRIPTION_PLANS.map(plan => (
            <button key={plan} type="button" onClick={() => setSubEditPlan(plan)} style={{ padding: '14px 12px', border: subEditPlan === plan ? '2px solid var(--primary)' : '2px solid var(--border)', borderRadius: 10, background: subEditPlan === plan ? 'var(--primary-light)' : 'var(--input-bg)', cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: 12, color: subEditPlan === plan ? 'var(--primary)' : 'var(--dark)' }}>
              {plan.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubEditModal(false)} disabled={savingSub}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleUpdateSubscription} disabled={savingSub}>{savingSub ? 'Saving...' : 'Update Plan'}</button>
        </div>
      </Modal>

      {/* Add/Edit Product Modal */}
      <Modal open={showProductForm} onClose={() => setShowProductForm(false)} title={editProduct ? 'Edit Product' : 'Add Product'} width="520px">
        <form onSubmit={saveProduct}>
          <TextInput label="Product Name *" value={productForm.name} onChange={e => handleProductFieldChange('name', e.target.value)} placeholder="e.g. Basmati Rice 5kg" required error={productFormErrors.name} disabled={savingProduct} maxLength={100} />
          <FormRow>
            <TextInput label="Brand" value={productForm.brand} onChange={e => handleProductFieldChange('brand', e.target.value)} placeholder="e.g. India Gate" disabled={savingProduct} maxLength={100} />
            <TextInput label="Category *" value={productForm.category} onChange={e => handleProductFieldChange('category', e.target.value)} placeholder="e.g. Grocery" required error={productFormErrors.category} disabled={savingProduct} maxLength={50} />
          </FormRow>
          <FormRow>
            <TextInput label="Price (₹) *" value={productForm.price} onChange={e => handleProductFieldChange('price', e.target.value)} type="number" required error={productFormErrors.price} disabled={savingProduct} inputMode="decimal" />
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Unit *</label>
              <select
                className="form-control"
                value={productForm.unit || 'Piece'}
                onChange={e => handleProductFieldChange('unit', e.target.value)}
                disabled={savingProduct}
                style={{ background: 'var(--input-bg)', borderColor: productFormErrors.unit ? '#EF4444' : undefined }}
              >
                {PRODUCT_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              {productFormErrors.unit && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4, fontWeight: 600 }}>⚠ {productFormErrors.unit}</div>}
            </div>
          </FormRow>
          <FormRow>
            <TextInput label="Stock *" value={productForm.stock} onChange={e => handleProductFieldChange('stock', e.target.value)} type="number" required error={productFormErrors.stock} disabled={savingProduct} />
            <TextInput label="Min Qty *" value={productForm.minQty} onChange={e => handleProductFieldChange('minQty', e.target.value)} type="number" required error={productFormErrors.minQty} disabled={savingProduct} />
          </FormRow>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Product Image</label>
            {editProduct && productForm.existingImage && !productForm.image && (
              <div style={{ marginBottom: 8 }}>
                <img src={productForm.existingImage.startsWith('http') ? productForm.existingImage : `${SERVER_URL}${productForm.existingImage}`} alt="Current" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.target.style.display = 'none' }} />
                <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Current image</div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--mid)', background: 'var(--input-bg)' }}>
              <input type="file" accept="image/*" onChange={handleProductImageChange} style={{ display: 'none' }} disabled={savingProduct} />
              {productForm.image ? productForm.image.name : editProduct && productForm.existingImage ? 'Change image...' : 'Choose image...'}
            </label>
          </div>
          <TextArea label="Description" value={productForm.description} onChange={e => handleProductFieldChange('description', e.target.value)} placeholder="Product description..." rows={2} disabled={savingProduct} maxLength={500} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={productForm.isActive} onChange={e => handleProductFieldChange('isActive', e.target.checked)} disabled={savingProduct} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
              <span>{productForm.isActive ? 'Active (visible to customers)' : 'Inactive (hidden)'}</span>
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Dynamic Attributes</label>
              <button type="button" className="btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={addAttribute} disabled={savingProduct}>+ Add</button>
            </div>
            {productForm.attributes.map((attr, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="form-control" placeholder="Name (e.g. Color)" value={attr.name} onChange={e => updateAttribute(idx, 'name', e.target.value)} disabled={savingProduct} style={{ flex: 1, background: 'var(--input-bg)' }} />
                <input className="form-control" placeholder="Value (e.g. Red)" value={attr.value} onChange={e => updateAttribute(idx, 'value', e.target.value)} disabled={savingProduct} style={{ flex: 1, background: 'var(--input-bg)' }} />
                <button type="button" className="btn-icon danger" onClick={() => removeAttribute(idx)} disabled={savingProduct} style={{ flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            ))}
            {productForm.attributes.length === 0 && <div style={{ fontSize: 12, color: 'var(--mid)', fontStyle: 'italic' }}>No attributes added</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowProductForm(false)} disabled={savingProduct}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={savingProduct}>
              {savingProduct ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ Confirm Modals ═══════════ */}
      {confirm?.type === 'toggle_shop' && (
        <ConfirmModal
          title={shops.find(s => s._id === confirm.id)?.isOnline ? 'Block Shop' : 'Activate Shop'}
          message={shops.find(s => s._id === confirm.id)?.isOnline ? `Block ${confirm.name}? It will be hidden from customers.` : `Activate ${confirm.name}? It will be visible to customers.`}
          danger={shops.find(s => s._id === confirm.id)?.isOnline}
          confirmText={shops.find(s => s._id === confirm.id)?.isOnline ? 'Block Shop' : 'Activate Shop'}
          onConfirm={() => handleToggle(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'delete_shop' && (
        <ConfirmModal title="Delete Shop" message={`Permanently delete ${confirm.name}? All products and data will be lost.`} confirmText="Delete Permanently" onConfirm={() => deleteShop(confirm.id)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.type === 'delete_product' && (
        <ConfirmModal title="Delete Product" message={`Remove ${confirm.name} from this shop?`} confirmText="Delete Product" onConfirm={() => deleteProduct(confirm.id)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.type === 'delete_kyc_doc' && (
        <ConfirmModal title="Delete Document" message={`Remove "${confirm.name}" from KYC documents?`} confirmText="Delete" onConfirm={() => handleDeleteKycDoc(confirm.docIndex)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.type === 'delete_payout' && (
        <ConfirmModal title="Delete Payout Method" message={`Remove "${confirm.name}" from payout methods?`} confirmText="Delete" onConfirm={() => handleDeletePayout(confirm.methodId)} onClose={() => setConfirm(null)} />
      )}

      {/* ═══════════ Wallet Adjust Modal ═══════════ */}
      <Modal open={showWalletModal} onClose={() => !savingWallet && setShowWalletModal(false)} title="Adjust Shop Wallet" width="420px">
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Action</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={walletAction === 'credit' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => setWalletAction('credit')} disabled={savingWallet}>Credit (+)</button>
            <button type="button" className={walletAction === 'debit' ? 'btn-danger' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => setWalletAction('debit')} disabled={savingWallet}>Debit (−)</button>
          </div>
        </div>
        <TextInput label="Amount (₹) *" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} type="number" placeholder="Enter amount" disabled={savingWallet} inputMode="decimal" hint="Must be greater than 0" />
        <TextArea label="Description / Reason *" value={walletDesc} onChange={e => setWalletDesc(e.target.value)} placeholder="e.g. Bonus credit, Refund for order #123, Correction" rows={2} disabled={savingWallet} maxLength={200} hint="Required for audit trail" />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowWalletModal(false)} disabled={savingWallet}>Cancel</button>
          <button
            type="button"
            className={walletAction === 'credit' ? 'btn-primary' : 'btn-danger'}
            style={{ flex: 1 }}
            onClick={handleWalletSubmit}
            disabled={savingWallet}
          >
            {savingWallet ? 'Processing...' : walletAction === 'credit' ? 'Credit ₹' + (walletAmount || '0') : 'Debit ₹' + (walletAmount || '0')}
          </button>
        </div>
      </Modal>

      {/* KYC Doc Upload Modal */}
      <Modal open={showKycDocModal} onClose={() => !savingKycDoc && setShowKycDocModal(false)} title="Upload KYC Document" width="420px">
        <TextInput label="Document Name *" value={kycDocName} onChange={e => setKycDocName(e.target.value)} placeholder="e.g. GST Certificate, Shop License, PAN Card" disabled={savingKycDoc} hint="Enter a descriptive name for the document" />
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Document File *</label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', border: kycDocFile ? '2px solid var(--primary)' : '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--mid)', background: 'var(--input-bg)', gap: 8 }}>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setKycDocFile(e.target.files?.[0] || null)} style={{ display: 'none' }} disabled={savingKycDoc} />
            {kycDocFile ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{kycDocFile.name}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{(kycDocFile.size / 1024).toFixed(1)} KB — {kycDocFile.type}</div>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ opacity: 0.4 }} />
                <div>Click to choose file (JPG, PNG, PDF)</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Max file size: 5 MB</div>
              </>
            )}
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowKycDocModal(false); setKycDocName(''); setKycDocFile(null) }} disabled={savingKycDoc}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleKycDocUpload} disabled={savingKycDoc}>
            {savingKycDoc ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </Modal>

      {/* Add Payout Method Modal */}
      <Modal open={showPayoutModal} onClose={() => !savingPayout && setShowPayoutModal(false)} title="Add Payout Method" width="420px">
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Type *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={payoutForm.type === 'BANK' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => { setPayoutForm(p => ({ ...p, type: 'BANK' })); setPayoutErrors({}) }} disabled={savingPayout}>Bank Account</button>
            <button type="button" className={payoutForm.type === 'UPI' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => { setPayoutForm(p => ({ ...p, type: 'UPI' })); setPayoutErrors({}) }} disabled={savingPayout}>UPI</button>
          </div>
        </div>
        <TextInput label="Label *" value={payoutForm.label} onChange={e => { setPayoutForm(p => ({ ...p, label: e.target.value })); if (payoutErrors.label) setPayoutErrors(pe => ({ ...pe, label: null })) }} placeholder="e.g. SBI Savings, GPay" error={payoutErrors.label} disabled={savingPayout} hint="A name to identify this account" />
        {payoutForm.type === 'BANK' ? (
          <>
            <TextInput label="Account Number *" value={payoutForm.accountNumber} onChange={e => { setPayoutForm(p => ({ ...p, accountNumber: e.target.value })); if (payoutErrors.accountNumber) setPayoutErrors(pe => ({ ...pe, accountNumber: null })) }} placeholder="e.g. 123456789012" error={payoutErrors.accountNumber} disabled={savingPayout} inputMode="numeric" maxLength={18} hint="9-18 digit bank account number" />
            <TextInput label="IFSC Code *" value={payoutForm.ifscCode} onChange={e => { setPayoutForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() })); if (payoutErrors.ifscCode) setPayoutErrors(pe => ({ ...pe, ifscCode: null })) }} placeholder="e.g. HDFC0001234" error={payoutErrors.ifscCode} disabled={savingPayout} maxLength={11} hint="11-character IFSC code" />
          </>
        ) : (
          <TextInput label="UPI ID *" value={payoutForm.upiId} onChange={e => { setPayoutForm(p => ({ ...p, upiId: e.target.value })); if (payoutErrors.upiId) setPayoutErrors(pe => ({ ...pe, upiId: null })) }} placeholder="e.g. yourname@oksbi" error={payoutErrors.upiId} disabled={savingPayout} hint="Format: name@bank (e.g. shop@paytm, 9876543210@okicici)" />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPayoutModal(false); setPayoutErrors({}) }} disabled={savingPayout}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleAddPayout} disabled={savingPayout}>{savingPayout ? 'Saving...' : 'Add Method'}</button>
        </div>
      </Modal>

      {/* Edit Payout Method Modal */}
      <Modal open={showEditPayoutModal} onClose={() => !savingEditPayout && setShowEditPayoutModal(false)} title="Edit Payout Method" width="420px">
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Type *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={editPayoutForm.type === 'BANK' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => { setEditPayoutForm(p => ({ ...p, type: 'BANK' })); setEditPayoutErrors({}) }} disabled={savingEditPayout}>Bank Account</button>
            <button type="button" className={editPayoutForm.type === 'UPI' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => { setEditPayoutForm(p => ({ ...p, type: 'UPI' })); setEditPayoutErrors({}) }} disabled={savingEditPayout}>UPI</button>
          </div>
        </div>
        <TextInput label="Label *" value={editPayoutForm.label} onChange={e => { setEditPayoutForm(p => ({ ...p, label: e.target.value })); if (editPayoutErrors.label) setEditPayoutErrors(pe => ({ ...pe, label: null })) }} placeholder="e.g. SBI Savings, GPay" error={editPayoutErrors.label} disabled={savingEditPayout} hint="A name to identify this account" />
        {editPayoutForm.type === 'BANK' ? (
          <>
            <TextInput label="Account Number *" value={editPayoutForm.accountNumber} onChange={e => { setEditPayoutForm(p => ({ ...p, accountNumber: e.target.value })); if (editPayoutErrors.accountNumber) setEditPayoutErrors(pe => ({ ...pe, accountNumber: null })) }} placeholder="e.g. 123456789012" error={editPayoutErrors.accountNumber} disabled={savingEditPayout} inputMode="numeric" maxLength={18} hint="9-18 digit bank account number" />
            <TextInput label="IFSC Code *" value={editPayoutForm.ifscCode} onChange={e => { setEditPayoutForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() })); if (editPayoutErrors.ifscCode) setEditPayoutErrors(pe => ({ ...pe, ifscCode: null })) }} placeholder="e.g. HDFC0001234" error={editPayoutErrors.ifscCode} disabled={savingEditPayout} maxLength={11} hint="11-character IFSC code" />
          </>
        ) : (
          <TextInput label="UPI ID *" value={editPayoutForm.upiId} onChange={e => { setEditPayoutForm(p => ({ ...p, upiId: e.target.value })); if (editPayoutErrors.upiId) setEditPayoutErrors(pe => ({ ...pe, upiId: null })) }} placeholder="e.g. yourname@oksbi" error={editPayoutErrors.upiId} disabled={savingEditPayout} hint="Format: name@bank (e.g. shop@paytm, 9876543210@okicici)" />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowEditPayoutModal(false); setEditPayoutMethod(null); setEditPayoutErrors({}) }} disabled={savingEditPayout}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleEditPayout} disabled={savingEditPayout}>{savingEditPayout ? 'Saving...' : 'Update Method'}</button>
        </div>
      </Modal>

      {/* Edit KYC Document Modal */}
      <Modal open={showEditKycDocModal} onClose={() => !savingEditKycDoc && setShowEditKycDocModal(false)} title="Edit KYC Document" width="420px">
        <TextInput label="Document Name *" value={editKycDocName} onChange={e => setEditKycDocName(e.target.value)} placeholder="e.g. GST Certificate, Shop License" disabled={savingEditKycDoc} />
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Document Type</label>
          <select value={editKycDocType} onChange={e => setEditKycDocType(e.target.value)} disabled={savingEditKycDoc} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="AADHAAR">Aadhaar Card</option>
            <option value="PAN">PAN Card</option>
            <option value="GST">GST Certificate</option>
            <option value="LICENSE">Shop License</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Replace File (optional)</label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', border: editKycDocFile ? '2px solid var(--primary)' : '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--mid)', background: 'var(--input-bg)', gap: 8 }}>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setEditKycDocFile(e.target.files?.[0] || null)} style={{ display: 'none' }} disabled={savingEditKycDoc} />
            {editKycDocFile ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{editKycDocFile.name}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{(editKycDocFile.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ opacity: 0.4 }} />
                <div>Click to replace file (JPG, PNG, PDF)</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Leave empty to keep current file</div>
              </>
            )}
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowEditKycDocModal(false); setEditKycDocIndex(null); setEditKycDocFile(null) }} disabled={savingEditKycDoc}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleEditKycDoc} disabled={savingEditKycDoc}>{savingEditKycDoc ? 'Saving...' : 'Update Document'}</button>
        </div>
      </Modal>

      {/* KYC Document Preview Modal */}
      {previewDoc && (
        <div className="drawer-overlay" onClick={() => setPreviewDoc(null)} style={{ zIndex: 2000 }}>
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card)', borderRadius: 16, padding: 20, zIndex: 2001, maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{previewDoc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mid)' }}>{previewDoc.docType || 'Document'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ height: 32, padding: '0 12px', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>Open in Tab</a>
                <button className="btn-icon" onClick={() => setPreviewDoc(null)} title="Close">✕</button>
              </div>
            </div>
            {previewDoc.url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth: '80vw', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', background: '#000' }} />
            ) : previewDoc.url?.match(/\.pdf$/i) ? (
              <iframe src={previewDoc.url} title={previewDoc.name} style={{ width: '80vw', height: '70vh', border: 'none', borderRadius: 8 }} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div>Preview not available for this file type</div>
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ marginTop: 12, display: 'inline-block', padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>Open File</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
