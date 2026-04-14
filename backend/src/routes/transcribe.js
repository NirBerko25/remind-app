const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(m4a|wav|mp3|ogg|webm|flac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  },
});

async function transcribeWithGroq(buffer, mimetype, originalname) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Write buffer to temp file (Groq SDK needs a file stream)
  const ext = path.extname(originalname) || '.webm';
  const tmpFile = path.join(os.tmpdir(), `remind-groq-${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: 'whisper-large-v3-turbo',
      response_format: 'text',
      language: 'he',
    });
    return typeof transcription === 'string' ? transcription : transcription.text || '';
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function transcribeWithGemini(buffer, mimetype) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const audioPart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: mimetype.startsWith('audio/') ? mimetype : 'audio/webm',
    },
  };

  const result = await model.generateContent([
    audioPart,
    'Transcribe the speech in this audio clip. The speaker may be speaking Hebrew or English — transcribe in whatever language was spoken. Return only the spoken words, nothing else. If there is no speech or it is inaudible, return an empty string.',
  ]);

  return result.response.text().trim();
}

// POST /api/transcribe
router.post('/', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided. Use multipart form with "audio" field.' });
    }

    let transcript = '';
    let usedEngine = '';

    // Try Groq first (Whisper)
    if (process.env.GROQ_API_KEY) {
      try {
        transcript = await transcribeWithGroq(req.file.buffer, req.file.mimetype, req.file.originalname);
        usedEngine = 'groq-whisper';
      } catch (err) {
        console.warn('[Transcribe] Groq failed, trying Gemini fallback:', err.message);
      }
    }

    // Fallback to Gemini
    if (!usedEngine && process.env.GEMINI_API_KEY) {
      try {
        transcript = await transcribeWithGemini(req.file.buffer, req.file.mimetype);
        usedEngine = 'gemini';
      } catch (err) {
        console.warn('[Transcribe] Gemini fallback also failed:', err.message);
      }
    }

    if (!usedEngine) {
      return res.status(500).json({ error: 'No transcription service available. Set GROQ_API_KEY or GEMINI_API_KEY.' });
    }

    console.log(`[Transcribe] ${usedEngine} transcribed ${req.file.size} bytes → "${transcript.substring(0, 80)}"`);
    return res.json({ transcript });

  } catch (err) {
    console.error('[Transcribe] Error:', err.message);
    return res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

module.exports = router;
