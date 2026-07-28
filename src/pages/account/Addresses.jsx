import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

const empty = { label: "", line1: "", city: "", state: "", postal_code: "", country: "", phone: "" };

export default function AccountAddresses() {
  const { user, reloadUser } = useOutletContext();
  const addresses = user.data?.addresses || [];
  const [editing, setEditing] = useState(null); // index or "new" or null
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (i) => { setForm({ ...empty, ...addresses[i] }); setEditing(i); };
  const close = () => { setEditing(null); setForm(empty); };

  const persist = async (next) => {
    setSaving(true);
    await base44.auth.updateMe({ addresses: next });
    await reloadUser();
    setSaving(false);
    close();
  };

  const save = (e) => {
    e.preventDefault();
    const clean = { ...form, label: form.label.trim() || "Address" };
    if (editing === "new") persist([...addresses, clean]);
    else persist(addresses.map((a, i) => (i === editing ? clean : a)));
  };

  const remove = (i) => {
    if (!confirm("Delete this address?")) return;
    persist(addresses.filter((_, idx) => idx !== i));
  };

  const field = (label, key) => (
    <label className="block">
      <span className="label-mono text-muted-foreground text-[9px]">{label}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm focus:outline-none focus:border-foreground" />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-[-0.04em]">Saved Addresses</h2>
        {editing === null && (
          <button onClick={openNew} className="flex items-center gap-2 border hairline px-4 py-2.5 label-mono hover:bg-muted"><Plus size={14} /> Add</button>
        )}
      </div>

      {addresses.length === 0 && editing === null ? (
        <div className="border hairline p-10 text-center">
          <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a, i) => (
            <div key={i} className="border hairline p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="label-mono text-[10px] border hairline px-2 py-1">{a.label || "Address"}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(i)} className="p-1.5 hover:bg-muted"><Pencil size={13} /></button>
                  <button onClick={() => remove(i)} className="p-1.5 hover:bg-muted text-destructive"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {a.line1}<br />
                {a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />
                {a.country}{a.phone && <><br />{a.phone}</>}
              </p>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-background border hairline my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b hairline">
              <h3 className="font-display text-lg tracking-[-0.04em]">{editing === "new" ? "New Address" : "Edit Address"}</h3>
              <button onClick={close} className="p-1 hover:bg-muted"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="px-6 py-6 space-y-4">
              {field("Label", "label")}
              {field("Address Line 1", "line1")}
              <div className="grid grid-cols-2 gap-4">
                {field("City", "city")}
                {field("State / Region", "state")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("Postal Code", "postal_code")}
                {field("Country", "country")}
              </div>
              {field("Phone", "phone")}
              <div className="flex gap-3 pt-2 border-t hairline">
                <button type="submit" disabled={saving} className="flex-1 bg-foreground text-background py-3 label-mono hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving ? "Saving…" : <><Check size={14} /> Save Address</>}
                </button>
                <button type="button" onClick={close} className="px-6 border hairline py-3 label-mono hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}