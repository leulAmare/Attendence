// Script to update existing attendants to use new QR format: "name|student_id"
require('dotenv').config();
const pool = require('./src/db/pool');

async function updateQRCodes() {
  try {
    console.log('Updating existing attendants to new QR format (name|student_id)...\n');
    
    // Get all attendants
    const { rows: attendants } = await pool.query(
      'SELECT id, name, student_id, qr_code FROM attendants ORDER BY id'
    );
    
    console.log(`Found ${attendants.length} attendants to update:\n`);
    
    // Update each attendant
    for (const attendant of attendants) {
      const newQRCode = `${attendant.name}|${attendant.student_id}`;
      
      await pool.query(
        'UPDATE attendants SET qr_code = $1 WHERE id = $2',
        [newQRCode, attendant.id]
      );
      
      console.log(`✓ Updated: ${attendant.name}`);
      console.log(`  Old QR: ${attendant.qr_code}`);
      console.log(`  New QR: ${newQRCode}\n`);
    }
    
    console.log('✓ All attendants updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Update failed:', err.message);
    process.exit(1);
  }
}

updateQRCodes();
