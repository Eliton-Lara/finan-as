// State Management
let expenses = JSON.parse(localStorage.getItem('finances_expenses')) || [
    { id: 1, desc: 'Conta de Luz', category: 'Luz', amount: 150.00, installments: 1, date: getRelativeDate(0, 5) },
    { id: 2, desc: 'Conta de Água', category: 'Água', amount: 80.00, installments: 1, date: getRelativeDate(0, 10) },
    { id: 3, desc: 'Compra Havan', category: 'Loja', amount: 100.00, installments: 10, date: getRelativeDate(-1, 15) },
    { id: 4, desc: 'Supermercado', category: 'Outros', amount: 450.00, installments: 1, date: getRelativeDate(0, 2) }
];

let income = parseFloat(localStorage.getItem('finances_income')) || 3000;
let calendarDate = new Date();

// Helper to generate dates easily for initial demo
function getRelativeDate(monthOffset, day) {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    d.setDate(day);
    return d.toISOString().split('T')[0];
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('monthly-income').value = income;
    document.getElementById('expense-date').valueAsDate = new Date();
    
    document.getElementById('monthly-income').addEventListener('input', (e) => {
        income = parseFloat(e.target.value) || 0;
        localStorage.setItem('finances_income', income);
        updateApp();
    });

    document.getElementById('expense-form').addEventListener('submit', handleAddExpense);

    updateApp();
});

function saveExpenses() {
    localStorage.setItem('finances_expenses', JSON.stringify(expenses));
}

function handleAddExpense(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const category = document.getElementById('category').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const installments = parseInt(document.getElementById('installments').value);
    const date = document.getElementById('expense-date').value;

    const newExpense = {
        id: Date.now(),
        desc,
        category,
        amount,
        installments,
        date
    };

    expenses.push(newExpense);
    saveExpenses();
    updateApp();

    // Reset form
    document.getElementById('desc').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('expense-date').valueAsDate = new Date();
}

function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    updateApp();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCategoryIcon(cat) {
    switch(cat) {
        case 'Cartão': return '<i class="fa-solid fa-credit-card"></i>';
        case 'Luz': return '<i class="fa-solid fa-bolt"></i>';
        case 'Água': return '<i class="fa-solid fa-droplet"></i>';
        case 'Loja': return '<i class="fa-solid fa-bag-shopping"></i>';
        default: return '<i class="fa-solid fa-receipt"></i>';
    }
}

function getCategoryClass(cat) {
    switch(cat) {
        case 'Cartão': return 'cat-cartao';
        case 'Luz': return 'cat-luz';
        case 'Água': return 'cat-agua';
        case 'Loja': return 'cat-loja';
        default: return 'cat-outros';
    }
}

// Calculation Helpers for Installments across Months
function getActiveInstallmentsForMonth(targetYear, targetMonth) {
    let activeList = [];

    expenses.forEach(expense => {
        const [expYear, expMonth, expDay] = expense.date.split('-').map(Number);
        
        // Calculate difference in months
        const monthsDiff = (targetYear - expYear) * 12 + (targetMonth - (expMonth - 1));

        if (monthsDiff >= 0 && monthsDiff < expense.installments) {
            activeList.push({
                ...expense,
                currentInstallment: monthsDiff + 1,
                dueDate: new Date(targetYear, targetMonth, Math.min(expDay, 28))
            });
        }
    });

    return activeList;
}

// Update All Views & Dashboards
function updateApp() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Active Expenses for current month
    const currentExpenses = getActiveInstallmentsForMonth(currentYear, currentMonth);
    const totalSpentCurrentMonth = currentExpenses.reduce((sum, item) => sum + item.amount, 0);

    // 1. Metrics Update
    const percentage = income > 0 ? Math.round((totalSpentCurrentMonth / income) * 100) : 0;
    const percentageElem = document.getElementById('metric-percentage');
    const progressBar = document.getElementById('progress-bar');
    
    percentageElem.innerText = `${percentage}%`;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;

    if (percentage > 90) {
        progressBar.style.background = 'var(--danger)';
        percentageElem.style.color = 'var(--danger)';
    } else if (percentage > 70) {
        progressBar.style.background = 'var(--warning)';
        percentageElem.style.color = 'var(--warning)';
    } else {
        progressBar.style.background = 'var(--primary)';
        percentageElem.style.color = 'var(--dark)';
    }

    document.getElementById('metric-percentage-sub').innerText = `${percentage}% da renda de ${formatCurrency(income)}`;
    document.getElementById('metric-total-expenses').innerText = formatCurrency(totalSpentCurrentMonth);
    
    const remaining = income - totalSpentCurrentMonth;
    const remainingElem = document.getElementById('metric-remaining');
    remainingElem.innerText = `Saldo livre: ${formatCurrency(remaining)}`;
    remainingElem.style.color = remaining < 0 ? 'var(--danger)' : 'var(--gray-500)';

    const installmentCount = currentExpenses.filter(e => e.installments > 1).length;
    document.getElementById('metric-installments-count').innerText = installmentCount;

    // 2. Render Expense List
    renderExpenseList(currentExpenses);

    // 3. Render Projections
    renderProjections();

    // 4. Render Calendar
    renderCalendar();
}

function renderExpenseList(list) {
    const container = document.getElementById('expense-list');
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-square-check"></i>
                <p>Nenhum gasto registrado para este mês.</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(item => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-icon ${getCategoryClass(item.category)}">
                    ${getCategoryIcon(item.category)}
                </div>
                <div class="expense-details">
                    <h4>${item.desc}</h4>
                    <p>${item.category} ${item.installments > 1 ? `• Parcela ${item.currentInstallment}/${item.installments}` : '• À vista'}</p>
                </div>
            </div>
            <div class="expense-amount">
                <div class="val">${formatCurrency(item.amount)}</div>
                ${item.installments > 1 ? `<span class="badge">${item.currentInstallment}ª de ${item.installments}x</span>` : ''}
                <button class="delete-btn" onclick="deleteExpense(${item.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>
    `).join('');
}

function renderProjections() {
    const container = document.getElementById('projection-cards');
    const now = new Date();
    let html = '';

    for (let i = 0; i < 6; i++) {
        let targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        let monthName = targetDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        let monthExpenses = getActiveInstallmentsForMonth(targetDate.getFullYear(), targetDate.getMonth());
        let monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
        let monthPercent = income > 0 ? Math.round((monthTotal / income) * 100) : 0;

        html += `
            <div class="projection-card">
                <h4>${monthName}</h4>
                <div class="total">${formatCurrency(monthTotal)}</div>
                <div class="metric-subtitle">${monthPercent}% da renda</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function changeMonth(direction) {
    calendarDate.setMonth(calendarDate.getMonth() + direction);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('calendar-month-year');
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    monthYearLabel.innerText = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    let activeExpenses = getActiveInstallmentsForMonth(year, month);

    let daysHtml = `
        <div class="calendar-day-head">Dom</div>
        <div class="calendar-day-head">Seg</div>
        <div class="calendar-day-head">Ter</div>
        <div class="calendar-day-head">Qua</div>
        <div class="calendar-day-head">Qui</div>
        <div class="calendar-day-head">Sex</div>
        <div class="calendar-day-head">Sáb</div>
    `;

    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="calendar-day empty"></div>`;
    }

    const today = new Date();

    for (let day = 1; day <= totalDays; day++) {
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        
        // Find expenses due on this day
        const dayEvents = activeExpenses.filter(e => {
            const expDate = new Date(e.date);
            // Match day or default to purchase day of month
            const originalDay = expDate.getDate();
            return originalDay === day || (day === 28 && originalDay > 28);
        });

        const hasEventClass = dayEvents.length > 0 ? 'has-event' : '';

        daysHtml += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasEventClass}">
                <span class="day-num">${day}</span>
                ${dayEvents.map(ev => `<div class="event-dot" title="${ev.desc}: ${formatCurrency(ev.amount)}">${ev.desc}</div>`).join('')}
            </div>
        `;
    }

    grid.innerHTML = daysHtml;
}