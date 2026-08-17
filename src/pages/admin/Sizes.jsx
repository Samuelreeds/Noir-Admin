import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Ruler } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Sizes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Updated Form state matching the new UI
  const [form, setForm] = useState({
    name: '',
    ordering: 0,
    isActive: true
  });

  const queryClient = useQueryClient();

  // 1. Fetch Sizes from Supabase with Caching
  const { data: sizes = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-sizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Insert a New Size
  const addSizeMutation = useMutation({
    mutationFn: async (/** @type {any} */ newSize) => {
      const { data, error } = await supabase
        .from('sizes')
        .insert([newSize])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sizes'] });
      setIsAddModalOpen(false);
      setForm({ name: '', ordering: 0, isActive: true });
    },
    onError: (err) => {
      console.error("Error creating size:", err);
      alert("Failed to create size. Please make sure your Supabase 'sizes' table has an 'ordering' integer column.");
    }
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredSizes = sizes.filter((/** @type {any} */ item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${item.name || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredSizes.length / ITEMS_PER_PAGE) || 1;
  const paginatedSizes = filteredSizes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSubmitNew = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Please enter a size name.");
    
    addSizeMutation.mutate({
      name: form.name,
      ordering: form.ordering,
      status: form.isActive ? 'active' : 'inactive'
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
            placeholder="Search sizes..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
            <Plus size={14} /> Add Size
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-16 text-center">No.</th>
              <th className="px-4 py-3">Size Name</th>
              <th className="px-4 py-3">Ordering</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Loading sizes...</td></tr>
            ) : paginatedSizes.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No sizes found. Click 'Add Size' to add one.</td></tr>
            ) : (
              paginatedSizes.map((/** @type {any} */ item, index) => {
                const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                const isActive = item.status !== 'inactive';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-center text-slate-500">{displayId}</td>
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 text-slate-600">{item.ordering || 0}</td>
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
          Showing {filteredSizes.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredSizes.length)} of {filteredSizes.length} entries
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

      {/* --- ADD SIZE MODAL (UPDATED UI) --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsAddModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Create Size</h2>
            
            <form onSubmit={handleSubmitNew} className="space-y-5">
              {/* Size Input */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  Size *
                </label>
                <input 
                  type="text" 
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="Enter size..." 
                  className="w-full border-2 border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:border-black transition-colors"
                  autoFocus
                  required
                />
              </div>
              
              {/* Ordering Input */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  Ordering
                </label>
                <input 
                  type="number" 
                  value={form.ordering}
                  onChange={(e) => setForm({...form, ordering: Number(e.target.value)})}
                  className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              
              {/* Status Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setForm({...form, isActive: !form.isActive})}
                  className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors duration-200 ease-in-out ${form.isActive ? 'bg-slate-800' : 'bg-slate-300'}`}
                >
                  <div 
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} 
                  />
                </button>
                <span className="text-sm font-medium text-slate-900">
                  Status: {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                   <X size={16} /> Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!form.name.trim() || addSizeMutation.isPending}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50"
                >
                   {addSizeMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}