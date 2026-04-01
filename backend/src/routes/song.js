const express = require('express');
const https = require('https');

const router = express.Router();

function searchYouTube(query) {
  return new Promise((resolve, reject) => {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract all video IDs and titles from the page's JSON blob
        const matches = [...data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})","thumbnail".*?"text":"([^"]+)"/g)];
        if (matches.length > 0) {
          resolve({ videoId: matches[0][1], title: matches[0][2] });
        } else {
          // Fallback: just grab first videoId
          const simple = data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
          if (simple) resolve({ videoId: simple[1], title: query });
          else reject(new Error('No results found'));
        }
      });
    }).on('error', reject);
  });
}

// GET /api/song/search?q=Yesterday+Beatles
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  try {
    const result = await searchYouTube(q);
    console.log(`[Song] "${q}" → videoId: ${result.videoId} (${result.title})`);
    return res.json(result);
  } catch (err) {
    console.error('[Song] Search error:', err.message);
    return res.status(500).json({ error: 'Could not find song', details: err.message });
  }
});

module.exports = router;
