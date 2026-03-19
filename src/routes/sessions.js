const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const XLSX = require('xlsx');
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
      `INSERT INTO sessions (title, date)
       VALUES ($1, $2) RETURNING *`,
      [title, date || new Date().toISOString().split('T')[0]]
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

// GET /sessions/:id/export/excel — export session attendance to Excel
router.get('/:id/export/excel', auth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get session details
    const { rows: sessionRows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );
    
    if (!sessionRows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionRows[0];
    
    // Get attendance data
    const { rows: attendanceRows } = await pool.query(
      `SELECT a.name, a.email, a.student_id, att.scanned_at
       FROM attendance att
       JOIN attendants a ON a.id = att.attendant_id
       WHERE att.session_id = $1
       ORDER BY a.name ASC`,
      [sessionId]
    );
    
    // Get all attendants for comparison
    const { rows: allAttendants } = await pool.query(
      'SELECT * FROM attendants ORDER BY name ASC'
    );
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Attendance sheet
    const attendanceData = attendanceRows.map((row, index) => ({
      'No': index + 1,
      'Name': row.name,
      'Student ID': row.student_id,
      'Email': row.email || '',
      'Scan Time': new Date(row.scanned_at).toLocaleString(),
      'Status': 'Present'
    }));
    
    const attendanceSheet = XLSX.utils.json_to_sheet(attendanceData);
    XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance');
    
    // Summary sheet
    const presentCount = attendanceRows.length;
    const totalCount = allAttendants.length;
    const absentCount = totalCount - presentCount;
    const attendanceRate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0;
    
    const summaryData = [
      { 'Metric': 'Session Title', 'Value': session.title },
      { 'Metric': 'Session Date', 'Value': new Date(session.date).toLocaleDateString() },
      { 'Metric': 'Total Attendants', 'Value': totalCount },
      { 'Metric': 'Present', 'Value': presentCount },
      { 'Metric': 'Absent', 'Value': absentCount },
      { 'Metric': 'Attendance Rate', 'Value': `${attendanceRate}%` },
      { 'Metric': 'Session Status', 'Value': session.is_open ? 'Open' : 'Closed' }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Absent list sheet
    const presentStudentIds = new Set(attendanceRows.map(row => row.student_id));
    const absentAttendants = allAttendants.filter(attendant => !presentStudentIds.has(attendant.student_id));
    
    const absentData = absentAttendants.map((row, index) => ({
      'No': index + 1,
      'Name': row.name,
      'Student ID': row.student_id,
      'Email': row.email || '',
      'Status': 'Absent'
    }));
    
    if (absentData.length > 0) {
      const absentSheet = XLSX.utils.json_to_sheet(absentData);
      XLSX.utils.book_append_sheet(workbook, absentSheet, 'Absent');
    }
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    console.log('Excel export completed, buffer size:', excelBuffer.length);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(session.date).toISOString().split('T')[0]}.xlsx`);
    
    res.send(excelBuffer);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/export/pdf — export session attendance to HTML (PDF-like)
router.get('/:id/export/pdf', auth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get session details
    const { rows: sessionRows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );
    
    if (!sessionRows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionRows[0];
    
    // Get attendance data
    const { rows: attendanceRows } = await pool.query(
      `SELECT a.name, a.email, a.student_id, att.scanned_at
       FROM attendance att
       JOIN attendants a ON a.id = att.attendant_id
       WHERE att.session_id = $1
       ORDER BY a.name ASC`,
      [sessionId]
    );
    
    // Get all attendants for comparison
    const { rows: allAttendants } = await pool.query(
      'SELECT * FROM attendants ORDER BY name ASC'
    );
    
    // Calculate statistics
    const presentCount = attendanceRows.length;
    const totalCount = allAttendants.length;
    const absentCount = totalCount - presentCount;
    const attendanceRate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0;
    
    // Generate HTML report
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Attendance Report - ${session.title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #333; }
        .header p { color: #666; }
        .summary { margin-bottom: 30px; }
        .summary table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .summary th, .summary td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .summary th { background-color: #f2f2f2; }
        .attendance-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .attendance-table th, .attendance-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .attendance-table th { background-color: #4CAF50; color: white; }
        .attendance-table tr:nth-child(even) { background-color: #f9f9f9; }
        .present { color: green; font-weight: bold; }
        .absent { color: red; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Attendance Report</h1>
        <p><strong>${session.title}</strong></p>
        <p>Date: ${new Date(session.date).toLocaleDateString()}</p>
        <p>Status: ${session.is_open ? 'Open' : 'Closed'}</p>
      </div>
      
      <div class="summary">
        <h2>Summary</h2>
        <table>
          <tr><th>Total Attendants</th><td>${totalCount}</td></tr>
          <tr><th>Present</th><td class="present">${presentCount}</td></tr>
          <tr><th>Absent</th><td class="absent">${absentCount}</td></tr>
          <tr><th>Attendance Rate</th><td>${attendanceRate}%</td></tr>
        </table>
      </div>
      
      <div class="attendance">
        <h2>Attendance Details</h2>
        <table class="attendance-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Name</th>
              <th>Student ID</th>
              <th>Email</th>
              <th>Status</th>
              <th>Scan Time</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceRows.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${row.name}</td>
                <td>${row.student_id}</td>
                <td>${row.email || ''}</td>
                <td class="present">Present</td>
                <td>${new Date(row.scanned_at).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Attendance Management System</p>
      </div>
      
      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Print / Save as PDF</button>
      </div>
    </body>
    </html>
    `;
    
    // Set headers for HTML download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename=attendance_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(session.date).toISOString().split('T')[0]}.html`);
    
    res.send(html);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
