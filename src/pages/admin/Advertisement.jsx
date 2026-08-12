import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Megaphone, ExternalLink, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

// --- IMAGE COMPRESSION & WEBP CONVERSION UTILITIES ---
const processImageToWebP = (/** @type {File} */ file) => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File too large. Please select an image under 10MB."));
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = /** @type {string} */ (event.target?.result);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1400; // Banner size max width
        const MAX_HEIGHT = 800;
        let { width, height } = img;

        if (width > height && width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Failed to get canvas context"));
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas conversion failed'));
          if (blob.size > 5 * 1024 * 1024) return reject(new Error('Processed image is still over 5MB.'));
          
          const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
          resolve(webpFile);
        }, 'image/webp', 0.85);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const uploadBannerToSupabase = async (/** @type {File} */ file) => {
  const processedFile = await processImageToWebP(file);
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.webp`;
  const filePath = `banners/${fileName}`;
  
  const { error: uploadError } = await supabase.storage.from('advertisement-banners').upload(filePath, processedFile);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('advertisement-banners').getPublicUrl(filePath);
  return data.publicUrl;
};

export default function Advertisement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form state for creating a new advertisement with file upload & target route selection
  const [form, setForm] = useState({
    title: '',
    imageFile: /** @type {File | null} */ (null),
    imagePreview: '',
    link_url: '/shop',
    position: 'homepage_hero'
  });

  const queryClient = useQueryClient();

  // 1. Fetch Advertisements
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

  // 2. Fetch Products to power the Target Shop/Product Selector Preview
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products-target-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, code').eq('status', 'active');
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // 3. Mutation to Insert a New Advertisement
  const addAdMutation = useMutation({
    mutationFn: async (/** @type {any} */ newAd) => {
      let finalImageUrl = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80';
      if (newAd.imageFile) {
        finalImageUrl = await uploadBannerToSupabase(newAd.imageFile);
      }
      
      const { imageFile, imagePreview, ...rest } = newAd;
      const { data, error } = await supabase
        .from('advertisements')
        .insert([{ ...rest, image_url: finalImageUrl }])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisements'] });
      setIsAddModalOpen(false);
      if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
      setForm({ title: '', imageFile: null, imagePreview: '', link_url: '/shop', position: 'homepage_hero' });
    },
    onError: (err) => {
      console.error("Error creating advertisement:", err);
      alert(err.message || "Failed to create advertisement.");
    }
  });

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const filteredAds = ads.filter((/** @type {any} */ item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${item.title || ''} ${item.position || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredAds.length / ITEMS_PER_PAGE) || 1;
  const paginatedAds = filteredAds.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleFileChange = (/** @type {any} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, imageFile: file, imagePreview: previewUrl }));
  };

  const handleSubmitNew = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!form.title || (!form.imageFile && !form.imagePreview)) return alert("Please provide a title and banner image.");
    
    addAdMutation.mutate({
      title: form.title,
      imageFile: form.imageFile,
      imagePreview: form.imagePreview,
      link_url: form.link_url || '/shop',
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
              <th className="px-4 py-3">Target Shop / Link</th>
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
                      {ad.link_url ? (
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Create New Advertisement</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitNew} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
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

              {/* BANNER IMAGE UPLOAD FIELD */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Banner Image Upload</label>
                <div className="flex items-center gap-4 border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="w-20 h-12 bg-white border border-slate-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
                    {form.imagePreview ? <img src={form.imagePreview} alt="Banner Preview" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer" 
                    />
                    <p className="text-[10px] text-slate-400 mt-1 truncate">Auto-compressed to WebP (&lt; 5MB).</p>
                  </div>
                </div>
              </div>

              {/* SHOP / PRODUCT TARGET SELECTOR PREVIEW */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Shop / Product Page</label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select 
                    value={form.link_url} 
                    onChange={(e) => setForm({...form, link_url: e.target.value})} 
                    className="w-full border border-slate-300 rounded pl-9 pr-4 py-2 text-sm bg-white outline-none focus:border-slate-500 cursor-pointer"
                  >
                    <optgroup label="General Storefront">
                      <option value="/shop">Main Shop Catalog (/shop)</option>
                      <option value="/shop?view=categories">Shop Categories Page</option>
                      <option value="/">Homepage Storefront</option>
                    </optgroup>
                    <optgroup label="Specific Products">
                      {products.map((/** @type {any} */ p) => (
                        <option key={p.id} value={`/product/${p.id}`}>
                          Product: {p.name} ({p.code || 'SKU'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Select where users are redirected when clicking this advertisement banner.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Banner Position</label>
                <select 
                  value={form.position} 
                  onChange={(e) => setForm({...form, position: e.target.value})} 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-slate-500 cursor-pointer"
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
                <button type="submit" disabled={addAdMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {addAdMutation.isPending && <RefreshCcw size={14} className="animate-spin" />} 
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