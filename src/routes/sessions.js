const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /sessions
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM sessions ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions
router.post('/', auth, async (req, res) => {
  const { title, date } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO sessions (title, date, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [title, date || new Date().toISOString().split('T')[0], req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /sessions/:id/close
router.patch('/:id/close', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE sessions SET is_open = FALSE WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /sessions/:id/open
router.patch('/:id/open', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE sessions SET is_open = TRUE WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /sessions/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
