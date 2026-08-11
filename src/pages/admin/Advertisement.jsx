import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Megaphone, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Advertisement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form state for creating a new advertisement
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    link_url: '',
    position: 'homepage_hero'
  });

  const queryClient = useQueryClient();

  // 1. Fetch Advertisements from Supabase with Caching
  const { data: ads = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-advertisements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Insert a New Advertisement
  const addAdMutation = useMutation({
    mutationFn: async (/** @type {any} */ newAd) => {
      const { data, error } = await supabase
        .from('advertisements')
        .insert([newAd])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisements'] });
      setIsAddModalOpen(false);
      setForm({ title: '', image_url: '', link_url: '', position: 'homepage_hero' });
    },
    onError: (err) => {
      console.error("Error creating advertisement:", err);
      alert("Failed to create advertisement. Please check your Supabase table schema.");
    }
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredAds = ads.filter((/** @type {any} */ item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${item.title || ''} ${item.position || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredAds.length / ITEMS_PER_PAGE) || 1;
  const paginatedAds = filteredAds.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSubmitNew = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!form.title || !form.image_url) return alert("Please fill in the title and image URL.");
    addAdMutation.mutate({
      title: form.title,
      image_url: form.image_url,
      link_url: form.link_url || '#',
      position: form.position,
      status: 'active'
    });
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search advertisements..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
            <Plus size={14} /> Create New Ad
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-16 text-center">No.</th>
              <th className="px-4 py-3">Banner</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Target URL</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading advertisements...</td></tr>
            ) : paginatedAds.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No advertisements found. Click 'Create New Ad' to add one.</td></tr>
            ) : (
              paginatedAds.map((/** @type {any} */ ad, index) => {
                const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                const isActive = ad.status !== 'inactive';

                return (
                  <tr key={ad.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-center text-slate-500">{displayId}</td>
                    <td className="px-4 py-4">
                      <div className="w-16 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400"><Megaphone size={16} /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-900">{ad.title}</td>
                    <td className="px-4 py-4 text-slate-600 font-mono text-xs">{ad.position || 'homepage'}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      {ad.link_url && ad.link_url !== '#' ? (
                        <a href={ad.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-900 underline">
                          {ad.link_url} <ExternalLink size={12} />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wider border ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isActive ? 'ACTIVE' : 'IN-ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="text-sm text-slate-500">
          Showing {filteredAds.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAds.length)} of {filteredAds.length} entries
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* --- CREATE NEW AD MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Create New Advertisement</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitNew} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Ad Title / Description</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={(e) => setForm({...form, title: e.target.value})} 
                  placeholder="e.g. Summer Campaign Banner" 
                  required
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Banner Image URL</label>
                <input 
                  type="url" 
                  value={form.image_url} 
                  onChange={(e) => setForm({...form, image_url: e.target.value})} 
                  placeholder="https://images.unsplash.com/..." 
                  required
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Link URL</label>
                <input 
                  type="text" 
                  value={form.link_url} 
                  onChange={(e) => setForm({...form, link_url: e.target.value})} 
                  placeholder="/shop" 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Position</label>
                <select 
                  value={form.position} 
                  onChange={(e) => setForm({...form, position: e.target.value})} 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-slate-500"
                >
                  <option value="homepage_hero">Homepage Hero Banner</option>
                  <option value="shop_sidebar">Shop Sidebar</option>
                  <option value="checkout_banner">Checkout Banner</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={addAdMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {addAdMutation.isPending ? 'Saving...' : 'Save Advertisement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}