// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Search, Edit, ArrowLeft, Save, Briefcase, Percent } from 'lucide-react';

export default function B2BPriceLists() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' or 'edit'
  const [search, setSearch] = useState('');
  const [activeTier, setActiveTier] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Fetch B2B Tiers (Replacing old arbitrary price lists)
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['b2b-tiers-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('b2b_tiers').select('*').order('min_order_packs', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const updateTierMutation = useMutation({
    mutationFn: async (payload) => {
      const { id, created_at, updated_at, ...updateData } = payload;
      const { error } = await supabase.from('b2b_tiers').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-tiers-admin'] });
      setView('list');
      setActiveTier(null);
    },
    onError: (err) => alert(err.message)
  });

  const handleEditClick = (tier) => {
    setActiveTier(tier);
    setEditForm({ ...tier });
    setView('edit');
  };

  const handleSave = () => {
    updateTierMutation.mutate(editForm);
  };

  if (view === 'edit' && activeTier) {
    const inputCls = "w-full border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-slate-500 bg-white";
    const labelCls = "block text-xs font-semibold text-slate-600 uppercase mb-2";

    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView('list'); setActiveTier(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{activeTier.tier_name} Tier Rules</h1>
              <p className="text-xs text-slate-500">Manage B2B discounts, MOQs, and financial targets</p>
            </div>
          </div>
          <button 
            onClick={handleSave}
            disabled={updateTierMutation.isPending}
            className="px-6 py-2 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
          >
            {updateTierMutation.isPending ? 'Saving...' : <><Save size={16} /> Save Changes</>}
          </button>
        </div>

        <div className="p-6 bg-slate-50/50 flex-1">
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Core Commercials */}
            <div className="col-span-full md:col-span-2 lg:col-span-3 pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                <Percent size={16} className="text-emerald-600"/> Core Commercials
              </h3>
            </div>
            
            <div>
              <label className={labelCls}>Retailer Discount (%)</label>
              <input type="number" step="0.01" value={editForm.retailer_discount_pct || 0} onChange={e => setEditForm({...editForm, retailer_discount_pct: parseFloat(e.target.value)})} className={inputCls} />
              <p className="text-[10px] text-slate-500 mt-1">Decimal format (e.g., 0.15 = 15%)</p>
            </div>
            <div>
              <label className={labelCls}>Deposit Required (%)</label>
              <input type="number" step="0.01" value={editForm.deposit_pct || 0} onChange={e => setEditForm({...editForm, deposit_pct: parseFloat(e.target.value)})} className={inputCls} />
              <p className="text-[10px] text-slate-500 mt-1">Decimal format (e.g., 0.50 = 50%)</p>
            </div>
            <div>
              <label className={labelCls}>Credit Days</label>
              <input type="number" value={editForm.credit_days || 0} onChange={e => setEditForm({...editForm, credit_days: parseInt(e.target.value)})} className={inputCls} />
              <p className="text-[10px] text-slate-500 mt-1">Days to pay balance (0 = Cash on Delivery)</p>
            </div>

            {/* Order Requirements */}
            <div className="col-span-full md:col-span-2 lg:col-span-3 pb-2 border-b border-slate-200 mt-4">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                <Briefcase size={16} className="text-blue-600"/> Order Requirements (MOQ)
              </h3>
            </div>

            <div>
              <label className={labelCls}>Min Order (Packs)</label>
              <input type="number" value={editForm.min_order_packs || 0} onChange={e => setEditForm({...editForm, min_order_packs: parseInt(e.target.value)})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Min Order Value (USD)</label>
              <input type="number" step="0.01" value={editForm.min_order_usd || 0} onChange={e => setEditForm({...editForm, min_order_usd: parseFloat(e.target.value)})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Min Packs / SKU</label>
              <input type="number" value={editForm.min_packs_per_sku || 0} onChange={e => setEditForm({...editForm, min_packs_per_sku: parseInt(e.target.value)})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Case Multiple</label>
              <input type="number" value={editForm.case_multiple || 1} onChange={e => setEditForm({...editForm, case_multiple: parseInt(e.target.value)})} className={inputCls} />
              <p className="text-[10px] text-slate-500 mt-1">Orders must be divisible by this number</p>
            </div>

            {/* Financial Targets */}
            <div className="col-span-full md:col-span-2 lg:col-span-3 pb-2 border-b border-slate-200 mt-4">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                Financial Targets & Overheads
              </h3>
            </div>

            <div>
              <label className={labelCls}>Target Contribution (%)</label>
              <input type="number" step="0.01" value={editForm.target_contribution_pct || 0} onChange={e => setEditForm({...editForm, target_contribution_pct: parseFloat(e.target.value)})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Min Contribution (USD)</label>
              <input type="number" step="0.01" value={editForm.min_contribution_usd || 0} onChange={e => setEditForm({...editForm, min_contribution_usd: parseFloat(e.target.value)})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Variable Reserve (%)</label>
              <input type="number" step="0.01" value={editForm.variable_reserve_pct || 0} onChange={e => setEditForm({...editForm, variable_reserve_pct: parseFloat(e.target.value)})} className={inputCls} />
            </div>
            
            <div className="col-span-full mt-4">
              <label className={labelCls}>Program Status</label>
              <select value={editForm.program_status || 'Draft'} onChange={e => setEditForm({...editForm, program_status: e.target.value})} className={inputCls}>
                <option value="Draft">Draft (Not Active)</option>
                <option value="Active">Active (Available for B2B Checkout)</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: Show all Tiers
  const filteredTiers = tiers.filter((t) => t.tier_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      
      <div className="p-6 border-b border-slate-200 bg-slate-50 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">B2B Program Tiers</h1>
        <p className="text-sm text-slate-500 mt-1">Manage wholesale tier rules, discount structures, and MOQs based on the Finance Tracker.</p>
      </div>

      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tiers..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-3">Tier Name</th>
              <th className="px-6 py-3 text-right">Discount</th>
              <th className="px-6 py-3 text-right">Min Order (Packs)</th>
              <th className="px-6 py-3 text-right">Min Order (USD)</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading...</td></tr> : filteredTiers.map(tier => (
              <tr key={tier.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900">{tier.tier_name}</td>
                <td className="px-6 py-4 text-right font-mono text-emerald-600 font-semibold">{(tier.retailer_discount_pct * 100).toFixed(0)}%</td>
                <td className="px-6 py-4 text-right font-mono">{tier.min_order_packs}</td>
                <td className="px-6 py-4 text-right font-mono">${tier.min_order_usd.toFixed(2)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${tier.program_status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {tier.program_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleEditClick(tier)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-semibold flex items-center gap-2 ml-auto"
                  >
                    <Edit size={14} /> Manage Rules
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}