import { Link, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Dashboard from '@/pages/Dashboard';
import GroupPage from '@/pages/GroupPage';
import BillingPage from '@/pages/BillingPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import JoinInvite from '@/pages/JoinInvite';
import { PrivacyPage, TermsPage } from '@/pages/Legal';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage, VerifyEmailPage } from '@/pages/AuthPages';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={<ProtectedRoute />}><Route path="/app" element={<Dashboard />} /><Route path="/app/profile" element={<ProfilePage />} /><Route path="/join/:token" element={<JoinInvite />} /><Route path="/app/groups/:groupId" element={<GroupPage />} /><Route path="/app/groups/:groupId/billing" element={<BillingPage />} /></Route>
      <Route element={<ProtectedRoute role="SUPER_ADMIN" />}><Route path="/app/admin" element={<AdminPage />} /></Route>
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<div className="grid min-h-screen place-items-center text-center"><div><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="btn-primary mt-5">Go home</Link></div></div>} />
    </Routes>
  );
}
