import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const CartContext = createContext(null);

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => load("atelier_cart", []));
  const [wishlist, setWishlist] = useState(() => load("atelier_wishlist", []));
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { localStorage.setItem("atelier_cart", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("atelier_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback((product, { size, color, quantity = 1 }) => {
    setItems((prev) => {
      const key = `${product.id}|${size}|${color}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => i.key === key ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, {
        key,
        product_id: product.id,
        name: product.name,
        price: product.discount_price != null ? product.discount_price : product.price,
        original_price: product.price,
        image: product.images?.[0],
        size,
        color,
        quantity,
      }];
    });
    setDrawerOpen(true);
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQty = useCallback((key, quantity) => {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, quantity: Math.max(1, quantity) } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const toggleWishlist = useCallback((productId) => {
    setWishlist((prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const originalSubtotal = items.reduce((s, i) => s + (i.original_price ?? i.price) * i.quantity, 0);
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    const shippingFee = subtotal > 250 || subtotal === 0 ? 0 : 18;
    const tax = +(subtotal * 0.08).toFixed(2);
    const total = +(subtotal + shippingFee + tax).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), originalSubtotal, itemCount, shippingFee, tax, total };
  }, [items]);

  const value = useMemo(() => ({
    items, wishlist, drawerOpen, openDrawer, closeDrawer,
    addItem, removeItem, updateQty, clearCart, toggleWishlist, totals,
    isInWishlist: (id) => wishlist.includes(id),
  }), [items, wishlist, drawerOpen, openDrawer, closeDrawer, addItem, removeItem, updateQty, clearCart, toggleWishlist, totals]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}