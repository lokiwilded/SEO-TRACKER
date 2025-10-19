require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- CRITICAL FIX: Ensure all models are imported here ---
const TargetUrl = require('./models/TargetUrl'); 
const CompetitorUrl = require('./models/CompetitorUrl'); 
const Keyword = require('./models/Keyword'); // <-- This was the missing or misplaced import

const app = express();
const PORT = process.env.PORT || 5000;
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rankpilot'; 

// Helper function to sanitize URL/Domain input
const sanitizeDomain = (rawUrl) => {
    return rawUrl
        .replace(/^(https?:\/\/|www\.)/i, '') 
        .split('/')[0] 
        .toLowerCase(); 
};

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', 
}));
app.use(express.json());

// --- Database Connection ---
mongoose.connect(DB_URI)
  .then(() => console.log('MongoDB connection successful'))
  .catch((err) => console.error('MongoDB connection error:', err));


// --- API Routes ---

// ------------------------------------
// TARGET URL ROUTES
// ------------------------------------

// GET route to fetch the Target Domain
app.get('/api/urls/target', async (req, res) => {
  try {
    const target = await TargetUrl.findOne().select('url'); 
    if (target) {
      return res.status(200).json({ url: target.url });
    }
    return res.status(200).json({ url: '' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch target domain', error: error.message });
  }
});


// POST route to save/update the Target Domain (deletes old target)
app.post('/api/urls/target', async (req, res) => {
  const { url: rawUrl } = req.body; 
  if (!rawUrl) {
    return res.status(400).json({ message: 'Domain is required' });
  }
  const cleanDomain = sanitizeDomain(rawUrl);
  if (!cleanDomain) {
    return res.status(400).json({ message: 'Invalid domain format.' });
  }

  try {
    // Check if this domain is already a competitor
    const isCompetitor = await CompetitorUrl.findOne({ url: cleanDomain });
    if (isCompetitor) {
      // Delete the competitor entry before making it the target
      await CompetitorUrl.deleteOne({ _id: isCompetitor._id });
    }

    // 1. Delete all existing target documents (ensures only one remains)
    await TargetUrl.deleteMany({});

    // 2. Create the new target domain document
    const newTarget = await TargetUrl.create({ url: cleanDomain }); 

    res.status(200).json({ 
        message: 'Target Domain updated successfully', 
        url: newTarget.url 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Domain is already tracked as a competitor.' });
    }
    res.status(500).json({ message: 'Failed to save target domain', error: error.message });
  }
});


// ------------------------------------
// COMPETITOR URL ROUTES
// ------------------------------------

// GET route to fetch all competitor domains
app.get('/api/urls/competitors', async (req, res) => {
    try {
        const competitors = await CompetitorUrl.find().select('_id url');
        res.status(200).json(competitors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch competitors', error: error.message });
    }
});

// POST route to add a new competitor domain
app.post('/api/urls/competitors', async (req, res) => {
    const { url: rawUrl } = req.body;
    if (!rawUrl) {
        return res.status(400).json({ message: 'Competitor domain is required' });
    }

    const cleanDomain = sanitizeDomain(rawUrl);
    if (!cleanDomain) {
        return res.status(400).json({ message: 'Invalid domain format.' });
    }

    try {
        // Check if this domain is the main target
        const isTarget = await TargetUrl.findOne({ url: cleanDomain });
        if (isTarget) {
            return res.status(409).json({ message: `Cannot add ${cleanDomain}. It is already set as your Target Domain.` });
        }
        
        // Save the new competitor
        const newCompetitor = await CompetitorUrl.create({ url: cleanDomain });

        res.status(201).json({ 
            message: 'Competitor added successfully', 
            competitor: { _id: newCompetitor._id, url: newCompetitor.url } 
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Competitor is already tracked.' });
        }
        res.status(500).json({ message: 'Failed to add competitor', error: error.message });
    }
});

// DELETE route to remove a competitor domain by ID
app.delete('/api/urls/competitors/:id', async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
    }

    try {
        const result = await CompetitorUrl.deleteOne({ _id: id }); 

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Competitor not found or already deleted.' });
        }

        res.status(200).json({ message: 'Competitor deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete competitor', error: error.message });
    }
});


// ------------------------------------
// KEYWORD ROUTES
// ------------------------------------

// GET route to fetch all keywords
app.get('/api/keywords', async (req, res) => {
    try {
        const keywords = await Keyword.find().select('_id term historicalRankings');
        res.status(200).json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ message: 'Failed to fetch keywords', error: error.message });
    }
});

// POST route to add one or more keywords (comma-separated)
app.post('/api/keywords', async (req, res) => {
    const { keywords: rawKeywords } = req.body; 
    
    if (!rawKeywords) {
        return res.status(400).json({ message: 'Keywords field is required.' });
    }

    const terms = rawKeywords.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (terms.length === 0) {
        return res.status(400).json({ message: 'No valid keywords provided.' });
    }

    let addedKeywords = [];
    let failedKeywords = [];

    for (const term of terms) {
        try {
            const newKeyword = await Keyword.create({ term: term });
            addedKeywords.push({ _id: newKeyword._id, term: newKeyword.term });
        } catch (error) {
            if (error.code === 11000) { 
                failedKeywords.push({ term: term, reason: 'Already exists.' });
            } else {
                console.error(`Error adding keyword "${term}":`, error);
                failedKeywords.push({ term: term, reason: error.message });
            }
        }
    }

    res.status(201).json({ 
        message: `${addedKeywords.length} keyword(s) added successfully.`,
        added: addedKeywords,
        failed: failedKeywords
    });
});


// DELETE route to remove a keyword by ID
app.delete('/api/keywords/:id', async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
    }

    try {
        const result = await Keyword.deleteOne({ _id: id }); 

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Keyword not found or already deleted.' });
        }

        res.status(200).json({ message: 'Keyword deleted successfully' });
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).json({ message: 'Failed to delete keyword', error: error.message });
    }
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});