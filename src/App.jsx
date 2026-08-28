import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';

// --- ADMIN IMPORTS ONLY ---
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
import AdminRoles from '@/pages/admin/Roles';
import AdminCreateRole from '@/pages/admin/CreateRole';
import AdminPermissions from '@/pages/admin/Permissions';
import AdminUsers from '@/pages/admin/Users';
import AdminActivityLogs from '@/pages/admin/ActivityLogs';
import AdminSecurity from '@/pages/admin/Security';
import AdminReports from '@/pages/admin/Reports';

// Auth Imports
import Login from '@/pages/Login';

// --- ADMIN VERIFICATION LOGIC ---
const HARDCODED_ADMINS = [
  'jackstyle4@gmail.com',
  'noirmtd@gmail.com',
  'admin@testing.com'
];

const getAdminEmails = () => {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS || "";
  const parsedEnv = envEmails.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...HARDCODED_ADMINS, ...parsedEnv])];
};

const ADMIN_EMAILS = getAdminEmails();

const AdminApp = () => {
  const { isLoadingAuth, authError, navigateToLogin, user } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  const currentUser = user?.email ? user : user?.user;
  const userEmail = currentUser?.email?.toLowerCase().trim();
  const isRoleAdmin = currentUser?.user_metadata?.role === 'admin' || currentUser?.role === 'admin'; 
  const isAdmin = currentUser && ((userEmail && ADMIN_EMAILS.includes(userEmail)) || isRoleAdmin);

  // If someone logs in but isn't an admin, force them back to the login screen
  if (!isAdmin) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Admin Routes - Base path is now "/" instead of "/admin"
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
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
        <Route path="reports" element={<AdminReports />} />
        <Route path="web-setup" element={<AdminWebSetup />} />
        <Route path="roles" element={<AdminRoles />} />
        <Route path="roles/create" element={<AdminCreateRole />} />
        <Route path="roles/:id" element={<AdminCreateRole />} />
        <Route path="permissions" element={<AdminPermissions />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="activity-logs" element={<AdminActivityLogs />} />
        <Route path="security" element={<AdminSecurity />} />
      </Route>
      
      {/* Catch-all to redirect back to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* All other routes get passed to the Admin logic */}
            <Route path="/*" element={<AdminApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}