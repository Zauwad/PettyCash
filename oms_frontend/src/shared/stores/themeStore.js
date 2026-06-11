import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  isDarkMode: localStorage.getItem('isDarkMode') !== 'false', // Default to true (standard theme)
  toggleDarkMode: () => set((state) => {
    const nextVal = !state.isDarkMode;
    localStorage.setItem('isDarkMode', String(nextVal));
    return { isDarkMode: nextVal };
  })
}));
