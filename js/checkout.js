/* =========================================================
   Snufflewind — checkout
   Inline validation, order creation, demo payment
   ========================================================= */
(function () {
  "use strict";

  if (!window.SW) return;

  var SW = window.SW;
  var form = document.getElementById("checkoutForm");
  if (!form) return;

  var cart = SW.getCart();
  if (!cart.length) {
    window.location.replace("cart.html");
    return;
  }

  var summaryItems = document.getElementById("summaryItems");
  var summarySubtotal = document.getElementById("summarySubtotal");
  var summaryShipping = document.getElementById("summaryShipping");
  var summaryTotal = document.getElementById("summaryTotal");
  var placeOrderTotal = document.getElementById("placeOrderTotal");
  var placeOrderBtn = document.getElementById("placeOrder");
  var errorSummary = document.getElementById("formErrors");
  var errorSummaryText = document.getElementById("formErrorsText");
  var fillDemo = document.getElementById("fillDemo");
  var submitting = false;

  /* ---------------- Validators ---------------- */
  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function luhnValid(digits) {
    var sum = 0;
    var alternate = false;
    for (var i = digits.length - 1; i >= 0; i -= 1) {
      var n = parseInt(digits.charAt(i), 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }

  function validateName(value) {
    var v = String(value || "").trim();
    if (v.length < 2 || !/[A-Za-z\u00C0-\u024F]/.test(v)) {
      return "Please enter your full name.";
    }
    return "";
  }

  function validateEmail(value) {
    var v = String(value || "").trim();
    if (!v) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) {
      return "Enter an email like name@example.com.";
    }
    return "";
  }

  function validatePhone(value) {
    var digits = digitsOnly(value);
    if (!digits) return "Please enter a phone number.";
    if (digits.length < 7 || digits.length > 15) {
      return "Enter a phone number with 7 to 15 digits.";
    }
    return "";
  }

  function validateAddress(value) {
    if (String(value || "").trim().length < 4) {
      return "Please enter your street address.";
    }
    return "";
  }

  function validateCity(value) {
    if (String(value || "").trim().length < 2) {
      return "Please enter your city or town.";
    }
    return "";
  }

  function validatePostal(value) {
    var v = String(value || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(v)) {
      return "Please enter a valid postal or ZIP code.";
    }
    return "";
  }

  function validateCountry(value) {
    return String(value || "").trim() ? "" : "Please choose a country.";
  }

  function validateCardName(value) {
    return validateName(value) ? "Please enter the name on the card." : "";
  }

  function validateCardNumber(value) {
    var digits = digitsOnly(value);
    if (digits.length < 13 || digits.length > 19) {
      return "Enter a card number with 13 to 19 digits.";
    }
    if (!luhnValid(digits)) {
      return "That card number does not look right. Try 4242 4242 4242 4242.";
    }
    return "";
  }

  function validateExpiry(value) {
    var match = String(value || "").trim().match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
    if (!match) return "Enter the expiry date as MM/YY.";
    var month = parseInt(match[1], 10);
    var year = 2000 + parseInt(match[2], 10);
    if (month < 1 || month > 12) return "That month does not exist. Use MM/YY.";
    var expiryEnd = new Date(year, month, 1);
    var now = new Date();
    if (expiryEnd <= now) return "That card has expired.";
    if (expiryEnd > new Date(now.getFullYear() + 15, now.getMonth(), 1)) {
      return "Please check the expiry year.";
    }
    return "";
  }

  function validateCvc(value) {
    var digits = digitsOnly(value);
    if (!/^\d{3,4}$/.test(digits)) {
      return "Enter the 3-digit security code.";
    }
    return "";
  }

  var FIELDS = {
    fullName: { el: document.getElementById("fullName"), validate: validateName },
    email: { el: document.getElementById("email"), validate: validateEmail },
    phone: { el: document.getElementById("phone"), validate: validatePhone },
    address1: { el: document.getElementById("address1"), validate: validateAddress },
    address2: { el: document.getElementById("address2"), validate: function () { return ""; } },
    city: { el: document.getElementById("city"), validate: validateCity },
    postal: { el: document.getElementById("postal"), validate: validatePostal },
    country: { el: document.getElementById("country"), validate: validateCountry },
    cardName: { el: document.getElementById("cardName"), validate: validateCardName },
    cardNumber: { el: document.getElementById("cardNumber"), validate: validateCardNumber },
    expiry: { el: document.getElementById("expiry"), validate: validateExpiry },
    cvc: { el: document.getElementById("cvc"), validate: validateCvc }
  };

  /* ---------------- Error display ---------------- */
  function setError(name, message) {
    var field = FIELDS[name];
    if (!field || !field.el) return;
    var wrap = field.el.closest(".field");
    var error = document.getElementById("err-" + name);
    if (!wrap) return;
    if (message) {
      wrap.classList.add("has-error");
      field.el.setAttribute("aria-invalid", "true");
      if (error) error.textContent = message;
    } else {
      wrap.classList.remove("has-error");
      field.el.removeAttribute("aria-invalid");
      if (error) error.textContent = "";
    }
  }

  function validateField(name) {
    var field = FIELDS[name];
    if (!field || !field.el) return "";
    var message = field.validate(field.el.value);
    setError(name, message);
    return message;
  }

  function validateAll() {
    var invalid = [];
    Object.keys(FIELDS).forEach(function (name) {
      if (validateField(name)) invalid.push(name);
    });
    return invalid;
  }

  /* ---------------- Input formatting ---------------- */
  var cardNumber = FIELDS.cardNumber.el;
  var expiry = FIELDS.expiry.el;
  var cvc = FIELDS.cvc.el;

  cardNumber.addEventListener("input", function () {
    var start = cardNumber.selectionStart;
    var digitsBefore = cardNumber.value
      .slice(0, start == null ? cardNumber.value.length : start)
      .replace(/\D/g, "").length;
    var digits = cardNumber.value.replace(/\D/g, "").slice(0, 19);
    var formatted = digits.replace(/(.{4})/g, "$1 ").trim();
    cardNumber.value = formatted;

    var pos = 0;
    var seen = 0;
    while (pos < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted.charAt(pos))) seen += 1;
      pos += 1;
    }
    try {
      cardNumber.setSelectionRange(pos, pos);
    } catch (err) {
      /* ignore browsers that do not support selection */
    }
  });

  expiry.addEventListener("input", function () {
    var digits = expiry.value.replace(/\D/g, "").slice(0, 4);
    expiry.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });

  cvc.addEventListener("input", function () {
    cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4);
  });

  /* ---------------- Live validation ---------------- */
  Object.keys(FIELDS).forEach(function (name) {
    var field = FIELDS[name];
    if (!field.el) return;
    field.el.addEventListener("blur", function () {
      if (field.el.value.trim() || field.el.closest(".field").classList.contains("has-error")) {
        validateField(name);
      }
    });
    field.el.addEventListener("input", function () {
      if (field.el.closest(".field").classList.contains("has-error")) {
        validateField(name);
      }
    });
    field.el.addEventListener("change", function () {
      if (field.el.closest(".field").classList.contains("has-error")) {
        validateField(name);
      }
    });
  });

  /* ---------------- Summary ---------------- */
  function renderSummary() {
    cart = SW.getCart();
    if (!cart.length) {
      window.location.replace("cart.html");
      return;
    }

    summaryItems.innerHTML = cart
      .map(function (line) {
        var meta = "Qty " + line.qty + " · " + SW.SIZES[line.sizeId].weight + " dogs" +
          (line.refill ? " · Refill rings" : "");
        return (
          '<div class="summary__item">' +
            '<div class="media summary__thumb" data-ph="tower">' +
              '<img class="media__img" src="images/product-small.png" width="120" height="120" alt="" loading="lazy">' +
            "</div>" +
            "<div>" +
              '<p class="summary__name">' + SW.lineTitle(line) + "</p>" +
              '<p class="summary__meta">' + meta + "</p>" +
            "</div>" +
            '<span class="summary__price">' + SW.money(line.unitPrice * line.qty) + "</span>" +
          "</div>"
        );
      })
      .join("");

    SW.paintPlaceholders();

    var subtotal = SW.cartSubtotal();
    var shipping = SW.shippingFor(subtotal);
    var total = subtotal + shipping;

    summarySubtotal.textContent = SW.money(subtotal);
    summaryShipping.textContent = shipping === 0 ? "Free" : SW.money(shipping);
    summaryTotal.textContent = SW.money(total);
    placeOrderTotal.textContent = SW.money(total);
  }

  renderSummary();

  window.addEventListener("storage", function (event) {
    if (event.key === SW.CART_KEY) renderSummary();
  });

  /* ---------------- Demo card ---------------- */
  fillDemo.addEventListener("click", function () {
    var now = new Date();
    var year = String((now.getFullYear() + 2) % 100).padStart(2, "0");

    cardNumber.value = "4242 4242 4242 4242";
    expiry.value = "12/" + year;
    cvc.value = "123";
    if (!FIELDS.cardName.el.value.trim()) {
      FIELDS.cardName.el.value = FIELDS.fullName.el.value.trim() || "Alex Morgan";
    }

    ["cardName", "cardNumber", "expiry", "cvc"].forEach(function (name) {
      setError(name, "");
    });

    SW.toast({
      title: "Demo card filled",
      text: "Nothing will be charged. Place the order to finish."
    });
    placeOrderBtn.focus({ preventScroll: true });
  });

  /* ---------------- Submit ---------------- */
  function makeOrderNumber() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var chars = [];
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i += 1) {
        chars.push(alphabet.charAt(bytes[i] % alphabet.length));
      }
    } else {
      for (var j = 0; j < 6; j += 1) {
        chars.push(alphabet.charAt(Math.floor(Math.random() * alphabet.length)));
      }
    }
    return "SW-" + chars.join("");
  }

  function cardBrand(digits) {
    if (/^4/.test(digits)) return "Visa";
    if (/^5[1-5]/.test(digits)) return "Mastercard";
    if (/^3[47]/.test(digits)) return "Amex";
    if (/^6/.test(digits)) return "Discover";
    return "Card";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitting) return;

    var invalid = validateAll();

    if (invalid.length) {
      errorSummary.classList.add("is-visible");
      errorSummaryText.textContent =
        "Please check " + invalid.length + (invalid.length === 1 ? " field" : " fields") + " below.";
      var first = FIELDS[invalid[0]].el;
      first.focus({ preventScroll: false });
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    errorSummary.classList.remove("is-visible");

    var currentCart = SW.getCart();
    if (!currentCart.length) {
      window.location.href = "cart.html";
      return;
    }

    submitting = true;
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Placing order…";

    var subtotal = SW.cartSubtotal();
    var shipping = SW.shippingFor(subtotal);
    var cardDigits = digitsOnly(cardNumber.value);

    var order = {
      id: makeOrderNumber(),
      createdAt: new Date().toISOString(),
      items: currentCart.map(function (line) {
        return {
          key: line.key,
          sizeId: line.sizeId,
          sizeLabel: line.sizeLabel,
          refill: line.refill,
          unitPrice: line.unitPrice,
          qty: line.qty,
          title: SW.lineTitle(line),
          meta: SW.SIZES[line.sizeId].weight + " dogs" + (line.refill ? " · Refill ring set" : "")
        };
      }),
      subtotal: subtotal,
      shipping: shipping,
      total: subtotal + shipping,
      customer: {
        fullName: FIELDS.fullName.el.value.trim(),
        email: FIELDS.email.el.value.trim(),
        phone: FIELDS.phone.el.value.trim()
      },
      address: {
        line1: FIELDS.address1.el.value.trim(),
        line2: FIELDS.address2.el.value.trim(),
        city: FIELDS.city.el.value.trim(),
        postal: FIELDS.postal.el.value.trim(),
        country: FIELDS.country.el.value
      },
      payment: {
        brand: cardBrand(cardDigits),
        last4: cardDigits.slice(-4)
      }
    };

    SW.write(SW.ORDER_KEY, order);

    var history = SW.read(SW.ORDERS_KEY, []);
    if (!Array.isArray(history)) history = [];
    history.unshift(order);
    SW.write(SW.ORDERS_KEY, history.slice(0, 20));

    SW.saveCart([]);

    window.setTimeout(function () {
      window.location.href = "confirmation.html";
    }, 220);
  });
})();
