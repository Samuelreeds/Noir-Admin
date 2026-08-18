import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';

// Storefront Imports
import StoreLayout from '@/components/store/StoreLayout';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import ProductDetail from '@/pages/ProductDetail';
import Checkout from '@/pages/Checkout';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Wishlist from '@/pages/Wishlist';

// Account Imports
import AccountLayout from '@/components/account/AccountLayout';
import AccountProfile from '@/pages/account/Profile';
import AccountOrders from '@/pages/account/Orders';
import AccountAddresses from '@/pages/account/Addresses';

// Admin Imports
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminOrders from '@/pages/admin/Orders';
import AdminCustomers from '@/pages/admin/Customers';
import AdminPaymentHistory from '@/pages/admin/PaymentHistory';
import AdminCategories from '@/pages/admin/Categories';
import AdminProductTypes from '@/pages/admin/ProductTypes';
import AdminProducts from '@/pages/admin/Products';
import AdminAdvertisement from '@/pages/admin/Advertisement';
import AdminColors from '@/pages/admin/Colors';
import AdminSizes from '@/pages/admin/Sizes';
import AdminInventory from '@/pages/admin/Inventory';
import AdminWebSetup from '@/pages/admin/WebSetup';

// Auth Imports
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';

// --- ADMIN EMAILS BULLETPROOF CHECK ---
// We hardcode the primary admins so it NEVER fails, and merge it with .env variables.
const HARDCODED_ADMINS = [
  'jackstyle4@gmail.com',
  'noirmtd@gmail.com',
  'admin@testing.com'
];

const getAdminEmails = () => {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS || "";
  const parsedEnv = envEmails.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  // Merge hardcoded and env emails, removing duplicates
  return [...new Set([...HARDCODED_ADMINS, ...parsedEnv])];
};

const ADMIN_EMAILS = getAdminEmails();

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // --- STRICT ADMIN VERIFICATION ---
  // Depending on how AuthContext is written, user might be { email: ... } or { user: { email: ... } }
  const currentUser = user?.email ? user : user?.user;
  const userEmail = currentUser?.email?.toLowerCase().trim();
  const isRoleAdmin = currentUser?.user_metadata?.role === 'admin' || currentUser?.role === 'admin'; 
  const isAdmin = currentUser && ((userEmail && ADMIN_EMAILS.includes(userEmail)) || isRoleAdmin);

  // =================================================================
  // 1. STRICT ADMIN ROUTING
  // If you are an admin, the customer storefront is deleted from your session.
  // =================================================================
  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/inventory" element={<AdminInventory />} />
          <Route path="products/size" element={<AdminSizes />} />
          <Route path="products/color" element={<AdminColors />} />
          <Route path="products/advertisement" element={<AdminAdvertisement />} />
          <Route path="products/product" element={<AdminProducts />} />
          <Route path="products/product-type" element={<AdminProductTypes />} />
          <Route path="products/category" element={<AdminCategories />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="payments" element={<AdminPaymentHistory />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="web-setup" element={<AdminWebSetup />} />
        </Route>
        
        {/* Force admins back to dashboard if they try to access /account or / */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // =================================================================
  // 2. STANDARD STOREFRONT ROUTING (For Customers & Guests)
  // =================================================================
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Storefront Routes */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      {/* Customer Account Routes */}
      <Route path="/account" element={<AccountLayout />}>
        <Route index element={<AccountProfile />} />
        <Route path="orders" element={<AccountOrders />} />
        <Route path="addresses" element={<AccountAddresses />} />
      </Route>

      {/* 404 CATCH-ALL */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}