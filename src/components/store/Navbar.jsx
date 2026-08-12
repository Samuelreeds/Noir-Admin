import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, Heart, User, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Categories", path: "/shop?view=categories" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

export default function Navbar({ onOpenSearch }) {
  const { totals, openDrawer, wishlist } = useCart();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b hairline">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-16 md:h-20 px-4 md:px-8">
          {/* left — desktop nav / mobile menu */}
          <div className="flex items-center gap-6">
            <button
              className="md:hidden p-1 -ml-1"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <nav className="hidden md:flex items-center gap-7">
              {NAV.slice(0, 3).map((n) => (
                <Link
                  key={n.label}
                  to={n.path}
                  className="label-mono text-foreground/80 hover:text-foreground transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* center — NOIR MTD Logo (Image Only) */}
          <Link 
            to="/" 
            className="flex items-center justify-center leading-none hover:opacity-80 transition-opacity"
          >
            <img 
              src="/logo.png" 
              alt="NOIR MTD Logo" 
              className="h-6 md:h-8 w-auto object-contain" 
            />
          </Link>

          {/* right — actions */}
          <div className="flex items-center justify-end gap-4 md:gap-5">
            <nav className="hidden md:flex items-center gap-7 mr-2">
              {NAV.slice(3).map((n) => (
                <Link
                  key={n.label}
                  to={n.path}
                  className="label-mono text-foreground/80 hover:text-foreground transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <button onClick={onOpenSearch} aria-label="Search" className="hover:opacity-60 transition-opacity">
              <Search size={18} strokeWidth={1.5} />
            </button>

            <Link to="/account" aria-label="Account" className="hover:opacity-60 transition-opacity hidden sm:block">
              <User size={18} strokeWidth={1.5} />
            </Link>
            <Link to="/wishlist" aria-label="Wishlist" className="relative hover:opacity-60 transition-opacity hidden sm:block">
              <Heart size={18} strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[9px] font-mono w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <button onClick={openDrawer} aria-label="Cart" className="relative hover:opacity-60 transition-opacity">
              <ShoppingBag size={18} strokeWidth={1.5} />
              {totals.itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[9px] font-mono w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {totals.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[78%] max-w-xs bg-background p-6 flex flex-col inertia-up">
            <div className="flex items-center justify-between mb-10">
              {/* Mobile Menu Logo (Image Only) */}
              <div className="flex items-center">
                <img src="/logo.png" alt="NOIR MTD Logo" className="h-6 w-auto object-contain" />
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} strokeWidth={1.5} /></button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((n, i) => (
                <button
                  key={n.label}
                  onClick={() => { setMobileOpen(false); navigate(n.path); }}
                  className="text-left font-display text-3xl tracking-[-0.04em] py-2 hover:translate-x-2 transition-transform duration-500"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-4 pt-8 border-t hairline">
              <div className="flex items-center gap-5">
                <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 label-mono"><Heart size={16} /> Wishlist</Link>
                <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 label-mono"><User size={16} /> Account</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}