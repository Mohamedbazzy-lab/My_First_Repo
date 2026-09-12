(() => {
  let currentUser = null;
  let uploadedDesign = null;

  const $ = (sel) => document.querySelector(sel);

  // ---------- Auth modal ----------
  const modalBackdrop = $('#modalBackdrop');
  const modalTitle = $('#modalTitle');
  const nameField = $('#nameField');
  const authForm = $('#authForm');
  const authStatus = $('#authStatus');
  let authMode = 'login';

  function openModal(mode) {
    authMode = mode;
    modalTitle.textContent = mode === 'login' ? 'Log in' : 'Create your account';
    nameField.hidden = mode !== 'register';
    nameField.querySelector('input').required = mode === 'register';
    authStatus.textContent = '';
    authForm.reset();
    modalBackdrop.hidden = false;
  }
  function closeModal() { modalBackdrop.hidden = true; }

  $('#btnLogin').addEventListener('click', () => openModal('login'));
  $('#btnRegister').addEventListener('click', () => openModal('register'));
  $('#modalClose').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(authForm);
    const body = Object.fromEntries(fd.entries());
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    authStatus.textContent = 'Please wait…';
    authStatus.className = 'status';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      currentUser = data;
      authStatus.textContent = 'Success!';
      authStatus.className = 'status status--ok';
      setTimeout(() => { closeModal(); renderAuthState(); loadOrders(); loadAdmin(); }, 300);
    } catch (err) {
      authStatus.textContent = err.message;
      authStatus.className = 'status status--error';
    }
  });

  $('#btnLogout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthState();
  });

  function renderAuthState() {
    const loggedIn = !!currentUser;
    $('#btnLogin').hidden = loggedIn;
    $('#btnRegister').hidden = loggedIn;
    $('#btnLogout').hidden = !loggedIn;
    const who = $('#whoami');
    who.hidden = !loggedIn;
    who.textContent = loggedIn ? `Hi, ${currentUser.name}` : '';
    $('#navOrders').hidden = !loggedIn;
    $('#orders').hidden = !loggedIn;
    const isAdmin = loggedIn && currentUser.role === 'admin';
    $('#navAdmin').hidden = !isAdmin;
    $('#admin').hidden = !isAdmin;
  }

  async function fetchMe() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) currentUser = await res.json();
    } catch (_) { /* not logged in */ }
    renderAuthState();
  }

  // ---------- Design upload ----------
  const dropzone = $('#dropzone');
  const fileInput = $('#fileInput');
  const previewImg = $('#previewImg');
  const dropzoneEmpty = $('#dropzoneEmpty');
  const uploadStatus = $('#uploadStatus');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.hidden = false;
    dropzoneEmpty.hidden = true;
  });

  $('#btnUpload').addEventListener('click', async () => {
    if (!currentUser) { openModal('login'); return; }
    const file = fileInput.files[0];
    if (!file) { setStatus(uploadStatus, 'Choose a file first.', true); return; }

    const fd = new FormData();
    fd.append('design', file);
    fd.append('isPublic', $('#isPublic').checked);

    setStatus(uploadStatus, 'Uploading…', false);
    try {
      const res = await fetch('/api/designs', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploadedDesign = data;
      setStatus(uploadStatus, 'Design uploaded — ready to order.', false, true);
      loadGallery();
    } catch (err) {
      setStatus(uploadStatus, err.message, true);
    }
  });

  // ---------- Order form ----------
  const orderForm = $('#orderForm');
  const orderStatus = $('#orderStatus');
  const priceHint = $('#priceHint');

  function updatePriceHint() {
    const fd = new FormData(orderForm);
    const material = fd.get('material');
    const size = fd.get('size');
    const qty = parseInt(fd.get('quantity'), 10) || 0;
    const materialBase = { vinyl: 0.15, paper: 0.08, holographic: 0.25, transparent: 0.18, glitter: 0.28 };
    const sizeMultiplier = { '2x2': 1, '3x3': 1.4, '4x4': 1.8, '5x5': 2.2, custom: 2.5 };
    const unit = (materialBase[material] || 0.15) * (sizeMultiplier[size] || 1);
    priceHint.textContent = qty > 0 ? `Estimated total: $${(unit * qty).toFixed(2)}` : '';
  }
  orderForm.addEventListener('input', updatePriceHint);
  updatePriceHint();

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { openModal('login'); return; }
    if (!uploadedDesign) { setStatus(orderStatus, 'Upload a design before ordering.', true); return; }

    const fd = new FormData(orderForm);
    const body = Object.fromEntries(fd.entries());
    body.designId = uploadedDesign.id;

    setStatus(orderStatus, 'Placing order…', false);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place order');
      setStatus(orderStatus, `Order placed — total $${data.total.toFixed(2)}.`, false, true);
      orderForm.reset();
      updatePriceHint();
      loadOrders();
    } catch (err) {
      setStatus(orderStatus, err.message, true);
    }
  });

  function setStatus(el, msg, isError, isOk) {
    el.textContent = msg;
    el.className = 'status' + (isError ? ' status--error' : isOk ? ' status--ok' : '');
  }

  // ---------- Gallery ----------
  async function loadGallery() {
    const grid = $('#galleryGrid');
    try {
      const res = await fetch('/api/designs/gallery');
      const data = await res.json();
      if (!data.length) {
        grid.innerHTML = '<p class="gallery-empty">No public designs yet — be the first to share one.</p>';
        return;
      }
      grid.innerHTML = data.map(d => `<img src="${d.url}" alt="Community sticker design" loading="lazy">`).join('');
    } catch (_) {
      grid.innerHTML = '<p class="gallery-empty">Could not load the gallery right now.</p>';
    }
  }

  // ---------- My orders ----------
  async function loadOrders() {
    if (!currentUser) return;
    const tbody = document.querySelector('#ordersTable tbody');
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      tbody.innerHTML = data.map(o => `
        <tr>
          <td>${new Date(o.createdAt).toLocaleDateString()}</td>
          <td>${o.shape}</td>
          <td>${o.material}</td>
          <td>${o.size}</td>
          <td>${o.quantity}</td>
          <td>$${o.total.toFixed(2)}</td>
          <td>${o.status}</td>
        </tr>`).join('') || '<tr><td colspan="7">No orders yet.</td></tr>';
    } catch (_) { /* ignore */ }
  }

  // ---------- Admin ----------
  async function loadAdmin() {
    if (!currentUser || currentUser.role !== 'admin') return;
    const tbody = document.querySelector('#adminTable tbody');
    try {
      const res = await fetch('/api/orders/admin/all');
      if (!res.ok) return;
      const data = await res.json();
      tbody.innerHTML = data.map(o => `
        <tr data-id="${o.id}">
          <td>${new Date(o.createdAt).toLocaleDateString()}</td>
          <td>${o.userId.slice(0, 8)}…</td>
          <td>${o.shape}</td>
          <td>${o.material}</td>
          <td>${o.quantity}</td>
          <td>$${o.total.toFixed(2)}</td>
          <td>${o.status}</td>
          <td>
            <select class="status-select">
              ${['pending','in_production','shipped','delivered','cancelled'].map(s =>
                `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('') || '<tr><td colspan="8">No orders yet.</td></tr>';

      tbody.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const id = e.target.closest('tr').dataset.id;
          await fetch(`/api/orders/admin/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: e.target.value })
          });
        });
      });
    } catch (_) { /* ignore */ }
  }

  // ---------- Init ----------
  fetchMe().then(() => { loadGallery(); loadOrders(); loadAdmin(); });
})();
