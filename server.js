const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON body
app.use(express.json());

// POST endpoint
app.post('/api/data', (req, res) => {
  const receivedData = req.body;
  console.log('Received data:', receivedData);

  res.json({ message: 'Data received successfully', yourData: receivedData });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${3000}`);
});
