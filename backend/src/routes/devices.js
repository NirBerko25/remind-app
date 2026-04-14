const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// POST /api/devices/register
router.post('/register', (req, res) => {
  try {
    const { patientId, expoPushToken, role } = req.body;

    if (!patientId || !expoPushToken || !role) {
      return res.status(400).json({ error: 'patientId, expoPushToken, and role are required' });
    }

    if (!['patient', 'caregiver'].includes(role)) {
      return res.status(400).json({ error: 'role must be "patient" or "caregiver"' });
    }

    if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
      console.warn(`[Devices] Unusual push token format: ${expoPushToken}`);
    }

    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if this token is already registered for this patient
    const existing = db.prepare(
      'SELECT id FROM devices WHERE patient_id = ? AND expo_push_token = ?'
    ).get(patientId, expoPushToken);

    if (existing) {
      // Update the role if the token already exists
      db.prepare(
        'UPDATE devices SET role = ? WHERE id = ?'
      ).run(role, existing.id);
      console.log(`[Devices] Updated device role for patient ${patientId}: ${role}`);
    } else {
      // Register new device
      const deviceId = uuidv4();
      db.prepare(
        'INSERT INTO devices (id, patient_id, expo_push_token, role) VALUES (?, ?, ?, ?)'
      ).run(deviceId, patientId, expoPushToken, role);
      console.log(`[Devices] Registered new device for patient ${patientId}: ${role}`);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Devices] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
