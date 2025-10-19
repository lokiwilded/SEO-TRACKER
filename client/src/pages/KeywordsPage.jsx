import React, { useState, useEffect, useCallback } from "react";
import { Trash2, Edit, Loader2 } from 'lucide-react';
import { useTheme } from "../context/ThemeContext.jsx"; 
import { toast } from 'react-toastify'; 

// Base URL for the backend API
const API_BASE_URL = 'http://localhost:5000/api/keywords';

// Helper function to get the current text color class based on theme
const getTextColor = (currentTheme) => (
    currentTheme === 'dark' ? 'text-text-main' : 'text-text-main'
);


const KeywordsPage = () => {
  const { accentColor, theme } = useTheme(); 
  const textColorClass = getTextColor(theme); 

  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  
  // State for initial load (only true on first mount, cleared after first fetch)
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data Fetching Function wrapped with useCallback (Stable) ---
  const fetchKeywords = useCallback(async () => {
    try {
      const response = await fetch(API_BASE_URL);
      const data = await response.json();
      
      if (response.ok) {
        // Set new keyword data directly
        const sortedKeywords = data.sort((a, b) => a.term.localeCompare(b.term));
        setKeywords(sortedKeywords); // This instantly updates the table
      } else {
        toast.error(`Error loading keywords: ${data.message || 'Server error on load.'}`);
      }
    } catch (error) {
      console.error('Network error fetching keywords:', error);
      toast.error("Error: Could not connect to the backend server (Is it running on port 5000?).");
    } finally {
      // Clear initial loading state once the fetch is complete (regardless of success/failure)
      setIsInitialLoading(false); 
    }
  }, []); // Empty dependency array ensures this function is stable

  // --- useEffect Hook (Initial Data Load) ---
  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]); 
  
  // --- Keyword Addition Logic (FIXED TOAST RESOLUTION) ---
  const handleAddKeywords = async (e) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;

    // 1. Create the loading toast
    const loadingToastId = toast.loading("Adding keywords...");

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordInput }),
      });

      const data = await response.json();

      if (response.ok) {
        setKeywordInput('');
        
        // 1. Update toast to SUCCESS
        toast.update(loadingToastId, { 
            render: "Keyword(s) added successfully!", 
            type: toast.TYPE.SUCCESS, 
            isLoading: false, 
            autoClose: 2000 // Toast disappears after 2 seconds
        });
        
        // 2. Trigger fetch, which updates the UI immediately
        fetchKeywords(); 

      } else {
        // Server Error Response: Update toast to ERROR (Guaranteed dismissal)
        toast.update(loadingToastId, { 
            render: `Error: ${data.message || 'Failed to add keywords'}`, 
            type: toast.TYPE.ERROR, 
            isLoading: false, 
            autoClose: 5000 
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      // Network Failure: Update toast to ERROR (Guaranteed dismissal)
      toast.update(loadingToastId, { 
          render: "Network error. Could not add keywords.", 
          type: toast.TYPE.ERROR, 
          isLoading: false, 
          autoClose: 5000 
      });
    }
  };

  // --- Single Keyword Deletion Logic ---
  const handleDeleteKeyword = (id, term) => {
    // Show an interactive toast for confirmation
    toast.warn(
        ({ closeToast }) => (
            <div className={`flex flex-col ${textColorClass}`}>
                <p className="font-semibold">Are you sure you want to delete <span className="font-mono">**{term}**</span>?</p>
                <button
                    onClick={() => {
                        closeToast();
                        confirmDelete([id]);
                    }}
                    // Inject accentColor for button background and theme-dependent text color
                    style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#121212' : '#ffffff' }} 
                    className="mt-2 px-3 py-1 rounded-md font-semibold hover:opacity-90 transition"
                >
                    Confirm Delete
                </button>
            </div>
        ),
        {
            autoClose: false,
            closeButton: true,
            draggable: false,
        }
    );
  };
  
  // --- Core Deletion Handler ---
  const confirmDelete = async (idsToDelete) => {
    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting ${idsToDelete.length} keyword(s)...`);
    
    const deletePromises = idsToDelete.map(id => 
        fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' })
    );

    const results = await Promise.allSettled(deletePromises);

    const successfullyDeleted = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    
    setSelectedIds(new Set());
    
    // Check if any deletion failed to determine success type
    if (successfullyDeleted === idsToDelete.length && successfullyDeleted > 0) {
        toast.update(loadingToastId, { 
            render: `Keyword(s) deleted successfully.`, // Simplified Message
            type: toast.TYPE.SUCCESS, 
            isLoading: false, 
            autoClose: 2000 // Auto-close after 2 seconds
        });
    } else {
        toast.update(loadingToastId, { 
            render: `Finished deleting. ${successfullyDeleted} of ${idsToDelete.length} deleted.`, 
            type: toast.TYPE.WARNING, 
            isLoading: false, 
            autoClose: 5000 
        });
    }

    // Refresh the list to update the UI
    fetchKeywords();
    setIsDeleting(false);
  };


  // --- Multi-Select Handlers ---
  const isAllSelected = selectedIds.size === keywords.length && keywords.length > 0;
  
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(keywords.map(k => k._id));
      setSelectedIds(allIds);
    }
  };

  const handleSelectKeyword = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      
      const idsArray = Array.from(selectedIds);
      
      toast.warn(
          ({ closeToast }) => (
              <div className={`flex flex-col ${textColorClass}`}>
                  <p className="font-semibold">Confirm deletion of **{idsArray.length}** selected keywords?</p>
                  <button
                      onClick={() => {
                          closeToast();
                          confirmDelete(idsArray);
                      }}
                      style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#121212' : '#ffffff' }}
                      className="mt-2 px-3 py-1 rounded-md font-semibold hover:opacity-90 transition"
                      disabled={isDeleting}
                  >
                      {isDeleting ? 'Deleting...' : 'Confirm Bulk Delete'}
                  </button>
              </div>
          ),
          {
              autoClose: false,
              closeButton: true,
              draggable: false,
          }
      );
  };


  // --- Placeholder Logic ---
  const handleEditKeyword = (keyword) => {
      const newTerm = prompt(`Editing keyword: ${keyword.term}. Enter new term:`, keyword.term);
      if (newTerm && newTerm.trim() !== keyword.term) {
          toast.info(`Pretending to save new term: ${newTerm}`);
      }
  };
  
  const getCurrentRank = () => 'N/A';
  const getLastUpdated = () => 'Never';


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-text-main">Keyword Tracker</h2>

      {/* Input Form */}
      <section className="mb-8 p-6 bg-bg-secondary rounded-lg shadow-xl border border-border-color">
        <h3 className="text-xl font-semibold mb-4 text-text-main">
          Add New Keywords
        </h3>
        <form onSubmit={handleAddKeywords} className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            className="flex-grow p-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary-color bg-bg-main text-text-main"
            placeholder="Enter keywords, separated by commas (e.g., seo audit, rank tracking, keyword tool)"
            required
          />
          <button
            type="submit"
            style={{ backgroundColor: accentColor, color: theme === 'dark' ? '#121212' : '#ffffff' }}
            className="px-6 py-2 rounded-lg font-bold hover:opacity-90 transition whitespace-nowrap"
          >
            Add Keywords
          </button>
        </form>
      </section>

      {/* Keywords Table */}
      <section>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-text-main">
              Tracked Keywords ({keywords.length})
            </h3>
            {/* Bulk Delete Button */}
            <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || isDeleting}
                style={{ 
                    backgroundColor: selectedIds.size > 0 ? '#dc3545' : '#6c757d', 
                    color: '#ffffff'
                }}
                className={`px-4 py-2 rounded-lg font-bold transition flex items-center space-x-2 
                           ${selectedIds.size > 0 ? 'hover:opacity-90' : 'opacity-70 cursor-not-allowed'}`}
            >
                <Trash2 size={16} />
                <span>Delete ({selectedIds.size})</span>
            </button>
        </div>
        
        {isInitialLoading && keywords.length === 0 ? (
            <div className="flex items-center space-x-2 text-text-secondary p-4">
                <Loader2 className="animate-spin w-5 h-5" />
                <p>Loading keywords...</p>
            </div>
        ) : keywords.length === 0 ? (
            <p className="text-text-secondary p-4">Start by adding your first keyword!</p>
        ) : (
            <div className="overflow-x-auto border border-border-color rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary">
                        <tr>
                            {/* Select All Checkbox */}
                            <th className="px-3 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    className="rounded text-primary-color bg-bg-main border-border-color focus:ring-primary-color"
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Keyword</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Current Rank (Target)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Last Updated</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                        {keywords.map((keyword) => (
                            <tr 
                                key={keyword._id} 
                                className={`bg-bg-main transition duration-150 ${selectedIds.has(keyword._id) ? 'bg-bg-secondary/70' : 'hover:bg-bg-secondary/50'}`}
                            >
                                {/* Individual Select Checkbox */}
                                <td className="px-3 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(keyword._id)}
                                        onChange={() => handleSelectKeyword(keyword._id)}
                                        className="rounded text-primary-color bg-bg-main border-border-color focus:ring-primary-color"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-main">{keyword.term}</td>
                                
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                    {getCurrentRank(keyword.historicalRankings)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                    {getLastUpdated(keyword.historicalRankings)}
                                </td>
                                
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => handleEditKeyword(keyword)}
                                        className="text-accent-primary hover:opacity-75 p-1 rounded transition"
                                        title="Edit Keyword"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteKeyword(keyword._id, keyword.term)}
                                        className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 p-1 rounded transition"
                                        title="Delete Keyword"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </section>
    </div>
  );
};

export default KeywordsPage;