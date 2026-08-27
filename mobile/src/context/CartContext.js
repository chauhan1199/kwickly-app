import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState(null);

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cart');
      if (res.data?.status === 'success' && res.data.data) {
        setCart(res.data.data);
      } else {
        setCart(null);
      }
    } catch (e) {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToCart = useCallback(async (shopId, productId, qty = 1) => {
    try {
      setLoading(true);
      const res = await api.post('/cart', { shopId, productId, qty });
      if (res.data?.status === 'success') {
        setCart(res.data.data);
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to add item';
      if (e?.response?.status === 409) {
        return { success: false, message: msg, conflict: true };
      }
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (itemId, qty) => {
    try {
      setLoading(true);
      const res = await api.patch(`/cart/${itemId}`, { qty });
      if (res.data?.status === 'success') {
        setCart(res.data.data);
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Failed to update' };
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId) => {
    try {
      setLoading(true);
      const res = await api.delete(`/cart/${itemId}`);
      if (res.data?.status === 'success') {
        setCart(res.data.data);
        return { success: true };
      }
      setCart(null);
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Failed to remove' };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    try {
      await api.delete('/cart/clear');
      setCart(null);
      setPromoDiscount(0);
      setPromoCode(null);
    } catch (e) {
      // Cart clear failure silently ignored
    }
  }, []);

  const validatePromo = useCallback(async (code, orderAmount) => {
    try {
      const res = await api.post('/promotions/validate', { code, orderAmount });
      if (res.data?.status === 'success') {
        setPromoDiscount(res.data.data.discount);
        setPromoCode(res.data.data.code);
        return { success: true, discount: res.data.data.discount };
      }
      return { success: false, message: res.data?.message };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Invalid promo code' };
    }
  }, []);

  const removePromo = useCallback(() => {
    setPromoDiscount(0);
    setPromoCode(null);
  }, []);

  const itemCount = cart?.items?.length || 0;
  const subtotal = cart?.subtotal || 0;
  const shopCfg = (typeof cart?.shopId === 'object' ? (cart.shopId?.deliveryConfig || cart.shopId?.delivery) : {}) || {};
  const freeAbove = Number(shopCfg.freeDeliveryAbove ?? shopCfg.freeAbove ?? 1000);
  const baseCharge = Number(shopCfg.deliveryCharge ?? shopCfg.fee ?? 40);
  const computedDeliveryCharge = (subtotal >= freeAbove) ? 0 : baseCharge;
  const deliveryCharge = (itemCount > 0) ? (cart?.deliveryCharge !== undefined && cart?.deliveryCharge !== null ? cart.deliveryCharge : computedDeliveryCharge) : 0;

  const shopDiscount = cart?.discount || 0;
  const effectiveDiscount = promoDiscount > 0 ? promoDiscount : shopDiscount;
  const netItems = Math.max(0, subtotal - effectiveDiscount);
  const platformFee = (itemCount > 0 && netItems > 0) ? Math.round((netItems * 0.05) * 100) / 100 : 0;
  const gstAmount = platformFee > 0 ? Math.round((platformFee * 0.18) * 100) / 100 : 0;
  const total = itemCount > 0 ? Math.round((netItems + deliveryCharge + platformFee + gstAmount) * 100) / 100 : 0;

  return (
    <CartContext.Provider value={{
      cart, loading, itemCount, subtotal, deliveryCharge, promoDiscount: effectiveDiscount, promoCode,
      platformFee, gstAmount, total,
      shopConfig: shopCfg, freeDeliveryAbove: freeAbove, minOrderAmount: Number(shopCfg.minOrderAmount ?? shopCfg.minOrder ?? 0),
      fetchCart, addToCart, updateItem, removeItem, clearCart, validatePromo, removePromo
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
