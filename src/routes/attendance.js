const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /attendance/scan — mark present via QR code
router.post('/scan', auth, async (req, res) => {
  const { qr_code, session_id } = req.body;

  try {
    // 1. Extract student_id from QR code
    // QR formats supported:
    // - "Name|student_id" (new format)
    // - "ssu/01/06/01/0004 ክርስቲና አስገል ገ/ማርያም" (old format)
    // - Just student_id (fallback)
    let student_id;
    
    // Check for "Name|student_id" format first
    if (qr_code.includes('|')) {
      const parts = qr_code.split('|');
      student_id = parts[1] ? parts[1].trim() : null;
    } else {
      // Match pattern: ssu/XX/XX/XX/XXXX (where X is digits)
      const studentIdPattern = /ssu\/\d{2}\/\d{2}\/\d{2}\/\d{4}/i;
      const match = qr_code.match(studentIdPattern);
      
      if (match) {
        student_id = match[0];
      } else {
        // Fallback: try to extract first part before space
        const firstSpace = qr_code.indexOf(' ');
        if (firstSpace > 0) {
          student_id = qr_code.substring(0, firstSpace).trim();
        } else {
          student_id = qr_code.trim();
        }
      }
    }

    // Debug: Log what we're trying to parse
    console.log('QR Code received:', qr_code);
    console.log('Extracted student_id:', student_id);
    
    // Validate we got a student_id
    if (!student_id) {
      return res.status(400).json({ error: 'Could not extract student ID from QR code: ' + qr_code });
    }

    // 2. Find attendant by student_id
    const { rows: found } = await pool.query(
      'SELECT * FROM attendants WHERE student_id = $1', [student_id]
    );
    if (!found[0]) return res.status(404).json({ error: 'Unknown student ID: ' + student_id });

    const attendant = found[0];

    // 2. Check if session is open
    const { rows: sessionRows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1', [session_id]
    );
    if (!sessionRows[0]) return res.status(404).json({ error: 'Session not found' });
    if (!sessionRows[0].is_open) return res.status(400).json({ error: 'Session is closed' });

    // 3. Insert attendance (UNIQUE constraint handles duplicates)
    await pool.query(
      `INSERT INTO attendance (attendant_id, session_id)
       VALUES ($1, $2)`,
      [attendant.id, session_id]
    );

    res.status(201).json({
      success: true,
      message: `${attendant.name} marked present`,
      attendant,
    });

  } catch (err) {
    // Postgres unique violation code
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already marked present' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /attendance/session/:sessionId — list all attendance for a session
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.name, a.student_id, 'present' as status, att.scanned_at
       FROM attendance att
       JOIN attendants a ON a.id = att.attendant_id
       WHERE att.session_id = $1
       ORDER BY att.scanned_at ASC`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /attendance/stats/:sessionId — get attendance statistics
router.get('/stats/:sessionId', auth, async (req, res) => {
  try {
    const { rows: attendanceRows } = await pool.query(
      'SELECT COUNT(*) as present FROM attendance WHERE session_id = $1',
      [req.params.sessionId]
    );
    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*) as total FROM attendants'
    );
    res.json({
      present: parseInt(attendanceRows[0].present),
      total: parseInt(totalRows[0].total),
      absent: parseInt(totalRows[0].total) - parseInt(attendanceRows[0].present)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
