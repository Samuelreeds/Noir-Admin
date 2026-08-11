import React from "react";

/**
 * @param {{ label: string, value: string | number, sub?: string, icon?: React.ComponentType<{ size?: number, strokeWidth?: number }>, accent?: string }} props
 */
export default function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="border hairline p-6 bg-background">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-mono text-muted-foreground text-[10px]">{label}</p>
          <p className="font-display text-4xl md:text-5xl tracking-[-0.04em] mt-2">{value}</p>
          {sub && <p className="label-mono text-muted-foreground text-[9px] mt-2">{sub}</p>}
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