const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

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

// POST /attendants/upload — upload Excel file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received');
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File uploaded:', req.file.path);

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('Excel data loaded, rows:', data.length);
    console.log('First row sample:', data[0]);
    console.log('Available columns:', Object.keys(data[0] || {}));

    const results = [];
    const errors = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Map Excel columns to database fields
      // Based on your screenshot: No, Name, Email, Student ID, Department
      const name = row['Name'] || row['name'] || row['NAME'] || row[Object.keys(row).find(k => k.toLowerCase().includes('name'))];
      const email = row['Email'] || row['email'] || row['EMAIL'] || row[Object.keys(row).find(k => k.toLowerCase().includes('email'))];
      const student_id = row['Student ID'] || row['Student_ID'] || row['student_id'] || row['STUDENT ID'] || row[Object.keys(row).find(k => k.toLowerCase().includes('student'))];
      
      console.log(`Row ${i + 2}: Name="${name}", StudentID="${student_id}"`);
      
      if (!name || !student_id) {
        console.log(`Row ${i + 2}: Missing required fields`);
        errors.push({ row: i + 2, error: 'Name and Student ID are required' });
        continue;
      }

      try {
        // Generate QR code
        const qr_code = `${name}|${student_id}`;
        
        console.log(`Inserting: ${name}, ${email}, ${student_id}, ${qr_code}`);
        
        // Insert into database
        const { rows } = await pool.query(
          `INSERT INTO attendants (name, email, student_id, qr_code)
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (student_id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           qr_code = EXCLUDED.qr_code
           RETURNING *`,
          [name, email || null, student_id, qr_code]
        );
        
        console.log(`Row ${i + 2}: Successfully inserted`);
        results.push({
          row: i + 2,
          success: true,
          data: rows[0]
        });
      } catch (err) {
        console.log(`Row ${i + 2}: Database error -`, err.message);
        errors.push({ row: i + 2, error: err.message });
      }
    }

    // Clean up uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    console.log(`Upload completed: ${results.length} success, ${errors.length} errors`);

    res.json({
      message: `Processed ${data.length} rows`,
      results,
      errors,
      totalProcessed: data.length,
      successCount: results.length,
      errorCount: errors.length
    });

  } catch (err) {
    console.log('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
