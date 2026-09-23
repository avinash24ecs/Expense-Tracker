const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- EXPENSES ----------

// Get all expenses, optionally filtered by ?category= & ?month=YYYY-MM
app.get('/api/expenses', (req, res) => {
  const { category, month } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (month) {
    query += " AND strftime('%Y-%m', date) = ?";
    params.push(month);
  }
  query += ' ORDER BY date DESC, id DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// Add a new expense
app.post('/api/expenses', (req, res) => {
  const { description, amount, category, date } = req.body;

  if (!description || amount === undefined || !category || !date) {
    return res.status(400).json({ error: 'description, amount, category, and date are required' });
  }
  if (isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const stmt = db.prepare(
    'INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)'
  );
  const info = stmt.run(description, Number(amount), category, date);
  const newExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newExpense);
});

// Delete an expense
app.delete('/api/expenses/:id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Expense not found' });
  res.json({ success: true });
});

// Summary: totals by category for a given month (for charts + budgets)
app.get('/api/summary', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT category, SUM(amount) as total FROM expenses';
  const params = [];
  if (month) {
    query += " WHERE strftime('%Y-%m', date) = ?";
    params.push(month);
  }
  query += ' GROUP BY category';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// ---------- BUDGETS ----------

app.get('/api/budgets', (req, res) => {
  res.json(db.prepare('SELECT * FROM budgets ORDER BY category').all());
});

app.put('/api/budgets/:category', (req, res) => {
  const { monthly_limit } = req.body;
  if (monthly_limit === undefined || isNaN(monthly_limit) || Number(monthly_limit) < 0) {
    return res.status(400).json({ error: 'monthly_limit must be a non-negative number' });
  }
  db.prepare(
    'INSERT INTO budgets (category, monthly_limit) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit'
  ).run(req.params.category, Number(monthly_limit));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Expense tracker running at http://localhost:${PORT}`);
});
