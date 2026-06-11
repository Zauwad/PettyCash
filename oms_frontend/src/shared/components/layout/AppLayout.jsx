import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Primary Sidebar Navigation (desktop only) */}
      <Sidebar />

      {/* Mobile Navigation Drawer */}
      <MobileNav 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Workspace Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Toolbar Header with Hamburger menu action */}
        <Header onMenuToggle={() => setIsMobileMenuOpen(true)} />

        {/* Dynamic Route Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-tr from-base-300/30 via-base-100 to-base-100">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
export default AppLayout;
