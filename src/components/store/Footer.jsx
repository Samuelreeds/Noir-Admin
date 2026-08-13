import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Send, ArrowRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white pt-20 pb-10 border-t border-slate-900 mt-auto">
      {/* Top Section - Newsletter */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 mb-24 grid md:grid-cols-2 gap-12 items-end">
        <div>
          <p className="label-mono text-xs text-slate-400 mb-6 tracking-widest uppercase">— DISPATCH 01</p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-[-0.04em] leading-tight mb-6">
            JOIN<br/>NOIR MTD.
          </h2>
          <p className="text-slate-400 text-sm max-w-md leading-relaxed">
            Receive private releases, archival editorials, and early access to seasonal drops. No noise — only signal.
          </p>
        </div>
        <div className="relative">
          <input 
            type="email" 
            placeholder="your@email.com" 
            className="w-full bg-transparent border-b border-slate-700 py-4 pr-32 outline-none focus:border-white transition-colors font-mono text-sm text-white placeholder:text-slate-500"
          />
          <button className="absolute right-0 top-1/2 -translate-y-1/2 label-mono text-xs tracking-widest uppercase hover:text-slate-300 transition-colors flex items-center gap-2">
            Subscribe <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Middle Section - Links */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-4 gap-12 pb-16 border-b border-slate-900">
        
        {/* Column 1: Brand Info */}
        <div className="md:col-span-1">
          <h3 className="font-display text-lg tracking-[-0.02em] mb-4 uppercase">NOIR MTD</h3>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Structural Minimalism for luxury fashion. A digital gallery where every garment is a masterwork.
          </p>
        </div>
        
        {/* Column 2: Shop */}
        <div>
          <h4 className="label-mono text-[10px] text-slate-500 tracking-widest uppercase mb-6">Shop</h4>
          <ul className="space-y-4 text-sm text-slate-300">
            <li><Link to="/shop" className="hover:text-white transition-colors">All Products</Link></li>
            <li><Link to="/shop?filter=new" className="hover:text-white transition-colors">New Arrivals</Link></li>
            <li><Link to="/shop?filter=best" className="hover:text-white transition-colors">Best Sellers</Link></li>
          </ul>
        </div>

        {/* Column 3: House & Contact */}
        <div>
          <h4 className="label-mono text-[10px] text-slate-500 tracking-widest uppercase mb-6">House</h4>
          <ul className="space-y-4 text-sm text-slate-300">
            <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">Categories</Link></li>
            {/* Contact Details */}
            <li className="pt-2 font-mono text-xs text-slate-400">096 665 6698</li>
            <li className="font-mono text-xs text-slate-400">noirmtd@gmail.com</li>
          </ul>
        </div>

        {/* Column 4: Legal */}
        <div>
          <h4 className="label-mono text-[10px] text-slate-500 tracking-widest uppercase mb-6">Legal</h4>
          <ul className="space-y-4 text-sm text-slate-300">
            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-white transition-colors">Terms</Link></li>
            <li><Link to="/shipping" className="hover:text-white transition-colors">Shipping</Link></li>
            <li><Link to="/returns" className="hover:text-white transition-colors">Returns</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom Section - Copyright & Socials */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="label-mono text-[10px] text-slate-500 tracking-widest uppercase">
          © {new Date().getFullYear()} NOIR MTD — All Rights Reserved
        </p>
        
        <div className="flex items-center gap-6 text-slate-400">
          <a href="https://www.instagram.com/noirmtd/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="Instagram">
            <Instagram size={18} />
          </a>
          <a href="https://www.facebook.com/profile.php?id=61592560277118" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="Facebook">
            <Facebook size={18} />
          </a>
          <a href="https://t.me/jyongwang" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="Telegram">
            <Send size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}