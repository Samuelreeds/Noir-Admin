import React, { useState } from 'react';
import { Search, Edit, Trash2, Plus, X, Save, RefreshCcw, UploadCloud } from 'lucide-react';
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

const uploadAssetToSupabase = async (/** @type {File} */ file) => {
  const processedFile = await processImageToWebP(file);
  const fileName = `slider_${Date.now()}.webp`;
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
  <label className="relative inline-flex items-center cursor-pointer">
    {label && <span className="mr-3 text-sm font-medium text-slate-700">{label}</span>}
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
  </label>
);

export default function Sliders() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [searchQuery, setSearchQuery] = useState('');
  const [sliderInnerTab, setSliderInnerTab] = useState('images'); // 'images' | 'preview'
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteId, setDeleteId] = useState(/** @type {string | null} */ (null));

  const queryClient = useQueryClient();

  const defaultForm = {
    id: null,
    image_url: '', image_file: null, image_preview: '',
    ordering: 0, status: true, cta_enabled: false,
    cta_link: 'https://bare-official.com/collections/all',
    cta_text_en: 'Explore', cta_text_kh: 'ទិញឥឡូវនេះ'
  };

  const [form, setForm] = useState(defaultForm);

  // FETCH SLIDERS
  const { data: sliders = [], isLoading } = useQuery({
    queryKey: ['admin-sliders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sliders').select('*').order('ordering', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // SAVE SLIDER MUTATION
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.image_url && !form.image_file) throw new Error("An image is required.");
      
      let finalImageUrl = form.image_url;
      if (form.image_file) {
        finalImageUrl = await uploadAssetToSupabase(form.image_file);
      }

      const payload = {
        image_url: finalImageUrl,
        ordering: parseInt(form.ordering.toString()) || 0,
        status: form.status,
        cta_enabled: form.cta_enabled,
        cta_link: form.cta_link,
        cta_text_en: form.cta_text_en,
        cta_text_kh: form.cta_text_kh
      };

      if (form.id) {
        const { error } = await supabase.from('sliders').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sliders').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sliders'] });
      setView('list');
      setForm(defaultForm);
    },
    onError: (err) => alert(err.message)
  });

  // DELETE MUTATION
  const deleteMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('sliders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sliders'] });
      setDeleteId(null);
    }
  });

  // HANDLERS
  const handleEdit = (/** @type {any} */ slider) => {
    setForm({
      ...defaultForm, ...slider, 
      image_preview: slider.image_url, 
      image_file: null 
    });
    setView('form');
  };

  const handleFileChange = (/** @type {any} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({ ...prev, image_file: file, image_preview: URL.createObjectURL(file) }));
  };

  const filteredSliders = sliders.filter((/** @type {any} */ s) => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.ordering.toString().includes(searchQuery)
  );

  return (
    <div className="w-full relative flex flex-col h-[calc(100vh-6rem)]">
      
      {/* -------------------- LIST VIEW -------------------- */}
      {view === 'list' && (
        <div className="bg-white rounded-md shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden animate-in fade-in">
          
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="relative w-[300px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sliders..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500 bg-white" />
            </div>
            <button onClick={() => { setForm(defaultForm); setView('form'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors">
              <Plus size={16} /> Create Slider
            </button>
          </div>

          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-16">ID</th>
                  <th className="px-6 py-4">Thumbnail</th>
                  <th className="px-6 py-4">Ordering</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading sliders...</td></tr>
                ) : filteredSliders.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No sliders found.</td></tr>
                ) : (
                  filteredSliders.map((/** @type {any} */ slider, /** @type {number} */ index) => (
                    <tr key={slider.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-slate-600">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="h-16 w-48 bg-slate-100 border border-slate-200 rounded overflow-hidden">
                          <img src={slider.image_url} alt={`Slider ${index}`} className="w-full h-full object-cover" />
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono">{slider.ordering}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-xs font-semibold uppercase tracking-wider">
                          {slider.status ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => handleEdit(slider)} className="text-slate-400 hover:text-slate-800 transition-colors" title="Edit"><Edit size={16} /></button>
                          <button onClick={() => setDeleteId(slider.id)} className="text-rose-400 hover:text-rose-600 transition-colors" title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-sm text-slate-500 shrink-0">
            <div>Showing 1 to {filteredSliders.length} of {filteredSliders.length} entries</div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1">
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50">«</button>
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50">Previous</button>
                 <button className="px-3 py-1 border border-slate-800 bg-slate-800 text-white rounded">1</button>
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50">Next</button>
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50">»</button>
               </div>
               <div className="flex items-center gap-2">
                 <span>Rows:</span>
                 <select className="border border-slate-300 rounded px-2 py-1 outline-none"><option>10</option><option>20</option></select>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- FORM VIEW -------------------- */}
      {view === 'form' && (
        <div className="bg-slate-100 rounded-md border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 animate-in slide-in-from-right-4 duration-300">
          
          {/* Form Header */}
          <div className="bg-slate-100 p-6 flex justify-between items-center border-b border-slate-200 shrink-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">SLIDER MENU</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 transition-colors">
                <X size={16} /> Discard
              </button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
                {saveMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Save Slider
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">{form.id ? 'Edit Slider' : 'Create Slider'}</h2>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Slider Layout</label>
              <select className="w-full border border-slate-300 rounded p-2.5 text-sm bg-white outline-none focus:border-slate-500">
                <option>1 Image</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">Choose how many images to display in this slider container</p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">CTA Button</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl">Enable or disable the CTA button for this slider. CTA settings are configured globally.</p>
              </div>
              <div className="shrink-0 mt-1">
                <ToggleSwitch checked={form.cta_enabled} onChange={val => setForm({...form, cta_enabled: val})} />
              </div>
            </div>

            <div className="bg-slate-100 p-5 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Global Slider Settings</h3>
              <p className="text-xs text-slate-500 mb-4">CTA button and slider behavior are configured globally.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><p className="text-[10px] text-slate-500 uppercase font-semibold">CTA Link URL</p><input type="text" value={form.cta_link} onChange={e => setForm({...form, cta_link: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none" /></div>
                <div><p className="text-[10px] text-slate-500 uppercase font-semibold">Button Text (EN)</p><input type="text" value={form.cta_text_en} onChange={e => setForm({...form, cta_text_en: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none" /></div>
                <div><p className="text-[10px] text-slate-500 uppercase font-semibold">Button Text (KH)</p><input type="text" value={form.cta_text_kh} onChange={e => setForm({...form, cta_text_kh: e.target.value})} className="w-full bg-transparent border-b border-slate-300 py-1 text-sm font-medium text-slate-900 outline-none" /></div>
                <div><p className="text-[10px] text-slate-500 uppercase font-semibold">Auto Slide</p><p className="text-sm font-medium text-slate-900 mt-1">Enabled</p></div>
              </div>
            </div>

            {/* Tabs for Images / Preview */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button onClick={() => setSliderInnerTab('images')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sliderInnerTab === 'images' ? 'bg-white border-b-2 border-slate-800 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Images</button>
                <button onClick={() => setSliderInnerTab('preview')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sliderInnerTab === 'preview' ? 'bg-white border-b-2 border-slate-800 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Preview</button>
              </div>
              
              <div className="p-6">
                {sliderInnerTab === 'images' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-800">Upload Images (1 required)</p>
                      <p className="text-xs text-slate-400">Drag images to rearrange</p>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <p className="text-xs text-slate-500 font-mono mb-2 flex items-center gap-2">:: image1 ({form.image_preview ? 'Uploaded' : 'Empty'})</p>
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 bg-white hover:bg-slate-50 transition-colors text-center relative flex flex-col items-center justify-center min-h-[250px] overflow-hidden">
                        {form.image_preview ? (
                          <div className="absolute inset-2"><img src={form.image_preview} alt="Slider" className="w-full h-full object-contain" /></div>
                        ) : (
                          <>
                            <UploadCloud size={32} className="text-slate-400 mb-3" />
                            <p className="text-sm font-medium text-slate-700 mb-1">Click to upload image</p>
                            <p className="text-xs text-slate-500 mb-2">or drag and drop</p>
                            <p className="text-[10px] text-slate-400">image1 (2000x750 px recommended)</p>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      </div>
                    </div>
                  </div>
                )}

                {sliderInnerTab === 'preview' && (
                  <div className="animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Live Preview</p>
                        <p className="text-xs text-slate-500">This is how your slider will appear on the frontend</p>
                      </div>
                      <ToggleSwitch checked={previewMode} onChange={setPreviewMode} label="Preview Mode" />
                    </div>
                    <div className={`border rounded-lg flex items-center justify-center overflow-hidden transition-all ${previewMode ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'} min-h-[300px]`}>
                      {previewMode && form.image_preview ? (
                        <img src={form.image_preview} alt="Live Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-600">No Preview Available</p>
                          <p className="text-xs text-slate-400 mt-1">Upload images to see the preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Ordering</label>
              <input type="number" value={form.ordering} onChange={e => setForm({...form, ordering: parseInt(e.target.value) || 0})} className="w-full border border-slate-300 rounded p-2.5 text-sm bg-white outline-none focus:border-slate-500" />
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Status: {form.status ? 'Active' : 'Inactive'}</span>
              <ToggleSwitch checked={form.status} onChange={val => setForm({...form, status: val})} label={form.status ? 'Active' : 'Inactive'} />
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-200 text-xs text-slate-500 bg-white shrink-0">
            2026 © NOIR MTD.
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <Trash2 size={32} className="mx-auto text-rose-500 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Delete Slider?</h2>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete this slider? This cannot be undone.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors flex items-center gap-2">
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