import React, { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Package, ShoppingBag, Tags, Barcode, LogOut, ExternalLink } from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/catalog", label: "Catalog", icon: Tags },
  { to: "/admin/barcodes", label: "Barcodes", icon: Barcode },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(/** @type {any} */ (null));
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) { 
          navigate("/login", { replace: true }); 
          return; 
        }
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile?.role !== "admin") { 
          navigate("/", { replace: true }); 
          return; 
        }
        
        setUser({ ...session.user, ...profile });
      } catch (error) {
        console.error("Admin layout auth error:", error);
        navigate("/login", { replace: true });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (/** @type {any} */ item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== "/admin";

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 hidden md:flex flex-col fixed inset-y-0 left-0 border-r hairline bg-background">
        <div className="px-6 py-6 border-b hairline">
          <Link to="/admin" className="font-display text-lg tracking-[-0.04em] leading-none block">MONOLITHIC</Link>
          <p className="label-mono text-muted-foreground mt-1 text-[9px]">Atelier · Admin</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} end={item.end} className={`flex items-center gap-3 px-3 py-2.5 label-mono text-[10px] transition-colors ${isActive(item) ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                <Icon size={15} strokeWidth={1.5} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t hairline p-3 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 label-mono text-[10px] text-muted-foreground hover:text-foreground">
            <ExternalLink size={15} strokeWidth={1.5} /> View Store
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 label-mono text-[10px] text-muted-foreground hover:text-foreground text-left">
            <LogOut size={15} strokeWidth={1.5} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 border-b hairline bg-background z-40 flex items-center justify-between px-4 py-3">
        <Link to="/admin" className="font-display text-sm tracking-[-0.04em]">MONOLITHIC · Admin</Link>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`p-2 ${isActive(item) ? "text-foreground" : "text-muted-foreground"}`}>
                <Icon size={16} strokeWidth={1.5} />
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 md:ml-60 pt-16 md:pt-0 min-w-0">
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}