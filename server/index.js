const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json()); // Middleware to parse JSON

let DB = []; // In-memory database
let idCounter = 1; // Simple ID generator

// Middleware to validate item input
function validateItem(req, res, next) {
  const { name, value } = req.body;
  if (typeof name !== 'string' || typeof value !== 'number') {
    return res.status(400).json({
      message: 'Invalid input: "name" must be a string and "value" must be a number',
    });
  }
  next();
}

// Middleware to validate ID parameter
function validateId(req, res, next) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  req.id = id;
  next();
}

// CREATE - Add a new item
app.post('/items', validateItem, (req, res) => {
  const newItem = { id: idCounter++, ...req.body };
  DB.push(newItem);
  res.status(201).json(newItem);
});

// READ - Get all items
app.get('/items', (req, res) => {
  res.json(DB);
});

// READ - Get item by ID
app.get('/items/:id', validateId, (req, res) => {
  const item = DB.find(i => i.id === req.id);
  if (!item) return res.status(404).json({ message: 'Item not found' });
  res.json(item);
});

// UPDATE - Modify item by ID
app.put('/items/:id', validateId, validateItem, (req, res) => {
  const index = DB.findIndex(i => i.id === req.id);
  if (index === -1) return res.status(404).json({ message: 'Item not found' });

  DB[index] = { id: DB[index].id, ...req.body };
  res.json(DB[index]);
});

// DELETE - Remove item by ID
app.delete('/items/:id', validateId, (req, res) => {
  const index = DB.findIndex(i => i.id === req.id);
  if (index === -1) return res.status(404).json({ message: 'Item not found' });

  const deletedItem = DB.splice(index, 1);
  res.json(deletedItem[0]);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nServer shutting down gracefully...');
  process.exit();
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});