// ===== Firebase Configuration =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCGLhqCndD9zpSraPhYLAMul6jtvavcoek",
  authDomain: "inventario-49d3b.firebaseapp.com",
  projectId: "inventario-49d3b",
  storageBucket: "inventario-49d3b.firebasestorage.app",
  messagingSenderId: "837690492755",
  appId: "1:837690492755:web:9882ffec8433786556c3a6",
  measurementId: "G-HRH7SSM5ZB"
};

// Initialize Firebase
let app, db;
let products = [];
let movements = [];

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  updateConnectionStatus('connected');
} catch (error) {
  console.error('Firebase initialization error:', error);
  updateConnectionStatus('error');
}

// ===== Connection Status =====
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connection-status');
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');
  
  dot.className = 'status-dot ' + status;
  
  switch(status) {
    case 'connected':
      text.textContent = 'Conectado';
      break;
    case 'error':
      text.textContent = 'Error de conexion';
      break;
    default:
      text.textContent = 'Conectando...';
  }
}

// ===== Navigation =====
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const viewId = item.dataset.view;
    
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  });
});

// Mobile menu toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ===== Tabs =====
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
  });
});

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = toast.querySelector('.toast-message');
  
  toastMessage.textContent = message;
  toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== Format Helpers =====
function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== Data Listeners =====
function setupRealtimeListeners() {
  // Products listener
  const productsRef = collection(db, 'products');
  onSnapshot(productsRef, (snapshot) => {
    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    updateDashboard();
    updateInventoryTable();
  }, (error) => {
    console.error('Products listener error:', error);
    updateConnectionStatus('error');
  });

  // Movements listener
  const movementsRef = query(collection(db, 'movements'), orderBy('createdAt', 'desc'));
  onSnapshot(movementsRef, (snapshot) => {
    movements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    updateDashboard();
    updateMovementsTable();
  }, (error) => {
    console.error('Movements listener error:', error);
  });
}

// ===== Dashboard =====
function updateDashboard() {
  // Total products
  document.getElementById('total-products').textContent = products.length;
  
  // Total movements
  document.getElementById('total-movements').textContent = movements.length;
  
  // Total value
  const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  document.getElementById('total-value').textContent = formatCurrency(totalValue);
  
  // Low stock
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  document.getElementById('low-stock').textContent = lowStock;
  
  // Out of stock
  const outOfStock = products.filter(p => p.stock === 0).length;
  document.getElementById('out-of-stock').textContent = outOfStock;
  
  // Recent movements
  updateRecentMovements();
  
  // Stock alerts
  updateStockAlerts();
}

function updateRecentMovements() {
  const container = document.getElementById('recent-movements');
  const recent = movements.slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay movimientos registrados</div>';
    return;
  }
  
  container.innerHTML = recent.map(m => {
    const iconClass = m.type === 'entrada' ? 'entry' : m.type === 'salida' ? 'exit' : 'transfer';
    const icon = m.type === 'entrada' 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'
      : m.type === 'salida'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
    
    return `
      <div class="recent-item">
        <div class="recent-icon ${iconClass}">${icon}</div>
        <div class="recent-info">
          <div class="recent-title">${m.productName} (${m.quantity})</div>
          <div class="recent-meta">${capitalizeFirst(m.type)} - ${formatDate(m.createdAt)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateStockAlerts() {
  const container = document.getElementById('stock-alerts');
  const alerts = products.filter(p => p.stock <= p.minStock);
  
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay alertas de stock</div>';
    return;
  }
  
  container.innerHTML = alerts.slice(0, 5).map(p => `
    <div class="alert-item">
      <div class="alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="alert-info">
        <div class="alert-title">${p.name}</div>
        <div class="alert-meta">Stock: ${p.stock} / Min: ${p.minStock}</div>
      </div>
      <span class="badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}">
        ${p.stock === 0 ? 'Sin Stock' : 'Stock Bajo'}
      </span>
    </div>
  `).join('');
}

// ===== Productos =====
document.getElementById('formulario-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const producto = {
    code: document.getElementById('codigo-producto').value,
    name: document.getElementById('nombre-producto').value,
    unit: document.getElementById('unidad-producto').value,
    group: document.getElementById('tipo-producto').value,
    stock: parseInt(document.getElementById('stock-producto').value) || 0,
    minStock: parseInt(document.getElementById('stock-min-producto').value) || 5,
    price: parseFloat(document.getElementById('precio-producto').value) || 0,
    warehouse: document.getElementById('almacen-producto').value,
    createdAt: Timestamp.now()
  };
  
  try {
    await addDoc(collection(db, 'producto'), producto);
    showToast('Producto guardado correctamente');
    clearProductForm();
  } catch (error) {
    console.error('Error adding product:', error);
    showToast('Error al guardar el producto', 'error');
  }
});

window.clearProductForm = function() {
  document.getElementById('formulario-producto').reset();
};

// ===== Inventory =====
function updateInventoryTable() {
  const tbody = document.getElementById('inventory-table');
  const groupFilter = document.getElementById('inventory-group-filter').value;
  const statusFilter = document.getElementById('inventory-status-filter').value;
  
  let filtered = [...products];
  
  if (groupFilter !== 'all') {
    filtered = filtered.filter(p => p.group === groupFilter);
  }
  
  if (statusFilter !== 'all') {
    filtered = filtered.filter(p => {
      if (statusFilter === 'available') return p.stock > p.minStock;
      if (statusFilter === 'low') return p.stock > 0 && p.stock <= p.minStock;
      if (statusFilter === 'out') return p.stock === 0;
      return true;
    });
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay productos que mostrar</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(p => {
    let status, badgeClass;
    if (p.stock === 0) {
      status = 'Sin Stock';
      badgeClass = 'badge-danger';
    } else if (p.stock <= p.minStock) {
      status = 'Stock Bajo';
      badgeClass = 'badge-warning';
    } else {
      status = 'Disponible';
      badgeClass = 'badge-success';
    }
    
    return `
      <tr>
        <td>${p.code}</td>
        <td>${p.name}</td>
        <td>${capitalizeFirst(p.group)}</td>
        <td>${p.stock}</td>
        <td>${p.unit}</td>
        <td>${formatCurrency(p.price)}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td class="actions">
          <button class="btn-icon" onclick="openEditModal('${p.id}')" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon" onclick="deleteProduct('${p.id}')" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('inventory-group-filter').addEventListener('change', updateInventoryTable);
document.getElementById('inventory-status-filter').addEventListener('change', updateInventoryTable);

// ===== Edit Modal =====
window.openEditModal = function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('edit-product-id').value = productId;
  document.getElementById('edit-code').value = product.code;
  document.getElementById('edit-name').value = product.name;
  document.getElementById('edit-unit').value = product.unit;
  document.getElementById('edit-group').value = product.group;
  document.getElementById('edit-stock').value = product.stock;
  document.getElementById('edit-min-stock').value = product.minStock;
  document.getElementById('edit-price').value = product.price;
  document.getElementById('edit-warehouse').value = product.warehouse;
  
  document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = function() {
  document.getElementById('edit-modal').classList.remove('active');
};

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('edit-product-id').value;
  
  const updates = {
    code: document.getElementById('edit-code').value,
    name: document.getElementById('edit-name').value,
    unit: document.getElementById('edit-unit').value,
    group: document.getElementById('edit-group').value,
    stock: parseInt(document.getElementById('edit-stock').value) || 0,
    minStock: parseInt(document.getElementById('edit-min-stock').value) || 5,
    price: parseFloat(document.getElementById('edit-price').value) || 0,
    warehouse: document.getElementById('edit-warehouse').value
  };
  
  try {
    await updateDoc(doc(db, 'products', productId), updates);
    showToast('Producto actualizado correctamente');
    closeEditModal();
  } catch (error) {
    console.error('Error updating product:', error);
    showToast('Error al actualizar el producto', 'error');
  }
});

window.deleteProduct = async function(productId) {
  if (!confirm('¿Esta seguro de eliminar este producto?')) return;
  
  try {
    await deleteDoc(doc(db, 'products', productId));
    showToast('Producto eliminado correctamente');
  } catch (error) {
    console.error('Error deleting product:', error);
    showToast('Error al eliminar el producto', 'error');
  }
};

// ===== Movements =====
// Entry form
document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('entry-product-id').value;
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    showToast('Debe seleccionar un producto valido de la lista', 'error');
    return;
  }
  
  const quantity = parseInt(document.getElementById('entry-quantity').value);
  const warehouse = document.getElementById('entry-warehouse').value;
  const reason = document.getElementById('entry-reason').value;
  
  if (!reason) {
    showToast('Debe seleccionar un motivo', 'error');
    return;
  }
  
  try {
    // Add movement
    await addDoc(collection(db, 'movements'), {
      type: 'entrada',
      productId,
      productName: product.name,
      productCode: product.code,
      quantity,
      warehouse,
      reason,
      createdAt: Timestamp.now()
    });
    
    // Update product stock
    await updateDoc(doc(db, 'products', productId), {
      stock: product.stock + quantity
    });
    
    showToast(`Entrada de ${quantity} unidades registrada`);
    document.getElementById('entry-form').reset();
    document.getElementById('entry-product-id').value = '';
  } catch (error) {
    console.error('Error registering entry:', error);
    showToast('Error al registrar la entrada', 'error');
  }
});

// Exit form
document.getElementById('exit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('exit-product-id').value;
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    showToast('Debe seleccionar un producto valido de la lista', 'error');
    return;
  }
  
  const quantity = parseInt(document.getElementById('exit-quantity').value);
  
  if (quantity > product.stock) {
    showToast('No hay suficiente stock disponible', 'error');
    return;
  }
  
  const warehouse = document.getElementById('exit-warehouse').value;
  const reason = document.getElementById('exit-reason').value;
  
  if (!reason) {
    showToast('Debe seleccionar un motivo', 'error');
    return;
  }
  
  try {
    await addDoc(collection(db, 'movements'), {
      type: 'salida',
      productId,
      productName: product.name,
      productCode: product.code,
      quantity,
      warehouse,
      reason,
      createdAt: Timestamp.now()
    });
    
    await updateDoc(doc(db, 'products', productId), {
      stock: product.stock - quantity
    });
    
    showToast(`Salida de ${quantity} unidades registrada`);
    document.getElementById('exit-form').reset();
    document.getElementById('exit-product-id').value = '';
  } catch (error) {
    console.error('Error registering exit:', error);
    showToast('Error al registrar la salida', 'error');
  }
});

// Transfer form
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('transfer-product-id').value;
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    showToast('Debe seleccionar un producto valido de la lista', 'error');
    return;
  }
  
  const quantity = parseInt(document.getElementById('transfer-quantity').value);
  const fromWarehouse = document.getElementById('transfer-from').value;
  const toWarehouse = document.getElementById('transfer-to').value;
  
  if (fromWarehouse === toWarehouse) {
    showToast('El almacen origen y destino deben ser diferentes', 'error');
    return;
  }
  
  if (quantity > product.stock) {
    showToast('No hay suficiente stock disponible', 'error');
    return;
  }
  
  try {
    await addDoc(collection(db, 'movements'), {
      type: 'transferencia',
      productId,
      productName: product.name,
      productCode: product.code,
      quantity,
      warehouse: `${capitalizeFirst(fromWarehouse)} → ${capitalizeFirst(toWarehouse)}`,
      reason: 'TRANSFERENCIA ENTRE ALMACENES',
      createdAt: Timestamp.now()
    });
    
    showToast(`Transferencia de ${quantity} unidades registrada`);
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-product-id').value = '';
  } catch (error) {
    console.error('Error registering transfer:', error);
    showToast('Error al registrar la transferencia', 'error');
  }
});

// Movements table
function updateMovementsTable() {
  const tbody = document.getElementById('movements-table');
  const filter = document.getElementById('history-filter').value;
  
  let filtered = [...movements];
  
  if (filter !== 'all') {
    filtered = filtered.filter(m => m.type === filter);
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay movimientos que mostrar</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(m => {
    const badgeClass = m.type === 'entrada' ? 'badge-success' : m.type === 'salida' ? 'badge-danger' : 'badge-blue';
    
    return `
      <tr>
        <td>${formatDate(m.createdAt)}</td>
        <td><span class="badge ${badgeClass}">${capitalizeFirst(m.type)}</span></td>
        <td>${m.productName}</td>
        <td>${m.quantity}</td>
        <td>${capitalizeFirst(m.warehouse)}</td>
        <td>${m.reason}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('history-filter').addEventListener('change', updateMovementsTable);

// ===== Uppercase Inputs =====
document.querySelectorAll('.uppercase-input').forEach(input => {
  input.addEventListener('input', function() {
    const start = this.selectionStart;
    const end = this.selectionEnd;
    this.value = this.value.toUpperCase();
    this.setSelectionRange(start, end);
  });
});

// ===== Product Autocomplete =====
function setupAutocomplete(inputId, listId, hiddenId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  
  if (!input || !list) return;
  
  let selectedIndex = -1;
  
  input.addEventListener('input', function() {
    const value = this.value.toUpperCase().trim();
    hidden.value = '';
    
    if (value.length < 1) {
      list.classList.remove('show');
      return;
    }
    
    const matches = products.filter(p => 
      p.code.toUpperCase().includes(value) || 
      p.name.toUpperCase().includes(value)
    ).slice(0, 8);
    
    if (matches.length === 0) {
      list.classList.remove('show');
      return;
    }
    
    list.innerHTML = matches.map((p, idx) => `
      <div class="autocomplete-item" data-id="${p.id}" data-code="${p.code}" data-name="${p.name}" data-index="${idx}">
        <span class="product-code">${p.code}</span>
        <span class="product-name">- ${p.name}</span>
        <span class="product-stock">Stock: ${p.stock} ${p.unit}</span>
      </div>
    `).join('');
    
    list.classList.add('show');
    selectedIndex = -1;
    
    // Add click handlers
    list.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', function() {
        selectProduct(input, hidden, list, this.dataset.id, this.dataset.code, this.dataset.name);
      });
    });
  });
  
  input.addEventListener('keydown', function(e) {
    const items = list.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) {
        selectProduct(input, hidden, list, item.dataset.id, item.dataset.code, item.dataset.name);
      }
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
    }
  });
  
  input.addEventListener('blur', function() {
    setTimeout(() => list.classList.remove('show'), 200);
  });
}

function updateSelection(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
}

function selectProduct(input, hidden, list, id, code, name) {
  input.value = code;
  hidden.value = id;
  list.classList.remove('show');
}

// Initialize autocomplete for all product inputs
setupAutocomplete('entry-product', 'entry-product-list', 'entry-product-id');
setupAutocomplete('exit-product', 'exit-product-list', 'exit-product-id');
setupAutocomplete('transfer-product', 'transfer-product-list', 'transfer-product-id');

// ===== Reports =====
let currentReportData = [];
let currentReportType = '';

window.generateInventoryReport = function() {
  currentReportType = 'inventory';
  currentReportData = products.map(p => ({
    Codigo: p.code,
    Nombre: p.name,
    Grupo: capitalizeFirst(p.group),
    Stock: p.stock,
    Unidad: p.unit,
    Precio: p.price,
    'Valor Total': p.stock * p.price,
    Estado: p.stock === 0 ? 'Sin Stock' : p.stock <= p.minStock ? 'Stock Bajo' : 'Disponible'
  }));
  
  displayReport('Reporte de Inventario Actual', currentReportData);
};

window.generateMovementsReport = function() {
  const from = document.getElementById('report-date-from').value;
  const to = document.getElementById('report-date-to').value;
  
  currentReportType = 'movements';
  let filtered = [...movements];
  
  if (from) {
    const fromDate = new Date(from);
    filtered = filtered.filter(m => {
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      return date >= fromDate;
    });
  }
  
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59);
    filtered = filtered.filter(m => {
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      return date <= toDate;
    });
  }
  
  currentReportData = filtered.map(m => ({
    Fecha: formatDate(m.createdAt),
    Tipo: capitalizeFirst(m.type),
    Producto: m.productName,
    Codigo: m.productCode,
    Cantidad: m.quantity,
    Almacen: capitalizeFirst(m.warehouse),
    Motivo: m.reason
  }));
  
  displayReport('Reporte de Movimientos', currentReportData);
};

window.generateLowStockReport = function() {
  currentReportType = 'lowstock';
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  
  currentReportData = lowStockProducts.map(p => ({
    Codigo: p.code,
    Nombre: p.name,
    Grupo: capitalizeFirst(p.group),
    'Stock Actual': p.stock,
    'Stock Minimo': p.minStock,
    Diferencia: p.minStock - p.stock,
    Estado: p.stock === 0 ? 'Sin Stock' : 'Stock Bajo'
  }));
  
  displayReport('Reporte de Productos con Stock Bajo', currentReportData);
};

function displayReport(title, data) {
  document.getElementById('report-title').textContent = title;
  
  const resultEl = document.getElementById('report-result');
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  
  if (data.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td class="empty-state">No hay datos para mostrar</td></tr>';
    resultEl.style.display = 'block';
    return;
  }
  
  const headers = Object.keys(data[0]);
  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  
  tbody.innerHTML = data.map(row => 
    `<tr>${headers.map(h => {
      let value = row[h];
      if (h === 'Precio' || h === 'Valor Total') value = formatCurrency(value);
      return `<td>${value}</td>`;
    }).join('')}</tr>`
  ).join('');
  
  resultEl.style.display = 'block';
}

window.exportReportCSV = function() {
  if (currentReportData.length === 0) {
    showToast('No hay datos para exportar', 'error');
    return;
  }
  
  const headers = Object.keys(currentReportData[0]);
  const csvContent = [
    headers.join(','),
    ...currentReportData.map(row => 
      headers.map(h => {
        let value = row[h];
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `reporte_${currentReportType}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  showToast('Reporte exportado correctamente');
};

// ===== Search =====
document.getElementById('global-search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  // Search products
  const productResults = query ? products.filter(p => 
    p.name.toLowerCase().includes(query) ||
    p.code.toLowerCase().includes(query) ||
    p.group.toLowerCase().includes(query)
  ) : [];
  
  updateSearchProducts(productResults);
  
  // Search movements
  const movementResults = query ? movements.filter(m =>
    m.productName.toLowerCase().includes(query) ||
    m.productCode?.toLowerCase().includes(query) ||
    m.reason?.toLowerCase().includes(query)
  ) : [];
  
  updateSearchMovements(movementResults);
});

function updateSearchProducts(results) {
  document.getElementById('product-count').textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  
  const tbody = document.getElementById('search-products');
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron productos</td></tr>';
    return;
  }
  
  tbody.innerHTML = results.map(p => `
    <tr>
      <td>${p.code}</td>
      <td>${p.name}</td>
      <td>${capitalizeFirst(p.group)}</td>
      <td>${p.stock}</td>
      <td>${formatCurrency(p.price)}</td>
    </tr>
  `).join('');
}

function updateSearchMovements(results) {
  document.getElementById('movement-count').textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  
  const tbody = document.getElementById('search-movements');
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron movimientos</td></tr>';
    return;
  }
  
  tbody.innerHTML = results.map(m => {
    const badgeClass = m.type === 'entrada' ? 'badge-success' : m.type === 'salida' ? 'badge-danger' : 'badge-blue';
    return `
      <tr>
        <td>${formatDate(m.createdAt)}</td>
        <td><span class="badge ${badgeClass}">${capitalizeFirst(m.type)}</span></td>
        <td>${m.productName}</td>
        <td>${m.quantity}</td>
        <td>${m.reason}</td>
      </tr>
    `;
  }).join('');
}

// ===== Initialize =====
if (db) {
  setupRealtimeListeners();
}

// Set default dates for reports
const today = new Date().toISOString().split('T')[0];
const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
document.getElementById('report-date-from').value = lastMonth;
document.getElementById('report-date-to').value = today;
