// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Backend: Safe Zones API
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /api/safezones/:patientId
router.get('/:patientId', (req, res) => {
  try {
    const { patientId } = req.params;
    const db = getDb();
    const zones = db.prepare(
      'SELECT * FROM safe_zones WHERE patient_id = ? ORDER BY created_at DESC'
    ).all(patientId);

    return res.json(
      zones.map(z => ({
        ...z,
        coordinates: z.coordinates ? JSON.parse(z.coordinates) : null,
      }))
    );
  } catch (err) {
    console.error('[SafeZones] GET error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/safezones/:patientId
router.post('/:patientId', (req, res) => {
  try {
    const { patientId } = req.params;
    const { name, type, latitude, longitude, radius, coordinates } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    if (type === 'circle' && (latitude == null || longitude == null)) {
      return res.status(400).json({ error: 'latitude and longitude required for circle zones' });
    }
    if (type === 'polygon' && (!Array.isArray(coordinates) || coordinates.length < 3)) {
      return res.status(400).json({ error: 'polygon requires at least 3 coordinates' });
    }

    const db = getDb();
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO safe_zones (id, patient_id, name, type, latitude, longitude, radius, coordinates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, patientId, name, type,
      type === 'circle' ? latitude : null,
      type === 'circle' ? longitude : null,
      type === 'circle' ? (radius || 500) : null,
      type === 'polygon' ? JSON.stringify(coordinates) : null
    );

    console.log(`[SafeZones] Created ${type} zone "${name}" for patient ${patientId}`);
    return res.status(201).json({ id, name, type });
  } catch (err) {
    console.error('[SafeZones] POST error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/safezones/:patientId/:zoneId
router.delete('/:patientId/:zoneId', (req, res) => {
  try {
    const { patientId, zoneId } = req.params;
    const db = getDb();
    const zone = db.prepare(
      'SELECT id FROM safe_zones WHERE id = ? AND patient_id = ?'
    ).get(zoneId, patientId);

    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    db.prepare('DELETE FROM safe_zones WHERE id = ?').run(zoneId);
    console.log(`[SafeZones] Deleted zone ${zoneId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[SafeZones] DELETE error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
