import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="flex justify-between items-center p-4 border-b border-border-color bg-bg-secondary">
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="text-text-main font-bold hover:text-accent-primary">Dashboard</Link>
        <Link to="/keywords" className="text-text-main font-bold hover:text-accent-primary">Keywords</Link>
        <Link to="/settings" className="text-text-main font-bold hover:text-accent-primary">Settings</Link>
      </div>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 rounded-lg bg-accent-primary --text-main hover:opacity-90 transition"
      >
        Toggle {theme === "dark" ? "Light" : "Dark"} Mode
      </button>
    </nav>
  );
};

export default Navbar;
