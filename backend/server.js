const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Keyword = require('./models/Keyword'); // Keep this
const TargetUrl = require('./models/Urls'); 
const RankingData = require('./models/RankingData');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Keyword Routes (Keep as they are for now) ---
// POST /api/keywords
app.post('/api/keywords', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const trimmedKeyword = keyword.trim();
    console.log(`[LOG] Received keyword: "${keyword}", trimmed to: "${trimmedKeyword}"`); // <-- ADDED LOG

    // Optional: Add validation to prevent duplicates if needed
    const existingKeyword = await Keyword.findOne({ keyword: trimmedKeyword });
    
    // <-- ADDED LOGS to see what findOne returns
    if (existingKeyword) {
      console.log(`[LOG] Found existing keyword:`, JSON.stringify(existingKeyword, null, 2));
      return res.status(409).json({ message: 'Keyword already exists' });
    } else {
      console.log(`[LOG] No existing keyword found for "${trimmedKeyword}". Proceeding to save...`);
    }

    const newKeyword = new Keyword({ keyword: trimmedKeyword });
    await newKeyword.save();
    
    console.log(`[LOG] Successfully saved new keyword:`, JSON.stringify(newKeyword, null, 2)); // <-- ADDED LOG

    res.status(201).json(newKeyword);

  } catch (error) {
     if (error.code === 11000) { // Should be caught above, but as a fallback
       console.error('[ERROR] Duplicate key error (11000):', error.message); // <-- ADDED LOG
       return res.status(409).json({ message: 'Keyword already exists' });
     }
    console.error('Error adding keyword:', error); // <-- This will catch other errors
    res.status(500).json({ message: 'Server error adding keyword' });
  }
});

 // DELETE /api/keywords/:id
 app.delete('/api/keywords/:id', async (req, res) => {
   try {
     const { id } = req.params;
     // Add validation for ObjectId format if desired
     if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid Keyword ID format' });
     }
     const deletedKeyword = await Keyword.findByIdAndDelete(id);
     if (!deletedKeyword) {
       return res.status(404).json({ message: 'Keyword not found' });
     }
     res.json({ message: 'Keyword deleted successfully' });
   } catch (error) {
     console.error('Error deleting keyword:', error);
     res.status(500).json({ message: 'Server error deleting keyword' });
   }
 });


// --- NEW CONFIGURATION ROUTES ---

// GET /api/config - Fetch the single configuration document
app.get('/api/config', async (req, res) => {
  try {
    // Find the first (and supposedly only) TargetUrl document
    const config = await TargetUrl.findOne();
    if (!config) {
      // If no config exists yet, return default empty state
      return res.json({ _id: null, url: '', competitorUrls: [] });
    }
    res.json({
        _id: config._id, // Send ID for potential updates
        url: config.url,
        competitorUrls: config.competitorUrls || [] // Ensure array exists
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ message: 'Server error fetching configuration' });
  }
});

// PUT /api/config - Update (or create) the single configuration document
app.put('/api/config', async (req, res) => {
  try {
    const { url, competitorUrls } = req.body;

    if (!url || !url.trim()) { // Basic validation
       return res.status(400).json({ message: 'Target URL is required' });
    }

    // Validate competitorUrls is an array of strings (basic)
    if (competitorUrls && !Array.isArray(competitorUrls)) {
        return res.status(400).json({ message: 'Competitor URLs must be an array' });
    }
    const cleanCompetitorUrls = (competitorUrls || []).map(u => String(u).trim()).filter(Boolean); // Clean the array

    // Use findOneAndUpdate with upsert:true.
    // The filter {} finds *any* document. Since we expect only one, this works.
    // If no document exists, it creates one based on the $set and $setOnInsert values.
    const updatedConfig = await TargetUrl.findOneAndUpdate(
      {}, // Empty filter - find the first/only document or create if none
      {
        $set: { url: url.trim(), competitorUrls: cleanCompetitorUrls }, // Update these fields
        // $setOnInsert is not strictly needed with upsert if timestamps: true is in schema
      },
      {
        new: true, // Return the updated document
        upsert: true, // Create the document if it doesn't exist
        runValidators: true, // Ensure schema validation runs
        setDefaultsOnInsert: true // Ensure defaults (like timestamps) are set on creation
      }
    );

    res.json({
        _id: updatedConfig._id,
        url: updatedConfig.url,
        competitorUrls: updatedConfig.competitorUrls
    });
  } catch (error) {
    console.error('Error saving config:', error);
    // Add more specific error handling if needed (e.g., validation errors)
    res.status(500).json({ message: 'Server error saving configuration' });
  }
});

app.get('/api/rankings', async (req, res) => {
    try {
        const { keywordId } = req.query;
        const limitPerUrl = parseInt(req.query.limit, 10) || 2; // Default to fetching current & previous

        // 1. Fetch relevant keywords
        let keywords;
        if (keywordId) {
            if (!mongoose.Types.ObjectId.isValid(keywordId)) {
                return res.status(400).json({ message: 'Invalid Keyword ID format' });
            }
            const keyword = await Keyword.findById(keywordId);
            if (!keyword) return res.status(404).json({ message: 'Keyword not found' });
            keywords = [keyword];
        } else {
            keywords = await Keyword.find().sort({ keyword: 1 }); // Fetch all, sorted
        }

        if (!keywords || keywords.length === 0) {
            return res.json([]); // No keywords to check
        }

        // 2. Fetch config to know target/competitor URLs
        const config = await TargetUrl.findOne();
        const targetUrl = config?.url || null;
        const competitorUrls = config?.competitorUrls || [];
        const allUrls = targetUrl ? [targetUrl, ...competitorUrls] : [...competitorUrls];

        // 3. Process each keyword
        const results = [];
        for (const keyword of keywords) {
            const keywordRankings = {
                keywordId: keyword._id,
                keywordText: keyword.keyword,
                urlData: []
            };

            // Fetch the latest 'limitPerUrl' checks for *this keyword*, sorted newest first
            const latestChecks = await RankingData.find({ keywordId: keyword._id })
                .sort({ checkDate: -1 })
                // Limit fetch slightly more than needed in case some URLs weren't present in all checks
                .limit(allUrls.length * limitPerUrl);

            // Group by URL to easily find current/previous
            const ranksByUrl = {};
            for (const check of latestChecks) {
                if (!ranksByUrl[check.url]) {
                    ranksByUrl[check.url] = [];
                }
                // Only store up to 'limitPerUrl' ranks per URL
                if (ranksByUrl[check.url].length < limitPerUrl) {
                     ranksByUrl[check.url].push({ position: check.position, date: check.checkDate });
                }
            }

            // 4. Calculate current rank and change for each tracked URL
            for (const url of allUrls) {
                const ranks = ranksByUrl[url] || []; // Get ranks for this URL, or empty array
                const currentRankData = ranks[0]; // Newest rank (if any)
                const previousRankData = ranks[1]; // Previous rank (if any)

                let change = null; // 'NC' (No Change), number (e.g., +2), or 'New'/'Gone'

                if (currentRankData && previousRankData) {
                    const diff = previousRankData.position - currentRankData.position;
                    change = diff === 0 ? 'NC' : (diff > 0 ? `+${diff}` : `${diff}`);
                } else if (currentRankData && !previousRankData) {
                    change = 'New'; // Was not ranked in the previous check we fetched
                } else if (!currentRankData && previousRankData) {
                    change = 'Gone'; // Was ranked previously, but not now
                }
                 // If neither exists, change remains null

                keywordRankings.urlData.push({
                    url: url,
                    isTarget: url === targetUrl,
                    currentRank: currentRankData ? currentRankData.position : null,
                    lastCheckDate: currentRankData ? currentRankData.date : null,
                    change: change
                });
            }
             // Sort urlData placing targetUrl first (optional)
             keywordRankings.urlData.sort((a, b) => {
                 if (a.isTarget) return -1;
                 if (b.isTarget) return 1;
                 return a.url.localeCompare(b.url);
             });

            results.push(keywordRankings);
        }

        res.json(results);

    } catch (error) {
        console.error('Error fetching ranking data:', error);
        res.status(500).json({ message: 'Server error fetching ranking data' });
    }
});

app.post('/api/rankings', async (req, res) => {
    try {
        const rankingEntries = req.body;

        // Basic validation: Check if it's an array
        if (!Array.isArray(rankingEntries)) {
            return res.status(400).json({ message: 'Request body must be an array of ranking entries.' });
        }

    
        const validEntries = rankingEntries.filter(entry =>
             entry.keywordId && mongoose.Types.ObjectId.isValid(entry.keywordId) &&
             entry.url && typeof entry.url === 'string' &&
             typeof entry.position === 'number' && entry.position > 0
            // checkDate is optional, defaults to now in schema
        );
         if (validEntries.length !== rankingEntries.length) {
            console.warn('Some invalid ranking entries were filtered out.');
        }

        if (rankingEntries.length === 0) {
             return res.status(200).json({ message: 'No valid ranking entries to insert.' });
        }

        // Use insertMany for efficiency
        const result = await RankingData.insertMany(rankingEntries, { ordered: false }); // ordered: false allows valid entries to insert even if some fail

        res.status(201).json({ message: `Inserted ${result.length} ranking entries.` });

    } catch (error) {
        console.error('Error saving ranking data:', error);
        res.status(500).json({ message: 'Server error saving ranking data' });
    }
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});