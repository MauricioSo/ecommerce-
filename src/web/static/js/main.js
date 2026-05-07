window.addEventListener("htmx:configRequest", function (evt) {
  var meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    evt.detail.headers["x-csrf-token"] = meta.getAttribute("content");
  }
});

document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-qty-delta]");
  if (btn) {
    var q = document.getElementById("qty");
    if (!q) return;
    var min = parseInt(q.getAttribute("min") || "1", 10);
    var max = parseInt(q.getAttribute("max") || "99", 10);
    var delta = parseInt(btn.getAttribute("data-qty-delta"), 10);
    q.value = Math.max(min, Math.min(max, parseInt(q.value, 10) + delta));
    return;
  }

  var thumb = e.target.closest("[data-set-thumb]");
  if (thumb) {
    var src = thumb.getAttribute("data-set-thumb");
    var main = document.getElementById("pdp-main-img");
    if (main) main.src = src;
    document.querySelectorAll(".pdp-thumb").forEach(function (t) {
      t.classList.toggle("active", t.querySelector("img") && t.querySelector("img").getAttribute("data-set-thumb") === src);
    });
    return;
  }

  var confirmBtn = e.target.closest("[data-confirm]");
  if (confirmBtn) {
    if (!confirm(confirmBtn.getAttribute("data-confirm"))) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
});

document.addEventListener("htmx:afterSettle", function (e) {
  document.querySelectorAll(".toast").forEach(function (toast) {
    if (toast.getAttribute("data-auto-dismiss") === null) {
      toast.setAttribute("data-auto-dismiss", "pending");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3000);
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("form[data-autosubmit]");
  if (form) form.submit();

  document.querySelectorAll("[data-auto-submit]").forEach(function (el) {
    el.addEventListener("change", function () {
      if (el.form) el.form.submit();
    });
  });
});

(function () {
  var navSearch = document.getElementById("nav-search");
  if (navSearch) {
    navSearch.addEventListener("htmx:configRequest", function (evt) {
      evt.detail.parameters.q = navSearch.value;
    });
  }
})();
