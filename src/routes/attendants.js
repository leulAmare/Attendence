const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /attendants — list all
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM attendants ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /attendants — create new attendant
router.post('/', auth, async (req, res) => {
  const { name, email, student_id } = req.body;
  try {
    // QR code format: "Name|student_id" (supports Amharic names)
    const qr_code = `${name}|${student_id}`;
    
    const { rows } = await pool.query(
      `INSERT INTO attendants (name, email, student_id, qr_code)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, student_id, qr_code]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /attendants/:id — get single attendant
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM attendants WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Attendant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /attendants/qr/:qrCode — lookup by QR value
router.get('/qr/:qrCode', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM attendants WHERE qr_code = $1',
      [req.params.qrCode]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Attendant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /attendants/:id — delete attendant
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM attendants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
