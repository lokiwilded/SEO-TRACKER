import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast, { Toaster, ToastBar } from 'react-hot-toast'; // Make sure Toaster is imported
import { Loader2, ArrowUp, ArrowDown, Minus, Trash2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper component to display rank change
const RankChange = ({ change }) => {
  if (change === null || change === undefined) {
    return <span className="text-gray-400">-</span>; // No data yet or wasn't ranked
  }
  if (change === 'NC') {
    return <span className="text-gray-500 flex items-center"><Minus size={12} className="mr-1"/>NC</span>; // No Change
  }
  if (change === 'New') {
    return <span className="text-green-500">New</span>;
  }
   if (change === 'Gone') {
     return <span className="text-red-500">Gone</span>;
   }

  // Handle numeric changes (+/-)
  const numericChange = parseInt(change, 10);
  if (numericChange > 0) {
    return <span className="text-green-500 flex items-center"><ArrowUp size={12} className="mr-1"/>{Math.abs(numericChange)}</span>; // Improved rank (lower number)
  }
  if (numericChange < 0) {
    return <span className="text-red-500 flex items-center"><ArrowDown size={12} className="mr-1"/>{Math.abs(numericChange)}</span>; // Worsened rank (higher number)
  }

  return <span className="text-gray-400">-</span>; // Fallback
};

const KeywordsPage = () => {
  const [newKeywordInput, setNewKeywordInput] = useState(''); // State for adding new keyword
  // State to hold the detailed ranking data fetched from /api/rankings
  const [rankingData, setRankingData] = useState([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false); // Loading for add/delete
  const [isLoadingRankings, setIsLoadingRankings] = useState(true); // Separate loading for rankings
  const [targetUrl, setTargetUrl] = useState(''); // Store target URL for display
  const [competitorUrls, setCompetitorUrls] = useState([]); // Store competitor URLs for table headers

  // Fetch detailed ranking data AND config
  const fetchRankingData = useCallback(async () => {
    setIsLoadingRankings(true);
    try {
      // Fetch config first to get URLs for table headers
      const configResponse = await axios.get(`${API_BASE_URL}/config`);
      setTargetUrl(configResponse.data?.url || 'Target URL');
      setCompetitorUrls(configResponse.data?.competitorUrls || []);

      // Now fetch rankings
      const rankingsResponse = await axios.get(`${API_BASE_URL}/rankings`);
      setRankingData(rankingsResponse.data || []);
    } catch (error) {
      console.error('Error fetching ranking data:', error);
      toast.error('Failed to load ranking data.');
      setRankingData([]); // Reset on error
    } finally {
      setIsLoadingRankings(false);
    }
  }, []);

  // Fetch ranking data on mount
  useEffect(() => {
    fetchRankingData();
  }, [fetchRankingData]); // Only fetchRankingData is needed now

  // Handle adding a new keyword
  const handleAddKeyword = async (e) => {
    e.preventDefault();
    const keywordToAdd = newKeywordInput.trim();
    if (!keywordToAdd) return;

    setIsLoadingKeywords(true);
    const toastId = toast.loading('Adding keyword...');

    try {
      // Use await directly without assigning to 'response'
      await axios.post(`${API_BASE_URL}/keywords`, {
        keyword: keywordToAdd,
      });
      toast.success('Keyword added', { id: toastId, duration: 2000 });
      setNewKeywordInput('');
      // Refresh ranking data after adding (new keyword will appear with null ranks)
      fetchRankingData();
    } catch (error) {
      console.error('Error adding keyword:', error);
      const errorMsg = error.response?.data?.message || 'Failed to add keyword';
      toast.error(errorMsg, { id: toastId, duration: 3000 });
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // Handle deleting a keyword
  const handleDeleteKeyword = async (id, keywordText) => {
     if (!window.confirm(`Are you sure you want to delete keyword: "${keywordText}"? This will also remove associated rank history.`)) return;

    setIsLoadingKeywords(true);
    const toastId = toast.loading('Deleting keyword...');
    try {
      await axios.delete(`${API_BASE_URL}/keywords/${id}`);
      toast.success('Keyword deleted', { id: toastId, duration: 2000 });
      // Refresh rankings to remove the deleted keyword's row
      fetchRankingData();
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error('Failed to delete keyword', { id: toastId, duration: 3000 });
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // Prepare headers for the table dynamically
  const tableHeaders = [
    'Keyword',
    targetUrl && targetUrl !== 'Target URL' ? `${targetUrl} Rank` : 'Target Rank',
    targetUrl && targetUrl !== 'Target URL' ? `${targetUrl} Change` : 'Target Change',
    ...competitorUrls.flatMap(url => [`${url} Rank`, `${url} Change`]), // Add competitors
    'Actions' // Keep Actions column
  ];

  return (
    <div className="container mx-auto p-4">
      {/* Toaster for notifications */}
      <Toaster>
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && t.duration > 0 && (
                  <div className="toast-timer-bar" style={{ animationDuration: `${t.duration}ms` }} />
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>

      <h1 className="text-2xl font-bold mb-4">Keywords & Rankings</h1>

      {/* Form to add new keyword */}
      <form onSubmit={handleAddKeyword} className="mb-4 flex flex-col sm:flex-row sm:space-x-2">
        <input
          type="text"
          value={newKeywordInput}
          onChange={(e) => setNewKeywordInput(e.target.value)}
          placeholder="Enter a new keyword"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-[--text-main] bg-[--background] leading-tight focus:outline-none focus:shadow-outline mb-2 sm:mb-0 flex-grow"
          disabled={isLoadingKeywords}
        />
        <button
          type="submit"
          className="bg-accent hover:bg-opacity-80 text-text-main font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          disabled={isLoadingKeywords}
        >
          {isLoadingKeywords ? <Loader2 className="animate-spin w-5 h-5 inline mr-2"/> : null}
          {isLoadingKeywords ? 'Adding...' : 'Add Keyword'}
        </button>
      </form>

      {/* Keyword & Ranking Table */}
      <div className="overflow-x-auto shadow-md rounded-lg border border-border-color">
        <table className="min-w-full bg-background ">
          <thead className="bg-bg-secondary sticky top-0"> {/* Make header sticky */}
            <tr>
              {tableHeaders.map((header, index) => (
                <th key={index} className="py-3 px-4 border-b dark:border-gray-700 text-left text-xs sm:text-sm font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoadingRankings ? (
              <tr>
                <td colSpan={tableHeaders.length} className="py-4 px-4 text-center text-gray-500">
                  <Loader2 className="animate-spin w-5 h-5 inline mr-2" /> Loading ranking data...
                </td>
              </tr>
            ) : rankingData.length === 0 ? (
              <tr>
                <td colSpan={tableHeaders.length} className="py-4 px-4 text-center text-gray-500 italic">
                  No keywords added or no ranking data available yet. Add keywords and run the rank checker.
                </td>
              </tr>
            ) : (
              rankingData.map((row) => (
                <tr key={row.keywordId} className="hover:bg-bg-secondary transition-colors duration-150">
                  {/* Keyword Text */}
                  <td className="py-3 px-4 border-b dark:border-gray-700 text-sm font-medium text-text-main whitespace-nowrap">
                    {row.keywordText}
                  </td>
                  {/* Target URL Rank & Change */}
                  {targetUrl && targetUrl !== 'Target URL' && ( // Check if targetUrl is set
                      <>
                          <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center">
                              {row.urlData.find(d => d.isTarget)?.currentRank ?? <span className="text-gray-400">-</span>}
                          </td>
                          <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center">
                              <RankChange change={row.urlData.find(d => d.isTarget)?.change} />
                          </td>
                      </>
                  )}
                   {/* Handle case where target URL isn't set yet */}
                   {(!targetUrl || targetUrl === 'Target URL') && (
                       <>
                           <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center"><span className="text-gray-400">-</span></td>
                           <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center"><span className="text-gray-400">-</span></td>
                       </>
                   )}
                  {/* Competitor URLs Rank & Change */}
                  {competitorUrls.map(compUrl => {
                      const compData = row.urlData.find(d => d.url === compUrl);
                      return (
                          <React.Fragment key={compUrl}>
                              <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center">
                                  {compData?.currentRank ?? <span className="text-gray-400">-</span>}
                              </td>
                              <td className="py-3 px-4 border-b dark:border-gray-700 text-sm text-text-secondary whitespace-nowrap text-center">
                                  <RankChange change={compData?.change} />
                              </td>
                          </React.Fragment>
                      );
                  })}

                  {/* Actions */}
                  <td className="py-3 px-4 border-b dark:border-gray-700 text-sm whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteKeyword(row.keywordId, row.keywordText)}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      disabled={isLoadingKeywords}
                      title="Delete Keyword"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
       {/* Button to manually trigger rank check (placeholder for now) */}
       <div className="mt-6">
           <button
             // onClick={handleTriggerRankCheck} // Add this function later
             className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
             // disabled={isLoadingRankings || isLoadingKeywords} // Disable if anything is loading
             disabled // Disabled until function is implemented
           >
             {/* {isCheckingRanks ? <Loader2 className="animate-spin w-5 h-5 inline mr-2"/> : null} */}
             Check Rankings Now (Not Implemented)
           </button>
           <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manually trigger Scraperdog to fetch latest ranks.</p>
       </div>
    </div>
  );
};

export default KeywordsPage;