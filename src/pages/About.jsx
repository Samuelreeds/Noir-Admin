// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import Reveal from "@/components/store/Reveal";
import { supabase } from "@/lib/supabase";
import { useQuery } from '@tanstack/react-query';

export default function About() {
  // Fetch dynamic content from store_settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['store-settings-about'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('about_heading, about_text, about_image, about_principles_heading, about_p1_title, about_p1_desc, about_p2_title, about_p2_desc, about_p3_title, about_p3_desc, about_cta_heading, about_cta_button_text, about_cta_button_link')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return /** @type {any} */ (data || {});
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active events (Now serving as Past Archives)
  const { data: events = [] } = useQuery({
    queryKey: ['store-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fallbacks for Hero
  const heading = settings?.about_heading || "Not a store.\nAn atelier.";
  const text = settings?.about_text || "MONOLITHIC ATELIER is a digital architectural statement for the future of luxury commerce. We do not build storefronts — we engineer high-fidelity galleries where every garment is treated as a masterwork.";
  const imageUrl = settings?.about_image || "https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/660472d4b_generated_9f0d643b.png";

  // Fallbacks for Principles
  const principlesHeading = settings?.about_principles_heading || "Structural Minimalism.";
  const principles = [
    { n: "01", t: settings?.about_p1_title || "Visible Architecture", d: settings?.about_p1_desc || "Hairline borders define every section, creating a blueprint-like aesthetic that honors the structure of each garment." },
    { n: "02", t: settings?.about_p2_title || "Material Inertia", d: settings?.about_p2_desc || "Interactions follow the laws of physical mass. Elements slide into place with weighted ease, suggesting premium craftsmanship." },
    { n: "03", t: settings?.about_p3_title || "Curated Restraint", d: settings?.about_p3_desc || "The power of negative space. We avoid clutter, allowing each object the room to command attention." },
  ];

  // Fallbacks for CTA
  const ctaHeading = settings?.about_cta_heading || "Begin the\nritual of discovery.";
  const ctaButtonText = settings?.about_cta_button_text || "Enter the Collection";
  const ctaButtonLink = settings?.about_cta_button_link || "/shop";

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="grid md:grid-cols-2 min-h-[70vh] border-b hairline">
        <div className="flex flex-col justify-center p-6 md:p-14 border-b md:border-b-0 md:border-r hairline">
          <p className="label-mono text-muted-foreground mb-4">— Manifesto</p>
          
          {isLoading ? (
            <div className="space-y-4 max-w-md">
              <div className="h-16 bg-muted/60 rounded animate-pulse w-3/4"></div>
              <div className="h-16 bg-muted/60 rounded animate-pulse w-1/2"></div>
              <div className="h-4 bg-muted/60 rounded animate-pulse w-full mt-6"></div>
              <div className="h-4 bg-muted/60 rounded animate-pulse w-5/6"></div>
              <div className="h-4 bg-muted/60 rounded animate-pulse w-2/3"></div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-5xl md:text-7xl tracking-[-0.05em] leading-[0.9] whitespace-pre-wrap">
                {heading}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-md text-balance whitespace-pre-wrap">
                {text}
              </p>
            </>
          )}
        </div>
        <div className="relative overflow-hidden min-h-[40vh]">
          {isLoading ? (
            <div className="w-full h-full bg-muted animate-pulse" />
          ) : (
            <Image src={imageUrl} alt="Atelier Manifesto" className="w-full h-full ken-burns" fittingType="cover" />
          )}
        </div>
      </section>

      {/* Pillars */}
      <section className="py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <Reveal className="mb-12">
            <p className="label-mono text-muted-foreground mb-3">— Principles</p>
            {isLoading ? (
               <div className="h-12 bg-muted/60 rounded animate-pulse w-64"></div>
            ) : (
              <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em] whitespace-pre-wrap">
                {principlesHeading}
              </h2>
            )}
          </Reveal>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {principles.map((p, i) => (
              <Reveal key={p.n} delay={i * 90} className="bg-background p-8 md:p-10">
                <p className="font-mono text-sm text-muted-foreground mb-6">{p.n}</p>
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-6 bg-muted/60 rounded animate-pulse w-3/4"></div>
                    <div className="h-4 bg-muted/60 rounded animate-pulse w-full mt-4"></div>
                    <div className="h-4 bg-muted/60 rounded animate-pulse w-5/6"></div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-display text-2xl tracking-[-0.04em] mb-4">{p.t}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{p.d}</p>
                  </>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Events (Archive) */}
      {events.length > 0 && (
        <section className="py-16 md:py-24 border-t hairline">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="mb-12">
              <p className="label-mono text-muted-foreground mb-3">— Archive</p>
              <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Past Exhibitions & Pop-Ups.</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
              {events.map((ev, i) => (
                <Reveal key={ev.id} delay={i * 80} className="group cursor-pointer">
                  {/* CHANGED: aspect-[4/3] is now aspect-[4/5] to perfectly fit 2160x2700 px */}
                  <div className="aspect-[4/5] bg-muted mb-6 overflow-hidden relative border hairline">
                    {ev.image_url ? (
                      <Image src={ev.image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" fittingType="cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">NO IMAGE</div>
                    )}
                  </div>
                  
                  {(ev.event_date || ev.location) && (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground mb-3 uppercase tracking-wider">
                      {ev.event_date && <span>{ev.event_date}</span>}
                      {ev.event_date && ev.location && <span>·</span>}
                      {ev.location && <span>{ev.location}</span>}
                    </div>
                  )}
                  
                  <h3 className="font-display text-2xl tracking-[-0.03em] mb-3">{ev.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">{ev.description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t hairline py-20 md:py-32 text-center px-6">
        <Reveal>
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="h-16 bg-muted/60 rounded animate-pulse w-full max-w-lg mb-2"></div>
              <div className="h-16 bg-muted/60 rounded animate-pulse w-full max-w-sm"></div>
            </div>
          ) : (
            <h2 className="font-display text-4xl md:text-7xl tracking-[-0.05em] leading-[0.95] whitespace-pre-wrap">
              {ctaHeading}
            </h2>
          )}
          <Link to={ctaButtonLink} className="inline-flex items-center gap-2 mt-10 label-mono border-b border-foreground pb-1 hover:gap-3 transition-all">
            {ctaButtonText} <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}