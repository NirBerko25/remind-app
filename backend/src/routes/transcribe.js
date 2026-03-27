const express = require('express');
const multer = require('multer');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const { Readable } = require('stream');
    const stream = Readable.from(req.file.buffer);
    stream.path = `recording.${req.file.mimetype.split('/')[1] || 'webm'}`;

    const transcription = await groq.audio.transcriptions.create({
      file: stream,
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'json',
    });

    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error('[Transcribe]', err.message);
    return res.status(500).json({ error: 'Transcription failed', transcript: '' });
  }
});

module.exports = router;
