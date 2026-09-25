/* Delegated tooltip (one listener set for the whole page) */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }

  /* ---------- tooltip (delegated) ----------------------------------------- */
  var tip = $("#tip"), tipFor = null;
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    var r = tip.getBoundingClientRect();
    var nx = Math.min(window.innerWidth - r.width - 10, Math.max(10, x + 14));
    var ny = y - r.height - 12; if (ny < 70) ny = y + 18;
    tip.style.transform = "translate(" + nx + "px," + ny + "px)";
  }
  function hideTip() { tip.classList.remove("show"); tipFor = null; }
  function tipContent(el) {
    var f = el.__tip; return typeof f === "function" ? f() : el.getAttribute("data-tip");
  }
  document.addEventListener("pointerover", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) return; tipFor = el;
  });
  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) { if (tipFor) hideTip(); return; }
    tipFor = el; showTip(tipContent(el), e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener("pointerdown", hideTip);
  document.addEventListener("focusin", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el || !el.matches(":focus-visible")) return;
    var r = el.getBoundingClientRect(); showTip(tipContent(el), r.left + r.width / 2 - 14, r.top);
  });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", function () { if (tip.classList.contains("show")) hideTip(); }, { passive: true });
  function bindTip(el, fn) { el.__tip = fn; el.setAttribute("data-tip", ""); }

  P.showTip = showTip;
  P.hideTip = hideTip;
  P.tipContent = tipContent;
  P.bindTip = bindTip;
})(window.PD = window.PD || {});
