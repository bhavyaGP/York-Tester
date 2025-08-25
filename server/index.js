const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json()); // Middleware to parse JSON

let DB = []; // In-memory database
let idCounter = 1; // Simple ID generator

// CREATE - Add a new item
app.post('/items', (req, res) => {
  const newItem = { id: idCounter++, ...req.body };
  DB.push(newItem);
  res.status(201).json(newItem);
});

// READ - Get all items
app.get('/items', (req, res) => {
  res.json(DB);
});

// READ - Get item by ID
app.get('/items/:id', (req, res) => {
  const item = DB.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ message: 'Item not found' });
  res.json(item);
});

// UPDATE - Modify item by ID
app.put('/items/:id', (req, res) => {
  const index = DB.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Item not found' });

  DB[index] = { id: DB[index].id, ...req.body };
  res.json(DB[index]);
});

// DELETE - Remove item by ID
app.delete('/items/:id', (req, res) => {
  const index = DB.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Item not found' });

  const deletedItem = DB.splice(index, 1);
  res.json(deletedItem[0]);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});