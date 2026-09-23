const monthInput = document.getElementById('month-select');
const form = document.getElementById('expense-form');
const formError = document.getElementById('form-error');
const categorySelect = document.getElementById('category');
const filterSelect = document.getElementById('filter-category');
const rowsEl = document.getElementById('expense-rows');
const listEmpty = document.getElementById('list-empty');
const totalSpentEl = document.getElementById('total-spent');
const totalCountEl = document.getElementById('total-count');
const budgetListEl = document.getElementById('budget-list');
const chartWrap = document.getElementById('category-chart').parentElement;

let budgets = [];
let chart = null;

const money = (n) => `$${Number(n).toFixed(2)}`;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function loadBudgets() {
  budgets = await api('/api/budgets');
  const categories = budgets.map((b) => b.category);

  categorySelect.innerHTML = categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  filterSelect.innerHTML =
    '<option value="All">All categories</option>' +
    categories.map((c) => `<option value="${c}">${c}</option>`).join('');
}

async function loadSummary(month) {
  const rows = await api(`/api/summary?month=${month}`);
  const spentByCategory = {};
  for (const r of rows) spentByCategory[r.category] = r.total;
  return spentByCategory;
}

function renderBudgets(spentByCategory) {
  budgetListEl.innerHTML = budgets
    .map((b) => {
      const spent = spentByCategory[b.category] || 0;
      const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
      const over = b.monthly_limit > 0 && spent > b.monthly_limit;
      return `
        <div class="budget-row" data-category="${b.category}">
          <div class="budget-top">
            <span>${b.category}</span>
            <input type="number" min="0" step="1" class="budget-input" value="${b.monthly_limit}">
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${over ? 'over' : ''}" style="width:${b.monthly_limit > 0 ? pct : 0}%"></div>
          </div>
        </div>`;
    })
    .join('');

  budgetListEl.querySelectorAll('.budget-input').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const category = e.target.closest('.budget-row').dataset.category;
      try {
        await api(`/api/budgets/${encodeURIComponent(category)}`, {
          method: 'PUT',
          body: JSON.stringify({ monthly_limit: Number(e.target.value) }),
        });
        refresh();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function renderChart(spentByCategory) {
  const entries = Object.entries(spentByCategory).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    chartWrap.classList.add('empty');
    return;
  }
  chartWrap.classList.remove('empty');

  const ctx = document.getElementById('category-chart');
  const palette = ['#2F6F4E', '#6E8F5C', '#A9BF8E', '#B3492F', '#D6906B', '#8C9F8C'];

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([cat]) => cat),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map((_, i) => palette[i % palette.length]),
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'IBM Plex Sans', size: 12 } } },
      },
    },
  });
}

async function loadExpenses(month) {
  const category = filterSelect.value;
  const params = new URLSearchParams({ month });
  if (category !== 'All') params.set('category', category);

  const expenses = await api(`/api/expenses?${params.toString()}`);

  totalCountEl.textContent = expenses.length;
  totalSpentEl.textContent = money(expenses.reduce((sum, e) => sum + e.amount, 0));

  if (expenses.length === 0) {
    rowsEl.innerHTML = '';
    listEmpty.classList.add('show');
    return;
  }
  listEmpty.classList.remove('show');

  rowsEl.innerHTML = expenses
    .map(
      (e) => `
      <tr data-id="${e.id}">
        <td>${e.date}</td>
        <td>${escapeHtml(e.description)}</td>
        <td><span class="cat-tag">${e.category}</span></td>
        <td class="align-right">${money(e.amount)}</td>
        <td><button class="delete-btn" aria-label="Delete expense">Delete</button></td>
      </tr>`
    )
    .join('');

  rowsEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      if (!confirm('Delete this expense?')) return;
      await api(`/api/expenses/${id}`, { method: 'DELETE' });
      refresh();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function refresh() {
  const month = monthInput.value;
  const spentByCategory = await loadSummary(month);
  renderBudgets(spentByCategory);
  renderChart(spentByCategory);
  await loadExpenses(month);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const description = document.getElementById('description').value.trim();
  const amount = document.getElementById('amount').value;
  const date = document.getElementById('date').value;
  const category = categorySelect.value;

  try {
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ description, amount, category, date }),
    });
    form.reset();
    document.getElementById('date').value = todayISO();
    if (date.slice(0, 7) === monthInput.value) refresh();
  } catch (err) {
    formError.textContent = err.message;
  }
});

filterSelect.addEventListener('change', refresh);
monthInput.addEventListener('change', refresh);

(async function init() {
  monthInput.value = currentMonth();
  document.getElementById('date').value = todayISO();
  await loadBudgets();
  await refresh();
})();
