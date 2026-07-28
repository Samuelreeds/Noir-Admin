import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { CartProvider } from "@/lib/cart-context";
import ScrollProgress from "./ScrollProgress";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import SearchOverlay from "./SearchOverlay";

export default function StoreLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <ScrollProgress />
        <Navbar onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <CartDrawer />
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </CartProvider>
  );
}