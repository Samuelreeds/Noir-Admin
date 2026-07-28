import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import Reveal from "@/components/store/Reveal";

export default function About() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="grid md:grid-cols-2 min-h-[70vh] border-b hairline">
        <div className="flex flex-col justify-center p-6 md:p-14 border-b md:border-b-0 md:border-r hairline">
          <p className="label-mono text-muted-foreground mb-4">— Manifesto</p>
          <h1 className="font-display text-5xl md:text-7xl tracking-[-0.05em] leading-[0.9]">
            Not a store.<br/>An atelier.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-md text-balance">
            MONOLITHIC ATELIER is a digital architectural statement for the future of luxury commerce. We do not build storefronts — we engineer high-fidelity galleries where every garment is treated as a masterwork.
          </p>
        </div>
        <div className="relative overflow-hidden min-h-[40vh]">
          <Image src="https://media.base44.com/images/public/6a6358cd1f0a294653264a9c/660472d4b_generated_9f0d643b.png" alt="Atelier" className="w-full h-full ken-burns" fittingType="fill" />
        </div>
      </section>

      {/* Pillars */}
      <section className="py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <Reveal className="mb-12">
            <p className="label-mono text-muted-foreground mb-3">— Principles</p>
            <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Structural Minimalism.</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {[
              { n: "01", t: "Visible Architecture", d: "Hairline borders define every section, creating a blueprint-like aesthetic that honors the structure of each garment." },
              { n: "02", t: "Material Inertia", d: "Interactions follow the laws of physical mass. Elements slide into place with weighted ease, suggesting premium craftsmanship." },
              { n: "03", t: "Curated Restraint", d: "The power of negative space. We avoid clutter, allowing each object the room to command attention." },
            ].map((p, i) => (
              <Reveal key={p.n} delay={i * 90} className="bg-background p-8 md:p-10">
                <p className="font-mono text-sm text-muted-foreground mb-6">{p.n}</p>
                <h3 className="font-display text-2xl tracking-[-0.04em] mb-4">{p.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t hairline py-20 md:py-32 text-center px-6">
        <Reveal>
          <h2 className="font-display text-4xl md:text-7xl tracking-[-0.05em] leading-[0.95]">Begin the<br/>ritual of discovery.</h2>
          <Link to="/shop" className="inline-flex items-center gap-2 mt-10 label-mono border-b border-foreground pb-1 hover:gap-3 transition-all">
            Enter the Collection <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}