import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useThemeStore } from '@/shared/stores/themeStore';

export const ORG_THEMES = {
  amaze: { theme: 'amaze', logo: '/logos/amaze-logo.svg', name: 'A Maze Venture' },
  mynt:  { theme: 'mynt',  logo: '/logos/mynt-logo.svg',  name: 'mYnt Connect' },
  braincount: { theme: 'braincount', logo: '/logos/braincount-logo.svg', name: 'Braincount' },
};

export function ThemeProvider({ children }) {
  const orgSlug = useAuthStore((s) => s.user?.organization?.slug);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  useEffect(() => {
    // Dynamic theme switching via oklch-tailored custom DaisyUI attributes
    const config = ORG_THEMES[orgSlug] || ORG_THEMES.amaze;
    const themeName = isDarkMode ? `${config.theme}-dark` : config.theme;
    document.documentElement.setAttribute('data-theme', themeName);
  }, [orgSlug, isDarkMode]);

  return children;
}
