import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext.jsx";
import Navbar from "./components/Navbar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import KeywordsPage from "./pages/KeywordsPage.jsx";
import { ToastContainer } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css'; 

// New component to wrap the ToastContainer and access the theme
const ThemedToastContainer = () => {
  const { theme } = useTheme();

  // React-Toastify accepts 'light', 'dark', or 'colored'
  const toastTheme = theme === 'dark' ? 'dark' : 'light'; 

  return (
    <ToastContainer 
      position="bottom-right" 
      autoClose={5000} 
      hideProgressBar={false} 
      newestOnTop={false} 
      closeOnClick 
      rtl={false} 
      pauseOnFocusLoss 
      draggable 
      pauseOnHover 
      theme={toastTheme} // PASS THE DYNAMIC THEME HERE
    />
  );
};


const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/keywords" element={<KeywordsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        {/* Render the themed toast container */}
        <ThemedToastContainer />
      </Router>
    </ThemeProvider>
  );
};

export default App;