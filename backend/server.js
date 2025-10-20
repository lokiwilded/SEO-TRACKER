const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// --- FIX 1: Load dotenv at the very top ---
dotenv.config(); 

// --- All other imports must come AFTER dotenv.config() ---
const Keyword = require('./models/Keyword');
const TargetUrl = require('./models/Urls');
const RankingData = require('./models/RankingData');
const { checkAllKeywords } = require('./utils/rankChecker.js'); 
const axios = require('axios');

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

// --- Keyword Routes ---
app.post('/api/keywords', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const trimmedKeyword = keyword.trim();
    console.log(`[LOG] Received keyword: "${keyword}", trimmed to: "${trimmedKeyword}"`);

    const existingKeyword = await Keyword.findOne({ keyword: trimmedKeyword });
    
    if (existingKeyword) {
      console.log(`[LOG] Found existing keyword:`, JSON.stringify(existingKeyword, null, 2));
      return res.status(409).json({ message: 'Keyword already exists' });
    } else {
      console.log(`[LOG] No existing keyword found for "${trimmedKeyword}". Proceeding to save...`);
    }

    const newKeyword = new Keyword({ keyword: trimmedKeyword });
    await newKeyword.save();
    
    console.log(`[LOG] Successfully saved new keyword:`, JSON.stringify(newKeyword, null, 2));

    res.status(201).json(newKeyword);

  } catch (error) {
     if (error.code === 11000) { 
       console.error('[ERROR] Duplicate key error (11000):', error.message);
       return res.status(409).json({ message: 'Keyword already exists' });
     }
    console.error('Error adding keyword:', error);
    res.status(500).json({ message: 'Server error adding keyword' });
  }
});

app.get('/api/keywords', async (req, res) => {
  try {
    const keywords = await Keyword.find();
    res.json(keywords);
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({ message: 'Server error fetching keywords' });
  }
});

 app.delete('/api/keywords/:id', async (req, res) => {
   try {
     const { id } = req.params;
     if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid Keyword ID format' });
     }
     const deletedKeyword = await Keyword.findByIdAndDelete(id);
     if (!deletedKeyword) {
       return res.status(404).json({ message: 'Keyword not found' });
     }
     
     // Also delete ranking data for this keyword
     await RankingData.deleteMany({ keywordId: id });
     console.log(`Deleted ranks for keyword ${id}`);

     res.json({ message: 'Keyword and associated rankings deleted' });
   } catch (error) {
     console.error('Error deleting keyword:', error);
     res.status(500).json({ message: 'Server error deleting keyword' });
   }
 });


// --- Configuration Routes ---
app.get('/api/config', async (req, res) => {
  try {
    const config = await TargetUrl.findOne();
    if (!config) {
      return res.json({ _id: null, url: '', competitorUrls: [] });
    }
    res.json({
        _id: config._id,
        url: config.url,
        competitorUrls: config.competitorUrls || []
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ message: 'Server error fetching configuration' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const { url, competitorUrls } = req.body;
    if (!url || !url.trim()) {
       return res.status(400).json({ message: 'Target URL is required' });
    }
    if (competitorUrls && !Array.isArray(competitorUrls)) {
        return res.status(400).json({ message: 'Competitor URLs must be an array' });
    }
    const cleanCompetitorUrls = (competitorUrls || []).map(u => String(u).trim()).filter(Boolean);
    const updatedConfig = await TargetUrl.findOneAndUpdate(
      {},
      { $set: { url: url.trim(), competitorUrls: cleanCompetitorUrls } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({
        _id: updatedConfig._id,
        url: updatedConfig.url,
        competitorUrls: updatedConfig.competitorUrls
    });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ message: 'Server error saving configuration' });
  }
});


// --- Ranking Data Routes ---
app.get('/api/rankings', async (req, res) => {
    try {
        const { keywordId } = req.query;
        const limitPerUrl = parseInt(req.query.limit, 10) || 2;

        let keywords;
        if (keywordId) {
            if (!mongoose.Types.ObjectId.isValid(keywordId)) {
                return res.status(400).json({ message: 'Invalid Keyword ID format' });
            }
            const keyword = await Keyword.findById(keywordId);
            if (!keyword) return res.status(404).json({ message: 'Keyword not found' });
            keywords = [keyword];
        } else {
            keywords = await Keyword.find().sort({ keyword: 1 });
        }

        if (!keywords || keywords.length === 0) {
            return res.json([]);
        }

        const config = await TargetUrl.findOne();
        const targetUrl = config?.url || null;
        const competitorUrls = config?.competitorUrls || [];
        const allUrls = targetUrl ? [targetUrl, ...competitorUrls] : [...competitorUrls];

        const results = [];
        for (const keyword of keywords) {
            const keywordRankings = {
                keywordId: keyword._id,
                keywordText: keyword.keyword,
                urlData: []
            };

            const latestChecks = await RankingData.find({ keywordId: keyword._id })
                .sort({ checkDate: -1 })
                .limit(allUrls.length * limitPerUrl);

            const ranksByUrl = {};
            for (const check of latestChecks) {
                if (!ranksByUrl[check.url]) {
                    ranksByUrl[check.url] = [];
                }
                if (ranksByUrl[check.url].length < limitPerUrl) {
                     ranksByUrl[check.url].push({ position: check.position, date: check.checkDate });
                }
            }

            for (const url of allUrls) {
                const ranks = ranksByUrl[url] || [];
                const currentRankData = ranks[0];
                const previousRankData = ranks[1];

                let change = null;

                if (currentRankData && previousRankData) {
                    const diff = previousRankData.position - currentRankData.position;
                    change = diff === 0 ? 'NC' : (diff > 0 ? `+${diff}` : `${diff}`);
                } else if (currentRankData && !previousRankData) {
                    change = 'New';
                } else if (!currentRankData && previousRankData) {
                    change = 'Gone';
                }

                keywordRankings.urlData.push({
                    url: url,
                    isTarget: url === targetUrl,
                    currentRank: currentRankData ? currentRankData.position : null,
                    lastCheckDate: currentRankData ? currentRankData.date : null,
                    change: change
                });
            }
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
        if (!Array.isArray(rankingEntries)) {
            return res.status(400).json({ message: 'Request body must be an array.' });
        }
        if (rankingEntries.length === 0) {
             return res.status(200).json({ message: 'No valid ranking entries to insert.' });
        }

        const result = await RankingData.insertMany(rankingEntries, { ordered: false });
        res.status(201).json({ message: `Inserted ${result.length} ranking entries.` });

    } catch (error) {
        console.error('Error saving ranking data:', error);
        res.status(500).json({ message: 'Server error saving ranking data' });
    }
});


// --- ROUTE TO TRIGGER RANK CHECK ---
app.post('/api/check-ranks', async (req, res) => {
  console.log('Received request to /api/check-ranks');
  
  // Don't wait for the whole job to finish, just start it
  checkAllKeywords()
    .then(result => console.log('Rank check job completed in background.', result.message))
    .catch(err => console.error('Rank check job failed in background:', err));

  // Respond immediately to the frontend
  res.status(202).json({ message: 'Rank checking job started.' });
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});