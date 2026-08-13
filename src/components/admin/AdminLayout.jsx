import React, { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  LayoutDashboard, ShoppingCart, CreditCard, Users, 
  Package, Settings, LogOut, ChevronDown, ChevronRight
} from "lucide-react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, isLoadingAuth, logout } = useAuth();
  
  // State for collapsible menus (Default Web Setting & General Setup to open)
  const [openMenus, setOpenMenus] = useState({ products: false, webSetting: true, generalSetup: true });

  // 1. Auth & Redirect Logic
  useEffect(() => {
    if (!isLoadingAuth) {
      if (!user) { 
        navigate("/login", { replace: true }); 
      } else if (user?.role?.trim() !== "admin") { 
        window.location.href = "http://localhost:5173"; 
      }
    }
  }, [user, isLoadingAuth, navigate]);

  // 2. Global Escape Key Listener for "Go Back" Navigation
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

  if (isLoadingAuth || !user || user?.role?.trim() !== "admin") return null;

  const toggleMenu = (/** @type {string} */ key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItemClass = (/** @type {string} */ path, exact = false) => {
    const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
    return `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
      isActive ? "bg-slate-100 text-slate-900 border-r-4 border-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;
  };

  // Helper for the new nested Query Param links
  const currentTab = searchParams.get('tab') || '';
  const subItemClass = (/** @type {string} */ tabName) => `block px-12 py-2.5 text-sm transition-colors ${
    currentTab === tabName ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
  }`;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-50">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="NOIR MTD Logo" className="h-8 w-auto object-contain" />
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <Link to="/" className={navItemClass("/", true)}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link to="/orders" className={navItemClass("/orders")}>
            <ShoppingCart size={18} /> Product Orders
          </Link>
          <Link to="/payments" className={navItemClass("/payments")}>
            <CreditCard size={18} /> Payment History
          </Link>
          <Link to="/customers" className={navItemClass("/customers")}>
            <Users size={18} /> Customer
          </Link>
          
          {/* Collapsible Product Management */}
          <div>
            <button onClick={() => toggleMenu('products')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <div className="flex items-center gap-3"><Package size={18} /> Product Management</div>
              {openMenus.products ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openMenus.products && (
              <div className="bg-slate-50 py-1 border-y border-slate-100">
                {["Product", "Category", "Product Type", "Advertisement", "Color", "Size", "Inventory"].map(sub => (
                  <Link key={sub} to={`/products/${sub.toLowerCase().replace(' ', '-')}`} className="block px-12 py-2.5 text-sm text-slate-500 hover:text-slate-900">— {sub}</Link>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Web Setting */}
          <div>
            <button onClick={() => toggleMenu('webSetting')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <div className="flex items-center gap-3"><Settings size={18} /> Web Setting</div>
              {openMenus.webSetting ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openMenus.webSetting && (
              <div className="bg-slate-50 py-1 border-y border-slate-100">
                <Link to="/web-setup?tab=about" className={subItemClass('about')}>— About Section</Link>
                <Link to="/web-setup?tab=contact" className={subItemClass('contact')}>— Footer & Contact</Link>
                <Link to="/web-setup?tab=filters" className={subItemClass('filters')}>— Store Filters</Link>
                <Link to="/web-setup?tab=shipping" className={subItemClass('shipping')}>— Shipping & Tax</Link>
              </div>
            )}
          </div>

          {/* Collapsible General Setup (Only Slider remaining) */}
          <div>
            <button onClick={() => toggleMenu('generalSetup')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <div className="flex items-center gap-3"><Settings size={18} /> General Setup</div>
              {openMenus.generalSetup ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openMenus.generalSetup && (
              <div className="bg-slate-50 py-1 border-y border-slate-100">
                <Link to="/web-setup?tab=slider" className={subItemClass('slider')}>— Slider</Link>
              </div>
            )}
          </div>

        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
           <div className="flex items-center gap-4">
             <h1 className="text-lg font-semibold text-slate-800 uppercase">
               {location.pathname === "/" ? "Dashboard" : location.pathname.replace('/', '').replace('-', ' ')}
             </h1>
           </div>
           <div className="flex items-center gap-4 text-sm">
             <button onClick={() => logout()} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 ml-4 border-l pl-4">
               <LogOut size={16} /> <span className="text-xs">{user.email}</span>
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