// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, ShoppingCart, CreditCard, Users, 
  Package, Settings, LogOut, ChevronDown, ChevronRight, Shield
} from "lucide-react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  
  const [openMenus, setOpenMenus] = useState({ products: false, webSetting: true, generalSetup: true, role: true });

  // 1. Resolve actual user object
  const actualUser = user?.email ? user : user?.user;
  
  // 2. Fetch User Permissions globally for the layout
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

      if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
        console.error("Error fetching permissions:", error);
        return [];
      }

      const roleName = data?.admin_roles?.name;
      const isOwner = ['jackstyle4@gmail.com', 'noirmtd@gmail.com', 'admin@testing.com'].includes(actualUser.email.toLowerCase());
      
      // If user is a store owner or explicitly assigned SUPER_ADMIN, grant universal bypass
      if (isOwner || roleName === 'SUPER_ADMIN') {
        return ['SUPER_ADMIN']; 
      }

      // Otherwise, flatten their permissions into a simple array like ['orders:read', 'products:create']
      const perms = data?.admin_roles?.admin_role_permissions?.map(rp => rp.admin_permissions) || [];
      return perms.map(p => `${p.resource}:${p.action}`);
    },
    enabled: !!actualUser?.id,
    staleTime: 5 * 60 * 1000 // Cache for 5 mins
  });

  // 3. Helper function to verify access
  const hasAccess = (/** @type {string} */ resource, /** @type {string} */ action = 'read') => {
    if (userPermissions.includes('SUPER_ADMIN')) return true;
    return userPermissions.includes(`${resource}:${action}`);
  };

  useEffect(() => {
    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return; 
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const toggleMenu = (/** @type {string} */ key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItemClass = (/** @type {string} */ path, exact = false) => {
    const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
    return `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
      isActive ? "bg-slate-100 text-slate-900 border-r-4 border-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;
  };

  const currentTab = searchParams.get('tab') || '';
  const subItemClass = (/** @type {string} */ tabName) => `block px-12 py-2.5 text-sm transition-colors ${
    currentTab === tabName ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
  }`;
  
  const activeSubClass = (/** @type {string} */ path) => `block px-12 py-2.5 text-sm transition-colors ${
    location.pathname.startsWith(path) ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
  }`;

  // Prevent UI flashing while checking security rules
  if (permsLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-50">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="NOIR MTD Logo" className="h-8 w-auto object-contain" />
          </a>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          
          {/* Dashboard is universally accessible to logged-in admins */}
          <Link to="/admin" className={navItemClass("/admin", true)}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>

          {hasAccess('orders') && (
            <Link to="/admin/orders" className={navItemClass("/admin/orders")}>
              <ShoppingCart size={18} /> Product Orders
            </Link>
          )}
          
          {hasAccess('orders') && (
            <Link to="/admin/payments" className={navItemClass("/admin/payments")}>
              <CreditCard size={18} /> Payment History
            </Link>
          )}
          
          {hasAccess('users') && (
            <Link to="/admin/customers" className={navItemClass("/admin/customers")}>
              <Users size={18} /> Customer
            </Link>
          )}
          
          {hasAccess('products') && (
            <div>
              <button onClick={() => toggleMenu('products')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <div className="flex items-center gap-3"><Package size={18} /> Product Management</div>
                {openMenus.products ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {openMenus.products && (
                <div className="bg-slate-50 py-1 border-y border-slate-100">
                  {["Product", "Category", "Product Type", "Advertisement", "Color", "Size", "Inventory"].map(sub => (
                    <Link key={sub} to={`/admin/products/${sub.toLowerCase().replace(' ', '-')}`} className="block px-12 py-2.5 text-sm text-slate-500 hover:text-slate-900">— {sub}</Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasAccess('users') && (
            <Link to="/admin/users" className={navItemClass("/admin/users")}>
              <Users size={18} /> User Management
            </Link>
          )}

          {hasAccess('roles') && (
            <div>
              <button onClick={() => toggleMenu('role')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <div className="flex items-center gap-3"><Shield size={18} /> Role</div>
                {openMenus.role ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {openMenus.role && (
                <div className="bg-slate-50 py-1 border-y border-slate-100">
                  <Link to="/admin/roles" className={activeSubClass('/admin/roles')}>— Roles</Link>
                  <Link to="/admin/permissions" className={activeSubClass('/admin/permissions')}>— Permissions</Link>
                </div>
              )}
            </div>
          )}

          {hasAccess('settings') && (
            <div>
              <button onClick={() => toggleMenu('webSetting')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <div className="flex items-center gap-3"><Settings size={18} /> Web Setting</div>
                {openMenus.webSetting ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {openMenus.webSetting && (
                <div className="bg-slate-50 py-1 border-y border-slate-100">
                  <Link to="/admin/web-setup?tab=about" className={subItemClass('about')}>— About Section</Link>
                  <Link to="/admin/web-setup?tab=contact" className={subItemClass('contact')}>— Footer & Contact</Link>
                  <Link to="/admin/web-setup?tab=filters" className={subItemClass('filters')}>— Store Filters</Link>
                  <Link to="/admin/web-setup?tab=shipping" className={subItemClass('shipping')}>— Shipping & Tax</Link>
                </div>
              )}
            </div>
          )}

          {hasAccess('settings') && (
            <div>
              <button onClick={() => toggleMenu('generalSetup')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <div className="flex items-center gap-3"><Settings size={18} /> General Setup</div>
                {openMenus.generalSetup ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {openMenus.generalSetup && (
                <div className="bg-slate-50 py-1 border-y border-slate-100">
                  <Link to="/admin/web-setup?tab=slider" className={subItemClass('slider')}>— Slider</Link>
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
           <div className="flex items-center gap-4">
             <h1 className="text-lg font-semibold text-slate-800 uppercase">
               {location.pathname === "/admin" || location.pathname === "/admin/" ? "Dashboard" : location.pathname.replace('/admin/', '').replace('-', ' ')}
             </h1>
           </div>
           <div className="flex items-center gap-4 text-sm">
             <button 
               onClick={async () => {
                  try { await logout(); window.location.href = "/"; } catch (error) { console.error("Logout failed", error); window.location.href = "/"; }
               }} 
               className="flex items-center gap-2 text-slate-600 hover:text-slate-900 ml-4 border-l pl-4 transition-colors"
             >
               <LogOut size={16} /> <span className="text-xs">{actualUser?.email}</span>
             </button>
           </div>
        </header>
        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}