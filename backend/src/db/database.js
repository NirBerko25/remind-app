const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../remind.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function setupDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      started_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS patient_context (
      patient_id TEXT PRIMARY KEY,
      name TEXT,
      age INTEGER,
      family TEXT,
      daily_routine TEXT,
      medications TEXT,
      address TEXT,
      emergency_contacts TEXT,
      baseline_rules TEXT,
      notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      expo_push_token TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS sos_events (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      triggered_at INTEGER DEFAULT (unixepoch()),
      notifications_sent INTEGER DEFAULT 0,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  // Migrations — add columns that may not exist in older DBs
  try { database.exec(`ALTER TABLE patient_context ADD COLUMN favorite_song TEXT`); } catch {}
  try { database.exec(`ALTER TABLE conversations ADD COLUMN tldr TEXT`); } catch {}
  try { database.exec(`ALTER TABLE conversations ADD COLUMN summary TEXT`); } catch {}
  try { database.exec(`ALTER TABLE sos_events ADD COLUMN resolved_at INTEGER`); } catch {}

  // Seed default demo patient if not exists
  const existing = database.prepare('SELECT id FROM patients WHERE id = ?').get('demo-patient-1');
  if (!existing) {
    database.prepare('INSERT INTO patients (id, name, age) VALUES (?, ?, ?)').run(
      'demo-patient-1',
      'Demo Patient',
      75
    );

    database.prepare(`
      INSERT INTO patient_context (
        patient_id, name, age, family, daily_routine, medications,
        address, emergency_contacts, baseline_rules, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'demo-patient-1',
      'Demo Patient',
      75,
      JSON.stringify([{ name: 'Family Member', relation: 'Child' }]),
      'Wake up at 7am, breakfast at 8am, lunch at noon, dinner at 6pm, bed at 9pm.',
      JSON.stringify([{ name: 'Donepezil', dosage: '10mg', time: 'morning' }]),
      '123 Main Street, Hometown',
      JSON.stringify([{ name: 'Family Member', phone: '555-0100' }]),
      'Speak slowly and clearly. Repeat if needed. Always reassure.',
      'Demo patient for testing purposes.'
    );

    console.log('[DB] Seeded default demo patient: demo-patient-1');
  }

  console.log('[DB] Database initialized at', DB_PATH);
}

module.exports = { getDb, setupDatabase };
