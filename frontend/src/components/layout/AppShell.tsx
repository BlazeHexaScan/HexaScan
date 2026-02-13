import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/**
 * Main application shell with header, sidebar, and content area
 * Includes mobile responsive behavior with hamburger menu
 */
export const AppShell = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950">
          <div className="p-4 md:p-6 custom-scrollbar h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
