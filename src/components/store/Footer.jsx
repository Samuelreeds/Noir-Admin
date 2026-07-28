import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter, Youtube, ArrowRight } from "lucide-react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setEmail("");
    setTimeout(() => setSent(false), 3500);
  };

  return (
    <footer className="bg-[#050505] text-white">
      {/* Newsletter band */}
      <div className="border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="label-mono text-white/50 mb-4">— Dispatch 01</p>
            <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-[0.95]">
              Enter the<br />Atelier.
            </h2>
            <p className="text-white/60 mt-5 max-w-md">
              Receive private releases, archival editorials, and early access to seasonal drops. No noise — only signal.
            </p>
          </div>
          <form onSubmit={submit} className="w-full">
            <div className="flex items-center border-b border-white/30 focus-within:border-white transition-colors py-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-transparent outline-none text-white placeholder:text-white/30 font-mono text-sm"
              />
              <button type="submit" className="flex items-center gap-2 label-mono text-white hover:gap-3 transition-all">
                Subscribe <ArrowRight size={14} />
              </button>
            </div>
            {sent && <p className="label-mono text-white/70 mt-3">— Welcome. You are on the list.</p>}
          </form>
        </div>
      </div>

      {/* Link columns */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-14 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <Link to="/" className="font-display text-xl font-semibold tracking-[-0.04em]">MONOLITHIC ATELIER</Link>
          <p className="text-white/50 text-sm mt-4 max-w-xs">
            Structural Minimalism for luxury fashion. A digital gallery where every garment is a masterwork.
          </p>
        </div>
        <div>
          <p className="label-mono text-white/40 mb-4">Shop</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link to="/shop" className="hover:text-white">All Products</Link></li>
            <li><Link to="/shop?gender=men" className="hover:text-white">Men</Link></li>
            <li><Link to="/shop?gender=women" className="hover:text-white">Women</Link></li>
            <li><Link to="/shop?filter=new" className="hover:text-white">New Arrivals</Link></li>
            <li><Link to="/shop?filter=best" className="hover:text-white">Best Sellers</Link></li>
          </ul>
        </div>
        <div>
          <p className="label-mono text-white/40 mb-4">House</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link to="/about" className="hover:text-white">About</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link to="/shop" className="hover:text-white">Categories</Link></li>
            <li><a href="tel:+10000000000" className="hover:text-white">+1 (000) 000-0000</a></li>
          </ul>
        </div>
        <div>
          <p className="label-mono text-white/40 mb-4">Legal</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link to="/about" className="hover:text-white">Privacy</Link></li>
            <li><Link to="/about" className="hover:text-white">Terms</Link></li>
            <li><Link to="/about" className="hover:text-white">Shipping</Link></li>
            <li><Link to="/about" className="hover:text-white">Returns</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="label-mono text-white/40">© {new Date().getFullYear()} Monolithic Atelier — All Rights Reserved</p>
          <div className="flex items-center gap-5">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="text-white/60 hover:text-white"><Instagram size={16} strokeWidth={1.5} /></a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter" className="text-white/60 hover:text-white"><Twitter size={16} strokeWidth={1.5} /></a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="Youtube" className="text-white/60 hover:text-white"><Youtube size={16} strokeWidth={1.5} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}