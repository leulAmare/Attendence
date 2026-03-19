const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.use('/auth',       require('./routes/auth'));
app.use('/attendants', require('./routes/attendants'));
app.use('/sessions',   require('./routes/sessions'));
app.use('/attendance', require('./routes/attendance'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`API running on port ${PORT}`)
);
