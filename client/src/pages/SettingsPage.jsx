import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext.jsx';
import { Loader2, Trash2, Pencil } from 'lucide-react'; // Import icons

const API_BASE_URL = 'http://localhost:5000/api';

const SettingsPage = () => {
  // --- Theme Context ---
  const { theme, toggleTheme, accentColor, setPrimaryAccent } = useTheme();

  // --- Combined State ---
  const [config, setConfig] = useState({ _id: null, url: '', competitorUrls: [] });
  const [targetDomainInput, setTargetDomainInput] = useState(''); // Separate input state for edit mode logic
  const [newCompetitorUrl, setNewCompetitorUrl] = useState(''); // Input field state for competitors
  const [isFetchingConfig, setIsFetchingConfig] = useState(true); // Initial loading state
  const [isSaving, setIsSaving] = useState(false); // General saving/loading state for API calls
  const [isEditMode, setIsEditMode] = useState(false); // Target URL edit mode
  const [statusMessage, setStatusMessage] = useState(""); // General status message area
  const [editingCompetitorUrl, setEditingCompetitorUrl] = useState(null); // Track which URL is being edited

  // --- Fetch Configuration Data ---
  const fetchConfig = useCallback(async () => {
    setIsFetchingConfig(true);
    setStatusMessage("Loading settings...");
    try {
      const response = await axios.get(`${API_BASE_URL}/config`);
      const data = response.data || { _id: null, url: '', competitorUrls: [] };
      const fetchedConfig = {
          ...data,
          competitorUrls: Array.isArray(data?.competitorUrls) ? data.competitorUrls : []
      };
      setConfig(fetchedConfig);
      setTargetDomainInput(fetchedConfig.url); // Sync input with fetched data
      setIsEditMode(!fetchedConfig.url); // Enter edit mode if no URL is saved
      setStatusMessage(""); // Clear loading message
    } catch (error) {
      console.error('Error fetching configuration:', error);
      toast.error('Failed to load settings.');
      setConfig({ _id: null, url: '', competitorUrls: [] }); // Reset on error
      setTargetDomainInput('');
      setIsEditMode(true); // Allow editing if load failed
      setStatusMessage("Could not load settings.");
    } finally {
      setIsFetchingConfig(false);
    }
  }, []); // useCallback ensures fetchConfig has a stable identity

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]); // Run fetchConfig on mount

  // --- Target Domain Logic ---
   const handleSaveTargetDomain = async () => {
     // Validation logic (returns true if valid, false otherwise and sets status message)
     if (!targetDomainInput.trim()) {
       setStatusMessage("Target URL cannot be empty.");
       setTimeout(() => setStatusMessage(""), 3000);
       return false;
     }
     if (/^https?:\/\//i.test(targetDomainInput.trim()) || /\s/.test(targetDomainInput.trim())) {
        setStatusMessage("Please enter only the clean domain (no http:// or spaces), e.g., example.com");
        setTimeout(() => setStatusMessage(""), 3000);
        return false;
     }
     try {
       new URL(`http://${targetDomainInput.trim()}`);
     // eslint-disable-next-line no-unused-vars
     } catch (err) { // <<< ESLint fix 1: Ignore unused 'err'
       setStatusMessage("Please enter a valid domain format, e.g., example.com");
       setTimeout(() => setStatusMessage(""), 3000);
       return false;
     }
     return true;
   };

  // --- Button Text Logic (Needs to be calculated before handleSubmitTarget uses it) ---
  // isInputDirty logic moved here, using trimmed value comparison for update intent
  const isInputDirty = targetDomainInput.trim() !== config.url;
  let buttonText;
  if (isFetchingConfig || isSaving) {
    buttonText = "Loading...";
  } else if (!config.url) { // No saved URL yet
    buttonText = "Save Target Domain";
  } else if (!isEditMode) { // URL saved, not editing
    buttonText = "Edit Domain";
  } else { // URL saved, editing mode
    // Check untrimmed value for displaying "Cancel Edit" accurately
    buttonText = (targetDomainInput !== config.url) ? "Update Domain" : "Cancel Edit";
  }


  const handleSubmitTarget = async (e) => {
    e.preventDefault();

    if (!isEditMode && config.url) { // If saved and not in edit mode, switch to edit mode
      setIsEditMode(true);
      setStatusMessage("Editing target domain...");
      setTimeout(() => setStatusMessage(""), 2000);
      return;
    }

    if (isEditMode) { // If in edit mode
      // Check if buttonText is "Cancel Edit" to trigger cancellation
      if (buttonText === "Cancel Edit") {
          setTargetDomainInput(config.url); // Reset input value to the saved one
          setIsEditMode(false);
          setStatusMessage("Edit cancelled.");
          setTimeout(() => setStatusMessage(""), 2000);
          return;
      }
      // Otherwise, validate and save
      const isValid = await handleSaveTargetDomain(); // handleSaveTargetDomain uses trimmed value for validation
      if (isValid) {
          await handleSaveSettings(); // Save the entire config (using the trimmed input value)
      }
    }
  };


  // --- Competitor URL Management (Immediate Save/Update) ---
  const handleCompetitorSubmit = async (e) => {
    e.preventDefault();
    const urlValue = newCompetitorUrl.trim();

    if (!urlValue) {
        toast.error('Competitor URL cannot be empty.');
        return;
    }
    try {
        new URL(urlValue.startsWith('http') ? urlValue : `http://${urlValue}`);
    // eslint-disable-next-line no-unused-vars
    } catch (err) { // <<< ESLint fix 3: Ignore unused 'err' (changed from _)
        toast.error('Please enter a valid competitor URL or domain.');
        return;
    }

    let updatedCompetitors;
    let action = 'none';
    const isDuplicate = config.competitorUrls.includes(urlValue) && urlValue !== editingCompetitorUrl;

    if (isDuplicate) {
        toast.error('Competitor URL already exists in the list.');
        return;
    }

    if (editingCompetitorUrl) { // We are updating
      if (editingCompetitorUrl === urlValue) { // No actual change
          toast.info('No changes detected.');
          setNewCompetitorUrl('');
          setEditingCompetitorUrl(null);
          return;
      }
      updatedCompetitors = config.competitorUrls.map(url =>
          url === editingCompetitorUrl ? urlValue : url
      );
      action = 'update';
    } else { // We are adding
      updatedCompetitors = [...config.competitorUrls, urlValue];
      action = 'add';
    }

    // --- Call API to save ---
    const saveToastId = toast.loading(editingCompetitorUrl ? 'Updating competitor...' : 'Adding competitor...');
    setIsSaving(true);
    setStatusMessage(editingCompetitorUrl ? 'Updating...' : 'Adding...');

    try {
      const response = await axios.put(`${API_BASE_URL}/config`, {
          url: config.url, // Send current target URL
          competitorUrls: updatedCompetitors
      });
      const data = response.data || { _id: null, url: '', competitorUrls: [] };
      setConfig({ // Update state with the confirmed list from backend
          ...data,
          competitorUrls: Array.isArray(data?.competitorUrls) ? data.competitorUrls : []
      });
      toast.success(`Competitor ${action === 'add' ? 'added' : 'updated'} successfully!`, { id: saveToastId });
      setStatusMessage(`Competitor ${action === 'add' ? 'added' : 'updated'}!`);
      setNewCompetitorUrl(''); // Clear input
      setEditingCompetitorUrl(null); // Clear editing state

    } catch (error) {
      console.error('Error saving competitor:', error);
      const errorMsg = error.response?.data?.message || `Failed to ${action} competitor.`;
      toast.error(errorMsg, { id: saveToastId });
      setStatusMessage(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(""), 3000);
    }
  };

  const handleRemoveCompetitor = async (urlToRemove) => {
    if (!window.confirm(`Are you sure you want to delete competitor: ${urlToRemove}? This action is immediate.`)) return;

    const updatedCompetitors = config.competitorUrls.filter(url => url !== urlToRemove);

    const saveToastId = toast.loading('Deleting competitor...');
    setIsSaving(true);
    setStatusMessage("Deleting...");

    try {
        const response = await axios.put(`${API_BASE_URL}/config`, {
            url: config.url,
            competitorUrls: updatedCompetitors
        });
        const data = response.data || { _id: null, url: '', competitorUrls: [] };
        setConfig({
            ...data,
            competitorUrls: Array.isArray(data?.competitorUrls) ? data.competitorUrls : []
        });
        toast.success('Competitor deleted successfully!', { id: saveToastId });
        setStatusMessage('Competitor deleted!');
        // If the deleted URL was being edited, cancel edit mode
        if (editingCompetitorUrl === urlToRemove) {
            setNewCompetitorUrl('');
            setEditingCompetitorUrl(null);
        }
    } catch (error) {
        console.error('Error deleting competitor:', error);
        const errorMsg = error.response?.data?.message || 'Failed to delete competitor.';
        toast.error(errorMsg, { id: saveToastId });
        setStatusMessage(`Error: ${errorMsg}`);
    } finally {
        setIsSaving(false);
        setTimeout(() => setStatusMessage(""), 3000);
    }
  };

  // --- Edit Competitor Initiation ---
  const handleEditCompetitor = (urlToEdit) => {
      setEditingCompetitorUrl(urlToEdit);
      setNewCompetitorUrl(urlToEdit); // Populate the input field
      setStatusMessage(`Editing: ${urlToEdit}`);
      // Optional: Focus the input field
      document.getElementById('competitorUrlInput')?.focus();
  };

  // --- Cancel Edit Competitor ---
  const handleCancelEdit = () => {
      setNewCompetitorUrl('');
      setEditingCompetitorUrl(null);
      setStatusMessage("Edit cancelled.");
      setTimeout(() => setStatusMessage(""), 2000);
   };


  // --- Main Save Function (Triggered ONLY by Target Domain Save/Update Button) ---
  const handleSaveSettings = async () => {
    // Validation is done before calling this now
    const saveToastId = toast.loading('Saving settings...');
    setIsSaving(true);
    setStatusMessage("Saving...");

    try {
      const response = await axios.put(`${API_BASE_URL}/config`, {
          url: targetDomainInput.trim(), // Use the validated input value
          competitorUrls: config.competitorUrls // Send current competitors
      });

      const data = response.data || { _id: null, url: '', competitorUrls: [] };
      const savedConfig = {
          ...data,
          competitorUrls: Array.isArray(data?.competitorUrls) ? data.competitorUrls : []
      };

      setConfig(savedConfig); // Update state with response
      setTargetDomainInput(savedConfig.url); // Re-sync input after save
      setIsEditMode(false); // Exit edit mode on successful save
      toast.success('Settings saved successfully!', { id: saveToastId });
      setStatusMessage("Settings saved successfully!");
    } catch (error) {
      console.error('Error saving settings:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save settings.';
      toast.error(errorMsg, { id: saveToastId });
      setStatusMessage(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(""), 3000);
    }
  };


  // --- Theme Color Change ---
  const handleColorChange = (e) => {
    setPrimaryAccent(e.target.value);
  };


  // --- Render Logic ---
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-text-main">App Settings</h2>

      {/* 1. Target Domain Configuration */}
      <section className="mb-6 sm:mb-8 p-4 sm:p-6 bg-bg-secondary rounded-lg shadow-md border border-border-color">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-text-main">
          Target Domain Configuration
        </h3>
        {isFetchingConfig ? (
            <div className="flex items-center space-x-2 text-text-secondary">
              <Loader2 className="animate-spin w-5 h-5" />
              <p>Loading saved domain...</p>
            </div>
        ) : (
          <form onSubmit={handleSubmitTarget} className="flex flex-col space-y-4">
            <label htmlFor="targetUrl" className="text-sm sm:text-base text-text-secondary font-medium">
              Your Main Tracking Domain:
            </label>
            <input
              id="targetUrl"
              type="text"
              value={targetDomainInput}
              onChange={(e) => setTargetDomainInput(e.target.value)}
              disabled={!isEditMode && !!config.url}
              className={`p-2 sm:p-3 border border-border-color rounded-lg focus:ring-2 bg-bg-main text-text-main ${
                isEditMode ? 'focus:ring-accent' : 'opacity-70 cursor-not-allowed'
              }`}
              placeholder="e.g., example.com"
              required
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 pt-2 space-y-2 sm:space-y-0">
              <button
                type="submit"
                // Only truly disable if fetching/saving. Allow Cancel click even if not dirty.
                disabled={isSaving || isFetchingConfig}
                style={{
                  // Grey out if it's meant to be Cancel Edit
                  backgroundColor: (buttonText === 'Cancel Edit') ? '#6c757d' : accentColor,
                  color: theme === 'dark' ? '#FFFFFF' : '#000000'
                }}
                className={`px-4 sm:px-6 py-2 rounded-lg font-bold transition self-start disabled:opacity-50 ${
                    // Add cursor-not-allowed specifically if disabled, allow hover otherwise
                    (isSaving || isFetchingConfig) ? 'cursor-not-allowed' : 'hover:opacity-90'
                  }`}
              >
                {isSaving && !isFetchingConfig ? <Loader2 className="animate-spin w-5 h-5 inline mr-2" /> : null}
                {buttonText}
              </button>
              {statusMessage && (
                <p className={`text-xs sm:text-sm font-medium ${statusMessage.toLowerCase().includes('error') || statusMessage.toLowerCase().includes('could not') ? 'text-red-500' : 'text-accent'}`}>
                  {statusMessage}
                </p>
              )}
            </div>
             <p className="text-xs text-gray-500 dark:text-gray-400">Enter the main domain (no http:// or spaces), e.g., `yourwebsite.com`. Saving this also persists competitor changes.</p>
          </form>
        )}
      </section>

      {/* 2. Competitor Domain Configuration */}
      <section className="mb-6 sm:mb-8 p-4 sm:p-6 bg-bg-secondary rounded-lg shadow-md border border-border-color">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-text-main">
          Competitor Tracking
        </h3>

        {/* Competitor Add/Update Form */}
        <form onSubmit={handleCompetitorSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4 sm:mb-6">
          <input
            id="competitorUrlInput" // Added ID for focusing
            type="text"
            value={newCompetitorUrl}
            onChange={(e) => setNewCompetitorUrl(e.target.value)}
            className="flex-grow p-2 sm:p-3 border border-border-color rounded-lg focus:ring-2 focus:ring-accent bg-bg-main text-text-main disabled:opacity-50"
            placeholder={editingCompetitorUrl ? "Update competitor URL" : "Add competitor domain or URL"}
            disabled={isSaving || isFetchingConfig} // Disable during any loading
            required
          />
          <button
            type="submit"
            style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
            className="px-4 sm:px-6 py-2 rounded-lg font-bold hover:opacity-90 transition whitespace-nowrap disabled:opacity-50"
            disabled={isSaving || isFetchingConfig}
          >
            {editingCompetitorUrl ? 'Update' : 'Add'} Competitor
          </button>
          {editingCompetitorUrl && ( // Show Cancel button only when editing
              <button
                  type="button" // Important: type="button" to prevent form submission
                  onClick={handleCancelEdit}
                  className="px-4 sm:px-6 py-2 rounded-lg font-bold bg-gray-500 text-white hover:bg-gray-600 transition whitespace-nowrap disabled:opacity-50"
                  disabled={isSaving || isFetchingConfig}
              >
                  Cancel Edit
              </button>
          )}
        </form>

        {/* Competitor List */}
        <h4 className="text-base sm:text-lg font-semibold mb-3 text-text-main border-t pt-4 border-border-color">
          Tracked Competitors ({config.competitorUrls.length})
        </h4>

        {isFetchingConfig ? (
             <div className="flex items-center space-x-2 text-text-secondary">
               <Loader2 className="animate-spin w-5 h-5" />
               <p>Loading competitors...</p>
             </div>
        ) : config.competitorUrls.length === 0 ? (
          <p className="text-sm sm:text-base text-text-secondary italic">No competitors added yet.</p>
        ) : (
          <ul className="space-y-2 sm:space-y-3">
            {config.competitorUrls.map((url) => (
              <li key={url} className="flex justify-between items-center p-2 sm:p-3 bg-bg-main rounded-lg border border-border-color">
                <span className="text-text-main font-mono text-xs sm:text-sm break-all mr-2">{url}</span>
                <div className="flex space-x-2 flex-shrink-0">
                    <button
                        onClick={() => handleEditCompetitor(url)}
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit Competitor"
                        disabled={isSaving || isFetchingConfig || !!editingCompetitorUrl} // Disable if any save/load or another edit is active
                    >
                        <Pencil size={16} />
                    </button>
                     <button
                       onClick={() => handleRemoveCompetitor(url)}
                       className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                       title="Delete Competitor"
                       disabled={isSaving || isFetchingConfig}
                     >
                       <Trash2 size={16} />
                     </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Removed the extra save button from here */}
      </section>

      {/* 3. Theme and Color Settings */}
      <section className="p-4 sm:p-6 bg-bg-secondary rounded-lg shadow-md border border-border-color">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-text-main">
          Theme and Style
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-sm sm:text-base text-text-secondary">Mode:</span>
            <button
              onClick={toggleTheme}
              style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              className="px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-sm sm:text-base font-bold hover:opacity-90 transition"
            >
              Toggle to {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <label htmlFor="accentColor" className="text-sm sm:text-base text-text-secondary whitespace-nowrap">
              Accent Color:
            </label>
            <input
              id="accentColor"
              type="color"
              value={accentColor}
              onChange={handleColorChange}
              // Basic inline style for consistent size & appearance
              style={{ width: '2rem', height: '2rem', padding: '0', border: 'none', borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', appearance: 'none', backgroundColor: 'transparent' }}
              title="Choose your primary accent color"
            />
            <span className="text-text-main font-mono text-sm sm:text-base">{accentColor}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;