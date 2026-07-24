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
  const deliveryCharge = cart?.deliveryCharge || 0;
  const total = subtotal + deliveryCharge - promoDiscount;

  return (
    <CartContext.Provider value={{
      cart, loading, itemCount, subtotal, deliveryCharge, promoDiscount, promoCode, total,
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
