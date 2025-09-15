const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello from CodeCollab!' });
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
});