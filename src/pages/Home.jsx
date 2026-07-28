import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import Reveal from "@/components/store/Reveal";
import ProductCard from "@/components/store/ProductCard";

const HERO_IMG = "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/9b06cbdbd_generated_a286cb60.png";
const PROMO_IMG = "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/660472d4b_generated_9f0d643b.png";

const CATEGORY_TILES = [
  { label: "Outerwear", path: "/shop?category=Outerwear", img: "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/163f6944e_generated_124de371.png" },
  { label: "Shirting", path: "/shop?category=Shirting", img: "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/77f99bcbe_generated_4a54556b.png" },
  { label: "Trousers", path: "/shop?category=Trousers", img: "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/414cbd925_generated_0b6b8133.png" },
  { label: "Knitwear", path: "/shop?category=Knitwear", img: "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/f84ca4809_generated_834125e8.png" },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const rackRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Product.list("-created_date", 60);
        setProducts(list.filter((p) => p.status !== "archived"));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const featured = products.filter((p) => p.featured).slice(0, 8);
  const newArrivals = products.filter((p) => p.is_new).slice(0, 6);
  const bestSellers = products.filter((p) => p.is_best_seller).slice(0, 6);

  const scrollRack = (dir) => {
    const el = rackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="bg-background">
      {/* HERO — The Grand Entrance */}
      <section className="grid md:grid-cols-[42%_58%] min-h-[92vh] border-b hairline">
        <div className="flex flex-col justify-between p-6 md:p-10 lg:p-14 order-2 md:order-1 border-t md:border-t-0 md:border-r hairline">
          <div className="flex items-center justify-between">
            <span className="label-mono text-muted-foreground">— F/W 26 Collection</span>
            <span className="label-mono text-muted-foreground">Vol. 01</span>
          </div>
          <div className="py-10 md:py-0">
            <h1 className="font-display text-[14vw] md:text-[8vw] leading-[0.88] tracking-[-0.05em] inertia-up">
              Structural<br/>Minimalism.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-sm text-balance">
              A high-fidelity gallery where every garment is treated as a masterwork. Engineered for those who understand that restraint is the ultimate luxury.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/shop" className="group flex items-center gap-2 label-mono border-b border-foreground pb-1 hover:gap-3 transition-all">
              Shop the Collection <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/about" className="label-mono text-muted-foreground hover:text-foreground transition-colors pb-1">
              The Philosophy
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden order-1 md:order-2 min-h-[50vh] md:min-h-0 group">
          <Image src={HERO_IMG} alt="Monolithic Atelier Hero" className="w-full h-full ken-burns" fittingType="fill" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          <div className="absolute bottom-6 right-6 hidden md:block">
            <Link to="/shop" className="glass-dark text-white w-24 h-24 rounded-full flex flex-col items-center justify-center label-mono text-center hover:scale-105 transition-transform duration-500">
              Shop<br/>Now
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee strip */}
      <div className="overflow-hidden border-b hairline py-4">
        <div className="flex marquee-track whitespace-nowrap">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex items-center shrink-0">
              {["Complimentary Global Shipping", "—", "Archival Editorials", "—", "Structural Minimalism", "—", "F/W 26 Release", "—", "Private Access", "—"].map((t, i) => (
                <span key={i} className="label-mono mx-6 text-muted-foreground">{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED — The Infinite Rack (horizontal) */}
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
            {featured.map((p, i) => (
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
            <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Browse by Form.</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {CATEGORY_TILES.map((c, i) => (
              <Reveal key={c.label} delay={i * 80}>
                <Link to={c.path} className="group relative block aspect-[4/5] overflow-hidden bg-muted">
                  <Image src={c.img} alt={c.label} className="w-full h-full group-hover:scale-105 transition-transform duration-[1.2s] cubic-bezier(0.16,1,0.3,1)" fittingType="fill" />
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
                <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">New Arrivals.</h2>
              </div>
              <Link to="/shop?filter=new" className="label-mono border-b border-foreground pb-1 hover:opacity-60 transition-opacity hidden md:inline-block">View All</Link>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-5 gap-y-10">
              {newArrivals.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 80}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROMO BANNER */}
      <section className="relative overflow-hidden border-y hairline">
        <div className="relative h-[60vh] md:h-[70vh]">
          <Image src={PROMO_IMG} alt="Seasonal Campaign" className="w-full h-full" fittingType="fill" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
            <Reveal>
              <p className="label-mono text-white/70 mb-4">— Limited Release</p>
              <h2 className="font-display text-5xl md:text-8xl tracking-[-0.05em] leading-[0.9]">The Obsidian<br/>Series.</h2>
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
                <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Best Sellers.</h2>
              </div>
              <Link to="/shop?filter=best" className="label-mono border-b border-foreground pb-1 hover:opacity-60 transition-opacity hidden md:inline-block">View All</Link>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
              {bestSellers.map((p, i) => (
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