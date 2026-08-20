// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Edit, Trash2, Plus, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Users() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const actualUser = user?.email ? user : user?.user;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedUser, setSelectedUser] = useState(null);

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    role_id: ''
  });

  // 1. Fetch Current User's Strict Permissions
  const { data: userPermissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['my-permissions', actualUser?.id],
    queryFn: async () => {
      if (!actualUser?.id) return [];
      const { data, error } = await supabase
        .from('admin_user_roles')
        .select(`
          admin_roles (
            name,
            admin_role_permissions (
              admin_permissions (
                resource,
                action
              )
            )
          )
        `)
        .eq('user_id', actualUser.id)
        .single();

      if (error && error.code !== 'PGRST116') return [];

      const roleName = data?.admin_roles?.name;
      const isOwner = ['jackstyle4@gmail.com', 'noirmtd@gmail.com', 'admin@testing.com'].includes(actualUser.email.toLowerCase());
      
      if (isOwner || roleName === 'SUPER_ADMIN') {
        return ['SUPER_ADMIN']; 
      }

      const perms = data?.admin_roles?.admin_role_permissions?.map(rp => rp.admin_permissions) || [];
      return perms.map(p => `${p.resource}:${p.action}`);
    },
    enabled: !!actualUser?.id,
    staleTime: 5 * 60 * 1000
  });

  // --- STRICT RBAC FLAGS ---
  const hasAccess = (action) => userPermissions.includes('SUPER_ADMIN') || userPermissions.includes(`users:${action}`);
  
  const canRead = hasAccess('read');
  const canCreate = hasAccess('create');
  const canUpdate = hasAccess('update');
  const canDelete = hasAccess('delete');
  const canAssignRole = hasAccess('assign_role');

  // 2. Fetch Admin Roles for Dropdowns
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_roles').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: canRead
  });

  // 3. Fetch Users (Profiles)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (profileError) throw profileError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('admin_user_roles')
        .select('*');
        
      if (rolesError) throw rolesError;

      const mergedUsers = (profilesData || [])
        .filter(profile => profile.role?.toLowerCase() === 'admin')
        .map(profile => ({
          ...profile,
          admin_user_roles: (rolesData || []).filter(r => r.user_id === profile.id)
        }));

      return mergedUsers;
    },
    enabled: canRead // Don't fetch if they don't have read access
  });

  // 4. Quick-Assign Role Mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }) => {
      if (!canAssignRole) throw new Error("Permission denied: You cannot assign roles.");
      await supabase.from('admin_user_roles').delete().eq('user_id', userId);
      if (roleId) {
        const { error } = await supabase.from('admin_user_roles').insert({ user_id: userId, role_id: roleId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => alert('Failed to assign role: ' + err.message)
  });

  // 5. Save User Mutation (Add / Edit)
  const saveUserMutation = useMutation({
    mutationFn: async () => {
      let userId = selectedUser?.id;

      if (modalMode === 'add') {
        if (!canCreate) throw new Error("Permission denied: You cannot create users.");

        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: form.email,
          password: form.password,
        });

        if (authError) throw authError;
        
        if (authData?.user?.identities?.length === 0) {
          throw new Error("This email is already registered in the Authentication system.");
        }

        if (!authData.user) throw new Error("Could not create authentication record.");
        userId = authData.user.id;

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: form.full_name,
          email: form.email,
          role: 'admin' 
        });
        if (profileError) throw profileError;

      } else {
        if (!canUpdate) throw new Error("Permission denied: You cannot update users.");
        const { error } = await supabase.from('profiles').update({
          full_name: form.full_name,
          email: form.email
        }).eq('id', userId);
        if (error) throw error;
      }

      // Sync custom role if permitted
      if (canAssignRole) {
        await supabase.from('admin_user_roles').delete().eq('user_id', userId);
        if (form.role_id) {
          await supabase.from('admin_user_roles').insert({ user_id: userId, role_id: form.role_id });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      closeModal();
    },
    onError: (err) => alert('Failed to save user: ' + err.message)
  });

  // 6. Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      if (!canDelete) throw new Error("Permission denied: You cannot delete users.");
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => alert('Failed to delete user: ' + err.message)
  });

  const openAddModal = () => {
    setModalMode('add');
    setForm({ full_name: '', username: '', email: '', password: '', role_id: '' });
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setForm({
      full_name: user.full_name || '',
      username: user.email?.split('@')[0] || '',
      email: user.email || '',
      password: '',
      role_id: user.admin_user_roles?.[0]?.role_id || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  if (permsLoading || usersLoading) return <div className="p-8 text-slate-500">Loading users...</div>;

  // HARD BLOCK IF READ PERMISSION IS DENIED
  if (!canRead) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg flex items-center gap-3">
          <ShieldAlert size={20} />
          <strong>Access Denied:</strong> You do not have permission to view the User Management module.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight text-slate-900">USER MANAGEMENT</h1>
          <p className="text-slate-500 text-sm mt-1">Manage admin users and their roles</p>
        </div>
        {canCreate && (
          <button onClick={openAddModal} className="bg-slate-800 text-white px-4 py-2.5 rounded-md flex items-center gap-2 hover:bg-slate-700 transition-colors text-sm font-medium shadow-sm">
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {!userPermissions.includes('SUPER_ADMIN') && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center gap-3 text-sm mb-4">
          <ShieldAlert size={18} />
          Your access is restricted by your role permissions. Certain actions may be hidden.
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const currentRoleId = u.admin_user_roles?.[0]?.role_id || '';
                const roleName = roles.find(r => r.id === currentRoleId)?.name || 'No role';
                
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{u.full_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700 uppercase">{u.role || 'user'}</td>
                    <td className="px-6 py-4">
                      {canAssignRole ? (
                        <select 
                          value={currentRoleId}
                          onChange={(e) => assignRoleMutation.mutate({ userId: u.id, roleId: e.target.value })}
                          disabled={assignRoleMutation.isPending}
                          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white outline-none cursor-pointer text-slate-700 min-w-[140px]"
                        >
                          <option value="">No role</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold uppercase border border-slate-200">
                          {roleName}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="text-sm">
                        {u.created_at 
                          ? new Date(u.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                          : 'N/A'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canUpdate && (
                          <button onClick={() => openEditModal(u)} className="text-slate-400 hover:text-slate-900 transition-colors">
                            <Edit size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => { if(window.confirm('Delete this user?')) deleteUserMutation.mutate(u.id) }} className="text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No admin users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Add New User' : 'Edit User'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  value={form.full_name} 
                  onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} 
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-slate-500 text-slate-800" 
                  placeholder="Enter full name" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={form.username} 
                  onChange={(e) => setForm(f => ({...f, username: e.target.value}))} 
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 outline-none text-slate-800" 
                  placeholder="username" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">Email</label>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={(e) => setForm(f => ({...f, email: e.target.value}))} 
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 outline-none text-slate-800" 
                  placeholder="Enter email address" 
                  disabled={modalMode === 'edit'} 
                />
              </div>

              {modalMode === 'add' && (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">Password</label>
                  <input 
                    type="password" 
                    value={form.password} 
                    onChange={(e) => setForm(f => ({...f, password: e.target.value}))} 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-slate-500 text-slate-800 placeholder-slate-400" 
                    placeholder="••••••••" 
                  />
                </div>
              )}

              {canAssignRole && (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">Assigned Role</label>
                  <select 
                    value={form.role_id} 
                    onChange={(e) => setForm(f => ({...f, role_id: e.target.value}))} 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-slate-500 text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="">No role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => saveUserMutation.mutate()} 
                disabled={saveUserMutation.isPending || !form.email}
                className="bg-[#2D333B] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#22272e] transition-colors disabled:opacity-50 shadow-sm"
              >
                {saveUserMutation.isPending ? 'Saving...' : modalMode === 'add' ? 'Create User' : 'Update User'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}