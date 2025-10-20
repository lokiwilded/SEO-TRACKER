// backend/utils/rankChecker.js
const axios = require('axios');
const Keyword = require('../models/Keyword');
const Urls = require('../models/Urls');
const mongoose = require('mongoose');

const SCRAPERDOG_API_KEY = process.env.SCRAPERDOG_API_KEY;
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to find rank
function findRankForUrl(results, urlToFind) {
  if (!results || !Array.isArray(results)) {
    return null;
  }
  const cleanUrlToFind = urlToFind.replace(/^www\./, '').replace(/\/$/, '');

  for (let i = 0; i < results.length; i++) {
    const resultUrl = results[i].link;
    if (!resultUrl) continue;

    const cleanResultUrl = resultUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

    if (cleanResultUrl.startsWith(cleanUrlToFind)) {
      return i + 1;
    }
  }
  return null;
}

const checkAllKeywords = async () => {
  console.log('[Rank Checker] Starting job...');
  
  // --- NEW: API Key Check ---
  if (!SCRAPERDOG_API_KEY || SCRAPERDOG_API_KEY === 'your_key_here') {
    console.error('[Rank Checker] FATAL ERROR: SCRAPERDOG_API_KEY is not set in backend/.env file.');
    return { success: false, message: 'Scraper API key not configured on server.' };
  }
  
  try {
    const keywords = await Keyword.find();
    const config = await Urls.findOne();

    if (!config || !config.url) {
      console.log('[Rank Checker] Aborted: Target URL not set.');
      return { success: false, message: 'Target URL not configured.' };
    }
    
    if (!keywords || keywords.length === 0) {
      console.log('[Rank Checker] Aborted: No keywords to check.');
      return { success: false, message: 'No keywords to check.' };
    }
    
    const targetUrl = config.url;
    const allUrlsToTrack = [targetUrl, ...config.competitorUrls];
    const rankingEntries = [];
    const checkDate = new Date();

    console.log(`[Rank Checker] Checking ${keywords.length} keywords...`);
    for (const keyword of keywords) {
      const query = keyword.keyword;
      console.log(`[Rank Checker] Scraping for: "${query}"`);
      
      let searchResults;
      try {
        const response = await axios.get('https://api.scrapingdog.com/serp', { // Corrected URL
          params: {
            api_key: SCRAPERDOG_API_KEY,
            q: query,
            gl: 'gb' // Great Britain
          }
        });
        
        // Check if we got HTML (which means auth failed) or real JSON
        if (typeof response.data !== 'object') {
            console.error('[Rank Checker] API Error: Expected JSON but got HTML. Check your API Key.');
            searchResults = [];
        } else {
            // This is the correct path
            searchResults = response.data?.organic_results;
        }
        
      } catch (scrapeError) {
        if (scrapeError.response) {
            console.error(`[Rank Checker] API Error for "${query}":`, scrapeError.response.status, scrapeError.response.data);
        } else {
            console.error(`[Rank Checker] Scrape failed for "${query}":`, scrapeError.message);
        }
        continue;
      }
      
      if (!searchResults || searchResults.length === 0) {
         console.log(`[Rank Checker] No organic results found in response for "${query}"`);
         continue;
      }

      // Find ranks
      for (const url of allUrlsToTrack) {
        const position = findRankForUrl(searchResults, url);
        if (position) {
          console.log(`[Rank Checker] FOUND: "${url}" at position ${position} for "${query}"`);
          rankingEntries.push({
            keywordId: keyword._id,
            url: url,
            position: position,
            checkDate: checkDate
          });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (rankingEntries.length > 0) {
      console.log(`[Rank Checker] Saving ${rankingEntries.length} new rank entries...`);
      await axios.post(`${API_BASE_URL}/rankings`, rankingEntries);
    }

    console.log('[Rank Checker] Job finished successfully.');
    return { success: true, message: `Checked ${keywords.length} keywords, found ${rankingEntries.length} ranks.` };

  } catch (error) {
    console.error('[Rank Checker] Critical error:', error);
    return { success: false, message: 'Job failed. See backend logs.' };
  }
};

module.exports = { checkAllKeywords };