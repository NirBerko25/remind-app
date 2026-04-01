const express = require('express');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /api/context/:patientId
router.get('/:patientId', (req, res) => {
  try {
    const { patientId } = req.params;
    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const context = db.prepare('SELECT * FROM patient_context WHERE patient_id = ?').get(patientId);

    if (!context) {
      // Return empty context structure if none exists yet
      return res.json({
        patientId,
        name: null,
        age: null,
        family: null,
        dailyRoutine: null,
        medications: null,
        address: null,
        emergencyContacts: null,
        baselineRules: null,
        notes: null,
      });
    }

    // Parse JSON fields
    let family = null;
    let medications = null;
    let emergencyContacts = null;

    try { family = context.family ? JSON.parse(context.family) : null; } catch { family = context.family; }
    try { medications = context.medications ? JSON.parse(context.medications) : null; } catch { medications = context.medications; }
    try { emergencyContacts = context.emergency_contacts ? JSON.parse(context.emergency_contacts) : null; } catch { emergencyContacts = context.emergency_contacts; }

    return res.json({
      patientId: context.patient_id,
      name: context.name,
      age: context.age,
      family,
      dailyRoutine: context.daily_routine,
      medications,
      address: context.address,
      emergencyContacts,
      baselineRules: context.baseline_rules,
      notes: context.notes,
      favoriteSong: context.favorite_song || null,
    });
  } catch (err) {
    console.error('[Context] GET Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// PUT /api/context/:patientId
router.put('/:patientId', (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      name,
      age,
      family,
      dailyRoutine,
      medications,
      address,
      emergencyContacts,
      baselineRules,
      notes,
      favoriteSong,
    } = req.body;

    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Serialize JSON fields
    const familyStr = family !== undefined ? JSON.stringify(family) : null;
    const medicationsStr = medications !== undefined ? JSON.stringify(medications) : null;
    const emergencyContactsStr = emergencyContacts !== undefined ? JSON.stringify(emergencyContacts) : null;

    // Upsert context
    const existing = db.prepare('SELECT patient_id FROM patient_context WHERE patient_id = ?').get(patientId);

    if (existing) {
      db.prepare(`
        UPDATE patient_context SET
          name = COALESCE(?, name),
          age = COALESCE(?, age),
          family = COALESCE(?, family),
          daily_routine = COALESCE(?, daily_routine),
          medications = COALESCE(?, medications),
          address = COALESCE(?, address),
          emergency_contacts = COALESCE(?, emergency_contacts),
          baseline_rules = COALESCE(?, baseline_rules),
          notes = COALESCE(?, notes),
          favorite_song = COALESCE(?, favorite_song)
        WHERE patient_id = ?
      `).run(
        name ?? null, age ?? null, familyStr,
        dailyRoutine ?? null, medicationsStr, address ?? null,
        emergencyContactsStr, baselineRules ?? null, notes ?? null,
        favoriteSong ?? null, patientId
      );
    } else {
      db.prepare(`
        INSERT INTO patient_context (
          patient_id, name, age, family, daily_routine,
          medications, address, emergency_contacts, baseline_rules, notes, favorite_song
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patientId, name ?? null, age ?? null, familyStr,
        dailyRoutine ?? null, medicationsStr, address ?? null,
        emergencyContactsStr, baselineRules ?? null, notes ?? null,
        favoriteSong ?? null
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Context] PUT Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
