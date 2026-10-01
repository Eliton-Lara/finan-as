// State Management
let expenses = JSON.parse(localStorage.getItem('finances_expenses')) || [
    { id: 1, desc: 'Conta de Luz', category: 'Luz', amount: 150.00, installments: 1, date: getRelativeDate(0, 5), removedMonths: [] },
    { id: 2, desc: 'Conta de Água', category: 'Água', amount: 80.00, installments: 1, date: getRelativeDate(0, 10), removedMonths: [] },
    { id: 3, desc: 'Compra Havan', category: 'Loja', amount: 100.00, installments: 10, date: getRelativeDate(-1, 15), removedMonths: [] },
    { id: 4, desc: 'Supermercado', category: 'Outros', amount: 450.00, installments: 1, date: getRelativeDate(0, 2), removedMonths: [] }
];

let income = parseFloat(localStorage.getItem('finances_income')) || 3000;
let calendarDate = new Date();
let viewingDate = new Date(); // Date being viewed in Tab 1 (Gastos do Mês)
let currentModalTarget = null;
let toastTimeout = null;

// Ensure legacy expenses have removedMonths array
expenses.forEach(e => {
    if (!Array.isArray(e.removedMonths)) {
        e.removedMonths = [];
    }
});

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

    // Close modal when clicking outside box
    const modal = document.getElementById('action-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeActionModal();
            }
        });
    }

    updateApp();
});

function saveExpenses() {
    localStorage.setItem('finances_expenses', JSON.stringify(expenses));
}

function handleAddExpense(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value.trim();
    const category = document.getElementById('category').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const installments = parseInt(document.getElementById('installments').value);
    const date = document.getElementById('expense-date').value;

    if (!desc || isNaN(amount) || amount <= 0 || !date) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }

    const newExpense = {
        id: Date.now(),
        desc,
        category,
        amount,
        installments,
        date,
        removedMonths: []
    };

    expenses.push(newExpense);
    saveExpenses();
    updateApp();

    showToast(`Gasto "${desc}" adicionado com sucesso!`);

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
    
    // Find button that links to tabId
    const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

function formatCurrency(val) {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
function getInstallmentDetails(expense, targetYear, targetMonth) {
    const [expYear, expMonth, expDay] = expense.date.split('-').map(Number);
    
    // Calculate difference in months
    const monthsDiff = (targetYear - expYear) * 12 + (targetMonth - (expMonth - 1));

    if (monthsDiff < 0 || monthsDiff >= expense.installments) {
        return null;
    }

    const monthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const isRemoved = Array.isArray(expense.removedMonths) && expense.removedMonths.includes(monthKey);
    const currentInstallment = monthsDiff + 1;
    const remainingInstallments = expense.installments - currentInstallment;
    const remainingAmount = remainingInstallments * expense.amount;

    return {
        ...expense,
        monthKey,
        currentInstallment,
        remainingInstallments,
        remainingAmount,
        isRemoved,
        dueDate: new Date(targetYear, targetMonth, Math.min(expDay, 28))
    };
}

function getActiveInstallmentsForMonth(targetYear, targetMonth, includeRemoved = false) {
    let list = [];
    expenses.forEach(expense => {
        const detail = getInstallmentDetails(expense, targetYear, targetMonth);
        if (detail) {
            if (includeRemoved || !detail.isRemoved) {
                list.push(detail);
            }
        }
    });
    return list;
}

// Month Navigation in Tab 1
function navigateMonth(direction) {
    viewingDate.setMonth(viewingDate.getMonth() + direction);
    updateApp();
}

function goToCurrentMonth() {
    viewingDate = new Date();
    updateApp();
}

function onJumpToMonth(val) {
    if (!val) return;
    const [year, month] = val.split('-').map(Number);
    viewingDate = new Date(year, month - 1, 1);
    updateApp();
}

function openMonthInMainTab(year, month) {
    viewingDate = new Date(year, month, 1);
    switchTab('list-tab');
    updateApp();
}

// Update All Views & Dashboards
function updateApp() {
    const now = new Date();
    const vYear = viewingDate.getFullYear();
    const vMonth = viewingDate.getMonth();
    const isCurrentMonth = vYear === now.getFullYear() && vMonth === now.getMonth();
    const monthName = viewingDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const monthShort = viewingDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });

    // Sync native month picker
    const jumpPicker = document.getElementById('month-jump-picker');
    if (jumpPicker) {
        jumpPicker.value = `${vYear}-${String(vMonth + 1).padStart(2, '0')}`;
    }

    // 1. Metrics for the VIEWING month (recalculados automaticamente para o mês selecionado)
    const viewingMonthExpenses = getActiveInstallmentsForMonth(vYear, vMonth, false);
    const totalSpentViewing = viewingMonthExpenses.reduce((sum, item) => sum + item.amount, 0);

    const percentage = income > 0 ? Math.round((totalSpentViewing / income) * 100) : 0;
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

    const metricTitle = document.getElementById('metric-total-title');
    if (metricTitle) {
        metricTitle.innerText = isCurrentMonth ? 'Total de Gastos (Mês Atual)' : `Total de Gastos (${monthShort})`;
    }

    const metricPercentageTitle = document.getElementById('metric-percentage-title');
    if (metricPercentageTitle) {
        metricPercentageTitle.innerText = isCurrentMonth ? 'Comprometimento Mensal' : `Comprometimento (${monthShort})`;
    }

    const subTitleElem = document.getElementById('metric-percentage-sub');
    if (subTitleElem) {
        subTitleElem.innerText = isCurrentMonth 
            ? `${percentage}% da sua renda comprometida`
            : `${percentage}% da renda comprometida em ${monthName}`;
    }

    document.getElementById('metric-total-expenses').innerText = formatCurrency(totalSpentViewing);
    
    const remaining = income - totalSpentViewing;
    const remainingElem = document.getElementById('metric-remaining');
    remainingElem.innerText = `Saldo livre: ${formatCurrency(remaining)}`;
    remainingElem.style.color = remaining < 0 ? 'var(--danger)' : 'var(--gray-500)';

    const installmentCount = viewingMonthExpenses.filter(e => e.installments > 1).length;
    document.getElementById('metric-installments-count').innerText = installmentCount;

    // 2. Render Expense List for the VIEWING month
    renderViewingMonthList();

    // 3. Render Projections for the next months
    renderProjections();

    // 4. Render Calendar
    renderCalendar();
}

// Render Tab 1 (Gastos do Mês com Navegação)
function renderViewingMonthList() {
    const now = new Date();
    const vYear = viewingDate.getFullYear();
    const vMonth = viewingDate.getMonth();

    const isCurrentMonth = vYear === now.getFullYear() && vMonth === now.getMonth();
    const isFutureMonth = (vYear > now.getFullYear()) || (vYear === now.getFullYear() && vMonth > now.getMonth());

    // Update month navigator UI
    const titleElem = document.getElementById('viewing-month-title');
    const badgeElem = document.getElementById('viewing-month-badge');
    const totalElem = document.getElementById('viewing-month-total');
    const btnToday = document.getElementById('btn-today-shortcut');

    const monthName = viewingDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    titleElem.innerText = monthName;

    if (isCurrentMonth) {
        badgeElem.innerText = 'Mês Atual';
        badgeElem.className = 'badge-status';
        if (btnToday) btnToday.style.display = 'none';
    } else if (isFutureMonth) {
        badgeElem.innerText = 'Mês Futuro';
        badgeElem.className = 'badge-status future';
        if (btnToday) btnToday.style.display = 'inline-flex';
    } else {
        badgeElem.innerText = 'Mês Passado';
        badgeElem.className = 'badge-status past';
        if (btnToday) btnToday.style.display = 'inline-flex';
    }

    // Get active and removed expenses for the viewing month
    const allExpenses = getActiveInstallmentsForMonth(vYear, vMonth, true);
    const activeExpenses = allExpenses.filter(e => !e.isRemoved);
    const removedExpenses = allExpenses.filter(e => e.isRemoved);

    const totalViewing = activeExpenses.reduce((sum, item) => sum + item.amount, 0);
    totalElem.innerText = `Total: ${formatCurrency(totalViewing)}`;

    const container = document.getElementById('expense-list');
    
    if (activeExpenses.length === 0 && removedExpenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-square-check"></i>
                <p>Nenhum gasto registrado ou previsto para ${monthName}.</p>
            </div>`;
    } else {
        container.innerHTML = activeExpenses.map(item => {
            const hasMultiple = item.installments > 1;
            let remainingText = '';
            let remainingClass = '';

            if (hasMultiple) {
                if (item.remainingInstallments > 0) {
                    remainingText = `Faltam ${item.remainingInstallments} parcelas para acabar (${formatCurrency(item.remainingAmount)} restantes)`;
                } else {
                    remainingText = `🎉 Última parcela para quitar!`;
                    remainingClass = 'last-one';
                }
            } else {
                remainingText = 'Conta única / À vista';
                remainingClass = 'single';
            }

            return `
                <div class="expense-item">
                    <div class="expense-info">
                        <div class="expense-icon ${getCategoryClass(item.category)}">
                            ${getCategoryIcon(item.category)}
                        </div>
                        <div class="expense-details">
                            <h4>${item.desc}</h4>
                            <p>
                                <span>${item.category}</span>
                                ${hasMultiple ? `<span>• Parcela ${item.currentInstallment}/${item.installments}</span>` : ''}
                                <span class="badge-remaining ${remainingClass}">${remainingText}</span>
                            </p>
                        </div>
                    </div>
                    <div class="expense-amount">
                        <div class="val">${formatCurrency(item.amount)}</div>
                        <button class="delete-btn" onclick="openDeleteModal(${item.id}, '${item.monthKey}')" title="${hasMultiple ? 'Apagar parcela adiantada ou excluir compra' : 'Excluir conta'}">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render advanced / removed installments section for this viewing month
    const advancedSection = document.getElementById('advanced-expenses-section');
    if (removedExpenses.length > 0) {
        advancedSection.style.display = 'block';
        advancedSection.innerHTML = `
            <div class="advanced-installments-box">
                <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Parcelas adiantadas no mês anterior / pagas antecipadamente neste mês (${removedExpenses.length}):</span>
                </div>
                ${removedExpenses.map(item => `
                    <div class="advanced-item-row">
                        <div>
                            <strong>${item.desc}</strong> — Parcela ${item.currentInstallment}/${item.installments} (${formatCurrency(item.amount)})
                        </div>
                        <button class="btn-restore-parcel" onclick="restoreSingleInstallment(${item.id}, '${item.monthKey}')" title="Restaurar parcela para este mês">
                            <i class="fa-solid fa-rotate-left"></i> Restaurar
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        advancedSection.style.display = 'none';
        advancedSection.innerHTML = '';
    }
}

// Render Tab 2: Projeção Futura Detalhada
function renderProjections() {
    const container = document.getElementById('projection-cards');
    const now = new Date();
    let html = '';

    for (let i = 0; i < 6; i++) {
        let targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        let tYear = targetDate.getFullYear();
        let tMonth = targetDate.getMonth();
        let monthName = targetDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        let allMonthExpenses = getActiveInstallmentsForMonth(tYear, tMonth, true);
        let activeList = allMonthExpenses.filter(e => !e.isRemoved);
        let removedList = allMonthExpenses.filter(e => e.isRemoved);

        let monthTotal = activeList.reduce((sum, item) => sum + item.amount, 0);
        let monthPercent = income > 0 ? Math.round((monthTotal / income) * 100) : 0;
        let isCurrent = i === 0;

        html += `
            <div class="projection-card">
                <div class="projection-card-header">
                    <div class="projection-card-header-top">
                        <h4>${monthName}</h4>
                        <span class="badge-status ${isCurrent ? '' : 'future'}">${isCurrent ? 'Mês Atual' : 'Mês Futuro'}</span>
                    </div>
                    <div class="total">${formatCurrency(monthTotal)}</div>
                    <div class="projection-meta-row">
                        <span>${monthPercent}% da renda comprometida</span>
                        <span><strong>${activeList.length}</strong> ${activeList.length === 1 ? 'conta' : 'contas'}</span>
                    </div>
                    <div class="projection-card-progress">
                        <div class="projection-card-progress-fill" style="width: ${Math.min(monthPercent, 100)}%; background: ${monthPercent > 90 ? 'var(--danger)' : (monthPercent > 70 ? 'var(--warning)' : 'var(--primary)')}"></div>
                    </div>
                </div>

                <div class="projection-breakdown-title">
                    <i class="fa-solid fa-list-ul"></i> Detalhamento das contas deste mês:
                </div>

                <div class="projection-items-list">
                    ${activeList.length === 0 ? `
                        <div style="font-size: 13px; color: var(--gray-500); padding: 12px 0; text-align: center;">
                            <i class="fa-solid fa-circle-check" style="color: var(--success); margin-right: 4px;"></i> Nenhum gasto previsto para este mês.
                        </div>
                    ` : activeList.map(item => {
                        const hasMultiple = item.installments > 1;
                        let remainingBadge = '';
                        if (hasMultiple) {
                            if (item.remainingInstallments > 0) {
                                remainingBadge = `<span class="badge-remaining">Parcela ${item.currentInstallment}/${item.installments}x • Faltam ${item.remainingInstallments} para acabar</span>`;
                            } else {
                                remainingBadge = `<span class="badge-remaining last-one">Parcela ${item.currentInstallment}/${item.installments}x • Última parcela!</span>`;
                            }
                        } else {
                            remainingBadge = `<span class="badge-remaining single">Conta única</span>`;
                        }

                        return `
                            <div class="projection-item">
                                <div class="projection-item-left">
                                    <div class="projection-item-icon ${getCategoryClass(item.category)}">
                                        ${getCategoryIcon(item.category)}
                                    </div>
                                    <div class="projection-item-info">
                                        <h5>${item.desc}</h5>
                                        <p>
                                            <span>${item.category}</span>
                                            ${remainingBadge}
                                        </p>
                                    </div>
                                </div>
                                <div class="projection-item-right">
                                    <div class="projection-item-amount">${formatCurrency(item.amount)}</div>
                                    <button class="btn-item-delete" onclick="openDeleteModal(${item.id}, '${item.monthKey}')" title="Apagar parcela (caso tenha adiantado)">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${removedList.length > 0 ? `
                    <div class="advanced-installments-box">
                        <strong><i class="fa-solid fa-circle-check"></i> ${removedList.length} parcela(s) já adiantada(s) / paga(s):</strong>
                        ${removedList.map(item => `
                            <div class="advanced-item-row">
                                <span>${item.desc} (Parcela ${item.currentInstallment}/${item.installments} - ${formatCurrency(item.amount)})</span>
                                <button class="btn-restore-parcel" onclick="restoreSingleInstallment(${item.id}, '${item.monthKey}')">
                                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="projection-card-footer">
                    <button class="btn-open-month" onclick="openMonthInMainTab(${tYear}, ${tMonth})">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir na lista principal
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Delete Modal & Actions
function openDeleteModal(expenseId, monthKey) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const [year, month] = monthKey.split('-').map(Number);
    const detail = getInstallmentDetails(expense, year, month - 1);
    if (!detail) return;

    const monthObj = new Date(year, month - 1, 1);
    const monthName = monthObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    currentModalTarget = {
        expenseId,
        monthKey,
        desc: expense.desc,
        amount: expense.amount,
        installments: expense.installments,
        currentInstallment: detail.currentInstallment,
        remainingInstallments: detail.remainingInstallments,
        monthName
    };

    // If single installment, confirm directly with simple question
    if (expense.installments === 1) {
        if (confirm(`Deseja excluir "${expense.desc}" no valor de ${formatCurrency(expense.amount)}?`)) {
            deleteExpense(expenseId);
            showToast(`Gasto "${expense.desc}" excluído com sucesso.`);
        }
        return;
    }

    // Multi-installment expense: open custom modal with choices
    document.getElementById('modal-item-desc').innerText = expense.desc;
    document.getElementById('modal-item-sub').innerText = `Parcela ${detail.currentInstallment} de ${expense.installments}x • Mês de ${monthName}`;
    
    if (detail.remainingInstallments > 0) {
        document.getElementById('modal-item-remaining').innerText = `Faltam ${detail.remainingInstallments} parcelas para acabar (${formatCurrency(detail.remainingAmount)} restantes)`;
        document.getElementById('modal-item-remaining').style.display = 'inline-block';
    } else {
        document.getElementById('modal-item-remaining').innerText = `🎉 Última parcela para quitar!`;
        document.getElementById('modal-item-remaining').style.display = 'inline-block';
    }

    document.getElementById('modal-item-val').innerText = formatCurrency(expense.amount);
    document.getElementById('modal-advance-hint').innerText = `Você adiantou o pagamento no mês anterior? Ela será apagada apenas de ${monthName}. As demais parcelas continuam ativas normalmente.`;

    const modal = document.getElementById('action-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeActionModal() {
    const modal = document.getElementById('action-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentModalTarget = null;
}

function executeDeleteSingleInstallment() {
    if (!currentModalTarget) return;

    const { expenseId, monthKey, desc, currentInstallment, monthName } = currentModalTarget;
    const expense = expenses.find(e => e.id === expenseId);
    
    if (expense) {
        if (!Array.isArray(expense.removedMonths)) {
            expense.removedMonths = [];
        }
        if (!expense.removedMonths.includes(monthKey)) {
            expense.removedMonths.push(monthKey);
        }
        saveExpenses();
        closeActionModal();
        updateApp();

        showToast(`Parcela ${currentInstallment} de "${desc}" apagada de ${monthName}!`, () => {
            restoreSingleInstallment(expenseId, monthKey);
        });
    }
}

function executeDeleteAllInstallments() {
    if (!currentModalTarget) return;

    const { expenseId, desc } = currentModalTarget;
    if (confirm(`Atenção: deseja realmente excluir o lançamento "${desc}" e TODAS as suas parcelas de todos os meses?`)) {
        deleteExpense(expenseId);
        closeActionModal();
        showToast(`Compra "${desc}" e todas as parcelas foram excluídas definitivamente.`);
    }
}

function restoreSingleInstallment(expenseId, monthKey) {
    const expense = expenses.find(e => e.id === expenseId);
    if (expense && Array.isArray(expense.removedMonths)) {
        expense.removedMonths = expense.removedMonths.filter(m => m !== monthKey);
        saveExpenses();
        updateApp();
        showToast(`Parcela de "${expense.desc}" restaurada com sucesso!`);
    }
}

// Toast notification with optional undo
function showToast(message, undoAction = null) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    let html = `<span>${message}</span>`;
    if (undoAction) {
        html += `<button class="toast-undo-btn" id="toast-undo-btn"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>`;
    }

    toast.innerHTML = html;
    toast.classList.add('show');

    if (undoAction) {
        const undoBtn = document.getElementById('toast-undo-btn');
        if (undoBtn) {
            undoBtn.onclick = () => {
                undoAction();
                toast.classList.remove('show');
            };
        }
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4500);
}

// Calendar View
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
    
    // Only active (not removed) expenses for calendar
    let activeExpenses = getActiveInstallmentsForMonth(year, month, false);

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
