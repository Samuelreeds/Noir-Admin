import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import Reveal from "@/components/store/Reveal";
import ProductCard from "@/components/store/ProductCard";

/** @type {any} */
const Image = BaseImage;

const PROMO_IMG = "https://images.unsplash.com/photo-1617897903246-719242758050?q=80&w=2000&auto=format&fit=crop";

// Cosmetic-focused Category Tiles
const CATEGORY_TILES = [
  { label: "Face", path: "/shop?category=Face", img: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=800&auto=format&fit=crop" },
  { label: "Lips", path: "/shop?category=Lips", img: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?q=80&w=800&auto=format&fit=crop" },
  { label: "Eyes", path: "/shop?category=Eyes", img: "https://images.unsplash.com/photo-1512496015851-a1dc8a47781b?q=80&w=800&auto=format&fit=crop" },
  { label: "Skincare", path: "/shop?category=Skincare", img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800&auto=format&fit=crop" },
];

// Fallback images for the slider if the admin hasn't uploaded any
const FALLBACK_SLIDER_IMAGES = [
  "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?q=80&w=2071&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512496015851-a1dc8a47781b?q=80&w=2000&auto=format&fit=crop"
];

export default function Home() {
  const [products, setProducts] = useState(/** @type {any[]} */ ([]));
  const [settings, setSettings] = useState(/** @type {any} */ (null));
  const [loading, setLoading] = useState(true);
  const rackRef = useRef(/** @type {any} */ (null));
  
  // Image Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, settingsRes] = await Promise.all([
          supabase.from("products").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(60),
          supabase.from("store_settings").select("*").eq("id", 1).single()
        ]);

        if (prodRes.data) setProducts(prodRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);

      } catch (e) {
        console.error("Error loading home data:", e);
      }
      setLoading(false);
    })();
  }, []);

  const featured = products.filter((/** @type {any} */ p) => p.featured).slice(0, 8);
  const newArrivals = products.filter((/** @type {any} */ p) => p.is_new).slice(0, 6);
  const bestSellers = products.filter((/** @type {any} */ p) => p.is_best_seller).slice(0, 6);

  // Safely fallback to admin settings
  const heroHeading = settings?.hero_heading || "WELCOME TO\nNOIR MTD";
  const heroSubheading = settings?.hero_subheading || "Discover our latest collection.";
  const heroBtnText = settings?.hero_button_text || "Shop Now";
  const heroBtnLink = settings?.hero_button_link || "/shop";
  
  // Pull the 3 slider images from the database, filtering out empty ones
  const dbImages = [
    settings?.hero_image_1,
    settings?.hero_image_2,
    settings?.hero_image_3
  ].filter(Boolean);

  // If the admin uploaded images, use them. Otherwise, use the fallback defaults.
  const sliderImages = dbImages.length > 0 ? dbImages : FALLBACK_SLIDER_IMAGES;

  // Auto-advance slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000); // Changes image every 5 seconds
    return () => clearInterval(timer);
  }, [sliderImages.length]);

  const scrollRack = (/** @type {number} */ dir) => {
    const el = rackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="bg-background">
      {/* HERO — Dynamic via Admin Web Setup */}
      <section className="grid md:grid-cols-[42%_58%] min-h-[92vh] border-b hairline">
        <div className="flex flex-col justify-center p-6 md:p-10 lg:p-14 order-2 md:order-1 border-t md:border-t-0 md:border-r hairline relative bg-white z-20">
          
          <div className="py-10 md:py-0">
            <h1 className="font-display text-[12vw] md:text-[6vw] leading-[0.88] tracking-[-0.05em] inertia-up whitespace-pre-line uppercase">
              {heroHeading}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-sm text-balance">
              {heroSubheading}
            </p>
          </div>
          
          <div className="absolute bottom-6 md:bottom-10 lg:bottom-14 left-6 md:left-10 lg:left-14 flex items-center gap-4">
            <Link to={heroBtnLink} className="group flex items-center gap-2 label-mono border-b border-foreground pb-1 hover:gap-3 transition-all uppercase text-xs font-semibold">
              {heroBtnText} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/about" className="label-mono text-muted-foreground hover:text-foreground transition-colors pb-1 uppercase text-xs ml-4">
              The Philosophy
            </Link>
          </div>
        </div>

        {/* IMAGE SLIDER */}
        <div className="relative overflow-hidden order-1 md:order-2 min-h-[50vh] md:min-h-0 bg-slate-100">
          {sliderImages.map((img, idx) => (
            <div 
              key={idx}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <Image src={img} alt={`Hero Slider Image ${idx + 1}`} className="w-full h-full object-cover ken-burns" fittingType="cover" />
            </div>
          ))}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20" />
          
          {/* Slider Indicators */}
          {sliderImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">
               {sliderImages.map((_, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => setCurrentSlide(idx)}
                   className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/80'}`}
                   aria-label={`Go to slide ${idx + 1}`}
                 />
               ))}
            </div>
          )}

          <div className="absolute bottom-6 right-6 hidden md:block z-30">
            <Link to={heroBtnLink} className="glass-dark text-white w-24 h-24 rounded-full flex flex-col items-center justify-center label-mono text-center hover:scale-105 transition-transform duration-500 uppercase text-xs tracking-wider">
              Shop<br/>Now
            </Link>
          </div>
        </div>
      </section>

      {/* Cosmetic Marquee strip */}
      <div className="overflow-hidden border-b hairline py-4 bg-foreground text-background">
        <div className="flex marquee-track whitespace-nowrap">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex items-center shrink-0">
              {["Cruelty-Free Formulas", "—", "Botanical Extracts", "—", "Dermatologist Tested", "—", "Radiant Finish", "—", "Clean Beauty", "—"].map((t, i) => (
                <span key={i} className="label-mono mx-6 opacity-80">{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="flex items-end justify-between mb-10">
              <div>
                <p className="label-mono text-muted-foreground mb-3">— Featured</p>
                <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">The Edit.</h2>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <button onClick={() => scrollRack(-1)} className="w-11 h-11 border hairline flex items-center justify-center hover:bg-foreground hover:text-background transition-colors" aria-label="Scroll left">←</button>
                <button onClick={() => scrollRack(1)} className="w-11 h-11 border hairline flex items-center justify-center hover:bg-foreground hover:text-background transition-colors" aria-label="Scroll right">→</button>
              </div>
            </Reveal>
          </div>
          <div ref={rackRef} className="flex gap-5 overflow-x-auto no-scrollbar px-4 md:px-8 pb-4 snap-x">
            {featured.map((/** @type {any} */ p, /** @type {number} */ i) => (
              <div key={p.id} className="w-[78vw] sm:w-[46vw] md:w-[30vw] lg:w-[22vw] shrink-0 snap-start">
                <ProductCard product={p} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="border-y hairline py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <Reveal className="mb-10">
            <p className="label-mono text-muted-foreground mb-3">— Departments</p>
            <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Browse by Category.</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {CATEGORY_TILES.map((/** @type {any} */ c, /** @type {number} */ i) => (
              <Reveal key={c.label} delay={i * 80}>
                <Link to={c.path} className="group relative block aspect-[4/5] overflow-hidden bg-muted">
                  <Image src={c.img} alt={c.label} className="w-full h-full group-hover:scale-105 transition-transform duration-[1.2s] cubic-bezier(0.16,1,0.3,1)" fittingType="cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white flex items-end justify-between">
                    <span className="font-display text-xl md:text-2xl tracking-[-0.04em]">{c.label}</span>
                    <ArrowUpRight size={18} strokeWidth={1.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="flex items-end justify-between mb-10">
              <div>
                <p className="label-mono text-muted-foreground mb-3">— Just Arrived</p>
                <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">New Formulas.</h2>
              </div>
              <Link to="/shop?filter=new" className="label-mono border-b border-foreground pb-1 hover:opacity-60 transition-opacity hidden md:inline-block">View All</Link>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-5 gap-y-10">
              {newArrivals.map((/** @type {any} */ p, /** @type {number} */ i) => (
                <Reveal key={p.id} delay={(i % 3) * 80}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COSMETIC PROMO BANNER */}
      <section className="relative overflow-hidden border-y hairline">
        <div className="relative h-[60vh] md:h-[70vh]">
          <Image src={PROMO_IMG} alt="Cosmetics Campaign" className="w-full h-full" fittingType="cover" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
            <Reveal>
              <p className="label-mono text-white/80 mb-4">— The Skin-First Approach</p>
              <h2 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-[-0.05em] leading-[0.9]">The Signature<br/>Glow Series.</h2>
              <Link to="/shop" className="inline-flex items-center gap-2 mt-8 label-mono border border-white/50 px-6 py-3 hover:bg-white hover:text-black transition-colors">
                Discover <ArrowRight size={14} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* BEST SELLERS */}
      {bestSellers.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="flex items-end justify-between mb-10">
              <div>
                <p className="label-mono text-muted-foreground mb-3">— Most Coveted</p>
                <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Cult Favorites.</h2>
              </div>
              <Link to="/shop?filter=best" className="label-mono border-b border-foreground pb-1 hover:opacity-60 transition-opacity hidden md:inline-block">View All</Link>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
              {bestSellers.map((/** @type {any} */ p, /** @type {number} */ i) => (
                <Reveal key={p.id} delay={(i % 3) * 80}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {loading && (
        <div className="py-32 flex items-center justify-center">
          <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}