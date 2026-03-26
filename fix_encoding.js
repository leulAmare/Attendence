const pool = require('./src/db/pool');

async function fixEncoding() {
  try {
    console.log('Setting database encoding to UTF-8...');
    
    // Ensure database uses UTF-8
    await pool.query('SET CLIENT_ENCODING TO UTF8');
    
    // Check current encoding
    const { rows } = await pool.query('SHOW SERVER_ENCODING');
    console.log('Server encoding:', rows[0].server_encoding);
    
    const { rows: clientRows } = await pool.query('SHOW CLIENT_ENCODING');
    console.log('Client encoding:', clientRows[0].client_encoding);
    
    // Get all attendants to check encoding
    const { rows: attendants } = await pool.query('SELECT id, name, email, student_id FROM attendants LIMIT 10');
    
    console.log('\nSample attendants:');
    attendants.forEach(a => {
      console.log(`ID: ${a.id}, Name: ${a.name}, Student ID: ${a.student_id}, Email: ${a.email}`);
    });
    
    console.log('\n⚠️  If names show as garbled characters, the data is already corrupted in the database.');
    console.log('You need to re-import the attendants with proper UTF-8 encoding.');
    console.log('\nTo fix:');
    console.log('1. Export your attendants to Excel');
    console.log('2. Delete all attendants from database');
    console.log('3. Re-import using the Excel upload feature');
    console.log('4. Make sure the Excel file is saved with UTF-8 encoding');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

fixEncoding();
