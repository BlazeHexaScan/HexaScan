import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui';
import logoImg from '@/assets/logo.jpg';

interface HeaderProps {
  onMenuClick: () => void;
}

/**
 * Application header with user menu, logout, and mobile hamburger menu
 */
export const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center px-4 md:px-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        aria-label="Toggle menu"
        className="md:hidden mr-2"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex-1">
        <img src={logoImg} alt="HexaScan" className="h-20 w-auto" />
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {user && (
          <>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Logout">
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
};
