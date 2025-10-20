import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext.jsx";
import Navbar from "./components/Navbar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import KeywordsPage from "./pages/KeywordsPage.jsx";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Component to access theme inside ThemeProvider
const AppContent = () => {
  const { theme } = useTheme();
  const toastTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/keywords" element={<KeywordsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
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
        theme={toastTheme} // Directly pass theme here
      />
    </>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <AppContent /> {/* Render content inside provider */}
      </Router>
    </ThemeProvider>
  );
};

export default App;