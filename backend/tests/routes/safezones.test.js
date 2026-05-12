'use strict';

// Mock DB before requiring app so setupDatabase() is a no-op
jest.mock('../../src/db/database', () => ({
  setupDatabase: jest.fn(),
  getDb: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/index');
const { getDb } = require('../../src/db/database');

function makeMockDb(overrides = {}) {
  const stmt = {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    ...overrides,
  };
  return { prepare: jest.fn(() => stmt), _stmt: stmt };
}

describe('GET /api/safezones/:patientId', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns an array of zones with parsed coordinates', async () => {
    const db = makeMockDb();
    db._stmt.all.mockReturnValue([
      { id: 'z1', patient_id: 'demo-patient-1', name: 'Home', type: 'circle',
        latitude: 32.08, longitude: 34.78, radius: 500, coordinates: null, created_at: 1000 },
    ]);
    getDb.mockReturnValue(db);

    const res = await request(app).get('/api/safezones/demo-patient-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Home', type: 'circle' });
  });

  it('returns empty array when patient has no zones', async () => {
    const db = makeMockDb();
    db._stmt.all.mockReturnValue([]);
    getDb.mockReturnValue(db);

    const res = await request(app).get('/api/safezones/demo-patient-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/safezones/:patientId', () => {
  afterEach(() => jest.clearAllMocks());

  it('creates a circle zone and returns 201', async () => {
    // prepare() called twice: patient lookup, then insert
    let callCount = 0;
    const db = {
      prepare: jest.fn(() => {
        callCount++;
        if (callCount === 1) return { get: jest.fn().mockReturnValue({ id: 'demo-patient-1' }) };
        return { run: jest.fn() };
      }),
    };
    getDb.mockReturnValue(db);

    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'Home', type: 'circle', latitude: 32.08, longitude: 34.78, radius: 300 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Home', type: 'circle' });
    expect(res.body.id).toBeDefined();
  });

  it('creates a polygon zone', async () => {
    let callCount = 0;
    const db = {
      prepare: jest.fn(() => {
        callCount++;
        if (callCount === 1) return { get: jest.fn().mockReturnValue({ id: 'p1' }) };
        return { run: jest.fn() };
      }),
    };
    getDb.mockReturnValue(db);

    const coords = [
      { latitude: 32.0, longitude: 34.7 },
      { latitude: 32.1, longitude: 34.7 },
      { latitude: 32.1, longitude: 34.8 },
    ];
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'Park', type: 'polygon', coordinates: coords });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('polygon');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ type: 'circle', latitude: 32.08, longitude: 34.78 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when circle zone is missing coordinates', async () => {
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'Home', type: 'circle' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when polygon has fewer than 3 points', async () => {
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'Park', type: 'polygon', coordinates: [{ latitude: 1, longitude: 1 }] });
    expect(res.status).toBe(400);
  });

  it('returns 404 when patient does not exist', async () => {
    const db = makeMockDb();
    db._stmt.get.mockReturnValue(null);
    getDb.mockReturnValue(db);

    const res = await request(app)
      .post('/api/safezones/unknown')
      .send({ name: 'Home', type: 'circle', latitude: 32, longitude: 34 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/safezones/:patientId/:zoneId', () => {
  afterEach(() => jest.clearAllMocks());

  it('deletes an existing zone', async () => {
    let callCount = 0;
    const db = {
      prepare: jest.fn(() => {
        callCount++;
        if (callCount === 1) return { get: jest.fn().mockReturnValue({ id: 'z1' }) };
        return { run: jest.fn() };
      }),
    };
    getDb.mockReturnValue(db);

    const res = await request(app).delete('/api/safezones/demo-patient-1/z1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when zone does not exist', async () => {
    const db = makeMockDb();
    db._stmt.get.mockReturnValue(null);
    getDb.mockReturnValue(db);

    const res = await request(app).delete('/api/safezones/demo-patient-1/ghost');
    expect(res.status).toBe(404);
  });
});
