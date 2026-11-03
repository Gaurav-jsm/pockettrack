const $ = id => document.getElementById(id);

const CATEGORIES = [
  "Food", "Groceries", "Travel", "Shopping", "Bills",
  "Rent", "Health", "Entertainment", "Education",
  "Personal care", "Other"
];

const STORAGE_KEY = "pockettrack_data_v1";

let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"transactions":[],"budgets":{}}');
let selectedMonth = new Date().toISOString().slice(0, 7);
let editingId = null;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function monthTransactions() {
  return data.transactions.filter(t => t.date.slice(0, 7) === selectedMonth);
}

function totals() {
  const tx = monthTransactions();
  const income = tx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

function render() {
  const tx = monthTransactions().sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );

  const t = totals();

  $("monthPicker").value = selectedMonth;
  $("totalIncome").textContent = money(t.income);
  $("totalExpense").textContent = money(t.expense);
  $("netBalance").textContent = money(t.balance);
  $("netBalance").className = "amount " + (t.balance >= 0 ? "green" : "red");
  $("balanceHint").textContent = t.balance >= 0
    ? "You're within your income."
    : "Expenses are higher than income.";

  $("reportIncome").textContent = money(t.income);
  $("reportExpense").textContent = money(t.expense);

  const transactionHTML = tx.length ? tx.map(item => `
    <div class="tx row">
      <div style="min-width:0">
        <div class="txname">${escapeHTML(item.description)}</div>
        <div class="txmeta">${escapeHTML(item.category)} · ${item.date}</div>
        <div class="actions">
          <button class="btn secondary" data-edit="${item.id}">Edit</button>
          <button class="btn danger" data-delete="${item.id}">Delete</button>
        </div>
      </div>
      <div class="txamt ${item.type === "income" ? "green" : "red"}">
        ${item.type === "income" ? "+" : "−"}${money(item.amount)}
      </div>
    </div>
  `).join("") : `<div class="empty">No transactions this month.<br>Tap Add expense to get started.</div>`;

  $("recent").innerHTML = tx.slice(0, 5).map(item => `
    <div class="tx row">
      <div>
        <div class="txname">${escapeHTML(item.description)}</div>
        <div class="txmeta">${escapeHTML(item.category)} · ${item.date}</div>
      </div>
      <div class="txamt ${item.type === "income" ? "green" : "red"}">
        ${item.type === "income" ? "+" : "−"}${money(item.amount)}
      </div>
    </div>
  `).join("") || `<div class="empty">Your transactions will appear here.</div>`;

  $("allTransactions").innerHTML = transactionHTML;

  renderBudgets();
  renderCategories();
}

function renderBudgets() {
  const expenses = monthTransactions().filter(t => t.type === "expense");
  const budgets = data.budgets[selectedMonth] || {};

  const html = CATEGORIES.map(category => {
    const spent = expenses
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);

    const limit = Number(budgets[category] || 0);
    if (!limit && !spent) return "";

    const percent = limit ? Math.min(100, spent / limit * 100) : 0;
    const over = limit && spent > limit;

    return `
      <div class="budgetitem">
        <div class="row">
          <strong>${escapeHTML(category)}</strong>
          <span class="small">${money(spent)} / ${limit ? money(limit) : "No limit"}</span>
        </div>
        <div class="progress">
          <i style="width:${percent}%;${over ? "background:var(--red)" : ""}"></i>
        </div>
        ${over ? `<div class="small red">Budget exceeded by ${money(spent - limit)}</div>` : ""}
      </div>
    `;
  }).join("");

  $("budgetList").innerHTML = html || `<div class="empty">No budgets yet. Tap Set budget to begin.</div>`;
}

function renderCategories() {
  const expenses = monthTransactions().filter(t => t.type === "expense");
  const totals = {};

  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  $("categoryReport").innerHTML = sorted.length
    ? sorted.map(([category, amount]) => `
      <div class="budgetitem">
        <div class="row">
          <strong>${escapeHTML(category)}</strong>
          <span>${money(amount)}</span>
        </div>
        <div class="progress">
          <i style="width:${total ? amount / total * 100 : 0}%"></i>
        </div>
        <div class="small">${total ? (amount / total * 100).toFixed(1) : 0}% of expenses</div>
      </div>
    `).join("")
    : `<div class="empty">No spending data for this month.</div>`;
}

function openTransaction(type = "expense", item = null) {
  editingId = item ? item.id : null;
  $("dialogTitle").textContent = item ? "Edit transaction" : "Add transaction";
  $("type").value = item ? item.type : type;
  $("description").value = item ? item.description : "";
  $("amount").value = item ? item.amount : "";
  $("category").value = item ? item.category : CATEGORIES[0];
  $("date").value = item ? item.date : new Date().toISOString().slice(0, 10);
  $("transactionDialog").showModal();
}

function openBudget() {
  $("budgetCategory").value = CATEGORIES[0];
  $("budgetAmount").value = "";
  $("budgetDialog").showModal();
}

function exportCSV() {
  const rows = [
    ["Date", "Type", "Description", "Category", "Amount (INR)"],
    ...data.transactions.map(t => [
      t.date, t.type, t.description, t.category, t.amount
    ])
  ];

  const csv = rows.map(row =>
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PocketTrack-transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Navigation
document.querySelectorAll(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b =>
      b.classList.toggle("active", b === button)
    );
    document.querySelectorAll(".section").forEach(section =>
      section.classList.toggle("active", section.id === button.dataset.tab)
    );
  });
});

// Add transaction buttons
$("addExpense").addEventListener("click", () => openTransaction("expense"));
$("addIncome").addEventListener("click", () => openTransaction("income"));
$("addTransaction").addEventListener("click", () => openTransaction());

$("cancelDialog").addEventListener("click", () => {
  $("transactionDialog").close();
});

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const item = {
    id: editingId || Date.now(),
    type: $("type").value,
    description: $("description").value.trim(),
    amount: Number($("amount").value),
    category: $("category").value,
    date: $("date").value
  };

  if (!item.description || !Number.isFinite(item.amount) ||
      item.amount <= 0 || !item.date) {
    alert("Please enter valid transaction details.");
    return;
  }

  if (editingId) {
    const index = data.transactions.findIndex(t => t.id === editingId);
    if (index !== -1) data.transactions[index] = item;
  } else {
    data.transactions.push(item);
  }

  save();
  $("transactionDialog").close();
  render();
});

// Edit and delete transactions
document.addEventListener("click", event => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const item = data.transactions.find(t => t.id === Number(editId));
    if (item) openTransaction(item.type, item);
  }

  if (deleteId) {
    const id = Number(deleteId);
    if (confirm("Delete this transaction?")) {
      data.transactions = data.transactions.filter(t => t.id !== id);
      save();
      render();
    }
  }
});

// Budgets
$("addBudget").addEventListener("click", openBudget);

$("cancelBudget").addEventListener("click", () => {
  $("budgetDialog").close();
});

$("budgetForm").addEventListener("submit", event => {
  event.preventDefault();

  const category = $("budgetCategory").value;
  const amount = Number($("budgetAmount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid budget amount.");
    return;
  }

  if (!data.budgets[selectedMonth]) data.budgets[selectedMonth] = {};
  data.budgets[selectedMonth][category] = amount;

  save();
  $("budgetDialog").close();
  render();
});

// Month selection
$("monthPicker").addEventListener("change", event => {
  if (event.target.value) {
    selectedMonth = event.target.value;
    render();
  }
});

// Export
$("exportCsv").addEventListener("click", exportCSV);

// Populate category dropdowns
["category", "budgetCategory"].forEach(id => {
  $(id).innerHTML = CATEGORIES.map(category =>
    `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
  ).join("");
});

// Start app
render();