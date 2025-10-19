import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import { Loader2, Trash2 } from 'lucide-react'; 

// Base URL for the backend API
const API_BASE_URL = 'http://localhost:5000/api/urls';

const SettingsPage = () => {
  const { theme, toggleTheme, accentColor, setPrimaryAccent } = useTheme();

  // --- Target Domain State ---
  const [savedDomain, setSavedDomain] = useState('');
  const [targetDomainInput, setTargetDomainInput] = useState('');
  const [targetSaveStatus, setTargetSaveStatus] = useState(""); 
  const [isTargetLoading, setIsTargetLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // --- Competitor State ---
  const [competitors, setCompetitors] = useState([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitorSaveStatus, setCompetitorSaveStatus] = useState("");
  const [isCompetitorLoading, setIsCompetitorLoading] = useState(true);


  // --- Data Fetching ---
  const fetchTargetDomain = async () => {
    // ... (unchanged)
    try {
      const response = await fetch(`${API_BASE_URL}/target`);
      const data = await response.json();
      
      if (response.ok && data.url) {
        setSavedDomain(data.url);
        setTargetDomainInput(data.url);
        setIsEditMode(false); 
      } else {
        setIsEditMode(true); 
      }
    } catch (error) {
      console.error('Error fetching target domain:', error);
      setTargetSaveStatus("Could not load saved domain.");
      setIsEditMode(true); 
    } finally {
      setIsTargetLoading(false);
    }
  };

  const fetchCompetitors = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/competitors`);
        const data = await response.json();
        if (response.ok) {
            setCompetitors(data);
        }
    } catch (error) {
        console.error('Error fetching competitors:', error);
        setCompetitorSaveStatus("Could not load competitors.");
    } finally {
        setIsCompetitorLoading(false);
    }
  };


  useEffect(() => {
    fetchTargetDomain();
    fetchCompetitors();
  }, []);

  // --- Target Domain Logic (mostly unchanged) ---
  const handleSaveDomain = async () => {
    setTargetSaveStatus("Saving...");
    if (targetDomainInput.includes('http') || targetDomainInput.includes(' ')) {
        setTargetSaveStatus("Please enter only the clean domain, e.g., example.com");
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetDomainInput }),
      });

      const data = await response.json();

      if (response.ok) {
        setSavedDomain(data.url); 
        setTargetDomainInput(data.url);
        setTargetSaveStatus("Target Domain updated successfully!");
        setIsEditMode(false); 
        // Re-fetch competitors because the new target might have deleted an old competitor
        fetchCompetitors(); 
      } else {
        setTargetSaveStatus(`Error: ${data.message || 'Failed to save domain'}`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setTargetSaveStatus("Network error. Check console and server logs.");
    }
    
    setTimeout(() => setTargetSaveStatus(""), 3000);
  };
  
  const handleSubmitTarget = async (e) => {
    e.preventDefault();

    if (!isEditMode && savedDomain) {
      setIsEditMode(true);
      return;
    }
    if (isEditMode) {
      await handleSaveDomain();
    }
  };

  // --- Competitor Logic (NEW) ---
  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    if (!competitorInput) return;
    
    setCompetitorSaveStatus("Adding...");

    try {
        const response = await fetch(`${API_BASE_URL}/competitors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: competitorInput }),
        });

        const data = await response.json();

        if (response.ok) {
            // Update the state with the new competitor data returned by the server (includes _id)
            setCompetitors(prev => [...prev, data.competitor]);
            setCompetitorInput(''); // Clear input field
            setCompetitorSaveStatus("Competitor added!");
        } else {
            setCompetitorSaveStatus(`Error: ${data.message || 'Failed to add competitor'}`);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        setCompetitorSaveStatus("Network error. Could not add competitor.");
    }

    setTimeout(() => setCompetitorSaveStatus(""), 3000);
  };

  const handleDeleteCompetitor = async (id) => {
      if (!window.confirm("Are you sure you want to delete this competitor?")) return;

      setCompetitorSaveStatus("Deleting...");
      try {
          const response = await fetch(`${API_BASE_URL}/competitors/${id}`, {
              method: 'DELETE',
          });

          if (response.ok) {
              setCompetitors(prev => prev.filter(c => c._id !== id));
              setCompetitorSaveStatus("Competitor deleted!");
          } else {
              const data = await response.json();
              setCompetitorSaveStatus(`Error: ${data.message || 'Failed to delete competitor'}`);
          }
      } catch (error) {
          console.error('Fetch error:', error);
          setCompetitorSaveStatus("Network error. Could not delete competitor.");
      }
      setTimeout(() => setCompetitorSaveStatus(""), 3000);
  };


  const handleColorChange = (e) => {
    setPrimaryAccent(e.target.value);
  };

  const isInputDirty = targetDomainInput !== savedDomain;

  let buttonText;
  if (isTargetLoading) {
    buttonText = "Loading...";
  } else if (!savedDomain) {
    buttonText = "Save Target Domain";
  } else if (!isEditMode) {
    buttonText = "Edit Domain"; 
  } else {
    buttonText = isInputDirty ? "Update Domain" : "Saved (No Changes)";
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-text-main">App Settings</h2>

      {/* 1. Target Domain Configuration */}
      <section className="mb-8 p-6 bg-bg-secondary rounded-lg shadow-xl border border-border-color">
        <h3 className="text-xl font-semibold mb-4 text-text-main">
          Target Domain Configuration
        </h3>
        
        {isTargetLoading ? (
            <div className="flex items-center space-x-2 text-text-secondary">
                <Loader2 className="animate-spin w-5 h-5" />
                <p>Loading saved domain...</p>
            </div>
        ) : (
            <form onSubmit={handleSubmitTarget} className="flex flex-col space-y-4">
                <label htmlFor="targetUrl" className="text-text-secondary font-medium">
                    Your Main Tracking Domain:
                </label>
                <input
                    id="targetUrl"
                    type="text" 
                    value={targetDomainInput}
                    onChange={(e) => setTargetDomainInput(e.target.value)}
                    disabled={!isEditMode && savedDomain} 
                    className={`p-3 border border-border-color rounded-lg focus:ring-2 bg-bg-main text-text-main 
                                ${isEditMode ? 'focus:ring-primary-color' : 'opacity-80 cursor-default'}`}
                    placeholder="e.g., cleanandshiny.co.uk"
                    required
                />
                
                <div className="flex items-center space-x-4 pt-2">
                    <button
                        type="submit"
                        disabled={isEditMode && savedDomain && !isInputDirty}
                        style={{ 
                            backgroundColor: (isEditMode && !isInputDirty && savedDomain) ? '#6c757d' : accentColor,
                            color: theme === 'dark' ? '#121212' : '#ffffff' 
                        }}
                        className={`px-6 py-2 rounded-lg font-bold transition self-start 
                                   ${isEditMode && !isInputDirty && savedDomain ? 'opacity-70' : 'hover:opacity-90'}`}
                    >
                        {buttonText}
                    </button>
                    {targetSaveStatus && (
                        <p className={`text-sm font-medium ${targetSaveStatus.startsWith('Error') ? 'text-red-500' : 'text-accent-primary'}`}>
                            {targetSaveStatus}
                        </p>
                    )}
                </div>
            </form>
        )}
      </section>

      {/* 2. Competitor Domain Configuration (NEW SECTION) */}
      <section className="mb-8 p-6 bg-bg-secondary rounded-lg shadow-xl border border-border-color">
        <h3 className="text-xl font-semibold mb-4 text-text-main">
          Competitor Tracking
        </h3>
        
        {/* Competitor Add Form */}
        <form onSubmit={handleAddCompetitor} className="flex space-x-2 mb-6">
          <input
            type="text"
            value={competitorInput}
            onChange={(e) => setCompetitorInput(e.target.value)}
            className="flex-grow p-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary-color bg-bg-main text-text-main"
            placeholder="Add competitor domain, e.g., site-B.com"
            required
          />
          <button
            type="submit"
            style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#121212' : '#ffffff' }}
            className="px-6 py-2 rounded-lg font-bold hover:opacity-90 transition whitespace-nowrap"
          >
            Add Competitor
          </button>
        </form>
        {competitorSaveStatus && (
            <p className={`text-sm font-medium mb-4 ${competitorSaveStatus.startsWith('Error') ? 'text-red-500' : 'text-accent-primary'}`}>
                {competitorSaveStatus}
            </p>
        )}

        {/* Competitor List */}
        <h4 className="text-lg font-semibold mb-3 text-text-main border-t pt-4 border-border-color">
            Tracked Competitors ({competitors.length})
        </h4>
        
        {isCompetitorLoading ? (
             <div className="flex items-center space-x-2 text-text-secondary">
                <Loader2 className="animate-spin w-5 h-5" />
                <p>Loading competitors...</p>
            </div>
        ) : competitors.length === 0 ? (
            <p className="text-text-secondary">No competitors added yet.</p>
        ) : (
            <ul className="space-y-3">
              {competitors.map((competitor) => (
                <li key={competitor._id} className="flex justify-between items-center p-3 bg-bg-main rounded-lg border border-border-color">
                  <span className="text-text-main font-mono text-sm">{competitor.url}</span>
                  <button
                    onClick={() => handleDeleteCompetitor(competitor._id)}
                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition"
                    title="Delete Competitor"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
        )}

      </section>

      {/* 3. Theme and Color Settings (Existing) */}
      <section className="p-6 bg-bg-secondary rounded-lg shadow-md border border-border-color">
        <h3 className="text-xl font-semibold mb-4 text-text-main">
          Theme and Style
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
          
          <div className="flex items-center space-x-4">
            <span className="text-text-secondary">Dark Mode:</span>
            <button
              onClick={toggleTheme}
              style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#121212' : '#ffffff' }}
              className="px-4 py-2 rounded-lg font-bold hover:opacity-90 transition"
            >
              Toggle to {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <label htmlFor="accentColor" className="text-text-secondary">
              Primary Accent Color:
            </label>
            <input
              id="accentColor"
              type="color"
              value={accentColor}
              onChange={handleColorChange}
              className="w-10 h-10 p-0 border-none rounded-full cursor-pointer overflow-hidden"
              title="Choose your primary accent color"
            />
            <span className="text-text-main font-mono">{accentColor}</span>
          </div>
          
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;