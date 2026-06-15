// ===== Configuración de Firebase =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
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

const firebaseConfig = {
  apiKey: "AIzaSyCGLhqCndD9zpSraPhYLAMul6jtvavcoek",
  authDomain: "inventario-49d3b.firebaseapp.com",
  projectId: "inventario-49d3b",
  storageBucket: "inventario-49d3b.firebasestorage.app",
  messagingSenderId: "837690492755",
  appId: "1:837690492755:web:9882ffec8433786556c3a6",
  measurementId: "G-HRH7SSM5ZB"
};

// ===== Estado global =====
let app, db;
let producto = [];      // documentos de la colección "producto"
let movimientos = [];   // documentos de la colección "movimientos"

// Mapas código -> nombre, para mostrar nombres en vez de códigos
let mapaUnidades = {};
let mapaTipos = {};
let mapaAlmacenes = {};
let mapaMotivos = {};

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  updateConnectionStatus('connected');
} catch (error) {
  console.error('Error al inicializar Firebase:', error);
  updateConnectionStatus('error');
}

// ===== Estado de conexión =====
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');

  dot.className = 'status-dot ' + status;

  switch (status) {
    case 'connected':
      text.textContent = 'Conectado';
      break;
    case 'error':
      text.textContent = 'Error de conexión';
      break;
    default:
      text.textContent = 'Conectando...';
  }
}

// ===== Helpers de formato =====
function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP'
  }).format(Number(value) || 0);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function capitalizeFirst(str) {
  if (!str) return '';
  str = String(str);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Devuelve el TEXTO de la opción seleccionada de un <select>
function textoSeleccionado(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return '';
  const opt = sel.options[sel.selectedIndex];
  return opt ? opt.textContent : sel.value;
}

// Lookups para mostrar nombres a partir del código guardado
const nombreUnidad  = (c) => mapaUnidades[String(c)]  || (c ?? '-');
const nombreTipo    = (c) => mapaTipos[String(c)]     || (c ?? '-');
const nombreAlmacen = (c) => mapaAlmacenes[String(c)] || (c ?? '-');

// ===== Toast =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = toast.querySelector('.toast-message');

  toastMessage.textContent = message;
  toast.className = 'toast show ' + type;

  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Navegación entre vistas =====
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const viewId = item.dataset.view;
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ===== Pestañas (Movimientos) =====
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

// ===== Campos dinámicos =====
function crearCampoUnidadMedida(idSelect) {
  return `
    <div class="form-group">
      <label for="${idSelect}">Unidad de Medida *</label>
      <select id="${idSelect}" required>
        <option value="">Seleccionar...</option>
      </select>
    </div>`;
}
function crearCampoTipoProducto(idSelect) {
  return `
    <div class="form-group">
      <label for="${idSelect}">Tipo de Producto *</label>
      <select id="${idSelect}" required>
        <option value="">Seleccionar...</option>
      </select>
    </div>`;
}
function crearCampoAlmacen(idSelect) {
  return `
    <div class="form-group">
      <label for="${idSelect}">Almacén *</label>
      <select id="${idSelect}" required>
        <option value="">Seleccionar...</option>
      </select>
    </div>`;
}
function crearCampoMotivo(idSelect) {
  return `
    <div class="form-group">
      <label for="${idSelect}">Motivo *</label>
      <select id="${idSelect}" required>
        <option value="">Seleccionar...</option>
      </select>
    </div>`;
}

// Inyectar los campos dinámicos (los <div> contenedores existen en el HTML)
document.getElementById("campo-unidad-medida").innerHTML = crearCampoUnidadMedida("unidad-producto");
document.getElementById("campo-tipo-producto").innerHTML = crearCampoTipoProducto("tipo-producto");
document.getElementById("campo-almacen").innerHTML       = crearCampoAlmacen("almacen-producto");
document.getElementById("campo-motivo").innerHTML        = crearCampoMotivo("motivo-movimiento");

// ===== Carga de catálogos (selects) =====
function llenarSelect(ids, items, placeholder = 'Seleccionar...') {
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(it => {
      const opt = document.createElement('option');
      opt.value = String(it.value);
      opt.textContent = it.text;
      sel.appendChild(opt);
    });
  });
}

async function cargarUnidadesMedida() {
  try {
    const snap = await getDocs(collection(db, 'unidad_medida'));
    const items = [];
    mapaUnidades = {};
    snap.forEach(d => {
      const u = d.data();
      const text = `${u.nombre_unidad_medida} (${u.abreviacion_unidad_medida})`;
      items.push({ value: u.codigo_unidad_medida, text });
      mapaUnidades[String(u.codigo_unidad_medida)] = text;
    });
    llenarSelect(['unidad-producto', 'editar-unidad-producto'], items);
  } catch (e) {
    console.error('Error al cargar unidades:', e);
  }
}

async function cargarTipoProducto() {
  try {
    const snap = await getDocs(collection(db, 'tipo_producto'));
    const items = [];
    mapaTipos = {};
    snap.forEach(d => {
      const t = d.data();
      items.push({ value: t.codigo_tipo_producto, text: t.nombre_tipo_producto });
      mapaTipos[String(t.codigo_tipo_producto)] = t.nombre_tipo_producto;
    });
    llenarSelect(['tipo-producto', 'editar-tipo-producto'], items);
    // También el filtro de inventario
    llenarSelect(['inventory-group-filter'], items, 'Todos los grupos');
  } catch (e) {
    console.error('Error al cargar tipos de producto:', e);
  }
}

async function cargarAlmacenes() {
  try {
    const snap = await getDocs(collection(db, 'almacen'));
    const items = [];
    mapaAlmacenes = {};
    snap.forEach(d => {
      const a = d.data();
      items.push({ value: a.codigo_almacen_producto, text: a.nombre_almacen_producto });
      mapaAlmacenes[String(a.codigo_almacen_producto)] = a.nombre_almacen_producto;
    });
    // Producto + edición + todos los selects de almacén de movimientos
    llenarSelect([
      'almacen-producto',
      'editar-almacen-producto',
      'entry-warehouse',
      'exit-warehouse',
      'transfer-from',
      'transfer-to'
    ], items);
  } catch (e) {
    console.error('Error al cargar almacenes:', e);
  }
}

async function cargarMotivos() {
  try {
    const snap = await getDocs(collection(db, 'motivo'));
    const items = [];
    mapaMotivos = {};
    snap.forEach(d => {
      const m = d.data();
      items.push({ value: m.codigo_motivo, text: m.nombre_motivo });
      mapaMotivos[String(m.codigo_motivo)] = m.nombre_motivo;
    });
    llenarSelect(['motivo-movimiento'], items);
  } catch (e) {
    console.error('Error al cargar motivos:', e);
  }
}

// ===== Listeners en tiempo real =====
function setupRealtimeListeners() {
  // Productos
  onSnapshot(collection(db, 'producto'), (snapshot) => {
    producto = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateDashboard();
    updateInventoryTable();
    updateConnectionStatus('connected');
  }, (error) => {
    console.error('Error en listener de producto:', error);
    updateConnectionStatus('error');
  });

  // Movimientos
  const movRef = query(collection(db, 'movimientos'), orderBy('fecha_creacion', 'desc'));
  onSnapshot(movRef, (snapshot) => {
    movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateDashboard();
    updateMovementsTable();
  }, (error) => {
    console.error('Error en listener de movimientos:', error);
  });
}

// ===== Dashboard =====
function updateDashboard() {
  document.getElementById('total-productos').textContent = producto.length;
  document.getElementById('total-movements').textContent = movimientos.length;

  const totalValue = producto.reduce(
    (sum, p) => sum + (Number(p.stock_producto) || 0) * (Number(p.precio_unitario) || 0),
    0
  );
  document.getElementById('total-value').textContent = formatCurrency(totalValue);

  const lowStock = producto.filter(
    p => Number(p.stock_producto) > 0 && Number(p.stock_producto) <= Number(p.stock_minimo)
  ).length;
  document.getElementById('low-stock').textContent = lowStock;

  const outOfStock = producto.filter(p => Number(p.stock_producto) === 0).length;
  document.getElementById('out-of-stock').textContent = outOfStock;

  updateRecentMovements();
  updateStockAlerts();
}

function updateRecentMovements() {
  const container = document.getElementById('recent-movements');
  const recent = movimientos.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay movimientos registrados</div>';
    return;
  }

  container.innerHTML = recent.map(m => {
    const iconClass = m.tipo_movimiento === 'entrada' ? 'entry'
      : m.tipo_movimiento === 'salida' ? 'exit' : 'transfer';
    const icon = m.tipo_movimiento === 'entrada'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'
      : m.tipo_movimiento === 'salida'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';

    return `
      <div class="recent-item">
        <div class="recent-icon ${iconClass}">${icon}</div>
        <div class="recent-info">
          <div class="recent-title">${m.nombre_producto} (${m.cantidad})</div>
          <div class="recent-meta">${capitalizeFirst(m.tipo_movimiento)} - ${formatDate(m.fecha_creacion)}</div>
        </div>
      </div>`;
  }).join('');
}

function updateStockAlerts() {
  const container = document.getElementById('stock-alerts');
  const alerts = producto.filter(p => Number(p.stock_producto) <= Number(p.stock_minimo));

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
        <div class="alert-title">${p.nombre_producto}</div>
        <div class="alert-meta">Stock: ${p.stock_producto} / Mín: ${p.stock_minimo}</div>
      </div>
      <span class="badge ${Number(p.stock_producto) === 0 ? 'badge-danger' : 'badge-warning'}">
        ${Number(p.stock_producto) === 0 ? 'Sin Stock' : 'Stock Bajo'}
      </span>
    </div>`).join('');
}

// ===== Alta de producto =====
document.getElementById('formulario-producto').addEventListener('submit', async (e) => {
  e.preventDefault();

  const codigoProducto = document.getElementById('codigo-producto').value.trim();

  try {
    // Validar código duplicado
    const q = query(collection(db, 'producto'), where('codigo_producto', '==', codigoProducto));
    const codigoExistente = await getDocs(q);
    if (!codigoExistente.empty) {
      showToast('El código de producto ya existe. Ingrese otro.', 'error');
      return;
    }

    // ID correlativo
    const snapshot = await getDocs(collection(db, 'producto'));
    const nuevoId = snapshot.size.toString();

    const nuevoProducto = {
      codigo_producto: codigoProducto,
      nombre_producto: document.getElementById('nombre-producto').value,
      unidad_producto: document.getElementById('unidad-producto').value,
      tipo_producto: document.getElementById('tipo-producto').value,
      stock_producto: parseInt(document.getElementById('stock-producto').value) || 0,
      stock_minimo: parseInt(document.getElementById('stock-min-producto').value) || 5,
      precio_unitario: parseFloat(document.getElementById('precio-producto').value) || 0,
      almacen_producto: document.getElementById('almacen-producto').value,
      fecha_creacion: Timestamp.now()
    };

    await setDoc(doc(db, 'producto', nuevoId), nuevoProducto);
    showToast('Producto guardado correctamente');
    clearProductForm();
  } catch (error) {
    console.error('Error al guardar producto:', error);
    showToast('Error al guardar el producto', 'error');
  }
});

window.clearProductForm = function () {
  document.getElementById('formulario-producto').reset();
};

// ===== Tabla de inventario =====
function updateInventoryTable() {
  const tbody = document.getElementById('inventory-table');
  const groupFilter = document.getElementById('inventory-group-filter').value;
  const statusFilter = document.getElementById('inventory-status-filter').value;

  let filtered = [...producto];

  if (groupFilter !== 'all' && groupFilter !== '') {
    filtered = filtered.filter(p => String(p.tipo_producto) === String(groupFilter));
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter(p => {
      const stock = Number(p.stock_producto);
      const min = Number(p.stock_minimo);
      if (statusFilter === 'available') return stock > min;
      if (statusFilter === 'low') return stock > 0 && stock <= min;
      if (statusFilter === 'out') return stock === 0;
      return true;
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No hay productos que mostrar</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const precioSinIva = Number(p.precio_unitario) || 0;
    const precioConIva = precioSinIva * 1.19;
    const stock = Number(p.stock_producto) || 0;
    const totalSinIva = stock * precioSinIva;
    const totalConIva = stock * precioConIva;

    let status, badgeClass;
    if (stock === 0) {
      status = 'Sin Stock'; badgeClass = 'badge-danger';
    } else if (stock <= Number(p.stock_minimo)) {
      status = 'Stock Bajo'; badgeClass = 'badge-warning';
    } else {
      status = 'Disponible'; badgeClass = 'badge-success';
    }

    return `
      <tr data-id="${p.id}">
        <td>${p.codigo_producto}</td>
        <td>${p.nombre_producto}</td>
        <td>${nombreTipo(p.tipo_producto)}</td>
        <td>${stock}</td>
        <td>${nombreUnidad(p.unidad_producto)}</td>
        <td>${formatCurrency(precioSinIva)}</td>
        <td>${formatCurrency(precioConIva)}</td>
        <td>${formatCurrency(totalSinIva)}</td>
        <td>${formatCurrency(totalConIva)}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td class="actions">
          <button class="btn-icon" onclick="openEditModal('${p.id}')" title="Editar">✏️</button>
          <button class="btn-icon" onclick="deleteProduct('${p.id}')" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('inventory-group-filter').addEventListener('change', updateInventoryTable);
document.getElementById('inventory-status-filter').addEventListener('change', updateInventoryTable);

// ===== Modal de edición =====
window.openEditModal = function (productId) {
  const p = producto.find(x => x.id === productId);
  if (!p) {
    console.error('Producto no encontrado:', productId);
    return;
  }

  document.getElementById('editar-producto-id').value = p.id;
  document.getElementById('editar-codigo-producto').value = p.codigo_producto;
  document.getElementById('editar-nombre-producto').value = p.nombre_producto;
  document.getElementById('editar-unidad-producto').value = p.unidad_producto;
  document.getElementById('editar-tipo-producto').value = p.tipo_producto;
  document.getElementById('editar-stock-producto').value = p.stock_producto;
  document.getElementById('editar-stock-minimo').value = p.stock_minimo;
  document.getElementById('editar-precio-unitario').value = p.precio_unitario;
  document.getElementById('editar-almacen-producto').value = p.almacen_producto;

  document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = function () {
  document.getElementById('edit-modal').classList.remove('active');
};

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const productId = document.getElementById('editar-producto-id').value;

  const updates = {
    codigo_producto: document.getElementById('editar-codigo-producto').value,
    nombre_producto: document.getElementById('editar-nombre-producto').value,
    unidad_producto: document.getElementById('editar-unidad-producto').value,
    tipo_producto: document.getElementById('editar-tipo-producto').value,
    stock_producto: parseInt(document.getElementById('editar-stock-producto').value) || 0,
    stock_minimo: parseInt(document.getElementById('editar-stock-minimo').value) || 5,
    precio_unitario: parseFloat(document.getElementById('editar-precio-unitario').value) || 0,
    almacen_producto: document.getElementById('editar-almacen-producto').value
  };

  try {
    await updateDoc(doc(db, 'producto', productId), updates);
    showToast('Producto actualizado correctamente');
    closeEditModal();
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    showToast('Error al actualizar el producto', 'error');
  }
});

window.deleteProduct = async function (productId) {
  if (!confirm('¿Está seguro de eliminar este producto?')) return;
  try {
    await deleteDoc(doc(db, 'producto', productId));
    showToast('Producto eliminado correctamente');
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    showToast('Error al eliminar el producto', 'error');
  }
};

// ===== Movimientos =====
// Entrada
document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const productId = document.getElementById('entry-product-id').value;
  const prod = producto.find(p => p.id === productId);
  if (!prod) {
    showToast('Debe seleccionar un producto válido de la lista', 'error');
    return;
  }

  const cantidad = parseInt(document.getElementById('entry-quantity').value);
  const almacen = textoSeleccionado('entry-warehouse');
  const motivo = textoSeleccionado('motivo-movimiento');

  if (!document.getElementById('motivo-movimiento').value) {
    showToast('Debe seleccionar un motivo', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'movimientos'), {
      tipo_movimiento: 'entrada',
      producto_id: productId,
      codigo_producto: prod.codigo_producto,
      nombre_producto: prod.nombre_producto,
      cantidad,
      almacen,
      motivo,
      fecha_creacion: Timestamp.now()
    });

    await updateDoc(doc(db, 'producto', productId), {
      stock_producto: (Number(prod.stock_producto) || 0) + cantidad
    });

    showToast(`Entrada de ${cantidad} unidades registrada`);
    document.getElementById('entry-form').reset();
    document.getElementById('entry-product-id').value = '';
  } catch (error) {
    console.error('Error al registrar entrada:', error);
    showToast('Error al registrar la entrada', 'error');
  }
});

// Salida
document.getElementById('exit-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const productId = document.getElementById('exit-product-id').value;
  const prod = producto.find(p => p.id === productId);
  if (!prod) {
    showToast('Debe seleccionar un producto válido de la lista', 'error');
    return;
  }

  const cantidad = parseInt(document.getElementById('exit-quantity').value);
  if (cantidad > (Number(prod.stock_producto) || 0)) {
    showToast('No hay suficiente stock disponible', 'error');
    return;
  }

  const almacen = textoSeleccionado('exit-warehouse');
  const motivo = textoSeleccionado('exit-reason');

  if (!document.getElementById('exit-reason').value) {
    showToast('Debe seleccionar un motivo', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'movimientos'), {
      tipo_movimiento: 'salida',
      producto_id: productId,
      codigo_producto: prod.codigo_producto,
      nombre_producto: prod.nombre_producto,
      cantidad,
      almacen,
      motivo,
      fecha_creacion: Timestamp.now()
    });

    await updateDoc(doc(db, 'producto', productId), {
      stock_producto: (Number(prod.stock_producto) || 0) - cantidad
    });

    showToast(`Salida de ${cantidad} unidades registrada`);
    document.getElementById('exit-form').reset();
    document.getElementById('exit-product-id').value = '';
  } catch (error) {
    console.error('Error al registrar salida:', error);
    showToast('Error al registrar la salida', 'error');
  }
});

// Transferencia (no cambia el stock total, solo se registra)
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const productId = document.getElementById('transfer-product-id').value;
  const prod = producto.find(p => p.id === productId);
  if (!prod) {
    showToast('Debe seleccionar un producto válido de la lista', 'error');
    return;
  }

  const cantidad = parseInt(document.getElementById('transfer-quantity').value);
  const fromVal = document.getElementById('transfer-from').value;
  const toVal = document.getElementById('transfer-to').value;
  const fromTxt = textoSeleccionado('transfer-from');
  const toTxt = textoSeleccionado('transfer-to');

  if (fromVal === toVal) {
    showToast('El almacén origen y destino deben ser diferentes', 'error');
    return;
  }
  if (cantidad > (Number(prod.stock_producto) || 0)) {
    showToast('No hay suficiente stock disponible', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'movimientos'), {
      tipo_movimiento: 'transferencia',
      producto_id: productId,
      codigo_producto: prod.codigo_producto,
      nombre_producto: prod.nombre_producto,
      cantidad,
      almacen: `${fromTxt} → ${toTxt}`,
      motivo: 'TRANSFERENCIA ENTRE ALMACENES',
      fecha_creacion: Timestamp.now()
    });

    showToast(`Transferencia de ${cantidad} unidades registrada`);
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-product-id').value = '';
  } catch (error) {
    console.error('Error al registrar transferencia:', error);
    showToast('Error al registrar la transferencia', 'error');
  }
});

// Historial de movimientos
function updateMovementsTable() {
  const tbody = document.getElementById('movements-table');
  const filter = document.getElementById('history-filter').value;

  let filtered = [...movimientos];
  if (filter !== 'all') {
    filtered = filtered.filter(m => m.tipo_movimiento === filter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay movimientos que mostrar</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const badgeClass = m.tipo_movimiento === 'entrada' ? 'badge-success'
      : m.tipo_movimiento === 'salida' ? 'badge-danger' : 'badge-blue';
    return `
      <tr>
        <td>${formatDate(m.fecha_creacion)}</td>
        <td><span class="badge ${badgeClass}">${capitalizeFirst(m.tipo_movimiento)}</span></td>
        <td>${m.nombre_producto}</td>
        <td>${m.cantidad}</td>
        <td>${m.almacen}</td>
        <td>${m.motivo}</td>
      </tr>`;
  }).join('');
}

document.getElementById('history-filter').addEventListener('change', updateMovementsTable);

// ===== Inputs en mayúscula =====
document.querySelectorAll('.uppercase-input').forEach(input => {
  input.addEventListener('input', function () {
    const start = this.selectionStart;
    const end = this.selectionEnd;
    this.value = this.value.toUpperCase();
    this.setSelectionRange(start, end);
  });
});

// ===== Autocompletado de productos =====
function setupAutocomplete(inputId, listId, hiddenId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  if (!input || !list) return;

  let selectedIndex = -1;

  input.addEventListener('input', function () {
    const value = this.value.toUpperCase().trim();
    hidden.value = '';

    if (value.length < 1) { list.classList.remove('show'); return; }

    const matches = producto.filter(p =>
      String(p.codigo_producto).toUpperCase().includes(value) ||
      String(p.nombre_producto).toUpperCase().includes(value)
    ).slice(0, 8);

    if (matches.length === 0) { list.classList.remove('show'); return; }

    list.innerHTML = matches.map((p, idx) => `
      <div class="autocomplete-item" data-id="${p.id}" data-code="${p.codigo_producto}" data-name="${p.nombre_producto}" data-index="${idx}">
        <span class="product-code">${p.codigo_producto}</span>
        <span class="product-name">- ${p.nombre_producto}</span>
        <span class="product-stock">Stock: ${p.stock_producto} ${nombreUnidad(p.unidad_producto)}</span>
      </div>`).join('');

    list.classList.add('show');
    selectedIndex = -1;

    list.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', function () {
        selectProduct(input, hidden, list, this.dataset.id, this.dataset.code);
      });
    });
  });

  input.addEventListener('keydown', function (e) {
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
      if (item) selectProduct(input, hidden, list, item.dataset.id, item.dataset.code);
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
    }
  });

  input.addEventListener('blur', function () {
    setTimeout(() => list.classList.remove('show'), 200);
  });
}

function updateSelection(items, index) {
  items.forEach((item, i) => item.classList.toggle('active', i === index));
}

function selectProduct(input, hidden, list, id, code) {
  input.value = code;
  hidden.value = id;
  list.classList.remove('show');
}

setupAutocomplete('entry-product', 'entry-product-list', 'entry-product-id');
setupAutocomplete('exit-product', 'exit-product-list', 'exit-product-id');
setupAutocomplete('transfer-product', 'transfer-product-list', 'transfer-product-id');

// ===== Reportes =====
let currentReportData = [];
let currentReportType = '';

window.generateInventoryReport = function () {
  currentReportType = 'inventory';
  currentReportData = producto.map(p => {
    const stock = Number(p.stock_producto) || 0;
    const precio = Number(p.precio_unitario) || 0;
    return {
      Codigo: p.codigo_producto,
      Nombre: p.nombre_producto,
      Tipo: nombreTipo(p.tipo_producto),
      Stock: stock,
      Unidad: nombreUnidad(p.unidad_producto),
      Precio: precio,
      'Valor Total': stock * precio,
      Estado: stock === 0 ? 'Sin Stock' : stock <= Number(p.stock_minimo) ? 'Stock Bajo' : 'Disponible'
    };
  });
  displayReport('Reporte de Inventario Actual', currentReportData);
};

window.generateMovementsReport = function () {
  const from = document.getElementById('report-date-from').value;
  const to = document.getElementById('report-date-to').value;

  currentReportType = 'movements';
  let filtered = [...movimientos];

  if (from) {
    const fromDate = new Date(from);
    filtered = filtered.filter(m => {
      const date = m.fecha_creacion?.toDate ? m.fecha_creacion.toDate() : new Date(m.fecha_creacion);
      return date >= fromDate;
    });
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59);
    filtered = filtered.filter(m => {
      const date = m.fecha_creacion?.toDate ? m.fecha_creacion.toDate() : new Date(m.fecha_creacion);
      return date <= toDate;
    });
  }

  currentReportData = filtered.map(m => ({
    Fecha: formatDate(m.fecha_creacion),
    Tipo: capitalizeFirst(m.tipo_movimiento),
    Producto: m.nombre_producto,
    Codigo: m.codigo_producto,
    Cantidad: m.cantidad,
    Almacen: m.almacen,
    Motivo: m.motivo
  }));
  displayReport('Reporte de Movimientos', currentReportData);
};

window.generateLowStockReport = function () {
  currentReportType = 'lowstock';
  const bajos = producto.filter(p => Number(p.stock_producto) <= Number(p.stock_minimo));
  currentReportData = bajos.map(p => ({
    Codigo: p.codigo_producto,
    Nombre: p.nombre_producto,
    Tipo: nombreTipo(p.tipo_producto),
    'Stock Actual': p.stock_producto,
    'Stock Minimo': p.stock_minimo,
    Diferencia: Number(p.stock_minimo) - Number(p.stock_producto),
    Estado: Number(p.stock_producto) === 0 ? 'Sin Stock' : 'Stock Bajo'
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

window.exportReportCSV = function () {
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
        if (typeof value === 'string' && value.includes(',')) value = `"${value}"`;
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

// ===== Búsqueda global =====
document.getElementById('global-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();

  const productResults = q ? producto.filter(p =>
    String(p.nombre_producto).toLowerCase().includes(q) ||
    String(p.codigo_producto).toLowerCase().includes(q) ||
    nombreTipo(p.tipo_producto).toLowerCase().includes(q)
  ) : [];
  updateSearchProductos(productResults);

  const movementResults = q ? movimientos.filter(m =>
    String(m.nombre_producto).toLowerCase().includes(q) ||
    String(m.codigo_producto || '').toLowerCase().includes(q) ||
    String(m.motivo || '').toLowerCase().includes(q)
  ) : [];
  updateSearchMovements(movementResults);
});

function updateSearchProductos(results) {
  document.getElementById('product-count').textContent =
    `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('search-products');

  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron productos</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(p => `
    <tr>
      <td>${p.codigo_producto}</td>
      <td>${p.nombre_producto}</td>
      <td>${nombreTipo(p.tipo_producto)}</td>
      <td>${p.stock_producto}</td>
      <td>${formatCurrency(p.precio_unitario)}</td>
    </tr>`).join('');
}

function updateSearchMovements(results) {
  document.getElementById('movement-count').textContent =
    `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('search-movements');

  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron movimientos</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(m => {
    const badgeClass = m.tipo_movimiento === 'entrada' ? 'badge-success'
      : m.tipo_movimiento === 'salida' ? 'badge-danger' : 'badge-blue';
    return `
      <tr>
        <td>${formatDate(m.fecha_creacion)}</td>
        <td><span class="badge ${badgeClass}">${capitalizeFirst(m.tipo_movimiento)}</span></td>
        <td>${m.nombre_producto}</td>
        <td>${m.cantidad}</td>
        <td>${m.motivo}</td>
      </tr>`;
  }).join('');
}

// ===== Inicialización =====
async function init() {
  if (!db) return;

  // 1) Cargar catálogos (selects) y armar los mapas código->nombre
  await Promise.all([
    cargarUnidadesMedida(),
    cargarTipoProducto(),
    cargarAlmacenes(),
    cargarMotivos()
  ]);

  // 2) Activar escucha en tiempo real (ya con los mapas listos)
  setupRealtimeListeners();

  // 3) Fechas por defecto en reportes
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  document.getElementById('report-date-from').value = lastMonth;
  document.getElementById('report-date-to').value = today;
}

init();