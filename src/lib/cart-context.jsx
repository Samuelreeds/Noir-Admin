import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const CartContext = createContext(/** @type {any} */ (null));

const load = (/** @type {string} */ key, /** @type {any} */ fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * @param {{ children: React.ReactNode }} props 
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => /** @type {any[]} */ (load("atelier_cart", [])));
  const [wishlist, setWishlist] = useState(() => /** @type {string[]} */ (load("atelier_wishlist", [])));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Global timer for the cart reservation (10 minutes)
  const [cartExpiresAt, setCartExpiresAt] = useState(() => localStorage.getItem("atelier_cart_expires_at") || null);

  useEffect(() => { localStorage.setItem("atelier_cart", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("atelier_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // Expiration Checker
  useEffect(() => {
    if (!cartExpiresAt || items.length === 0) return;

    const interval = setInterval(() => {
      if (Date.now() > parseInt(cartExpiresAt, 10)) {
        // Cart Expired! Wipe everything.
        setItems([]);
        setCartExpiresAt(null);
        localStorage.removeItem("atelier_cart");
        localStorage.removeItem("atelier_cart_expires_at");
        
        // Let the user know
        alert("Your cart reservation has expired. The items have been released.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cartExpiresAt, items.length]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback((/** @type {any} */ product, /** @type {any} */ { size, color, quantity = 1, max_stock = product.inventory ?? product.stock ?? Infinity }) => {
    setItems((/** @type {any[]} */ prev) => {
      const key = `${product.id}|${size}|${color}`;
      const existing = prev.find((i) => i.key === key);
      
      if (existing) {
        // Enforce max stock limit when adding to existing items[cite: 4]
        const newQty = Math.min(existing.quantity + quantity, existing.max_stock ?? max_stock);
        return prev.map((i) => i.key === key ? { ...i, quantity: newQty } : i);
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
        quantity: Math.min(quantity, max_stock), // Enforce limit on initial add[cite: 4]
        max_stock, // Store the limit for future cart updates[cite: 4]
      }];
    });

    // Set or refresh the 10-minute timer (600,000 milliseconds)
    const expiryTime = Date.now() + 10 * 60 * 1000;
    setCartExpiresAt(expiryTime.toString());
    localStorage.setItem('atelier_cart_expires_at', expiryTime.toString());

    setDrawerOpen(true);
  }, []);

  const removeItem = useCallback((/** @type {string} */ key) => {
    setItems((/** @type {any[]} */ prev) => {
      const newItems = prev.filter((i) => i.key !== key);
      // If the cart is now empty, kill the timer
      if (newItems.length === 0) {
        setCartExpiresAt(null);
        localStorage.removeItem("atelier_cart_expires_at");
      }
      return newItems;
    });
  }, []);

  const updateQty = useCallback((/** @type {string} */ key, /** @type {number} */ quantity) => {
    setItems((/** @type {any[]} */ prev) => prev.map((i) => {
      if (i.key === key) {
        // Clamp quantity between 1 and the maximum available stock[cite: 4]
        const max = i.max_stock ?? Infinity;
        return { ...i, quantity: Math.max(1, Math.min(quantity, max)) };
      }
      return i;
    }));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCartExpiresAt(null);
    localStorage.removeItem("atelier_cart_expires_at");
  }, []);

  const toggleWishlist = useCallback((/** @type {string} */ productId) => {
    setWishlist((/** @type {string[]} */ prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + i.price * i.quantity, 0);
    const originalSubtotal = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + (i.original_price ?? i.price) * i.quantity, 0);
    const itemCount = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + i.quantity, 0);
    const shippingFee = subtotal > 250 || subtotal === 0 ? 0 : 18;
    const tax = +(subtotal * 0.08).toFixed(2);
    const total = +(subtotal + shippingFee + tax).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), originalSubtotal, itemCount, shippingFee, tax, total };
  }, [items]);

  const value = useMemo(() => ({
    items, wishlist, drawerOpen, openDrawer, closeDrawer,
    addItem, removeItem, updateQty, clearCart, toggleWishlist, totals, cartExpiresAt,
    isInWishlist: (/** @type {string} */ id) => wishlist.includes(id),
  }), [items, wishlist, drawerOpen, openDrawer, closeDrawer, addItem, removeItem, updateQty, clearCart, toggleWishlist, totals, cartExpiresAt]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}