import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, UploadCloud, Save, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

// --- IMAGE UPLOAD HELPER ---
const uploadImageToSupabase = async (/** @type {File} */ file) => {
  const fileName = `ad_${Date.now()}_${Math.random().toString(36).substring(2)}.webp`;
  const filePath = `advertisements/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- REUSABLE TOGGLE SWITCH ---
/**
 * @param {{ checked: boolean, onChange: (val: boolean) => void, label?: string, labelLeft?: string }} props
 */
const ToggleSwitch = ({ checked, onChange, label = '', labelLeft = '' }) => (
  <div className="flex items-center justify-between">
    {labelLeft && <span className="text-sm font-semibold text-slate-800">{labelLeft}</span>}
    <label className="inline-flex items-center cursor-pointer shrink-0">
      {label && <span className="mr-3 text-sm font-medium text-slate-500 whitespace-nowrap select-none">{label}</span>}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="relative w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
    </label>
  </div>
);

export default function Advertisement() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAdToDelete, setSelectedAdToDelete] = useState(/** @type {{id: string, title: string} | null} */ (null));
  
  // UI Tabs State in Form
  const [activeLangTab, setActiveLangTab] = useState('english'); // 'english' | 'khmer'

  const queryClient = useQueryClient();

  const defaultForm = {
    id: null,
    image: '',
    imageFile: /** @type {File | null} */ (null),
    title: '',
    title_khmer: '',
    subtitle: '',
    subtitle_khmer: '',
    redirect_label: '',
    redirect_label_khmer: '',
    redirect_to: '',
    status: true,
    ordering: 0
  };

  const [form, setForm] = useState(defaultForm);

  // FETCH DATA
  const { data: ads = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-advertisements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('ordering', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // MUTATIONS
  const saveAdMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = form.image;
      if (form.imageFile) {
        imageUrl = await uploadImageToSupabase(form.imageFile);
      }

      const payload = {
        image: imageUrl || null,
        title: form.title || null,
        title_khmer: form.title_khmer || null,
        subtitle: form.subtitle || null,
        subtitle_khmer: form.subtitle_khmer || null,
        redirect_label: form.redirect_label || null,
        redirect_label_khmer: form.redirect_label_khmer || null,
        redirect_to: form.redirect_to || null,
        status: form.status ? 'active' : 'inactive',
        ordering: parseInt(form.ordering.toString()) || 0
      };

      if (form.id) {
        const { error } = await supabase.from('advertisements').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('advertisements').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisements'] });
      setView('list');
      setForm(defaultForm);
    },
    onError: (err) => alert(`Error: ${err.message}`)
  });

  const deleteAdMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('advertisements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisements'] });
      setSelectedAdToDelete(null);
    },
    onError: (err) => alert(`Error: ${err.message}`)
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredAds = ads.filter((/** @type {any} */ ad) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchString = `${ad.title || ''} ${ad.subtitle || ''} ${ad.redirect_to || ''}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredAds.length / ITEMS_PER_PAGE) || 1;
  const paginatedAds = filteredAds.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleEditOpen = (/** @type {any} */ ad) => {
    setForm({
      id: ad.id,
      image: ad.image || '',
      imageFile: null,
      title: ad.title || '',
      title_khmer: ad.title_khmer || '',
      subtitle: ad.subtitle || '',
      subtitle_khmer: ad.subtitle_khmer || '',
      redirect_label: ad.redirect_label || '',
      redirect_label_khmer: ad.redirect_label_khmer || '',
      redirect_to: ad.redirect_to || '',
      status: ad.status !== 'inactive',
      ordering: ad.ordering || 0
    });
    setView('form');
  };

  const handleImageChange = (/** @type {any} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, image: previewUrl, imageFile: file }));
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* -------------------- LIST VIEW -------------------- */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search advertisements..." 
                className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500 bg-white" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors bg-white">
                <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={() => { setForm(defaultForm); setView('form'); }} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors">
                <Plus size={16} /> Create Advertisement
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">No.</th>
                  <th className="px-6 py-4">Image</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Redirect To</th>
                  <th className="px-6 py-4 text-center">Ordering</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading advertisements...</td></tr>
                ) : paginatedAds.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No advertisements found. Click 'Create Advertisement' to add one.</td></tr>
                ) : (
                  paginatedAds.map((/** @type {any} */ ad, index) => {
                    const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    const isActive = ad.status !== 'inactive';

                    return (
                      <tr key={ad.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500">{displayId}</td>
                        <td className="px-6 py-4">
                          <div className="w-16 h-12 rounded overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                            {ad.image ? <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{ad.title || 'Untitled'}</td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{ad.redirect_to || '-'}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{ad.ordering}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button onClick={() => handleEditOpen(ad)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit"><Edit size={16} /></button>
                            <button onClick={() => setSelectedAdToDelete({ id: ad.id, title: ad.title || 'Advertisement' })} className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete"><Trash2 size={16} /></button>
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
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">Showing {filteredAds.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAds.length)} of {filteredAds.length} entries</div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- FORM VIEW (CREATE / EDIT) -------------------- */}
      {view === 'form' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 duration-300">
          
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shrink-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">{form.id ? 'EDIT ADVERTISEMENT' : 'CREATE ADVERTISEMENT'}</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 transition-colors">
                <X size={16} /> Discard
              </button>
              <button onClick={() => saveAdMutation.mutate()} disabled={saveAdMutation.isPending} className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                {saveAdMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Save
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
              
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Advertisement</h3>

              {/* Image Uploader */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Choose Image</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative flex flex-col items-center justify-center min-h-[180px]">
                  {form.image ? (
                    <div className="relative w-full max-w-xs h-36 rounded overflow-hidden border border-slate-200 mb-2">
                      <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={32} className="text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Choose Image</p>
                    </>
                  )}
                  <p className="text-xs text-slate-400 mt-1">(Recommended: 400x533px for header cards)</p>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                </div>
              </div>

              {/* Language Tabs */}
              <div className="flex gap-2 border-b border-slate-200 pb-3 pt-2">
                <button type="button" onClick={() => setActiveLangTab('english')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'english' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>English</button>
                <button type="button" onClick={() => setActiveLangTab('khmer')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'khmer' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Khmer</button>
              </div>

              {activeLangTab === 'english' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Title</label>
                    <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Enter text..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Subtitle</label>
                    <input type="text" value={form.subtitle} onChange={e => setForm({...form, subtitle: e.target.value})} placeholder="Enter text..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Redirect Label</label>
                    <input type="text" value={form.redirect_label} onChange={e => setForm({...form, redirect_label: e.target.value})} placeholder="Enter text..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Title (Khmer)</label>
                    <input type="text" value={form.title_khmer} onChange={e => setForm({...form, title_khmer: e.target.value})} placeholder="បញ្ចូលចំណងជើង..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Subtitle (Khmer)</label>
                    <input type="text" value={form.subtitle_khmer} onChange={e => setForm({...form, subtitle_khmer: e.target.value})} placeholder="បញ្ចូលចំណងជើងរង..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Redirect Label (Khmer)</label>
                    <input type="text" value={form.redirect_label_khmer} onChange={e => setForm({...form, redirect_label_khmer: e.target.value})} placeholder="បញ្ចូលស្លាកបញ្ជូនต่อ..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Redirect To</label>
                <input type="text" value={form.redirect_to} onChange={e => setForm({...form, redirect_to: e.target.value})} placeholder="Enter slider link" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
              </div>

              <div className="pt-2">
                <ToggleSwitch labelLeft="Status: Active" label={form.status ? 'Active' : 'Inactive'} checked={form.status} onChange={v => setForm({...form, status: v})} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Ordering</label>
                <input type="number" value={form.ordering} onChange={e => setForm({...form, ordering: parseInt(e.target.value) || 0})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
              </div>

            </div>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {selectedAdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Advertisement?</h2>
              <p className="text-sm text-slate-500 mb-8">Are you sure you want to delete "<span className="font-semibold text-slate-800">{selectedAdToDelete.title}</span>"?</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setSelectedAdToDelete(null)} disabled={deleteAdMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={() => deleteAdMutation.mutate(selectedAdToDelete.id)} disabled={deleteAdMutation.isPending} className="px-5 py-2.5 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors w-full flex items-center justify-center gap-2">
                  {deleteAdMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}