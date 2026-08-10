import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Check } from "lucide-react";

export default function AccountProfile() {
  const { user, reloadUser } = /** @type {any} */ (useOutletContext());
  const [displayName, setDisplayName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    if (!user?.id) return;
    
    setSaving(true); 
    setSaved(false);
    
    try {
      await supabase
        .from('profiles')
        .update({ full_name: displayName.trim(), phone: phone.trim() })
        .eq('id', user.id);
        
      await reloadUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      setSaving(false); 
    }
  };

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "—";

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl tracking-[-0.04em] mb-6">Details</h2>
        <div className="border hairline divide-y hairline">
          {[
            ["Email", user?.email || "—"],
            ["Role", user?.role || "Customer"],
            ["Member since", joined],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-4 flex items-center justify-between">
              <span className="label-mono text-muted-foreground text-[9px]">{k}</span>
              <span className="text-sm font-mono">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl tracking-[-0.04em] mb-6">Preferences</h2>
        <form onSubmit={save} className="border hairline p-6 space-y-5 max-w-md">
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px]">Display Name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How we address you" className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm focus:outline-none focus:border-foreground" />
          </label>
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px]">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground" />
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-foreground text-background px-6 py-3 label-mono hover:opacity-85 disabled:opacity-40">
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="label-mono text-[9px] text-emerald-600 flex items-center gap-1"><Check size={12} /> Saved</span>}
          </div>
        </form>
      </section>
    </div>
  );
}