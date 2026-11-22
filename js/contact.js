/* =========================================================
   Snufflewind — contact form
   ========================================================= */
(function () {
  "use strict";

  if (!window.SW) return;

  var SW = window.SW;
  var form = document.getElementById("contactForm");
  if (!form) return;

  var card = document.getElementById("contactFormCard");
  var success = document.getElementById("contactSuccess");
  var successName = document.getElementById("successName");
  var successRef = document.getElementById("successRef");
  var errorSummary = document.getElementById("contactErrors");
  var errorSummaryText = document.getElementById("contactErrorsText");
  var sendAnother = document.getElementById("sendAnother");

  function validateName(value) {
    var v = String(value || "").trim();
    if (v.length < 2 || !/[A-Za-z\u00C0-\u024F]/.test(v)) {
      return "Please tell us your name.";
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

  function validateTopic(value) {
    return String(value || "").trim() ? "" : "Please choose a topic.";
  }

  function validateOrder(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{3,}$/.test(v)) {
      return "Order numbers look like SW-ABC123.";
    }
    return "";
  }

  function validateMessage(value) {
    var v = String(value || "").trim();
    if (v.length < 10) return "Please write at least a sentence (10 characters).";
    return "";
  }

  var FIELDS = {
    name: { el: document.getElementById("name"), validate: validateName },
    email: { el: document.getElementById("email"), validate: validateEmail },
    topic: { el: document.getElementById("topic"), validate: validateTopic },
    order: { el: document.getElementById("order"), validate: validateOrder },
    message: { el: document.getElementById("message"), validate: validateMessage }
  };

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

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var invalid = [];
    Object.keys(FIELDS).forEach(function (name) {
      if (validateField(name)) invalid.push(name);
    });

    if (invalid.length) {
      errorSummary.classList.add("is-visible");
      errorSummaryText.textContent =
        "Please check " + invalid.length + (invalid.length === 1 ? " field" : " fields") + " below.";
      var first = FIELDS[invalid[0]].el;
      first.focus();
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    errorSummary.classList.remove("is-visible");

    var reference =
      "MSG-" +
      String(Date.now()).slice(-4) +
      String(Math.floor(Math.random() * 90) + 10);

    var messages = SW.read(SW.MESSAGES_KEY, []);
    if (!Array.isArray(messages)) messages = [];
    messages.unshift({
      ref: reference,
      createdAt: new Date().toISOString(),
      name: FIELDS.name.el.value.trim(),
      email: FIELDS.email.el.value.trim(),
      topic: FIELDS.topic.el.value,
      order: FIELDS.order.el.value.trim(),
      message: FIELDS.message.el.value.trim()
    });
    SW.write(SW.MESSAGES_KEY, messages.slice(0, 20));

    successName.textContent = FIELDS.name.el.value.trim().split(/\s+/)[0] || "friend";
    successRef.textContent = "Reference " + reference;

    card.hidden = true;
    success.classList.add("is-visible");
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: "smooth", block: "center" });

    SW.toast({
      title: "Message sent",
      text: "We will reply within one working day."
    });
  });

  sendAnother.addEventListener("click", function () {
    success.classList.remove("is-visible");
    card.hidden = false;
    form.reset();
    Object.keys(FIELDS).forEach(function (name) {
      setError(name, "");
    });
    errorSummary.classList.remove("is-visible");
    FIELDS.name.el.focus();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
