const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth',       require('./routes/auth'));
app.use('/attendants', require('./routes/attendants'));
app.use('/sessions',   require('./routes/sessions'));
app.use('/attendance', require('./routes/attendance'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API running on port ${PORT}`)
);
