/* =========================================================
   Snufflewind — order confirmation
   ========================================================= */
(function () {
  "use strict";

  if (!window.SW) return;

  var SW = window.SW;
  var order = SW.read(SW.ORDER_KEY, null);

  if (!order || !order.items || !order.items.length) {
    window.location.replace("index.html");
    return;
  }

  var wrap = document.getElementById("confirmWrap");
  if (!wrap) return;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function placedDate() {
    var date = new Date(order.createdAt);
    if (isNaN(date.getTime())) date = new Date();
    return date;
  }

  function longDate(date) {
    return date.getDate() + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
  }

  function addWorkingDays(date, days) {
    var d = new Date(date.getTime());
    var added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added += 1;
    }
    return d;
  }

  function rangeText(a, b) {
    var sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    if (sameMonth) return a.getDate() + "–" + b.getDate() + " " + MONTHS[b.getMonth()];
    return a.getDate() + " " + MONTHS[a.getMonth()] + " – " + b.getDate() + " " + MONTHS[b.getMonth()];
  }

  var created = placedDate();
  var customer = order.customer || {};
  var address = order.address || {};
  var fullName = String(customer.fullName || "").trim();
  var firstName = fullName ? fullName.split(/\s+/)[0] : "friend";

  document.getElementById("customerName").textContent = firstName;
  document.getElementById("orderNumber").textContent = order.id || "SW-000000";
  document.title = "Order " + (order.id || "") + " confirmed — Snufflewind";

  /* Items */
  var lines = order.items
    .map(function (line) {
      var title = line.title || "Snufflewind — " + (line.sizeLabel || "");
      var meta = "Qty " + line.qty + " · " + (line.meta || "");
      return (
        '<div class="order-line">' +
          '<div class="media order-line__thumb" data-ph="tower">' +
            '<img class="media__img" src="images/product-small.png" width="120" height="120" alt="" loading="lazy">' +
          "</div>" +
          "<div>" +
            "<h3>" + esc(title) + "</h3>" +
            "<p>" + esc(meta) + "</p>" +
          "</div>" +
          '<span class="order-line__price">' + SW.money(line.unitPrice * line.qty) + "</span>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("orderLines").innerHTML = lines;

  /* Address */
  var addressLines = [address.line1, address.line2, address.city, address.postal, address.country]
    .filter(function (part) {
      return part && String(part).trim();
    })
    .map(function (part) {
      return esc(String(part).trim());
    });

  document.getElementById("orderAddress").innerHTML = addressLines.join("<br>");

  /* Contact */
  var contactParts = [];
  if (customer.email) contactParts.push(esc(customer.email));
  if (customer.phone) contactParts.push(esc(customer.phone));
  document.getElementById("orderContact").innerHTML = contactParts.join("<br>");

  var payment = order.payment || {};
  document.getElementById("orderPayment").textContent = payment.last4
    ? "Paid with " + (payment.brand || "card") + " ending " + payment.last4 + " (demo)"
    : "Demo payment — no charge made";

  /* Dates */
  var etaStart = addWorkingDays(created, 2);
  var etaEnd = addWorkingDays(created, 4);
  document.getElementById("orderEta").textContent = "Arriving " + rangeText(etaStart, etaEnd);
  document.getElementById("orderPlaced").textContent =
    "Placed " + longDate(created) + " at " +
    String(created.getHours()).padStart(2, "0") + ":" +
    String(created.getMinutes()).padStart(2, "0");

  /* Totals */
  var subtotal = Number(order.subtotal) || 0;
  var shipping = Number(order.shipping) || 0;
  var total = Number(order.total) || subtotal + shipping;

  document.getElementById("orderSubtotal").textContent = SW.money(subtotal);
  document.getElementById("orderShipping").textContent = shipping === 0 ? "Free" : SW.money(shipping);
  document.getElementById("orderTotal").textContent = SW.money(total);

  wrap.hidden = false;
  SW.paintPlaceholders();

  /* The cart is emptied once the order is shown. */
  SW.saveCart([]);
})();
