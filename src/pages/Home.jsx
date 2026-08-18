// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import Reveal from "@/components/store/Reveal";
import ProductCard from "@/components/store/ProductCard";

/** @type {any} */
const Image = BaseImage;

const FALLBACK_CATEGORIES = [
  { title: "Face", image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=800&auto=format&fit=crop" },
  { title: "Lips", image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?q=80&w=800&auto=format&fit=crop" },
  { title: "Eyes", image: "https://images.unsplash.com/photo-1512496015851-a1dc8a47781b?q=80&w=800&auto=format&fit=crop" },
  { title: "Skincare", image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800&auto=format&fit=crop" },
];

const FALLBACK_SLIDER_IMAGES = [
  { image_url: "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?q=80&w=2071&auto=format&fit=crop" }
];

export default function Home() {
  const [products, setProducts] = useState(/** @type {any[]} */ ([]));
  const [settings, setSettings] = useState(/** @type {any} */ (null));
  const [sliders, setSliders] = useState(/** @type {any[]} */ ([]));
  const [dbCategories, setDbCategories] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const rackRef = useRef(/** @type {any} */ (null));
  
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // AD MODAL STATES
  const [activeAd, setActiveAd] = useState(/** @type {any} */ (null));
  const [showAdModal, setShowAdModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, settingsRes, slidersRes, catRes, adRes] = await Promise.all([
          supabase.from("products").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(60),
          supabase.from("store_settings").select("*").eq("id", 1).single(),
          supabase.from("sliders").select("*").eq("status", true).order("ordering", { ascending: true }),
          supabase.from("categories").select("*").eq("status", true).order("ordering", { ascending: true }),
          // Fetch the first active advertisement from the advertisements table
          supabase.from("advertisements").select("*").eq("status", "active").order("ordering", { ascending: true }).limit(1)
        ]);

        if (prodRes.data) setProducts(prodRes.data);
        if (slidersRes.data) setSliders(slidersRes.data);
        if (catRes.data) setDbCategories(catRes.data);
        if (adRes.data && adRes.data.length > 0) setActiveAd(adRes.data[0]);
        
        if (settingsRes.error) console.error("Store Settings Fetch Error:", settingsRes.error);
        if (settingsRes.data) {
          setSettings(settingsRes.data);
          
          // Trigger Ad Modal if globally enabled AND an active ad exists AND user hasn't seen it yet this session
          if (settingsRes.data.ad_modal_enabled && adRes.data && adRes.data.length > 0 && !sessionStorage.getItem('noir_ad_seen')) {
            setTimeout(() => {
              setShowAdModal(true);
            }, 2000); // 2-second delay so it's less aggressive
          }
        }

      } catch (e) {
        console.error("Error loading home data:", e);
      }
      setLoading(false);
    })();
  }, []);

  const closeAdModal = () => {
    setShowAdModal(false);
    sessionStorage.setItem('noir_ad_seen', 'true');
  };

  const featured = products.filter((/** @type {any} */ p) => p.featured).slice(0, 8);
  const newArrivals = products.filter((/** @type {any} */ p) => p.is_new).slice(0, 6);
  const bestSellers = products.filter((/** @type {any} */ p) => p.is_best_seller).slice(0, 6);

  // --- DYNAMIC HERO VARIABLES ---
  let heroHeading = settings?.hero_heading || "WELCOME TO NOIR";
  if (heroHeading.includes("BARE") || heroHeading.includes("BEAUTY BEGINS")) heroHeading = "WELCOME TO NOIR";
  let heroSubheading = settings?.hero_subheading || "DISCOVER OUR LATEST COLLECTION.";
  if (heroSubheading.includes("HIGH QUALITY")) heroSubheading = "DISCOVER OUR LATEST COLLECTION.";

  const promoHeading = settings?.promo_heading || "The Signature Glow Series.";
  const promoSubheading = settings?.promo_subheading || "The Skin-First Approach";
  const promoImage = settings?.promo_image || "https://images.unsplash.com/photo-1617897903246-719242758050?q=80&w=2000&auto=format&fit=crop";
  const promoBtnText = settings?.promo_button_text || "Discover";
  const promoBtnLink = settings?.promo_button_link || "/shop";

  const activeSliders = sliders.length > 0 ? sliders : FALLBACK_SLIDER_IMAGES;
  const activeCategories = dbCategories.length > 0 ? dbCategories : FALLBACK_CATEGORIES;
  
  const currentSliderData = activeSliders[currentSlide] || {};
  const heroBtnText = currentSliderData.cta_text_en || settings?.hero_button_text || "SHOP NOW";
  const heroBtnLink = currentSliderData.cta_link || settings?.hero_button_link || "/shop";
  const ctaEnabled = currentSliderData.cta_enabled !== false;

  useEffect(() => {
    if (activeSliders.length <= 1) return;
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % activeSliders.length), 5000);
    return () => clearInterval(timer);
  }, [activeSliders.length]);

  const scrollRack = (/** @type {number} */ dir) => {
    const el = rackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="bg-background">
      <section className="flex flex-col border-b hairline">
        {/* Swipe Slider Container */}
        <div className="relative w-full h-[50vh] md:h-[65vh] overflow-hidden bg-slate-100">
          <div 
            className="flex h-full w-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {activeSliders.map((slide, idx) => (
              <div key={slide.id || idx} className="w-full h-full shrink-0 relative">
                <Image src={slide.image_url} alt={`Hero Slider Image ${idx + 1}`} className="w-full h-full object-cover object-center" fittingType="cover" />
              </div>
            ))}
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none z-20" />
          
          {activeSliders.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
               {activeSliders.map((_, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => setCurrentSlide(idx)}
                   className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-black w-8' : 'bg-black/30 w-2 hover:bg-black/50'}`}
                   aria-label={`Go to slide ${idx + 1}`}
                 />
               ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center text-center py-12 md:py-16 px-6 bg-background">
          <h1 className="font-display text-2xl md:text-4xl tracking-[-0.03em] uppercase max-w-4xl text-balance">
            {heroHeading}
          </h1>
          <p className="text-muted-foreground mt-3 text-xs md:text-sm tracking-wider uppercase">
            {heroSubheading}
          </p>
          
          {ctaEnabled && (
            <div className="mt-8">
              <Link to={heroBtnLink} className="inline-block bg-black text-white px-8 py-3.5 label-mono text-xs uppercase tracking-widest transition-transform duration-300 hover:scale-105">
                {heroBtnText}
              </Link>
            </div>
          )}
        </div>
      </section>

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

      <section className="border-y hairline py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <Reveal className="mb-10">
            <p className="label-mono text-muted-foreground mb-3">— Departments</p>
            <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Browse by Category.</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {activeCategories.map((/** @type {any} */ cat, /** @type {number} */ i) => {
              const catTitle = cat.title || cat.name;
              return (
                <Reveal key={cat.id || catTitle} delay={i * 80}>
                  <Link to={`/shop?category=${encodeURIComponent(catTitle)}`} className="group relative block aspect-[4/5] overflow-hidden bg-muted">
                    <Image src={cat.image} alt={catTitle} className="w-full h-full group-hover:scale-105 transition-transform duration-[1.2s]" fittingType="cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white flex items-end justify-between">
                      <span className="font-display text-xl md:text-2xl tracking-[-0.04em]">{catTitle}</span>
                      <ArrowUpRight size={18} strokeWidth={1.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

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

      {/* --- DYNAMIC PROMO BANNER --- */}
      <section className="relative overflow-hidden border-y hairline">
        <div className="relative h-[60vh] md:h-[70vh]">
          <Image src={promoImage} alt="Promo Campaign" className="w-full h-full object-cover object-center" fittingType="cover" />
          
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
            <Reveal>
              <p className="label-mono text-white/80 mb-4">— {promoSubheading}</p>
              <h2 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-[-0.05em] leading-[0.9]" dangerouslySetInnerHTML={{ __html: String(promoHeading).replace(/\n/g, '<br/>') }} />
              <Link to={promoBtnLink} className="inline-flex items-center gap-2 mt-8 label-mono border border-white/50 px-6 py-3 text-white transition-transform duration-300 hover:scale-105">
                {promoBtnText} <ArrowRight size={14} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

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

      {/* --- DYNAMIC ADVERTISEMENT MODAL (Fetched from 'advertisements' table) --- */}
      {showAdModal && activeAd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={closeAdModal} 
          />
          <div className="relative z-10 w-full max-w-[450px] bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-500 overflow-hidden border hairline flex flex-col">
            
            <button 
              onClick={closeAdModal}
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full transition-colors"
              aria-label="Close Advertisement"
            >
              <X size={18} strokeWidth={2} />
            </button>
            
            {activeAd.image && (
              <Link to={activeAd.redirect_to || '/shop'} onClick={closeAdModal} className="block w-full relative aspect-[4/3] bg-muted">
                <Image src={activeAd.image} alt={activeAd.title || "Advertisement"} className="w-full h-full object-cover" fittingType="cover" />
              </Link>
            )}
            
            {(activeAd.title || activeAd.subtitle || activeAd.redirect_label) && (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-white">
                {activeAd.title && <h2 className="font-display text-2xl md:text-3xl tracking-[-0.03em] uppercase mb-2">{activeAd.title}</h2>}
                {activeAd.subtitle && <p className="text-muted-foreground text-sm mb-6">{activeAd.subtitle}</p>}
                
                {activeAd.redirect_label && (
                  <Link to={activeAd.redirect_to || '/shop'} onClick={closeAdModal} className="inline-block bg-black text-white px-8 py-3 label-mono text-xs uppercase tracking-widest transition-transform hover:scale-105">
                    {activeAd.redirect_label}
                  </Link>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}