import { ReactNode, useState, createContext, useContext } from 'react';
import { clsx } from 'clsx';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component');
  }
  return context;
};

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  children: ReactNode;
  className?: string;
  onChange?: (value: string) => void;
}

/**
 * Tabs container component
 * Supports both controlled (value + onChange) and uncontrolled (defaultValue) modes
 */
export const Tabs = ({ defaultValue, value, children, className, onChange }: TabsProps) => {
  const [internalTab, setInternalTab] = useState(defaultValue || '');

  // Use controlled value if provided, otherwise use internal state
  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalTab;

  const handleTabChange = (tab: string) => {
    if (!isControlled) {
      setInternalTab(tab);
    }
    onChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Tabs list component (renders the tab buttons)
 */
export const TabsList = ({ children, className }: TabsListProps) => {
  return (
    <div
      className={clsx(
        'border-b border-gray-200 dark:border-gray-700 flex gap-1',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

/**
 * Tab trigger button component
 */
export const TabsTrigger = ({ value, children, className }: TabsTriggerProps) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={clsx(
        'px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-t-lg',
        isActive
          ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
        className
      )}
    >
      {children}
    </button>
  );
};

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

/**
 * Tab content component (only renders when tab is active)
 */
export const TabsContent = ({ value, children, className }: TabsContentProps) => {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div role="tabpanel" className={clsx('py-4', className)}>
      {children}
    </div>
  );
};
