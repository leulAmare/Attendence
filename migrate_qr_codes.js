// Migration script to update qr_code from UUID to student_id
require('dotenv').config();
const pool = require('./src/db/pool');

async function migrateQRCodes() {
  try {
    console.log('Starting migration: qr_code UUID -> student_id format...');
    
    // Step 1: Alter column type from UUID to VARCHAR first
    await pool.query(
      'ALTER TABLE attendants ALTER COLUMN qr_code TYPE VARCHAR(100) USING qr_code::text'
    );
    console.log('✓ Changed qr_code column type to VARCHAR(100)');
    
    // Step 2: Update existing records to use student_id as qr_code
    const updateResult = await pool.query(
      'UPDATE attendants SET qr_code = student_id'
    );
    console.log(`✓ Updated ${updateResult.rowCount} attendant records`);
    
    // Step 3: Verify the changes
    const { rows } = await pool.query(
      'SELECT id, name, student_id, qr_code FROM attendants ORDER BY id'
    );
    
    console.log('\n✓ Migration complete! Updated records:');
    console.table(rows);
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  }
}

migrateQRCodes();
