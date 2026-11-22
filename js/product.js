/* =========================================================
   Snufflewind — product page
   Size + refill pricing, gallery, quantity, add to cart
   ========================================================= */
(function () {
  "use strict";

  if (!window.SW) return;

  var SW = window.SW;
  var form = document.getElementById("productForm");
  if (!form) return;

  var priceEl = document.getElementById("price");
  var priceNote = document.getElementById("priceNote");
  var priceSub = document.getElementById("priceSub");
  var buttonPrice = document.getElementById("buttonPrice");
  var weightGuide = document.getElementById("weightGuide");
  var sizeGuideText = document.getElementById("sizeGuideText");
  var refillInput = document.getElementById("addRefill");
  var refillLabel = document.getElementById("refill");
  var qtyInput = document.getElementById("qty");
  var minus = document.getElementById("qtyMinus");
  var plus = document.getElementById("qtyPlus");
  var addButton = document.getElementById("addToCart");

  var sizeRadios = Array.prototype.slice.call(
    form.querySelectorAll('input[name="size"]')
  );

  var COPY = {
    small: "Small suits dogs under 10 kg — Jack Russells, Mini Dachshunds and Shih Tzus. A 22 cm tray and about 90 g of pocket space.",
    medium: "Medium is our bestseller. A 27 cm tray and about 140 g of pocket space, sized for beagles, spaniels and most dogs in between.",
    large: "Large suits dogs over 25 kg — Labradors, Golden Retrievers and German Shepherds. A 32 cm tray and about 200 g of pocket space."
  };

  function selectedSize() {
    var checked = sizeRadios.filter(function (input) {
      return input.checked;
    })[0];
    return (checked && checked.value) || "medium";
  }

  function currentQty() {
    var n = parseInt(qtyInput.value, 10);
    if (isNaN(n)) n = 1;
    return Math.max(1, Math.min(SW.MAX_QTY, n));
  }

  function unitPrice() {
    return (
      SW.SIZES[selectedSize()].price +
      (refillInput.checked ? SW.REFILL_PRICE : 0)
    );
  }

  function update() {
    var size = SW.SIZES[selectedSize()];
    var unit = unitPrice();
    var qty = currentQty();

    priceEl.textContent = SW.money(unit);
    buttonPrice.textContent = SW.money(unit * qty);
    weightGuide.textContent = "Suits dogs " + size.weight.toLowerCase();
    sizeGuideText.textContent = COPY[size.id];

    priceNote.textContent = refillInput.checked
      ? "Includes 3 rings + the refill ring set"
      : "Includes all three difficulty rings";

    var subtotal = unit * qty;
    if (subtotal >= SW.FREE_SHIPPING_AT) {
      priceSub.textContent = "Free shipping on this order.";
      priceSub.style.color = "";
    } else {
      priceSub.textContent =
        "Add " + SW.money(SW.FREE_SHIPPING_AT - subtotal) + " more for free shipping.";
      priceSub.style.color = "";
    }

    refillLabel.classList.toggle("is-checked", refillInput.checked);
    minus.disabled = qty <= 1;
    plus.disabled = qty >= SW.MAX_QTY;
    if (qtyInput.value !== String(qty)) qtyInput.value = String(qty);
  }

  function setQty(next) {
    var qty = Math.max(1, Math.min(SW.MAX_QTY, next));
    qtyInput.value = String(qty);
    update();
  }

  /* ---------------- Deep link: ?size=large ---------------- */
  var params = new URLSearchParams(window.location.search);
  var requested = (params.get("size") || "").toLowerCase();
  if (SW.SIZES[requested]) {
    sizeRadios.forEach(function (input) {
      input.checked = input.value === requested;
    });
  }

  /* ---------------- Gallery ---------------- */
  var mainMedia = document.getElementById("galleryMain");
  var thumbs = Array.prototype.slice.call(document.querySelectorAll(".thumb"));

  thumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      thumbs.forEach(function (other) {
        other.setAttribute("aria-pressed", other === thumb ? "true" : "false");
      });
      mainMedia.classList.add("is-swapping");
      SW.setMedia(
        mainMedia,
        thumb.getAttribute("data-src"),
        thumb.getAttribute("data-alt"),
        thumb.getAttribute("data-ph")
      );
      window.setTimeout(function () {
        mainMedia.classList.remove("is-swapping");
      }, 160);
    });
  });

  /* ---------------- Events ---------------- */
  sizeRadios.forEach(function (input) {
    input.addEventListener("change", update);
  });

  refillInput.addEventListener("change", update);

  minus.addEventListener("click", function () {
    setQty(currentQty() - 1);
  });

  plus.addEventListener("click", function () {
    setQty(currentQty() + 1);
  });

  qtyInput.addEventListener("change", function () {
    setQty(currentQty());
  });

  qtyInput.addEventListener("blur", function () {
    setQty(currentQty());
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var qty = currentQty();
    var size = SW.SIZES[selectedSize()];
    var refill = refillInput.checked;
    var unit = unitPrice();

    SW.addToCart({ sizeId: size.id, refill: refill, qty: qty });

    SW.toast({
      title: "Added to cart",
      text:
        size.label +
        (refill ? " + refill rings" : "") +
        " × " +
        qty +
        " · " +
        SW.money(unit * qty),
      linkHref: "cart.html",
      linkText: "View cart →"
    });

    addButton.focus({ preventScroll: true });
  });

  update();

  /* Scroll to the refill option when linked directly */
  if (window.location.hash === "#refill") {
    window.setTimeout(function () {
      refillLabel.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }
})();
