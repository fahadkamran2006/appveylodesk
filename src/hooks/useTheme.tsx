import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'veylodesk-dashboard-theme';

// Routes that should respect user theme preference (dashboard routes)
const DASHBOARD_PREFIXES = ['/admin', '/client', '/editor'];

function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
    }
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [currentPath, setCurrentPath] = useState<string>('');

  // Listen for route changes
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };

    updatePath();

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', updatePath);
    
    // Use MutationObserver to detect route changes from React Router
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        updatePath();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', updatePath);
      observer.disconnect();
    };
  }, [currentPath]);

  useEffect(() => {
    const root = window.document.documentElement;
    const isDashboard = isDashboardRoute(currentPath);

    const applyTheme = (newTheme: Theme, forDashboard: boolean) => {
      let resolved: 'dark' | 'light' = 'dark';
      
      // Landing page and public routes always stay dark
      if (!forDashboard) {
        resolved = 'dark';
      } else if (newTheme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        resolved = newTheme;
      }

      setResolvedTheme(resolved);

      // Remove both classes and add the correct one
      root.classList.remove('light', 'dark');
      if (resolved === 'light') {
        root.classList.add('light');
      } else {
        root.classList.add('dark');
      }
    };

    applyTheme(theme, isDashboard);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system' && isDashboard) {
        applyTheme('system', true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, currentPath]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
