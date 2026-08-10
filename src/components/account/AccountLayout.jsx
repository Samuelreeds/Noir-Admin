import React, { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { User, ShoppingBag, MapPin, LogOut } from "lucide-react";

const NAV = [
  { to: "/account", label: "Profile", icon: User, end: true },
  { to: "/account/orders", label: "Orders", icon: ShoppingBag },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
];

export default function AccountLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(/** @type {any} */ (null));
  const [checking, setChecking] = useState(true);

  const loadMe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      setUser({ ...session.user, ...profile });
    }
    setChecking(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { 
          navigate("/login"); 
          return; 
        }
        await loadMe();
      } catch (error) {
        console.error("Account layout auth error:", error);
        navigate("/login");
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (checking || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (/** @type {any} */ item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-14">
      <header className="mb-10">
        <p className="label-mono text-muted-foreground mb-2">— Account</p>
        <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">
          {user.full_name || user.email?.split("@")[0] || "Member"}.
        </h1>
        <p className="label-mono text-muted-foreground text-[10px] mt-3">{user.email} · {user.role || 'Customer'}</p>
      </header>

      <div className="grid md:grid-cols-[200px_1fr] gap-8 md:gap-12">
        <nav className="flex md:flex-col gap-1 md:border-r hairline md:pr-4 overflow-x-auto md:overflow-visible no-scrollbar">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} end={item.end} className={`flex items-center gap-3 px-3 py-2.5 label-mono text-[10px] whitespace-nowrap ${isActive(item) ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                <Icon size={15} strokeWidth={1.5} /> {item.label}
              </Link>
            );
          })}
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 label-mono text-[10px] text-muted-foreground hover:text-foreground text-left whitespace-nowrap">
            <LogOut size={15} strokeWidth={1.5} /> Sign Out
          </button>
        </nav>

        <div className="min-w-0">
          <Outlet context={{ user, reloadUser: loadMe }} />
        </div>
      </div>
    </div>
  );
}