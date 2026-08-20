// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Shield, Edit, Trash2, Plus } from 'lucide-react';

export default function Roles() {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_roles')
        .select(`*, admin_role_permissions(count)`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('admin_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
    onError: (err) => alert('Failed to delete role: ' + err.message)
  });

  if (isLoading) return <div className="p-8 text-slate-500">Loading roles...</div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-display uppercase tracking-tight text-slate-900">Role Management</h1>
        <Link to="/admin/roles/create" className="bg-slate-900 text-white px-4 py-2.5 rounded-md flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors text-sm font-medium w-full sm:w-auto">
          <Plus size={16} /> Create Role
        </Link>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm w-full">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Shield className="text-slate-500" size={20} strokeWidth={1.5} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-lg font-bold text-slate-900 uppercase truncate">{role.name}</h2>
                <p className="text-xs md:text-sm text-slate-500 truncate mt-0.5">{role.description || "No description provided."}</p>
                
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${role.is_active ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {role.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{role.admin_role_permissions?.[0]?.count || 0} permissions</span>
                  <span className="text-xs font-medium text-slate-500">0 users</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:ml-4 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
              <Link to={`/admin/roles/${role.id}`} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors">
                <Edit size={16} />
              </Link>
              {role.name !== 'SUPER_ADMIN' && (
                <button 
                  onClick={() => { if(window.confirm('Delete this role?')) deleteMutation.mutate(role.id) }} 
                  className="p-2 bg-slate-100 text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {roles.length === 0 && <p className="text-slate-500">No roles configured.</p>}
      </div>
    </div>
  );
}