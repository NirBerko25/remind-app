const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /api/patients
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const patients = db.prepare(`
      SELECT id, name, created_at
      FROM patients
      ORDER BY created_at DESC
    `).all();

    return res.json(patients.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
    })));
  } catch (err) {
    console.error('[Patients] GET Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// POST /api/patients
router.post('/', (req, res) => {
  try {
    const { name, age } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const db = getDb();
    const patientId = uuidv4();

    // Create the patient
    db.prepare(
      'INSERT INTO patients (id, name, age) VALUES (?, ?, ?)'
    ).run(patientId, name, age ?? null);

    // Create empty context for the patient
    db.prepare(`
      INSERT INTO patient_context (patient_id, name, age)
      VALUES (?, ?, ?)
    `).run(patientId, name, age ?? null);

    console.log(`[Patients] Created patient: ${patientId} (${name})`);

    return res.status(201).json({
      patientId,
      name,
    });
  } catch (err) {
    console.error('[Patients] POST Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
