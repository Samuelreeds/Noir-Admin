// @ts-nocheck
import React, { useState } from 'react';
import { Package, Plus, Search, History, ArrowDownRight, ArrowUpRight, Save, X, RefreshCcw, Calendar, Truck, ShieldCheck, FileDigit, ArrowRightLeft, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const generateIdempotencyKey = () => `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [successMessage, setSuccessMessage] = useState(/** @type {string | null} */ (null));
  
  const defaultForm = { 
    variant_id: '', 
    movement_type: 'receipt', 
    quantity: '', 
    reason: '',
    batch_lot: '',
    supplier: '',
    purchase_order: '',
    manufacturing_date: '',
    expiry_date: '',
    warehouse: 'Main Warehouse',
    source_warehouse: 'Main Warehouse',
    destination_warehouse: 'Storefront',
    quality_status: 'Good'
  };
  const [form, setForm] = useState(defaultForm);

  const queryClient = useQueryClient();

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

  const { data: ledgerHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['admin-inventory-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_ledger')
        .select(`
          id, movement_type, quantity_change, reason, created_at, warehouse,
          batch_lot, expiry_date, supplier, purchase_order,
          product_variants ( sku, size, products ( name ) ),
          users ( full_name )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      return data || [];
    }
  });

  const recordMovementMutation = useMutation({
    mutationFn: async () => {
      if (!form.variant_id || !form.quantity || !form.movement_type) {
        throw new Error("Please fill in all required core fields (SKU, Type, Quantity).");
      }

      let qty = parseInt(form.quantity, 10);
      if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be a positive number greater than zero.");

      if (form.movement_type === 'transfer') {
        if (form.source_warehouse === form.destination_warehouse) {
           throw new Error("Source and Destination warehouses cannot be the same.");
        }
        
        // Execute Atomic Transfer RPC
        const { error } = await supabase.rpc('transfer_inventory', {
          p_variant_id: form.variant_id,
          p_quantity: qty,
          p_source_warehouse: form.source_warehouse,
          p_destination_warehouse: form.destination_warehouse,
          p_batch_lot: form.batch_lot || null,
          p_manufacturing_date: form.manufacturing_date || null,
          p_expiry_date: form.expiry_date || null,
          p_reason: form.reason || null,
          p_idempotency_key: idempotencyKey
        });

        if (error) {
          if (error.code === '23505') throw new Error("Duplicate submission prevented.");
          throw new Error(error.message);
        }
        return { ...form, quantity_change: qty, movement_type: 'transfer' };
      } 
      else {
        // Execute Standard Receipt or Adjustment
        if (form.manufacturing_date && form.expiry_date && new Date(form.expiry_date) < new Date(form.manufacturing_date)) {
          throw new Error("Expiry date cannot precede manufacturing date.");
        }

        if (['damage', 'expiry', 'sale_issue'].includes(form.movement_type)) {
          qty = -Math.abs(qty);
        }

        const { data: authData } = await supabase.auth.getUser();

        const payload = {
          variant_id: form.variant_id,
          movement_type: form.movement_type,
          quantity_change: qty,
          reason: form.reason || null,
          recorded_by: authData?.user?.id || null,
          batch_lot: form.batch_lot || null,
          supplier: form.supplier || null,
          purchase_order: form.purchase_order || null,
          manufacturing_date: form.manufacturing_date || null,
          expiry_date: form.expiry_date || null,
          warehouse: form.warehouse,
          quality_status: form.quality_status,
          idempotency_key: idempotencyKey
        };

        const { error } = await supabase.from('inventory_ledger').insert([payload]);
        if (error) {
          if (error.code === '23505') throw new Error("Duplicate submission prevented.");
          throw error;
        }
        return payload;
      }
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-history'] });
      
      const variant = stockBalances.find((/** @type {any} */ v) => v.id === payload.variant_id);
      setSuccessMessage(`Successfully processed ${payload.movement_type.replace('_', ' ').toUpperCase()} for ${Math.abs(payload.quantity_change)} units of ${variant?.sku}.`);
      
      setTimeout(() => {
        setSuccessMessage(null);
        setIsModalOpen(false);
        setForm(defaultForm);
      }, 2500);
    },
    onError: (err) => alert(err.message)
  });

  const openModal = (/** @type {string} */ type = 'receipt') => {
    setForm({ ...defaultForm, movement_type: type });
    setIdempotencyKey(generateIdempotencyKey());
    setIsModalOpen(true);
  };

  const filteredBalances = stockBalances.filter((/** @type {any} */ item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const str = `${item.sku} ${item.products?.name} ${item.size}`.toLowerCase();
    return str.includes(q);
  });

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      
      <div className="p-6 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">Warehouse Inventory</h1>
            <p className="text-sm text-slate-500 mt-1">Manage stock levels, transfers, batch provenance, and view immutable ledger movements.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => openModal('adjustment')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
              <FileDigit size={16} /> Adjust
            </button>
            <button onClick={() => openModal('transfer')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
              <ArrowRightLeft size={16} /> Transfer
            </button>
            <button onClick={() => openModal('receipt')} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors shadow-sm">
              <Plus size={16} /> Receive
            </button>
          </div>
        </div>

        <div className="flex gap-6 mt-6 border-b border-slate-300">
          <button onClick={() => setActiveTab('balances')} className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'balances' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Stock Balances</button>
          <button onClick={() => setActiveTab('history')} className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Ledger History</button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by SKU or Product Name..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
        <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['admin-inventory-balances'] }); queryClient.invalidateQueries({ queryKey: ['admin-inventory-history'] }); }} className="p-2 text-slate-500 hover:text-slate-800 transition-colors border border-slate-300 rounded"><RefreshCcw size={16} /></button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50">
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
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No active SKUs found.</td></tr>
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

        {activeTab === 'history' && (
          <table className="w-full text-left text-sm whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">SKU & Product</th>
                <th className="px-6 py-4">Movement Details</th>
                <th className="px-6 py-4 text-center">Warehouse</th>
                <th className="px-6 py-4 text-right">Qty Change</th>
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
                  const isTransfer = log.movement_type.includes('transfer');
                  
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
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isTransfer ? 'bg-indigo-50 text-indigo-700' :
                            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {log.movement_type.replace('_', ' ')}
                          </span>
                          {log.batch_lot && <span className="text-[10px] font-mono text-slate-500 border border-slate-200 px-1.5 py-0.5 bg-slate-50 rounded">Lot: {log.batch_lot}</span>}
                          {log.purchase_order && <span className="text-[10px] font-mono text-blue-600 border border-blue-200 px-1.5 py-0.5 bg-blue-50 rounded">PO: {log.purchase_order}</span>}
                        </div>
                        {log.reason && <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[250px]">{log.reason}</p>}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className="text-xs font-medium text-slate-600 flex items-center justify-center gap-1">
                            <MapPin size={12} className="text-slate-400" /> {log.warehouse || 'Main Warehouse'}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">
                        <span className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {isPositive ? '+' : ''}{log.quantity_change}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
            
            {successMessage ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Transaction Successful</h2>
                <p className="text-slate-600 font-medium">{successMessage}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                  <h2 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                    {form.movement_type === 'receipt' ? <><Plus size={18}/> Receive Stock</> : 
                     form.movement_type === 'transfer' ? <><ArrowRightLeft size={18}/> Transfer Stock</> : 
                     <><FileDigit size={18}/> Adjust Stock</>}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Core Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Core Details</h3>
                    
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
                      {form.movement_type === 'transfer' ? (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Source Warehouse</label>
                            <input type="text" value={form.source_warehouse} onChange={(e) => setForm({...form, source_warehouse: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 bg-slate-50" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Destination Warehouse</label>
                            <input type="text" value={form.destination_warehouse} onChange={(e) => setForm({...form, destination_warehouse: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 bg-slate-50" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Movement Type</label>
                            <select 
                              value={form.movement_type} 
                              onChange={(e) => setForm({...form, movement_type: e.target.value})} 
                              className={`w-full border rounded p-3 text-sm bg-white outline-none focus:border-slate-500 font-semibold ${form.movement_type === 'receipt' ? 'border-emerald-300 text-emerald-800' : 'border-slate-300'}`}
                            >
                              <option value="receipt">Receipt (Add Stock)</option>
                              <option value="damage">Damage (Remove Stock)</option>
                              <option value="count_correction">Count Correction</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Target Warehouse</label>
                            <input type="text" value={form.warehouse} onChange={(e) => setForm({...form, warehouse: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Quantity</label>
                        <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} placeholder="e.g. 50" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Reason / Note</label>
                        <input type="text" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} placeholder={form.movement_type === 'transfer' ? 'e.g. Restocking storefront' : 'e.g. Received weekly shipment'} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                      </div>
                    </div>
                  </div>

                  {/* Advanced Batch/Expiry Information */}
                  <div className={`space-y-4 pt-2 transition-opacity ${form.movement_type === 'receipt' || form.movement_type === 'transfer' ? 'opacity-100 block' : 'opacity-50 hidden md:block'}`}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Package size={14} /> Batch & Expiry Provenance
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">{form.movement_type === 'transfer' ? 'Match Source Batch/Lot' : 'Batch / Lot Number'}</label>
                        <input type="text" value={form.batch_lot} onChange={(e) => setForm({...form, batch_lot: e.target.value})} placeholder="e.g. LOT-2026-08" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" />
                      </div>
                      {form.movement_type === 'receipt' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Purchase Order (PO)</label>
                          <div className="relative">
                            <FileDigit size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={form.purchase_order} onChange={(e) => setForm({...form, purchase_order: e.target.value})} placeholder="e.g. PO-90021" className="w-full border border-slate-300 rounded p-3 pl-9 text-sm outline-none focus:border-slate-500 font-mono" />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Manufacturing Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="date" value={form.manufacturing_date} onChange={(e) => setForm({...form, manufacturing_date: e.target.value})} className="w-full border border-slate-300 rounded p-3 pl-9 text-sm outline-none focus:border-slate-500 bg-white cursor-pointer" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 text-amber-700">Expiry Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                          <input type="date" value={form.expiry_date} onChange={(e) => setForm({...form, expiry_date: e.target.value})} className="w-full border border-amber-200 rounded p-3 pl-9 text-sm outline-none focus:border-amber-400 bg-amber-50/30 cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
                  <button onClick={() => setIsModalOpen(false)} disabled={recordMovementMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors">Cancel</button>
                  <button onClick={() => recordMovementMutation.mutate()} disabled={recordMovementMutation.isPending} className={`px-6 py-2.5 text-sm font-medium text-white rounded transition-colors flex items-center gap-2 ${form.movement_type === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : form.movement_type === 'transfer' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                    {recordMovementMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                    Record to Ledger
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}