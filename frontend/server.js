const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

console.log(`Starting server on port ${PORT}`);

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully running on port ${PORT}`);
  console.log(`🌐 Listening on http://0.0.0.0:${PORT}`);
});