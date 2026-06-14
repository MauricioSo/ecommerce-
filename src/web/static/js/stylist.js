(function () {
  'use strict';

  const CURRENCY_FORMAT = { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 };

  function formatPrice(cents, currency) {
    try {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency || 'CLP', minimumFractionDigits: 0 }).format(cents / 100);
    } catch {
      return `$${(cents / 100).toFixed(0)}`;
    }
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureSessionId() {
    let sid = localStorage.getItem('_stylist_sid');
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem('_stylist_sid', sid);
      document.cookie = `_stylist=${sid}; path=/; max-age=2592000; SameSite=Lax`;
    }
    return sid;
  }

  function getCsrf() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function renderLook(look, idx) {
    const productsHtml = look.products.map(p => {
      const imgHtml = p.baseImage
        ? `<img class="look-product-img" src="${escHtml(p.baseImage)}" alt="${escHtml(p.productName)}" loading="lazy">`
        : `<div class="look-product-img-placeholder">👗</div>`;
      return `
        <div class="look-product">
          ${imgHtml}
          <div class="look-product-info">
            <div class="look-product-name">${escHtml(p.productName)}</div>
            <div class="look-product-role">${escHtml(p.role || '')}</div>
          </div>
          <div class="look-product-price">${formatPrice(p.priceCents, p.currency)}</div>
        </div>`;
    }).join('');

    const lookBtns = look.products.map(p =>
      `<a href="/products/${escHtml(p.slug)}" class="look-btn" target="_blank" style="margin-bottom:4px">Ver ${escHtml(p.productName)}</a>`
    ).join('');

    return `
      <div class="stylist-look">
        <div class="look-header">
          <p class="look-title">Look ${idx + 1}: ${escHtml(look.title)}</p>
          <p class="look-desc">${escHtml(look.description)}</p>
        </div>
        <div class="look-products">${productsHtml}</div>
        <div class="look-footer">
          <span class="look-tip">${escHtml(look.styleTip || '')}</span>
          <span class="look-total">Total: ${formatPrice(look.totalPriceCents, look.products[0]?.currency || 'CLP')}</span>
        </div>
        ${lookBtns}
      </div>`;
  }

  function renderRecommendation(rec) {
    if (!rec || !rec.looks || rec.looks.length === 0) return '';
    const looksHtml = rec.looks.map((l, i) => renderLook(l, i)).join('');
    const adviceHtml = rec.generalAdvice ? `<div class="look-general-advice">💡 ${escHtml(rec.generalAdvice)}</div>` : '';
    return `<div class="stylist-looks">${looksHtml}${adviceHtml}</div>`;
  }

  function appendMessage(container, role, content, recommendation) {
    const div = document.createElement('div');
    div.className = `stylist-msg ${role}`;
    div.textContent = content;
    container.appendChild(div);
    if (recommendation) {
      const recDiv = document.createElement('div');
      recDiv.innerHTML = renderRecommendation(recommendation);
      container.appendChild(recDiv);
    }
    container.scrollTop = container.scrollHeight;
  }

  function showTyping(container) {
    const div = document.createElement('div');
    div.className = 'stylist-typing';
    div.id = 'stylist-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function removeTyping() {
    const el = document.getElementById('stylist-typing-indicator');
    if (el) el.remove();
  }

  function init() {
    ensureSessionId();

    const fab = document.getElementById('stylist-fab');
    const modal = document.getElementById('stylist-modal');
    const closeBtn = document.getElementById('stylist-close');
    const messagesEl = document.getElementById('stylist-messages');
    const input = document.getElementById('stylist-input');
    const sendBtn = document.getElementById('stylist-send');
    const photoBtn = document.getElementById('stylist-photo-btn');
    const photoInput = document.getElementById('stylist-photo-input');
    const photoPreview = document.getElementById('stylist-photo-preview');
    const photoName = document.getElementById('stylist-photo-name');
    const photoRemove = document.getElementById('stylist-photo-remove');
    const resetBtn = document.getElementById('stylist-reset');

    if (!fab || !modal) return;

    let pendingImage = null;
    let pendingImageType = null;
    let isOpen = false;
    let isLoading = false;
    let historyLoaded = false;

    function openModal() {
      isOpen = true;
      modal.classList.add('open');
      fab.style.display = 'none';
      if (!historyLoaded) loadHistory();
      input.focus();
    }

    function closeModal() {
      isOpen = false;
      modal.classList.remove('open');
      fab.style.display = '';
    }

    fab.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    async function loadHistory() {
      historyLoaded = true;
      try {
        const res = await fetch('/api/stylist/history');
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const welcome = messagesEl.querySelector('.stylist-welcome');
          if (welcome) welcome.remove();
          data.messages.forEach(m => {
            const rec = m.recommendations || null;
            appendMessage(messagesEl, m.role, m.content, rec);
          });
        }
      } catch {}
    }

    async function send() {
      const text = input.value.trim();
      if (!text || isLoading) return;

      isLoading = true;
      sendBtn.disabled = true;
      input.value = '';

      const welcome = messagesEl.querySelector('.stylist-welcome');
      if (welcome) welcome.remove();

      appendMessage(messagesEl, 'user', text, null);

      const typing = showTyping(messagesEl);

      const body = { message: text };
      if (pendingImage) {
        body.image = pendingImage;
        setPendingImage(null);
      }

      try {
        const res = await fetch('/api/stylist/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
          body: JSON.stringify(body),
        });
        removeTyping();
        const data = await res.json();
        if (data.recommendation) {
          const content = data.recommendation.generalAdvice || 'Aquí tienes mis recomendaciones:';
          appendMessage(messagesEl, 'assistant', content, data.recommendation);
        } else if (data.error) {
          appendMessage(messagesEl, 'assistant', 'Lo siento, ocurrió un error. Inténtalo de nuevo.', null);
        }
      } catch {
        removeTyping();
        appendMessage(messagesEl, 'assistant', 'Error de conexión. Por favor intenta de nuevo.', null);
      }

      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    function setPendingImage(dataUrl) {
      pendingImage = dataUrl;
      if (dataUrl) {
        photoPreview.style.display = 'flex';
      } else {
        photoPreview.style.display = 'none';
        photoInput.value = '';
        pendingImageType = null;
      }
    }

    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no puede superar 5MB');
        return;
      }
      pendingImageType = file.type;
      photoName.textContent = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
      const reader = new FileReader();
      reader.onload = e => setPendingImage(e.target.result);
      reader.readAsDataURL(file);
    });
    photoRemove.addEventListener('click', () => setPendingImage(null));

    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.prompt;
        input.focus();
        if (!isOpen) openModal();
      });
    });

    resetBtn.addEventListener('click', async () => {
      if (!confirm('¿Reiniciar conversación con el estilista?')) return;
      await fetch('/api/stylist/reset', {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrf() },
      });
      messagesEl.innerHTML = `
        <div class="stylist-welcome">
          <div class="welcome-icon">✨</div>
          <p><strong>¡Hola! Soy tu estilista personal.</strong></p>
          <p>Cuéntame tu objetivo o sube una foto y te armaré looks con productos de nuestra tienda.</p>
        </div>`;
      historyLoaded = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
