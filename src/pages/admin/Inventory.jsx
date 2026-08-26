// @ts-nocheck
import React, { useState } from 'react';
import { Package, Plus, Search, History, ArrowDownRight, ArrowUpRight, Save, X, RefreshCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' or 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const defaultForm = { variant_id: '', movement_type: 'receipt', quantity: '', reason: '' };
  const [form, setForm] = useState(defaultForm);

  const queryClient = useQueryClient();

  // 1. Fetch Variants and their Live Balances (Calculated securely from the ledger view)
  const { data: stockBalances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['admin-inventory-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          id, sku, size, scent, price,
          products ( name, image ),
          variant_stock_balances ( on_hand, reserved, available )
        `)
        .eq('is_active', true)
        .order('sku', { ascending: true });
        
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch Immutable Ledger History
  const { data: ledgerHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['admin-inventory-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_ledger')
        .select(`
          id, movement_type, quantity_change, reason, created_at,
          product_variants ( sku, size, products ( name ) ),
          users ( full_name )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Record Movement Mutation (Inserts a ledger row instead of editing flat stock)
  const recordMovementMutation = useMutation({
    mutationFn: async () => {
      if (!form.variant_id || !form.quantity || !form.movement_type) {
        throw new Error("Please fill in all required fields.");
      }

      let qty = parseInt(form.quantity, 10);
      if (isNaN(qty) || qty === 0) throw new Error("Quantity must be a valid number (not zero).");

      // If it's a reduction type (damage, expiry, issue), enforce negative quantity
      if (['damage', 'expiry', 'sale_issue'].includes(form.movement_type)) {
        qty = -Math.abs(qty);
      } else if (['receipt', 'return'].includes(form.movement_type)) {
        qty = Math.abs(qty);
      }
      
      const { data: authData } = await supabase.auth.getUser();

      const { error } = await supabase.from('inventory_ledger').insert([{
        variant_id: form.variant_id,
        movement_type: form.movement_type,
        quantity_change: qty,
        reason: form.reason || null,
        recorded_by: authData?.user?.id || null
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-history'] });
      setIsModalOpen(false);
      setForm(defaultForm);
    },
    onError: (err) => alert("Failed to record movement: " + err.message)
  });

  // Filter for Search
  const filteredBalances = stockBalances.filter((/** @type {any} */ item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const str = `${item.sku} ${item.products?.name} ${item.size}`.toLowerCase();
    return str.includes(q);
  });

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      
      {/* Header & Tabs */}
      <div className="p-6 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">Warehouse Inventory</h1>
            <p className="text-sm text-slate-500 mt-1">Manage stock levels and view immutable ledger movements.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors shadow-sm">
            <Plus size={16} /> Record Stock Movement
          </button>
        </div>

        <div className="flex gap-6 mt-6 border-b border-slate-300">
          <button 
            onClick={() => setActiveTab('balances')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'balances' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Stock Balances
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Ledger History
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by SKU or Product Name..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
        <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['admin-inventory-balances'] }); queryClient.invalidateQueries({ queryKey: ['admin-inventory-history'] }); }} className="p-2 text-slate-500 hover:text-slate-800 transition-colors border border-slate-300 rounded"><RefreshCcw size={16} /></button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50">
        
        {/* --- BALANCES TAB --- */}
        {activeTab === 'balances' && (
          <table className="w-full text-left text-sm whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">SKU Code</th>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4 text-center text-blue-700 bg-blue-50/50">Available</th>
                <th className="px-6 py-4 text-center text-amber-700 bg-amber-50/50">Reserved (Orders)</th>
                <th className="px-6 py-4 text-center text-slate-800 bg-slate-100">Total Physical On-Hand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingBalances ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Calculating inventory...</td></tr>
              ) : filteredBalances.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No active SKUs found. Go to Products to create variants.</td></tr>
              ) : (
                filteredBalances.map((/** @type {any} */ item) => {
                  const balances = item.variant_stock_balances?.[0] || { available: 0, reserved: 0, on_hand: 0 };
                  const isLowStock = balances.available <= 10;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{item.sku}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            {item.products?.image ? <img src={item.products.image} alt={item.products.name} className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-2 text-slate-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{item.products?.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{item.size} {item.scent ? `· ${item.scent}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center bg-blue-50/10">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold ${isLowStock ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'text-blue-700'}`}>
                          {balances.available || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-amber-600 bg-amber-50/10">{balances.reserved || 0}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900 bg-slate-50/50">{balances.on_hand || 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <table className="w-full text-left text-sm whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">SKU & Product</th>
                <th className="px-6 py-4">Movement Type</th>
                <th className="px-6 py-4 text-right">Qty Change</th>
                <th className="px-6 py-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingHistory ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading ledger...</td></tr>
              ) : ledgerHistory.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No movements recorded yet.</td></tr>
              ) : (
                ledgerHistory.map((/** @type {any} */ log) => {
                  const isPositive = log.quantity_change > 0;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-slate-900 font-medium">{new Date(log.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs font-bold text-slate-700">{log.product_variants?.sku}</p>
                        <p className="text-[10px] text-slate-500 uppercase truncate max-w-[200px]">{log.product_variants?.products?.name} ({log.product_variants?.size})</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {log.movement_type.replace('_', ' ')}
                        </span>
                        {log.reason && <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[150px]">{log.reason}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">
                        <span className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {isPositive ? '+' : ''}{log.quantity_change}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 flex items-center gap-2">
                        <History size={14} className="text-slate-400" /> {log.users?.full_name || 'System'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- RECORD MOVEMENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 uppercase">Record Movement</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Select Product SKU</label>
                <select value={form.variant_id} onChange={(e) => setForm({...form, variant_id: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                  <option value="">-- Choose SKU --</option>
                  {stockBalances.map((/** @type {any} */ item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} | {item.products?.name} {item.size ? `(${item.size})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Movement Type</label>
                  <select value={form.movement_type} onChange={(e) => setForm({...form, movement_type: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                    <option value="receipt">Receipt (Add Stock)</option>
                    <option value="damage">Damage (Remove Stock)</option>
                    <option value="count_correction">Count Correction (Add/Remove)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Quantity</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} placeholder="e.g. 50 or -5" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Reason / Note (Optional)</label>
                <input type="text" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} placeholder="e.g. Shipment from Supplier A" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} disabled={recordMovementMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors">Cancel</button>
              <button onClick={() => recordMovementMutation.mutate()} disabled={recordMovementMutation.isPending} className="px-6 py-2.5 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors flex items-center gap-2">
                {recordMovementMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Record to Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}