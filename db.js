const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'expenses.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    category TEXT PRIMARY KEY,
    monthly_limit REAL NOT NULL
  );
`);

// Seed some default categories with no limit set (0 = no budget)
const defaultCategories = ['Food', 'Transport', 'Housing', 'Entertainment', 'Utilities', 'Other'];
const insertBudget = db.prepare('INSERT OR IGNORE INTO budgets (category, monthly_limit) VALUES (?, 0)');
for (const cat of defaultCategories) insertBudget.run(cat);

module.exports = db;
