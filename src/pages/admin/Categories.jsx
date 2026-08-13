import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit, X, Save, RefreshCcw, UploadCloud, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

// --- IMAGE COMPRESSION UTILITY ---
const processImageToWebP = (/** @type {File} */ file) => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File too large (Max 10MB)."));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = /** @type {string} */ (event.target?.result);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024; const MAX_HEIGHT = 1280;
        let { width, height } = img;
        if (width > height && width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
        else if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Failed to get canvas context"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas conversion failed'));
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }));
        }, 'image/webp', 0.85);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const uploadAssetToSupabase = async (/** @type {File} */ file) => {
  const processedFile = await processImageToWebP(file);
  const fileName = `category_${Date.now()}.webp`;
  const { error } = await supabase.storage.from('site-assets').upload(fileName, processedFile);
  if (error) throw error;
  const { data } = supabase.storage.from('site-assets').getPublicUrl(fileName);
  return data.publicUrl;
};

// --- REUSABLE TOGGLE SWITCH ---
/**
 * @param {{ checked: boolean, onChange: (val: boolean) => void, label?: string }} props
 */
const ToggleSwitch = ({ checked, onChange, label = '' }) => (
  <label className="inline-flex items-center cursor-pointer shrink-0">
    {label && <span className="mr-3 text-sm font-medium text-slate-700 whitespace-nowrap select-none">{label}</span>}
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="relative w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
  </label>
);

export default function Categories() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTabLang, setActiveTabLang] = useState('english'); // 'english' | 'khmer'
  const [deleteId, setDeleteId] = useState(/** @type {string | null} */ (null));

  const queryClient = useQueryClient();

  const defaultForm = {
    id: null,
    title: '',
    title_khmer: '',
    image: '',
    image_file: /** @type {File | null} */ (null),
    image_preview: '',
    ordering: 0,
    status: true,
    suggest_category: false
  };

  const [form, setForm] = useState(defaultForm);

  // 1. Fetch Categories from Supabase
  const { data: categories = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('ordering', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Save / Create / Update Category
  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Please enter an English title.");
      
      let finalImageUrl = form.image;
      if (form.image_file) {
        finalImageUrl = await uploadAssetToSupabase(form.image_file);
      }

      const payload = {
        title: form.title,
        name: form.title, // <--- FIX: Maps title to the required 'name' column for the database
        title_khmer: form.title_khmer,
        image: finalImageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
        ordering: parseInt(form.ordering.toString()) || 0,
        status: form.status,
        suggest_category: form.suggest_category
      };

      if (form.id) {
        const { error } = await supabase.from('categories').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setView('list');
      setForm(defaultForm);
    },
    onError: (err) => {
      console.error("Error saving category:", err);
      alert(err.message || "Failed to save category.");
    }
  });

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteId(null);
    }
  });

  const handleEdit = (/** @type {any} */ cat) => {
    setForm({
      ...defaultForm,
      ...cat,
      // Fallback in case old categories only had 'name' populated
      title: cat.title || cat.name || '', 
      image_preview: cat.image,
      image_file: null
    });
    setView('form');
  };

  const handleFileChange = (/** @type {any} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({
      ...prev,
      image_file: file,
      image_preview: URL.createObjectURL(file)
    }));
  };

  // Filter Logic
  const filteredCategories = categories.filter((/** @type {any} */ cat) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${cat.title || cat.name || ''} ${cat.title_khmer || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE) || 1;
  const paginatedCategories = filteredCategories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      
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
                placeholder="Search category title..." 
                className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500 bg-white" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors bg-white">
                <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={() => { setForm(defaultForm); setView('form'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors">
                <Plus size={16} /> Add Category
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">No.</th>
                  <th className="px-6 py-4">Icon</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Title (Khmer)</th>
                  <th className="px-6 py-4">Top Category</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading categories...</td></tr>
                ) : paginatedCategories.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No categories found. Click 'Add Category' to create one.</td></tr>
                ) : (
                  paginatedCategories.map((/** @type {any} */ cat, index) => {
                    const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500">{displayId}</td>
                        <td className="px-6 py-4">
                          <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200">
                            <img src={cat.image} alt={cat.title || cat.name} className="w-full h-full object-cover" />
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{cat.title || cat.name}</td>
                        <td className="px-6 py-4 text-slate-600">{cat.title_khmer || '-'}</td>
                        <td className="px-6 py-4 text-slate-600 uppercase text-xs font-medium">SHOW</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${cat.status !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                            {cat.status !== false ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button onClick={() => handleEdit(cat)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => setDeleteId(cat.id)} className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete">
                              <Trash2 size={16} />
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
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">
              Showing {filteredCategories.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCategories.length)} of {filteredCategories.length} entries
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
        </div>
      )}

      {/* -------------------- FORM VIEW (CREATE / EDIT) -------------------- */}
      {view === 'form' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 duration-300">
          
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">CATEGORY MENU</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 transition-colors">
                <X size={16} /> Discard
              </button>
              <button onClick={() => saveCategoryMutation.mutate()} disabled={saveCategoryMutation.isPending} className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                {saveCategoryMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Save Category
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">{form.id ? 'Edit Category' : 'Create Category'}</h2>

            {/* Language Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-2">
              <button 
                type="button" 
                onClick={() => setActiveTabLang('english')} 
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTabLang === 'english' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                English
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTabLang('khmer')} 
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTabLang === 'khmer' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Khmer
              </button>
            </div>

            {/* Title Inputs */}
            {activeTabLang === 'english' ? (
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase">Category Title (English)</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={(e) => setForm({...form, title: e.target.value})} 
                  placeholder="Enter English Title" 
                  className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" 
                />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase">Category Title (Khmer)</label>
                <input 
                  type="text" 
                  value={form.title_khmer} 
                  onChange={(e) => setForm({...form, title_khmer: e.target.value})} 
                  placeholder="បញ្ចូលចំណងជើងភាសាខ្មែរ" 
                  className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" 
                />
              </div>
            )}

            {/* Icon Image Uploader */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-3">
              <label className="block text-xs font-semibold text-slate-600 uppercase">Icon Image (Recommended: 1024 x 1280 px, Max: 50MB)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative flex flex-col items-center justify-center min-h-[220px]">
                {form.image_preview ? (
                  <div className="absolute inset-2 flex items-center justify-center bg-white rounded">
                    <img src={form.image_preview} alt="Category Icon Preview" className="h-full object-contain" />
                  </div>
                ) : (
                  <>
                    <UploadCloud size={36} className="text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">Drag & Drop your image here or <span className="text-blue-600 underline cursor-pointer">Browse</span></p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG, WebP, or GIF (max 10MB)</p>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              </div>
            </div>

            {/* Ordering */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase">Ordering</label>
              <input 
                type="number" 
                value={form.ordering} 
                onChange={(e) => setForm({...form, ordering: parseInt(e.target.value) || 0})} 
                className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" 
              />
            </div>

            {/* Status & Suggest Category Toggles */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Status</span>
                <ToggleSwitch checked={form.status} onChange={val => setForm({...form, status: val})} label={form.status ? 'Active' : 'Inactive'} />
              </div>
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">Suggest Category</span>
                  <p className="text-xs text-slate-500">Show or hide category suggestion on the homepage storefront.</p>
                </div>
                <ToggleSwitch checked={form.suggest_category} onChange={val => setForm({...form, suggest_category: val})} label={form.suggest_category ? 'Visible' : 'Hidden'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Category?</h2>
              <p className="text-sm text-slate-500 mb-8">This action cannot be undone. Are you sure you want to permanently remove this category?</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteId(null)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="px-5 py-2.5 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors w-full flex items-center justify-center gap-2">
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}