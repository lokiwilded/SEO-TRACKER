import React, { createContext, useState, useEffect, useContext } from 'react';

// 1. Create the Context
const ThemeContext = createContext();

// Constants for localStorage keys
const THEME_KEY = 'seo-theme';
const ACCENT_KEY = 'seo-accent';
const DEFAULT_ACCENT = '#4a90e2'; // Default primary blue

// 2. Custom hook to use the Theme Context
export const useTheme = () => useContext(ThemeContext);

// 3. Theme Provider Component
export const ThemeProvider = ({ children }) => {
  // State for theme ('light' or 'dark')
  const [theme, setTheme] = useState(() => {
    // Try to load from localStorage, default to 'light'
    return localStorage.getItem(THEME_KEY) || 'light';
  });

  // State for accent color (HEX string)
  const [accentColor, setAccentColor] = useState(() => {
    // Try to load from localStorage, default to primary blue
    return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
  });

  // Effect to manage the theme class and accent color on the <html> element
  useEffect(() => {
    const root = document.documentElement; // Target the <html> element
    
    // 1. Manage Dark Mode Class
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    localStorage.setItem(THEME_KEY, theme);
    
    // 2. Manage Accent Color CSS Variable
    root.style.setProperty('--primary-color', accentColor);
    localStorage.setItem(ACCENT_KEY, accentColor);

  }, [theme, accentColor]); // Re-run when theme or accentColor changes

  // Function to toggle between light and dark
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Function to change the accent color
  const setPrimaryAccent = (newColor) => {
    setAccentColor(newColor);
  };

  const contextValue = {
    theme,
    accentColor,
    toggleTheme,
    setPrimaryAccent,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};