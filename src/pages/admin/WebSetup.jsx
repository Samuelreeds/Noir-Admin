import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Image as ImageIcon, RefreshCcw, CheckCircle, X, UploadCloud, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
        const MAX_WIDTH = 2000; const MAX_HEIGHT = 1000;
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

const uploadAssetToSupabase = async (/** @type {File} */ file, /** @type {string} */ prefix = 'asset') => {
  const processedFile = await processImageToWebP(file);
  const fileName = `${prefix}_${Date.now()}.webp`;
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

export default function WebSetup() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  // Get active tab from URL, default to 'slider'
  const activeTab = searchParams.get('tab') || 'slider';
  
  // Layout States
  const [sliderView, setSliderView] = useState('list'); // 'list' | 'form'
  const [sliderInnerTab, setSliderInnerTab] = useState('images'); // 'images' | 'preview'
  const [previewMode, setPreviewMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteSliderId, setDeleteSliderId] = useState(/** @type {string | null} */ (null));
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Default Forms
  const defaultStoreForm = {
    about_heading: '', about_text: '', about_image: '', about_image_file: null, about_image_preview: '',
    contact_email: '', contact_phone: '', social_instagram: '', store_genders: 'Men, Women, Unisex',
    shipping_pp_price: '1.50', shipping_province_price: '2.50', enable_tax: false, tax_rate: '8.00'
  };

  const defaultSliderForm = {
    id: null, image_url: '', image_file: null, image_preview: '',
    ordering: 0, status: true, cta_enabled: true,
    cta_link: '/shop', cta_text_en: 'Shop Now', cta_text_kh: 'ទិញឥឡូវនេះ'
  };

  const [storeForm, setStoreForm] = useState(defaultStoreForm);
  const [sliderForm, setSliderForm] = useState(defaultSliderForm);

  // DATA FETCHING
  const { data: storeSettings, isLoading: isStoreLoading } = useQuery({
    queryKey: ['admin-store-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || {};
    }
  });

  const { data: sliders = [], isLoading: isSlidersLoading } = useQuery({
    queryKey: ['admin-sliders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sliders').select('*').order('ordering', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // POPULATE STORE SETTINGS ON LOAD
  useEffect(() => {
    if (storeSettings && Object.keys(storeSettings).length > 0) {
      setStoreForm(prev => ({
        ...prev, ...storeSettings,
        about_image_preview: storeSettings.about_image || '',
        store_genders: storeSettings.genders ? storeSettings.genders.join(', ') : 'Men, Women, Unisex',
        shipping_pp_price: storeSettings.shipping_pp_price?.toString() ?? '1.50',
        shipping_province_price: storeSettings.shipping_province_price?.toString() ?? '2.50',
        enable_tax: !!storeSettings.enable_tax,
        tax_rate: storeSettings.tax_rate?.toString() ?? '8.00'
      }));
    }
  }, [storeSettings]);

  // MUTATIONS
  const saveStoreSettingsMutation = useMutation({
    mutationFn: async () => {
      let aboutUrl = storeForm.about_image;
      if (storeForm.about_image_file) aboutUrl = await uploadAssetToSupabase(storeForm.about_image_file, 'about');

      const payload = {
        id: 1,
        about_heading: storeForm.about_heading, about_text: storeForm.about_text, about_image: aboutUrl,
        contact_email: storeForm.contact_email, contact_phone: storeForm.contact_phone, social_instagram: storeForm.social_instagram,
        genders: storeForm.store_genders.split(',').map(s => s.trim()).filter(Boolean),
        shipping_pp_price: parseFloat(storeForm.shipping_pp_price || '0'), shipping_province_price: parseFloat(storeForm.shipping_province_price || '0'),
        enable_tax: storeForm.enable_tax, tax_rate: parseFloat(storeForm.tax_rate || '0')
      };

      const { error } = await supabase.from('store_settings').upsert(payload);
      if (error) throw error;
      return payload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] });
      setStoreForm(prev => ({ ...prev, about_image_file: null, about_image: data.about_image }));
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => alert(err.message)
  });

  const saveSliderMutation = useMutation({
    mutationFn: async () => {
      if (!sliderForm.image_url && !sliderForm.image_file) throw new Error("An image is required.");
      let finalImageUrl = sliderForm.image_url;
      if (sliderForm.image_file) finalImageUrl = await uploadAssetToSupabase(sliderForm.image_file, 'slider');

      const payload = {
        image_url: finalImageUrl, ordering: parseInt(sliderForm.ordering.toString()) || 0,
        status: sliderForm.status, cta_enabled: sliderForm.cta_enabled,
        cta_link: sliderForm.cta_link, cta_text_en: sliderForm.cta_text_en, cta_text_kh: sliderForm.cta_text_kh
      };

      if (sliderForm.id) {
        const { error } = await supabase.from('sliders').update(payload).eq('id', sliderForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sliders').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sliders'] });
      setSliderView('list');
      setSliderForm(defaultSliderForm);
    },
    onError: (err) => alert(err.message)
  });

  const deleteSliderMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('sliders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sliders'] });
      setDeleteSliderId(null);
    }
  });

  // HANDLERS
  const handleSliderEdit = (/** @type {any} */ slider) => {
    setSliderForm({ ...defaultSliderForm, ...slider, image_preview: slider.image_url, image_file: null });
    setSliderView('form');
  };

  const handleSliderFileChange = (/** @type {any} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSliderForm(prev => ({ ...prev, image_file: file, image_preview: URL.createObjectURL(file) }));
  };

  const filteredSliders = sliders.filter((/** @type {any} */ s) => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) || s.ordering.toString().includes(searchQuery)
  );

  if (isStoreLoading || isSlidersLoading) return <div className="p-10 flex justify-center"><RefreshCcw className="animate-spin text-slate-400" /></div>;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden animate-in fade-in">
      
      <div className="flex-1 bg-slate-50 overflow-y-auto custom-scrollbar p-6 md:p-8 min-h-[calc(100vh-10rem)]">
        
        {/* ======================================= */}
        {/* 1. SLIDER MENU TAB (LIST & FORM VIEWS)  */}
        {/* ======================================= */}
        {activeTab === 'slider' && (
          <div className="w-full">
            {/* --- SLIDER LIST VIEW --- */}
            {sliderView === 'list' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col animate-in fade-in">
                
                <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
                  <div className="relative w-full max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sliders..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500 bg-white" />
                  </div>
                  <button onClick={() => { setSliderForm(defaultSliderForm); setSliderView('form'); }} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition-colors w-full md:w-auto shrink-0">
                    <Plus size={16} /> Create Slider
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-6 py-4 w-16">ID</th>
                        <th className="px-6 py-4">Thumbnail</th>
                        <th className="px-6 py-4">Ordering</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSliders.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No sliders found.</td></tr>
                      ) : (
                        filteredSliders.map((/** @type {any} */ slider, /** @type {number} */ index) => (
                          <tr key={slider.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-mono text-slate-600">{index + 1}</td>
                            <td className="px-6 py-4"><div className="h-14 w-32 bg-slate-100 border border-slate-200 rounded overflow-hidden"><img src={slider.image_url} alt="Thumbnail" className="w-full h-full object-cover" /></div></td>
                            <td className="px-6 py-4 font-mono">{slider.ordering}</td>
                            <td className="px-6 py-4"><span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${slider.status ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 border border-slate-200 text-slate-500'}`}>{slider.status ? 'ACTIVE' : 'INACTIVE'}</span></td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => handleSliderEdit(slider)} className="text-slate-400 hover:text-slate-800 transition-colors"><Edit size={16} /></button>
                                <button onClick={() => setDeleteSliderId(slider.id)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- SLIDER FORM VIEW --- */}
            {sliderView === 'form' && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col w-full animate-in slide-in-from-right-4 duration-300">
                <div className="bg-white p-6 flex justify-between items-center border-b border-slate-200 shrink-0">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">SLIDER MENU</h1>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSliderView('list')} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 transition-colors">
                      <X size={16} /> Discard
                    </button>
                    <button onClick={() => saveSliderMutation.mutate()} disabled={saveSliderMutation.isPending} className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                      {saveSliderMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} Save Slider
                    </button>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-6 w-full max-w-6xl mx-auto">
                  <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">{sliderForm.id ? 'Edit Slider' : 'Create Slider'}</h2>

                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm w-full">
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Slider Layout</label>
                    <select className="w-full border border-slate-300 rounded p-2.5 text-sm bg-white outline-none focus:border-slate-500">
                      <option>1 Image</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-2">Choose how many images to display in this slider container</p>
                  </div>

                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 w-full">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">CTA Button</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-3xl">Enable or disable the CTA button for this slider. CTA settings (link URL, button text) are configured globally below.</p>
                    </div>
                    <ToggleSwitch checked={sliderForm.cta_enabled} onChange={val => setSliderForm({...sliderForm, cta_enabled: val})} />
                  </div>

                  <div className="bg-slate-100 p-6 rounded-lg border border-slate-200 w-full">
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Global Slider Settings</h3>
                    <p className="text-xs text-slate-500 mb-6">CTA button and slider behavior are configured globally. Edit them here.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div><p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">CTA Link URL</p><input type="text" value={sliderForm.cta_link} onChange={e => setSliderForm({...sliderForm, cta_link: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 transition-colors" /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Button Text (EN)</p><input type="text" value={sliderForm.cta_text_en} onChange={e => setSliderForm({...sliderForm, cta_text_en: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 transition-colors" /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Button Text (KH)</p><input type="text" value={sliderForm.cta_text_kh} onChange={e => setSliderForm({...sliderForm, cta_text_kh: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 transition-colors" /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Auto Slide</p><p className="text-sm font-medium text-slate-900 mt-1">Enabled</p></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden w-full">
                    <div className="flex border-b border-slate-200 bg-slate-50 w-full">
                      <button onClick={() => setSliderInnerTab('images')} className={`flex-1 py-4 text-sm font-medium transition-colors ${sliderInnerTab === 'images' ? 'bg-white border-b-2 border-slate-800 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Images</button>
                      <button onClick={() => setSliderInnerTab('preview')} className={`flex-1 py-4 text-sm font-medium transition-colors ${sliderInnerTab === 'preview' ? 'bg-white border-b-2 border-slate-800 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Preview</button>
                    </div>
                    
                    <div className="p-6 md:p-8">
                      {sliderInnerTab === 'images' && (
                        <div className="space-y-4 animate-in fade-in duration-200 w-full">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-semibold text-slate-800">Upload Images (1 required)</p>
                            <p className="text-xs text-slate-400 hidden sm:block">Drag images to rearrange</p>
                          </div>
                          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 w-full">
                            <p className="text-xs text-slate-500 font-mono mb-2">:: image1 ({sliderForm.image_preview ? 'Uploaded' : 'Empty'})</p>
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 bg-white hover:bg-slate-50 transition-colors text-center relative flex flex-col items-center justify-center min-h-[300px] overflow-hidden w-full">
                              {sliderForm.image_preview ? (
                                <div className="absolute inset-2"><img src={sliderForm.image_preview} alt="Slider" className="w-full h-full object-contain" /></div>
                              ) : (
                                <>
                                  <UploadCloud size={32} className="text-slate-400 mb-3" />
                                  <p className="text-sm font-medium text-slate-700 mb-1">Click to upload image</p>
                                  <p className="text-[10px] text-slate-400 mt-2">Recommended: 2000x1000px WebP or JPG</p>
                                </>
                              )}
                              <input type="file" accept="image/*" onChange={handleSliderFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            </div>
                          </div>
                        </div>
                      )}

                      {sliderInnerTab === 'preview' && (
                        <div className="animate-in fade-in duration-200 w-full">
                          <div className="flex items-center justify-between mb-6">
                            <div><p className="text-sm font-semibold text-slate-800">Live Preview</p><p className="text-xs text-slate-500">This is how your slider will appear on the frontend</p></div>
                            <ToggleSwitch checked={previewMode} onChange={setPreviewMode} label="Preview Mode" />
                          </div>
                          <div className={`border rounded-lg flex items-center justify-center overflow-hidden transition-all w-full min-h-[350px] ${previewMode ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                            {previewMode && sliderForm.image_preview ? (
                              <img src={sliderForm.image_preview} alt="Live Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center"><p className="text-sm font-medium text-slate-600">No Preview Available</p><p className="text-xs text-slate-400 mt-1">Upload images and toggle Preview Mode to see it.</p></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm w-full">
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Ordering</label>
                    <input type="number" value={sliderForm.ordering} onChange={e => setSliderForm({...sliderForm, ordering: parseInt(e.target.value) || 0})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500" />
                  </div>

                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between w-full">
                    <span className="text-sm font-semibold text-slate-800">Status: {sliderForm.status ? 'Active' : 'Inactive'}</span>
                    <ToggleSwitch checked={sliderForm.status} onChange={val => setSliderForm({...sliderForm, status: val})} label={sliderForm.status ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* 2. PLACEHOLDER SETTINGS TABS            */}
        {/* ======================================= */}
        {['popup', 'feature', 'feedback', 'ratings', 'faqs'].includes(activeTab) && (
          <div className="w-full h-full flex flex-col">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 animate-in fade-in">
              <div className="bg-slate-50 p-6 flex justify-between items-center border-b border-slate-200 shrink-0">
                <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">
                  {activeTab === 'popup' ? 'Popup Settings' : 
                   activeTab === 'feature' ? 'Feature Settings' : 
                   activeTab === 'feedback' ? 'Customer Feedback' : 
                   activeTab === 'ratings' ? 'Product Ratings' : 'FAQs'}
                </h1>
              </div>
              <div className="p-8 w-full flex-1 flex flex-col items-center justify-center">
                <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 w-full max-w-2xl">
                  <p className="text-slate-500 font-medium text-lg">This module is currently under development.</p>
                  <p className="text-sm text-slate-400 mt-2">Check back soon for updates.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 3. STORE SETTINGS TABS (ABOUT, ETC)     */}
        {/* ======================================= */}
        {['about', 'contact', 'filters', 'shipping'].includes(activeTab) && (
          <div className="w-full">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col w-full animate-in fade-in">
              
              <div className="bg-slate-50 p-6 flex justify-between items-center border-b border-slate-200">
                <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">
                  {activeTab === 'about' ? 'About Section' : activeTab === 'contact' ? 'Footer & Contact' : activeTab === 'filters' ? 'Store Filters' : 'Shipping & Tax'}
                </h1>
                <button onClick={() => saveStoreSettingsMutation.mutate()} disabled={saveStoreSettingsMutation.isPending} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded font-medium text-sm transition-all disabled:opacity-50">
                  {saveStoreSettingsMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle size={16} className="text-emerald-400" /> : <Save size={16} />} Save Changes
                </button>
              </div>

              <div className="p-6 md:p-8 w-full max-w-4xl mx-auto">
                {activeTab === 'about' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-3">About Image</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center hover:bg-slate-100 transition-colors w-full">
                        {storeForm.about_image_preview ? (
                          <div className="relative w-full max-w-sm mx-auto h-48 rounded-lg overflow-hidden mb-3"><img src={storeForm.about_image_preview} alt="About Preview" className="w-full h-full object-cover" /></div>
                        ) : (
                          <div className="w-full h-32 flex flex-col items-center justify-center text-slate-400 mb-3"><ImageIcon size={32} className="mb-2" /><p className="text-sm">No image uploaded</p></div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) setStoreForm(p => ({...p, about_image_file: f, about_image_preview: URL.createObjectURL(f)})) }} className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer" />
                      </div>
                    </div>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">About Heading</label><input type="text" value={storeForm.about_heading} onChange={e => setStoreForm({...storeForm, about_heading: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">About Text Paragraph</label><textarea value={storeForm.about_text} onChange={e => setStoreForm({...storeForm, about_text: e.target.value})} rows={5} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 resize-none" /></div>
                  </div>
                )}

                {activeTab === 'contact' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Support Email</label><input type="email" value={storeForm.contact_email} onChange={e => setStoreForm({...storeForm, contact_email: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Support Phone</label><input type="text" value={storeForm.contact_phone} onChange={e => setStoreForm({...storeForm, contact_phone: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" /></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Instagram URL</label><input type="url" value={storeForm.social_instagram} onChange={e => setStoreForm({...storeForm, social_instagram: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" /></div>
                  </div>
                )}

                {activeTab === 'filters' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Available Genders</label>
                      <input type="text" value={storeForm.store_genders} onChange={e => setStoreForm({...storeForm, store_genders: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                      <p className="text-xs text-slate-500 mt-2">Separate multiple genders with a comma.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Phnom Penh Delivery Fee ($)</label><input type="number" step="0.01" value={storeForm.shipping_pp_price} onChange={e => setStoreForm({...storeForm, shipping_pp_price: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm font-mono outline-none focus:border-slate-500" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Provinces Delivery Fee ($)</label><input type="number" step="0.01" value={storeForm.shipping_province_price} onChange={e => setStoreForm({...storeForm, shipping_province_price: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm font-mono outline-none focus:border-slate-500" /></div>
                    </div>
                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center justify-between bg-slate-50 p-5 rounded-lg border border-slate-200">
                        <div><h3 className="text-sm font-semibold text-slate-800">Enable Tax</h3><p className="text-xs text-slate-500 mt-1">If disabled, the tax line is completely hidden at checkout.</p></div>
                        <ToggleSwitch checked={storeForm.enable_tax} onChange={val => setStoreForm({...storeForm, enable_tax: val})} />
                      </div>
                      {storeForm.enable_tax && (
                        <div className="animate-in fade-in duration-200 mt-6">
                          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Tax Rate Percentage (%)</label>
                          <input type="number" step="0.01" value={storeForm.tax_rate} onChange={e => setStoreForm({...storeForm, tax_rate: e.target.value})} className="w-full max-w-sm border border-slate-300 rounded p-3 text-sm font-mono outline-none focus:border-slate-500" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteSliderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Slider?</h2>
              <p className="text-sm text-slate-500 mb-8">This action cannot be undone. Are you sure you want to permanently remove this slider image?</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteSliderId(null)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={() => deleteSliderMutation.mutate(deleteSliderId)} disabled={deleteSliderMutation.isPending} className="px-5 py-2.5 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors w-full flex items-center justify-center gap-2">
                  {deleteSliderMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}