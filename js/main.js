/* =========================================================
   Snufflewind — shared storefront script
   Cart, toasts, header, placeholder art, small UI helpers
   ========================================================= */
(function () {
  "use strict";

  var CART_KEY = "snufflewind.cart.v1";
  var ORDER_KEY = "snufflewind.lastOrder.v1";
  var ORDERS_KEY = "snufflewind.orders.v1";
  var MESSAGES_KEY = "snufflewind.messages.v1";

  var REFILL_PRICE = 1800;
  var FREE_SHIPPING_AT = 7500;
  var FLAT_SHIPPING = 600;
  var MAX_QTY = 10;

  var SIZES = {
    small: {
      id: "small",
      label: "Small",
      price: 6400,
      weight: "Under 10 kg",
      range: "under 10 kg",
      dogs: "Jack Russells, Mini Dachshunds, Shih Tzus",
      blurb: "A compact tower for little foragers, with a 22 cm sniff tray."
    },
    medium: {
      id: "medium",
      label: "Medium",
      price: 7900,
      weight: "10–25 kg",
      range: "10–25 kg",
      dogs: "Beagles, Border Collies, Cocker Spaniels",
      blurb: "Our bestseller, sized for the average snout and a 27 cm tray."
    },
    large: {
      id: "large",
      label: "Large",
      price: 9400,
      weight: "Over 25 kg",
      range: "over 25 kg",
      dogs: "Labradors, Golden Retrievers, German Shepherds",
      blurb: "A taller tower and 32 cm tray for big dogs with big appetites."
    }
  };

  /* ---------------- Storage helpers ---------------- */
  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------------- Money ---------------- */
  function money(cents) {
    var n = Number(cents) || 0;
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var whole = Math.floor(n / 100);
    var part = n % 100;
    var wholeText = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "$" + wholeText + (part ? "." + String(part).padStart(2, "0") : "");
  }

  /* ---------------- Cart ---------------- */
  function normaliseLine(line) {
    if (!line || !SIZES[line.sizeId]) return null;
    var qty = Math.max(1, Math.min(MAX_QTY, parseInt(line.qty, 10) || 1));
    var refill = Boolean(line.refill);
    return {
      key: line.sizeId + (refill ? "|refill" : ""),
      sizeId: line.sizeId,
      sizeLabel: SIZES[line.sizeId].label,
      refill: refill,
      unitPrice: SIZES[line.sizeId].price + (refill ? REFILL_PRICE : 0),
      qty: qty
    };
  }

  function getCart() {
    var raw = read(CART_KEY, []);
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (line) {
      var clean = normaliseLine(line);
      if (!clean) return;
      var existing = out.filter(function (l) {
        return l.key === clean.key;
      })[0];
      if (existing) {
        existing.qty = Math.min(MAX_QTY, existing.qty + clean.qty);
      } else {
        out.push(clean);
      }
    });
    return out;
  }

  function saveCart(lines) {
    var clean = (lines || []).map(normaliseLine).filter(Boolean);
    write(CART_KEY, clean);
    updateCartCount();
    document.dispatchEvent(
      new CustomEvent("sw:cart-change", { detail: { cart: clean } })
    );
    return clean;
  }

  function addToCart(item) {
    var lines = getCart();
    var clean = normaliseLine(item);
    if (!clean) return lines;
    var found = null;
    lines.forEach(function (line) {
      if (line.key === clean.key) found = line;
    });
    if (found) {
      found.qty = Math.min(MAX_QTY, found.qty + clean.qty);
    } else {
      lines.push(clean);
    }
    return saveCart(lines);
  }

  function setQty(key, qty) {
    var lines = getCart();
    var next = parseInt(qty, 10);
    if (isNaN(next)) next = 1;
    next = Math.max(0, Math.min(MAX_QTY, next));
    lines = lines
      .map(function (line) {
        if (line.key === key) line.qty = next;
        return line;
      })
      .filter(function (line) {
        return line.qty > 0;
      });
    return saveCart(lines);
  }

  function removeLine(key) {
    return saveCart(
      getCart().filter(function (line) {
        return line.key !== key;
      })
    );
  }

  function cartCount() {
    return getCart().reduce(function (sum, line) {
      return sum + line.qty;
    }, 0);
  }

  function cartSubtotal() {
    return getCart().reduce(function (sum, line) {
      return sum + line.unitPrice * line.qty;
    }, 0);
  }

  function shippingFor(subtotal) {
    if (subtotal <= 0) return 0;
    return subtotal >= FREE_SHIPPING_AT ? 0 : FLAT_SHIPPING;
  }

  function lineTitle(line) {
    return "Snufflewind — " + line.sizeLabel;
  }

  function lineMeta(line) {
    return SIZES[line.sizeId].weight + " dogs" + (line.refill ? " · Refill ring set included" : "");
  }

  function updateCartCount() {
    var count = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      var previous = el.getAttribute("data-count-value");
      el.textContent = String(count);
      el.classList.toggle("is-empty", count === 0);
      el.setAttribute("data-count-value", String(count));
      if (previous !== null && previous !== String(count)) {
        el.classList.remove("is-bumped");
        void el.offsetWidth;
        el.classList.add("is-bumped");
      }
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (el) {
      el.setAttribute(
        "aria-label",
        count === 0 ? "Cart, empty" : "Cart, " + count + (count === 1 ? " item" : " items")
      );
    });
  }

  /* ---------------- Toasts ---------------- */
  function toast(options) {
    var opts = options || {};
    var stack = document.getElementById("toastStack");
    if (!stack) return;

    var node = document.createElement("div");
    node.className = "toast";
    node.setAttribute("role", "status");

    var icon = document.createElement("span");
    icon.className = "toast__icon";
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

    var body = document.createElement("div");
    body.className = "toast__body";

    var title = document.createElement("strong");
    title.className = "toast__title";
    title.textContent = opts.title || "Added to cart";
    body.appendChild(title);

    if (opts.text) {
      var text = document.createElement("span");
      text.className = "toast__text";
      text.textContent = opts.text;
      body.appendChild(text);
    }

    if (opts.linkHref && opts.linkText) {
      var link = document.createElement("a");
      link.className = "toast__link";
      link.href = opts.linkHref;
      link.textContent = opts.linkText;
      body.appendChild(link);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    node.appendChild(icon);
    node.appendChild(body);
    node.appendChild(close);
    stack.appendChild(node);

    var timer = window.setTimeout(dismiss, opts.timeout || 5200);

    function dismiss() {
      window.clearTimeout(timer);
      if (!node.isConnected) return;
      node.classList.add("is-leaving");
      window.setTimeout(function () {
        node.remove();
      }, 260);
    }

    close.addEventListener("click", dismiss);
    node.addEventListener("mouseenter", function () {
      window.clearTimeout(timer);
    });
    node.addEventListener("mouseleave", function () {
      timer = window.setTimeout(dismiss, 2200);
    });
  }

  /* ---------------- Placeholder artwork ---------------- */
  var uid = 0;
  function nextId() {
    uid += 1;
    return "ph" + uid;
  }

  function treat(cx, cy, r, fill) {
    return (
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' +
      (fill || "#EF9F27") + '"/>' +
      '<circle cx="' + (cx - r * 0.28) + '" cy="' + (cy - r * 0.3) + '" r="' + (r * 0.22) +
      '" fill="rgba(255,255,255,.55)"/>'
    );
  }

  function paw(cx, cy, s, fill, opacity) {
    var g =
      '<g fill="' + (fill || "#12775A") + '" opacity="' + (opacity == null ? 1 : opacity) + '" transform="translate(' +
      cx + " " + cy + ") scale(" + s + ')">';
    g += '<ellipse cx="0" cy="6" rx="7" ry="6"/>';
    g += '<ellipse cx="-8" cy="-3" rx="3" ry="4"/>';
    g += '<ellipse cx="-2.5" cy="-7" rx="3" ry="4"/>';
    g += '<ellipse cx="3.5" cy="-7" rx="3" ry="4"/>';
    g += '<ellipse cx="9" cy="-2" rx="3" ry="4"/>';
    g += "</g>";
    return g;
  }

  function towerGroup(cx, baseY, scale) {
    var g = '<g transform="translate(' + cx + " " + baseY + ") scale(" + scale + ')">';
    /* shadow */
    g += '<ellipse cx="0" cy="6" rx="118" ry="22" fill="rgba(59,42,26,.1)"/>';
    /* tray */
    g += '<ellipse cx="0" cy="0" rx="112" ry="30" fill="#12775A"/>';
    g += '<ellipse cx="0" cy="-3" rx="112" ry="30" fill="#1D9E75"/>';
    g += '<ellipse cx="0" cy="-6" rx="90" ry="22" fill="#2FB68A"/>';
    g += '<ellipse cx="0" cy="-8" rx="64" ry="15" fill="#12775A" opacity=".55"/>';
    /* tower body */
    g += '<path d="M-46 0 L-46 -168 Q-46 -186 -28 -186 L28 -186 Q46 -186 46 -168 L46 0 Z" fill="#FFFDF8"/>';
    g += '<path d="M-46 0 L-46 -168 Q-46 -186 -28 -186 L-6 -186 L-6 0 Z" fill="#F4ECDF"/>';
    /* windows */
    g += '<rect x="-26" y="-150" width="52" height="34" rx="17" fill="#E2F3EC"/>';
    g += '<circle cx="0" cy="-133" r="11" fill="#1D9E75"/>';
    g += '<path d="M0 -139 L0 -133 L5 -130" stroke="#FFFDF8" stroke-width="2.6" stroke-linecap="round" fill="none"/>';
    g += '<rect x="-26" y="-98" width="52" height="10" rx="5" fill="#EF9F27" opacity=".35"/>';
    g += '<rect x="-26" y="-80" width="52" height="10" rx="5" fill="#EF9F27" opacity=".2"/>';
    /* spout */
    g += '<path d="M30 -74 Q52 -74 56 -56 L58 -44" stroke="#12775A" stroke-width="11" stroke-linecap="round" fill="none"/>';
    g += treat(60, -36, 6);
    g += treat(70, -18, 5);
    /* collar */
    g += '<rect x="-50" y="-192" width="100" height="14" rx="7" fill="#12775A"/>';
    /* crown */
    g += '<rect x="-17" y="-214" width="34" height="22" rx="7" fill="#EF9F27"/>';
    g += '<rect x="-24" y="-220" width="48" height="10" rx="5" fill="#F7B84D"/>';
    g += '<circle cx="-24" cy="-220" r="4" fill="#EF9F27"/>';
    g += '<circle cx="24" cy="-220" r="4" fill="#EF9F27"/>';
    g += '<path d="M-8 -214 v10 M0 -214 v10 M8 -214 v10" stroke="#B26A00" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
    /* base feet */
    g += '<rect x="-40" y="-10" width="12" height="10" rx="4" fill="#0B5B45"/>';
    g += '<rect x="28" y="-10" width="12" height="10" rx="4" fill="#0B5B45"/>';
    g += "</g>";
    return g;
  }

  var PLACEHOLDERS = {
    hero: function () {
      var id = nextId();
      return (
        '<svg viewBox="0 0 800 800" role="img" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#E9F6F0"/><stop offset="1" stop-color="#F7EFE1"/></linearGradient></defs>' +
        '<rect width="800" height="800" fill="url(#' + id + ')"/>' +
        '<circle cx="400" cy="410" r="300" fill="#FFFFFF" opacity=".55"/>' +
        '<circle cx="400" cy="410" r="252" fill="#FBF6EE"/>' +
        '<path d="M400 158c112 0 202 90 202 202v180c0 22-18 40-40 40H238c-22 0-40-18-40-40V360c0-112 90-202 202-202z" fill="#E2F3EC"/>' +
        towerGroup(400, 622, 1.32) +
        treat(596, 372, 13) +
        treat(626, 404, 9) +
        treat(208, 320, 10) +
        paw(186, 596, 1.5, "#1D9E75", 0.28) +
        paw(620, 236, 1.2, "#EF9F27", 0.5) +
        '<circle cx="650" cy="560" r="46" fill="#FDF0D9"/>' +
        '<circle cx="650" cy="560" r="30" fill="#EF9F27" opacity=".35"/>' +
        '<path d="M150 430c22-30 52-30 74 0" stroke="#1D9E75" stroke-width="6" stroke-linecap="round" fill="none" opacity=".35"/>' +
        "</svg>"
      );
    },

    tower: function () {
      return (
        '<svg viewBox="0 0 600 600" role="img" aria-hidden="true">' +
        '<rect width="600" height="600" fill="#F5EDE0"/>' +
        '<circle cx="300" cy="300" r="232" fill="#FBF6EE"/>' +
        '<circle cx="300" cy="300" r="176" fill="#E2F3EC"/>' +
        towerGroup(300, 452, 1.02) +
        treat(438, 214, 11) +
        treat(152, 268, 9) +
        paw(444, 380, 1.1, "#EF9F27", 0.45) +
        "</svg>"
      );
    },

    tray: function () {
      var id = nextId();
      return (
        '<svg viewBox="0 0 600 600" role="img" aria-hidden="true">' +
        '<defs><radialGradient id="' + id + '" cx="50%" cy="45%" r="60%">' +
        '<stop offset="0" stop-color="#2FB68A"/><stop offset="1" stop-color="#12775A"/></radialGradient></defs>' +
        '<rect width="600" height="600" fill="#F5EDE0"/>' +
        '<circle cx="300" cy="300" r="238" fill="#FBF6EE"/>' +
        '<circle cx="300" cy="300" r="206" fill="url(#' + id + ')"/>' +
        '<circle cx="300" cy="300" r="160" fill="none" stroke="#0B5B45" stroke-width="3" stroke-dasharray="10 12" opacity=".55"/>' +
        '<circle cx="300" cy="300" r="112" fill="none" stroke="#0B5B45" stroke-width="3" stroke-dasharray="10 12" opacity=".45"/>' +
        '<circle cx="300" cy="300" r="64" fill="none" stroke="#0B5B45" stroke-width="3" stroke-dasharray="10 12" opacity=".35"/>' +
        '<circle cx="300" cy="300" r="196" fill="none" stroke="#E2F3EC" stroke-width="10" opacity=".5"/>' +
        treat(300, 196, 13) +
        treat(394, 262, 11) +
        treat(356, 386, 14) +
        treat(226, 372, 10) +
        treat(206, 256, 12) +
        treat(300, 300, 9) +
        '<path d="M120 452c40-26 80 26 120 0s80 26 120 0 80 26 120 0" stroke="#0B5B45" stroke-width="4" stroke-linecap="round" fill="none" opacity=".18"/>' +
        "</svg>"
      );
    },

    detail: function () {
      return (
        '<svg viewBox="0 0 600 600" role="img" aria-hidden="true">' +
        '<rect width="600" height="600" fill="#F5EDE0"/>' +
        '<circle cx="300" cy="300" r="228" fill="#E2F3EC"/>' +
        '<circle cx="300" cy="300" r="168" fill="#FBF6EE"/>' +
        '<circle cx="300" cy="300" r="132" fill="#EF9F27"/>' +
        '<circle cx="300" cy="300" r="112" fill="#FDF0D9"/>' +
        '<circle cx="300" cy="300" r="100" fill="#FFFDF8"/>' +
        '<g stroke="#3B2A1A" stroke-width="5" stroke-linecap="round" opacity=".55">' +
        '<path d="M300 222v18"/><path d="M300 360v18"/><path d="M222 300h18"/><path d="M360 300h18"/>' +
        '<path d="M245 245l12 12"/><path d="M343 343l12 12"/><path d="M355 245l-12 12"/><path d="M257 343l-12 12"/>' +
        "</g>" +
        '<path d="M300 300 L300 244" stroke="#12775A" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M300 300 L348 320" stroke="#12775A" stroke-width="8" stroke-linecap="round"/>' +
        '<circle cx="300" cy="300" r="10" fill="#3B2A1A"/>' +
        '<circle cx="300" cy="300" r="152" fill="none" stroke="#12775A" stroke-width="4" stroke-dasharray="4 14" opacity=".5"/>' +
        paw(474, 460, 1.3, "#1D9E75", 0.35) +
        treat(128, 190, 10) +
        "</svg>"
      );
    },

    steps: function () {
      return (
        '<svg viewBox="0 0 800 600" role="img" aria-hidden="true">' +
        '<rect width="800" height="600" fill="#F5EDE0"/>' +
        '<rect y="392" width="800" height="208" fill="#EFE3D2"/>' +
        '<circle cx="662" cy="132" r="62" fill="#FDF0D9"/>' +
        '<circle cx="662" cy="132" r="40" fill="#EF9F27" opacity=".45"/>' +
        '<rect x="96" y="150" width="150" height="196" rx="16" fill="#FFFDF8" stroke="#E8DCC9" stroke-width="3"/>' +
        '<path d="M116 196h110M116 232h84M116 268h96" stroke="#E2F3EC" stroke-width="10" stroke-linecap="round"/>' +
        '<rect x="64" y="346" width="214" height="16" rx="8" fill="#DCC9AF"/>' +
        towerGroup(430, 470, 0.86) +
        '<ellipse cx="612" cy="486" rx="86" ry="22" fill="#12775A" opacity=".2"/>' +
        '<ellipse cx="612" cy="478" rx="74" ry="18" fill="#1D9E75"/>' +
        '<ellipse cx="612" cy="474" rx="52" ry="11" fill="#2FB68A"/>' +
        treat(590, 472, 7) + treat(624, 476, 6) + treat(650, 468, 5) +
        '<path d="M150 452c30-22 60 22 90 0s60 22 90 0" stroke="#C9B69C" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        paw(736, 424, 1.4, "#12775A", 0.25) +
        '<path d="M330 110q26-26 52 0" stroke="#1D9E75" stroke-width="6" stroke-linecap="round" fill="none" opacity=".4"/>' +
        "</svg>"
      );
    }
  };

  function paintPlaceholders() {
    document.querySelectorAll(".media[data-ph]").forEach(function (el) {
      var key = el.getAttribute("data-ph");
      var factory = PLACEHOLDERS[key] || PLACEHOLDERS.tower;
      var img = el.querySelector(".media__img");

      var holder = el.querySelector(".media__ph");
      if (!holder) {
        holder = document.createElement("div");
        holder.className = "media__ph";
        el.insertBefore(holder, el.firstChild);
      }
      holder.innerHTML = factory();
      var svg = holder.querySelector("svg");
      if (svg && img) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", img.getAttribute("alt") || "Snufflewind illustration");
      }

      if (!img) return;
      function markMissing() {
        el.classList.add("is-missing");
      }
      img.addEventListener("error", markMissing);
      if (img.complete && img.naturalWidth === 0) markMissing();
    });
  }

  function setMedia(el, src, alt, phKey) {
    if (!el) return;
    var img = el.querySelector(".media__img");
    var holder = el.querySelector(".media__ph");
    el.classList.remove("is-missing");
    if (img) {
      img.src = src;
      if (alt) img.alt = alt;
    }
    if (holder && phKey && PLACEHOLDERS[phKey]) {
      holder.innerHTML = PLACEHOLDERS[phKey]();
      var svg = holder.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", alt || "Snufflewind illustration");
      }
    }
  }

  /* ---------------- Header & nav ---------------- */
  function initHeader() {
    var header = document.querySelector(".site-header");
    var toggle = document.getElementById("navToggle");
    var panel = document.getElementById("mobileNav");

    function onScroll() {
      if (!header) return;
      header.classList.toggle("is-stuck", window.scrollY > 6);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle && panel) {
      function setOpen(open) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        panel.classList.toggle("is-open", open);
        if (!open) {
          toggle.focus({ preventScroll: true });
        }
      }

      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") !== "true";
        if (open) {
          toggle.setAttribute("aria-expanded", "true");
          panel.classList.add("is-open");
        } else {
          setOpen(false);
        }
      });

      panel.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          toggle.setAttribute("aria-expanded", "false");
          panel.classList.remove("is-open");
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && panel.classList.contains("is-open")) {
          setOpen(false);
        }
      });

      window.addEventListener("resize", function () {
        if (window.innerWidth >= 900 && panel.classList.contains("is-open")) {
          toggle.setAttribute("aria-expanded", "false");
          panel.classList.remove("is-open");
        }
      });
    }
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------------- Accordion groups ---------------- */
  function initAccordions() {
    document.querySelectorAll("[data-accordion]").forEach(function (group) {
      var items = group.querySelectorAll("details");
      items.forEach(function (item) {
        item.addEventListener("toggle", function () {
          if (!item.open) return;
          items.forEach(function (other) {
            if (other !== item) other.open = false;
          });
        });
      });
    });
  }

  /* ---------------- Misc ---------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function initNewsletterless() {
    /* keeps footer tidy: nothing to wire up here */
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    initHeader();
    initReveal();
    initAccordions();
    initYear();
    initNewsletterless();
    paintPlaceholders();
    updateCartCount();

    window.addEventListener("storage", function (event) {
      if (event.key === CART_KEY) updateCartCount();
    });

    document.addEventListener("sw:cart-change", updateCartCount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* ---------------- Public API ---------------- */
  window.SW = {
    SIZES: SIZES,
    REFILL_PRICE: REFILL_PRICE,
    FREE_SHIPPING_AT: FREE_SHIPPING_AT,
    FLAT_SHIPPING: FLAT_SHIPPING,
    MAX_QTY: MAX_QTY,
    CART_KEY: CART_KEY,
    ORDER_KEY: ORDER_KEY,
    ORDERS_KEY: ORDERS_KEY,
    MESSAGES_KEY: MESSAGES_KEY,
    money: money,
    read: read,
    write: write,
    getCart: getCart,
    saveCart: saveCart,
    addToCart: addToCart,
    setQty: setQty,
    removeLine: removeLine,
    cartCount: cartCount,
    cartSubtotal: cartSubtotal,
    shippingFor: shippingFor,
    lineTitle: lineTitle,
    lineMeta: lineMeta,
    updateCartCount: updateCartCount,
    toast: toast,
    paintPlaceholders: paintPlaceholders,
    setMedia: setMedia,
    placeholders: PLACEHOLDERS
  };
})();
