let entries = JSON.parse(localStorage.getItem('wh_entries')) || [];
let settings = JSON.parse(localStorage.getItem('wh_settings')) || {
  employees: ['Иван', 'Анна'],
  models: ['Футболка', 'Худи'],
  colors: ['Черный', 'Белый', 'Красный'],
  sizes: ['42', '44', '46', 'S', 'M', 'L']
};

// --- ИСПРАВЛЕННОЕ УВЕДОМЛЕНИЕ (TOAST) ---
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  
  // Уведомление гарантированно исчезает через 2.5 секунды
  setTimeout(() => {
    t.classList.remove('show');
  }, 2500);
}

const normalizeSize = (s) => s.toString().trim().toLowerCase();

function groupSum(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + Number(item.quantity);
    return acc;
  }, {});
}

// --- НАВИГАЦИЯ ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
    if(btn.dataset.target === 'tab-history') renderHistory();
    if(btn.dataset.target === 'tab-stats') renderStats();
  });
});

// --- ФОРМА ДОБАВЛЕНИЯ ---
function updateFormOptions() {
  document.getElementById('input-employee').innerHTML = settings.employees.map(e => `<option>${e}</option>`).join('');
  document.getElementById('input-model').innerHTML = settings.models.map(m => `<option>${m}</option>`).join('');
  document.getElementById('quick-colors').innerHTML = settings.colors.map(c => `<button type="button" class="q-btn" onclick="document.getElementById('input-color').value='${c}'">${c}</button>`).join('');
  document.getElementById('quick-sizes').innerHTML = settings.sizes.map(s => `<button type="button" class="q-btn" onclick="document.getElementById('input-size').value='${s}'">${s}</button>`).join('');
}

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  entries.push({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    employee: document.getElementById('input-employee').value,
    model: document.getElementById('input-model').value,
    color: document.getElementById('input-color').value,
    size: document.getElementById('input-size').value,
    quantity: parseInt(document.getElementById('input-qty').value),
    note: document.getElementById('input-note').value
  });
  localStorage.setItem('wh_entries', JSON.stringify(entries));
  showToast('Запись сохранена!');
  e.target.reset();
  updateFormOptions();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('add-form').reset();
  showToast('Очищено');
});

// --- ИСТОРИЯ ---
function renderHistory() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const fEmp = document.getElementById('filter-employee').value;
  
  const fEmpEl = document.getElementById('filter-employee');
  if(fEmpEl.options.length <= 1) {
    fEmpEl.innerHTML = '<option value="">Все сотрудники</option>' + settings.employees.map(e => `<option>${e}</option>`).join('');
  }

  let filtered = entries.filter(e => {
    const matchSearch = e.model.toLowerCase().includes(search) || e.color.toLowerCase().includes(search);
    const matchEmp = !fEmp || e.employee === fEmp;
    return matchSearch && matchEmp;
  }).sort((a,b) => b.id - a.id);

  document.getElementById('history-list').innerHTML = filtered.map(e => `
    <div class="entry-card">
      <div>
        <strong>${e.model}</strong> (${e.color}, ${e.size})<br>
        <small>${e.employee} | ${new Date(e.createdAt).toLocaleDateString()}</small>
      </div>
      <div style="text-align:right">
        <div class="entry-qty">${e.quantity} шт</div>
        <button class="btn-danger" onclick="deleteEntry(${e.id})">Удалить</button>
      </div>
    </div>
  `).join('') || '<p style="text-align:center; color:gray; margin-top:20px;">История пуста</p>';
}

window.deleteEntry = (id) => {
  if(confirm('Удалить эту запись?')) {
    entries = entries.filter(e => e.id !== id);
    localStorage.setItem('wh_entries', JSON.stringify(entries));
    renderHistory();
    showToast('Удалено');
  }
};

// --- СТАТИСТИКА ---
let currentPeriod = 'today';
document.querySelectorAll('.sub-tab').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentPeriod = b.dataset.period;
    renderStats();
  });
});

function getPeriodData() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;
  return entries.filter(e => {
    const t = new Date(e.createdAt).getTime();
    if(currentPeriod === 'today') return t >= startOfDay;
    if(currentPeriod === 'week') return t >= startOfDay - 6 * dayMs;
    if(currentPeriod === 'month') return t >= startOfDay - 29 * dayMs;
    return true;
  });
}

function renderStats() {
  const data = getPeriodData();
  const total = data.reduce((s,e) => s + e.quantity, 0);
  
  document.getElementById('stats-general').innerHTML = `
    <div class="stat-card"><span>${total}</span>Всего шт</div>
    <div class="stat-card"><span>${data.length}</span>Записей</div>
  `;

  const renderList = (id, keyFn, isModel = false) => {
    const g = groupSum(data, keyFn);
    const sorted = Object.entries(g).sort((a,b) => b[1]-a[1]);
    document.getElementById(id).innerHTML = sorted.map(i => `
      <div class="top-item ${isModel?'clickable':''}" ${isModel?`onclick="showModelDetails('${i[0].replace(/'/g, "\\\\'")}')"`:''}>
        <span>${i[0]}</span><strong>${i[1]} шт</strong>
      </div>
    `).join('') || '<p style="color:gray">Нет данных</p>';
  };

  renderList('stats-top-sizes', e => normalizeSize(e.size));
  renderList('stats-top-models', e => e.model, true);
  renderChart(); // Вызов исправленного графика
}

window.showModelDetails = (mName) => {
  const data = getPeriodData().filter(e => e.model === mName);
  const sizes = groupSum(data, e => normalizeSize(e.size));
  const sorted = Object.entries(sizes).sort((a,b) => b[1]-a[1]);

  document.getElementById('modal-title').innerText = mName;
  document.getElementById('modal-body').innerHTML = `
    <div class="top-list">${sorted.map(s => `
      <div class="top-item" style="background:var(--surface-light)">
        <span>Размер: <strong>${s[0].toUpperCase()}</strong></span>
        <strong>${s[1]} шт</strong>
      </div>
    `).join('')}</div>
  `;
  document.getElementById('modal-overlay').classList.add('active');
};

window.closeModal = () => document.getElementById('modal-overlay').classList.remove('active');

// --- ИСПРАВЛЕННЫЙ ГРАФИК (ДИНАМИКА) ---
function renderChart() {
  const container = document.getElementById('chart-container');
  const days = [];
  
  // Генерируем последние 14 дней в формате местного времени (ГГГГ-ММ-ДД)
  for(let i=13; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-CA')); 
  }

  // Группируем записи по датам
  const sums = entries.reduce((acc, item) => {
    const date = item.createdAt.split('T')[0];
    acc[date] = (acc[date] || 0) + Number(item.quantity);
    return acc;
  }, {});

  const max = Math.max(...Object.values(sums), 5); // 5 — это минимальная высота для красоты

  container.innerHTML = days.map(d => {
    const val = sums[d] || 0;
    const height = (val / max) * 100;
    const dayLabel = d.split('-')[2]; // Берем только число (например, "29")
    
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${height}%" title="${d}: ${val} шт"></div>
        <div class="chart-label">${dayLabel}</div>
      </div>
    `;
  }).join('');
}

// --- НАСТРОЙКИ ---
function renderSettings() {
  document.getElementById('set-employees').value = settings.employees.join(', ');
  document.getElementById('set-models').value = settings.models.join(', ');
}

document.getElementById('btn-save-settings').addEventListener('click', () => {
  const getVal = id => document.getElementById(id).value.split(',').map(x => x.trim()).filter(x => x);
  settings.employees = getVal('set-employees');
  settings.models = getVal('set-models');
  localStorage.setItem('wh_settings', JSON.stringify(settings));
  updateFormOptions();
  showToast('Настройки сохранены');
});

// Инициализация при запуске
updateFormOptions();
renderSettings();

