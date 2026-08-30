// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Trash2, ArrowLeft, Save, Edit, RefreshCcw } from 'lucide-react';

export default function B2BPriceLists() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' or 'manage'
  const [search, setSearch] = useState('');
  const [activeList, setActiveList] = useState(null);

  const [newListForm, setNewListForm] = useState({ name: '', description: '' });
  const [newItemForm, setNewItemForm] = useState({ variant_id: '', b2b_price: '' });

  // Fetch Base Price Lists
  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ['b2b-price-lists-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('b2b_price_lists').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  // Fetch Items for Active List
  const { data: listItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['b2b-price-list-items', activeList?.id],
    queryFn: async () => {
      if (!activeList?.id) return [];
      const { data } = await supabase
        .from('b2b_price_list_items')
        .select('*, product_variants(sku, price, products(name))')
        .eq('price_list_id', activeList.id);
      return data || [];
    },
    enabled: !!activeList?.id
  });

  // Fetch all variants for the dropdown
  const { data: variants = [] } = useQuery({
    queryKey: ['all-variants-for-b2b'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, sku, price, products(name)')
        .eq('is_active', true);
      return data || [];
    }
  });

  const createListMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('b2b_price_lists').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewListForm({ name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['b2b-price-lists-admin'] });
    }
  });

  const toggleListStatus = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('b2b_price_lists').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2b-price-lists-admin'] })
  });

  const addItemMutation = useMutation({
    mutationFn: async (payload) => {
      // Upsert to handle accidental duplicates gracefully
      const { error } = await supabase.from('b2b_price_list_items').upsert([payload], { onConflict: 'price_list_id, variant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItemForm({ variant_id: '', b2b_price: '' });
      queryClient.invalidateQueries({ queryKey: ['b2b-price-list-items'] });
    },
    onError: (err) => alert(err.message)
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('b2b_price_list_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2b-price-list-items'] })
  });

  if (view === 'manage' && activeList) {
    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView('list'); setActiveList(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{activeList.name}</h1>
              <p className="text-xs text-slate-500">Manage B2B specific SKU pricing overrides</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-end gap-4 max-w-3xl">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Select Variant (SKU)</label>
              <select 
                value={newItemForm.variant_id} 
                onChange={(e) => setNewItemForm({ ...newItemForm, variant_id: e.target.value })}
                className="w-full border border-slate-300 rounded p-2.5 text-sm bg-white outline-none focus:border-slate-500"
              >
                <option value="">-- Choose a Product Variant --</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.products?.name} (SKU: {v.sku}) - Retail: ${v.price}</option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">B2B Price ($)</label>
              <input 
                type="number" 
                step="0.01" 
                value={newItemForm.b2b_price} 
                onChange={(e) => setNewItemForm({ ...newItemForm, b2b_price: e.target.value })}
                className="w-full border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
            <button 
              onClick={() => addItemMutation.mutate({ price_list_id: activeList.id, variant_id: newItemForm.variant_id, b2b_price: parseFloat(newItemForm.b2b_price) })}
              disabled={!newItemForm.variant_id || !newItemForm.b2b_price || addItemMutation.isPending}
              className="px-6 py-2.5 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Add Price
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar bg-slate-50">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-right">Retail Price</th>
                <th className="px-6 py-3 text-right">B2B Price</th>
                <th className="px-6 py-3 text-center">Discount %</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {itemsLoading ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading...</td></tr> : listItems.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">No specific pricing defined yet.</td></tr> : listItems.map(item => {
                const retail = item.product_variants?.price || 0;
                const b2b = item.b2b_price || 0;
                const discountPct = retail > 0 ? Math.round(((retail - b2b) / retail) * 100) : 0;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{item.product_variants?.products?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{item.product_variants?.sku}</td>
                    <td className="px-6 py-4 text-right text-slate-500 line-through">${retail.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">${b2b.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs">
                        {discountPct}% Off
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => deleteItemMutation.mutate(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: Show all price lists
  const filteredLists = priceLists.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Top Creation Bar */}
      <div className="p-6 border-b border-slate-200 bg-white shrink-0 flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">New List Name</label>
          <input type="text" value={newListForm.name} onChange={e => setNewListForm({...newListForm, name: e.target.value})} placeholder="e.g. Distributor Tier 1" className="w-full border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-slate-500" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Description</label>
          <input type="text" value={newListForm.description} onChange={e => setNewListForm({...newListForm, description: e.target.value})} placeholder="Optional..." className="w-full border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-slate-500" />
        </div>
        <button 
          onClick={() => createListMutation.mutate(newListForm)} 
          disabled={!newListForm.name || createListMutation.isPending} 
          className="px-6 py-2.5 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
        >
          <Plus size={16} /> Create List
        </button>
      </div>

      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search price lists..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-3">Price List Name</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Loading...</td></tr> : filteredLists.map(list => (
              <tr key={list.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900">{list.name}</td>
                <td className="px-6 py-4 text-slate-500">{list.description || '—'}</td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => toggleListStatus.mutate({ id: list.id, is_active: !list.is_active })}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-colors ${list.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'}`}
                  >
                    {list.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => { setActiveList(list); setView('manage'); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-semibold flex items-center gap-2 ml-auto"
                  >
                    <Edit size={14} /> Manage Pricing
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