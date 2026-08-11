import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Colors() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form state for creating a new color
  const [form, setForm] = useState({
    name: '',
    hex_code: '#000000'
  });

  const queryClient = useQueryClient();

  // 1. Fetch Colors from Supabase with Caching
  const { data: colors = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Insert a New Color
  const addColorMutation = useMutation({
    mutationFn: async (/** @type {any} */ newColor) => {
      const { data, error } = await supabase
        .from('colors')
        .insert([newColor])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-colors'] });
      setIsAddModalOpen(false);
      setForm({ name: '', hex_code: '#000000' });
    },
    onError: (err) => {
      console.error("Error creating color:", err);
      alert("Failed to create color. Please check your Supabase table schema.");
    }
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredColors = colors.filter((/** @type {any} */ item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${item.name || ''} ${item.hex_code || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredColors.length / ITEMS_PER_PAGE) || 1;
  const paginatedColors = filteredColors.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSubmitNew = (/** @type {any} */e) => {
    e.preventDefault();
    if (!form.name) return alert("Please enter a color name.");
    addColorMutation.mutate({
      name: form.name,
      hex_code: form.hex_code || '#000000',
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
            placeholder="Search colors..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
            <Plus size={14} /> Add Color
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-16 text-center">No.</th>
              <th className="px-4 py-3">Swatch</th>
              <th className="px-4 py-3">Color Name</th>
              <th className="px-4 py-3">Hex Code</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading colors...</td></tr>
            ) : paginatedColors.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No colors found. Click 'Add Color' to add one.</td></tr>
            ) : (
              paginatedColors.map((/** @type {any} */ item, index) => {
                const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                const isActive = item.status !== 'inactive';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-center text-slate-500">{displayId}</td>
                    <td className="px-4 py-4">
                      <div className="w-6 h-6 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: item.hex_code || '#000' }} />
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.hex_code || '#000000'}</td>
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
          Showing {filteredColors.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredColors.length)} of {filteredColors.length} entries
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

      {/* --- ADD COLOR MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Add New Color</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitNew} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Color Name</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})} 
                  placeholder="e.g. Obsidian Black" 
                  required
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Hex Code</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={form.hex_code} 
                    onChange={(e) => setForm({...form, hex_code: e.target.value})} 
                    className="w-10 h-10 border border-slate-300 rounded cursor-pointer p-1 bg-white" 
                  />
                  <input 
                    type="text" 
                    value={form.hex_code} 
                    onChange={(e) => setForm({...form, hex_code: e.target.value})} 
                    placeholder="#000000" 
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm font-mono outline-none focus:border-slate-500" 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={addColorMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {addColorMutation.isPending ? 'Saving...' : 'Save Color'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}