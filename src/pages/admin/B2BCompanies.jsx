// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Search, Briefcase, CheckCircle, Ban, RefreshCcw } from 'lucide-react';

export default function B2BCompanies() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['b2b-companies'],
    queryFn: async () => {
      const { data } = await supabase.from('b2b_companies').select('*, b2b_price_lists(name)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ['b2b-price-lists'],
    queryFn: async () => {
      const { data } = await supabase.from('b2b_price_lists').select('id, name').eq('is_active', true);
      return data || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('b2b_companies').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2b-companies'] })
  });

  const updatePriceList = useMutation({
    mutationFn: async ({ id, price_list_id }) => {
      const { error } = await supabase.from('b2b_companies').update({ price_list_id: price_list_id || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2b-companies'] })
  });

  const filtered = companies.filter((c) => c.company_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned Price List</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">Loading...</td></tr> : filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-semibold text-slate-800 flex items-center gap-2"><Briefcase size={16} className="text-slate-400"/> {c.company_name}</td>
                <td className="px-4 py-4 text-slate-600">{c.contact_email}<br/><span className="text-xs">{c.contact_phone}</span></td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : c.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <select 
                    value={c.price_list_id || ''} 
                    onChange={(e) => updatePriceList.mutate({ id: c.id, price_list_id: e.target.value })}
                    className="border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-slate-500"
                    disabled={c.status !== 'approved'}
                  >
                    <option value="">-- No Special Pricing --</option>
                    {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-4 text-right flex items-center justify-end gap-2">
                  {c.status !== 'approved' && <button onClick={() => updateStatus.mutate({ id: c.id, status: 'approved' })} className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-xs hover:bg-emerald-100 flex items-center gap-1"><CheckCircle size={14}/> Approve</button>}
                  {c.status !== 'suspended' && <button onClick={() => updateStatus.mutate({ id: c.id, status: 'suspended' })} className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs hover:bg-rose-100 flex items-center gap-1"><Ban size={14}/> Suspend</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}