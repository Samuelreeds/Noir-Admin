import React, { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import Reveal from "@/components/store/Reveal";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    setTimeout(() => setSent(false), 4000);
  };

  const inputCls = "w-full border hairline px-4 py-3 outline-none focus:border-foreground bg-background";

  return (
    <div className="bg-background">
      <section className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-16">
          <p className="label-mono text-muted-foreground mb-3">— Get in Touch</p>
          <h1 className="font-display text-5xl md:text-7xl tracking-[-0.05em]">Contact.</h1>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 grid lg:grid-cols-[1fr_1.2fr] gap-12">
        {/* Info */}
        <div>
          <Reveal>
            <p className="text-muted-foreground max-w-sm mb-10">
              For private client services, press inquiries, or wholesale partnerships, our atelier responds within 24 hours.
            </p>
          </Reveal>
          <div className="space-y-6">
            {[
              { icon: Mail, label: "Email", value: "concierge@monolithic.atelier" },
              { icon: Phone, label: "Telephone", value: "+1 (000) 000-0000" },
              { icon: MapPin, label: "Atelier", value: "No. 1 Obsidian Square, Titanium District" },
            ].map((c, i) => (
              <Reveal key={c.label} delay={i * 80} className="flex items-start gap-4 border-b hairline pb-6">
                <c.icon size={18} strokeWidth={1.5} className="mt-1 shrink-0" />
                <div>
                  <p className="label-mono text-muted-foreground text-[10px] mb-1">{c.label}</p>
                  <p className="text-sm font-mono">{c.value}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Form */}
        <Reveal>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label-mono text-muted-foreground block mb-2">Name</label>
                <input required className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className="label-mono text-muted-foreground block mb-2">Email</label>
                <input required type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-mono text-muted-foreground block mb-2">Subject</label>
              <input className={inputCls} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </div>
            <div>
              <label className="label-mono text-muted-foreground block mb-2">Message</label>
              <textarea required rows={6} className={`${inputCls} resize-none`} value={form.message} onChange={(e) => set("message", e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-foreground text-background py-4 label-mono flex items-center justify-center gap-2 hover:bg-foreground/85 transition-colors">
              Send Message <ArrowRight size={14} />
            </button>
            {sent && <p className="label-mono text-center text-muted-foreground">— Message received. We will respond shortly.</p>}
          </form>
        </Reveal>
      </div>
    </div>
  );
}