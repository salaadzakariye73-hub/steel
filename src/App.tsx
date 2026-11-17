import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { DashboardLayout, type NavSection } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RentalsPage } from './pages/RentalsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { DamagesPage } from './pages/DamagesPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';

function AppShell() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavSection>('dashboard');
  const [newRentalSignal, setNewRentalSignal] = useState(0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
        Loading Kaah Steel Prop Rental System...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleQuickNewRental = () => {
    setActiveTab('rentals');
    setNewRentalSignal((s) => s + 1);
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      onNavigate={setActiveTab}
      onQuickNewRental={handleQuickNewRental}
    >
      {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
      {activeTab === 'inventory' && <InventoryPage />}
      {activeTab === 'customers' && <CustomersPage />}
      {activeTab === 'projects' && <ProjectsPage />}
      {activeTab === 'rentals' && <RentalsPage triggerCreateSignal={newRentalSignal} />}
      {activeTab === 'payments' && <PaymentsPage />}
      {activeTab === 'invoices' && <InvoicesPage />}
      {activeTab === 'damages' && <DamagesPage />}
      {activeTab === 'reports' && <ReportsPage />}
      {activeTab === 'users' && <UsersPage />}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  );
}
