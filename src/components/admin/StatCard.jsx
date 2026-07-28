import React from "react";

export default function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="border hairline p-6 bg-background">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-mono text-muted-foreground text-[10px]">{label}</p>
          <p className="font-display text-4xl md:text-5xl tracking-[-0.04em] mt-3 leading-none">{value}</p>
          {sub && <p className="label-mono text-muted-foreground text-[9px] mt-3">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2 border hairline ${accent || ""}`}>
            <Icon size={16} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
}