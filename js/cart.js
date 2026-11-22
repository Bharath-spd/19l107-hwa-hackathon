/* =========================================================
   Snufflewind — cart page
   ========================================================= */
(function () {
  "use strict";

  if (!window.SW) return;

  var SW = window.SW;
  var layout = document.getElementById("cartLayout");
  var emptyState = document.getElementById("cartEmpty");
  var list = document.getElementById("cartList");
  var live = document.getElementById("cartLive");
  var heading = document.getElementById("cartHeading");

  var subtotalEl = document.getElementById("subtotal");
  var shippingEl = document.getElementById("shipping");
  var totalEl = document.getElementById("total");
  var meter = document.getElementById("shipMeter");
  var meterText = document.getElementById("shipMeterText");
  var meterFill = document.getElementById("shipMeterFill");

  if (!layout || !list) return;

  var PRODUCT_IMG = "images/product-small.png";

  if (heading) heading.setAttribute("tabindex", "-1");

  function itemHTML(line) {
    var unit = SW.money(line.unitPrice);
    var lineTotal = SW.money(line.unitPrice * line.qty);
    var meta =
      SW.SIZES[line.sizeId].weight +
      " dogs" +
      (line.refill ? " · Refill ring set included" : "");
    var title = SW.lineTitle(line);

    return (
      '<article class="cart-item" data-key="' + line.key + '">' +
        '<div class="media cart-item__media" data-ph="tower">' +
          '<img class="media__img" src="' + PRODUCT_IMG + '" width="200" height="200" alt="" loading="lazy">' +
        "</div>" +
        '<div class="cart-item__body">' +
          '<h3 class="cart-item__title">' + title + "</h3>" +
          '<p class="cart-item__meta">' + meta + "</p>" +
          '<p class="cart-item__unit">' + unit + " each</p>" +
        "</div>" +
        '<div class="cart-item__foot">' +
          '<div class="qty" role="group" aria-label="Quantity for ' + title + '">' +
            '<button type="button" data-action="minus" aria-label="Decrease quantity of ' + title + '"' +
              (line.qty <= 1 ? " disabled" : "") + ">" +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>' +
            "</button>" +
            '<input type="number" min="1" max="' + SW.MAX_QTY + '" step="1" value="' + line.qty + '" data-qty inputmode="numeric" aria-label="Quantity of ' + title + '">' +
            '<button type="button" data-action="plus" aria-label="Increase quantity of ' + title + '"' +
              (line.qty >= SW.MAX_QTY ? " disabled" : "") + ">" +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="cart-item__price-wrap">' +
            '<span class="cart-item__line" data-line-total>' + lineTotal + "</span>" +
            '<button class="remove-btn" type="button" data-remove aria-label="Remove ' + title + ' from cart">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>' +
              "Remove" +
            "</button>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function updateSummary() {
    var subtotal = SW.cartSubtotal();
    var shipping = SW.shippingFor(subtotal);

    subtotalEl.textContent = SW.money(subtotal);
    shippingEl.textContent = shipping === 0 ? "Free" : SW.money(shipping);
    totalEl.textContent = SW.money(subtotal + shipping);

    var remaining = SW.FREE_SHIPPING_AT - subtotal;
    var isFree = subtotal >= SW.FREE_SHIPPING_AT;

    meter.classList.toggle("ship-meter--done", isFree);
    if (isFree) {
      meterText.textContent = "Free shipping unlocked. Nice one.";
      meterFill.style.width = "100%";
    } else {
      meterText.textContent =
        "You're " + SW.money(remaining) + " away from free shipping";
      meterFill.style.width =
        Math.max(0, Math.min(100, (subtotal / SW.FREE_SHIPPING_AT) * 100)) + "%";
    }
  }

  function findItem(key) {
    return Array.prototype.slice
      .call(list.querySelectorAll(".cart-item"))
      .filter(function (el) {
        return el.getAttribute("data-key") === key;
      })[0];
  }

  function syncItem(el, line) {
    if (!el || !line) return;
    var input = el.querySelector("[data-qty]");
    var minus = el.querySelector('[data-action="minus"]');
    var plus = el.querySelector('[data-action="plus"]');
    var total = el.querySelector("[data-line-total]");
    if (input) input.value = String(line.qty);
    if (minus) minus.disabled = line.qty <= 1;
    if (plus) plus.disabled = line.qty >= SW.MAX_QTY;
    if (total) total.textContent = SW.money(line.unitPrice * line.qty);
  }

  function render(announce) {
    var cart = SW.getCart();

    if (!cart.length) {
      layout.hidden = true;
      emptyState.hidden = false;
      if (announce && live) live.textContent = announce;
      return;
    }

    emptyState.hidden = true;
    layout.hidden = false;
    list.innerHTML = cart.map(itemHTML).join("");
    SW.paintPlaceholders();
    updateSummary();
    if (announce && live) live.textContent = announce;
  }

  /* ---------------- Events ---------------- */
  list.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    var item = button.closest(".cart-item");
    if (!item) return;
    var key = item.getAttribute("data-key");
    var line = SW.getCart().filter(function (l) {
      return l.key === key;
    })[0];
    if (!line) return;

    if (button.hasAttribute("data-remove")) {
      SW.removeLine(key);
      render("Removed " + SW.lineTitle(line) + " from your cart.");
      if (heading) heading.focus({ preventScroll: true });
      SW.toast({
        title: "Removed from cart",
        text: SW.lineTitle(line)
      });
      return;
    }

    var action = button.getAttribute("data-action");
    if (action !== "plus" && action !== "minus") return;

    var next = line.qty + (action === "plus" ? 1 : -1);
    SW.setQty(key, next);
    var updated = SW.getCart().filter(function (l) {
      return l.key === key;
    })[0];
    syncItem(item, updated);
    updateSummary();

    /* keep focus on the same control after the update */
    var focusTarget = item.querySelector('[data-action="' + action + '"]');
    if (focusTarget && !focusTarget.disabled) {
      focusTarget.focus({ preventScroll: true });
    } else if (action === "plus") {
      var minus = item.querySelector('[data-action="minus"]');
      if (minus) minus.focus({ preventScroll: true });
    } else {
      var plus = item.querySelector('[data-action="plus"]');
      if (plus) plus.focus({ preventScroll: true });
    }
  });

  list.addEventListener("change", function (event) {
    var input = event.target.closest("[data-qty]");
    if (!input) return;
    var item = input.closest(".cart-item");
    var key = item.getAttribute("data-key");
    var value = parseInt(input.value, 10);
    if (isNaN(value)) value = 1;
    value = Math.max(1, Math.min(SW.MAX_QTY, value));
    SW.setQty(key, value);
    var updated = SW.getCart().filter(function (l) {
      return l.key === key;
    })[0];
    syncItem(item, updated);
    updateSummary();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === SW.CART_KEY) render();
  });

  render();
})();
