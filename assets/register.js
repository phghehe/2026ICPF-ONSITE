(function () {
  var C = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  // 행사명, 데모 배너
  document.querySelectorAll("[data-event-en]").forEach(function (el) { if (C.EVENT_NAME_EN) el.textContent = C.EVENT_NAME_EN; });
  document.querySelectorAll("[data-event-ko]").forEach(function (el) { if (C.EVENT_NAME_KO) el.textContent = C.EVENT_NAME_KO; });
  if (window.Api.demo) $("demoBanner").hidden = false;

  /* ---------------- 국적 자동완성 ---------------- */
  var input = $("country"), list = $("countryList"), picked = $("countryPicked");
  var selected = null;        // { ko, en, custom }
  var items = [], active = -1;

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFC").replace(/[\s.\-'’(),·]/g, "");
  }
  var INDEX = window.COUNTRIES.map(function (c, i) {
    var aliases = (c[2] || "").split(",").map(norm).filter(Boolean);
    return { ko: c[0], en: c[1], i: i, nk: norm(c[0]), ne: norm(c[1]), al: aliases };
  });

  function search(q) {
    var nq = norm(q);
    if (!nq) return [];
    var out = [];
    INDEX.forEach(function (c) {
      var s = 99;
      var names = [c.nk, c.ne].concat(c.al);
      if (names.indexOf(nq) >= 0) s = 0;
      else if (c.nk.indexOf(nq) === 0 || c.ne.indexOf(nq) === 0) s = 1;
      else if (c.al.some(function (a) { return a.indexOf(nq) === 0; })) s = 2;
      else if (c.nk.indexOf(nq) > 0 || c.ne.indexOf(nq) > 0) s = 3;
      else if (nq.length >= 2 && c.al.some(function (a) { return a.indexOf(nq) > 0; })) s = 4;
      if (s < 99) out.push({ c: c, s: s });
    });
    out.sort(function (a, b) { return a.s - b.s || a.c.i - b.c.i; });
    return out.slice(0, 8).map(function (x) { return x.c; });
  }
  function exactMatch(q) {
    var nq = norm(q);
    if (!nq) return null;
    return INDEX.filter(function (c) { return c.nk === nq || c.ne === nq || c.al.indexOf(nq) >= 0; })[0] || null;
  }

  function render() {
    var q = input.value.trim();
    var res = search(q);
    items = res.map(function (c) { return { ko: c.ko, en: c.en }; });
    if (q.length >= 2 && !exactMatch(q)) items.push({ ko: q, en: q, custom: true });
    list.innerHTML = "";
    items.forEach(function (it, i) {
      var li = document.createElement("li");
      li.className = "ac-item" + (it.custom ? " free" : "");
      li.setAttribute("role", "option");
      li.dataset.i = i;
      if (it.custom) {
        li.innerHTML = '<span class="k"></span><span class="e">입력한 대로 사용 · Use as typed</span>';
        li.querySelector(".k").textContent = "“" + it.ko + "”";
      } else {
        li.innerHTML = '<span class="k"></span><span class="e"></span>';
        li.querySelector(".k").textContent = it.ko;
        li.querySelector(".e").textContent = it.en;
      }
      list.appendChild(li);
    });
    active = items.length ? 0 : -1;
    highlight();
    var open = items.length > 0 && q.length > 0;
    list.classList.toggle("open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function highlight() {
    Array.prototype.forEach.call(list.children, function (li, i) { li.classList.toggle("active", i === active); });
  }
  function close() { list.classList.remove("open"); input.setAttribute("aria-expanded", "false"); }
  function choose(it) {
    selected = it;
    input.value = it.custom ? it.ko : it.ko + " · " + it.en;
    picked.textContent = "✓ " + (it.custom ? it.ko : it.ko + " / " + it.en);
    picked.classList.add("show");
    input.classList.remove("invalid");
    $("err-country").classList.remove("show");
    close();
  }
  function clearPick() { selected = null; picked.classList.remove("show"); }

  input.addEventListener("input", function () { clearPick(); render(); });
  input.addEventListener("focus", function () { if (!selected && input.value) render(); });
  input.addEventListener("keydown", function (e) {
    if (!list.classList.contains("open")) return;
    if (e.key === "ArrowDown") { active = Math.min(items.length - 1, active + 1); highlight(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); highlight(); e.preventDefault(); }
    else if (e.key === "Enter") { if (active >= 0) { choose(items[active]); e.preventDefault(); } }
    else if (e.key === "Escape") close();
  });
  // 모바일에서 목록을 누를 때 입력칸 blur보다 먼저 처리
  list.addEventListener("mousedown", function (e) { e.preventDefault(); });
  list.addEventListener("click", function (e) {
    var li = e.target.closest(".ac-item");
    if (li) choose(items[+li.dataset.i]);
  });
  input.addEventListener("blur", function () {
    setTimeout(function () {
      if (!selected) {
        var m = exactMatch(input.value);
        if (m) choose({ ko: m.ko, en: m.en });
      }
      close();
    }, 150);
  });

  /* ---------------- 동의 체크 ---------------- */
  var agree = $("agree"), btn = $("submitBtn"), alertBox = $("formAlert");
  function syncBtn() { btn.classList.toggle("muted", !agree.checked); if (agree.checked) hideAlert(); }
  agree.addEventListener("change", syncBtn);
  function showAlert(msg) { alertBox.innerHTML = msg; alertBox.classList.add("show"); }
  function hideAlert() { alertBox.classList.remove("show"); }

  /* ---------------- 검증 ---------------- */
  var HANGUL = /^[ㄱ-힝\s]+$/;
  function displayName(last, first) {
    if (HANGUL.test(last + first)) return (last + first).replace(/\s+/g, "");
    return last + ", " + first;
  }
  function contactType(v) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "email";
    var digits = v.replace(/\D/g, "");
    if (/^[+()\d\s\-.]+$/.test(v) && digits.length >= 8 && digits.length <= 15) return "phone";
    return "";
  }
  function setErr(id, inputs, bad) {
    $(id).classList.toggle("show", bad);
    inputs.forEach(function (el) { el.classList.toggle("invalid", bad); });
    return bad;
  }

  $("regForm").addEventListener("submit", function (e) {
    e.preventDefault();
    hideAlert();
    var last = $("lastName").value.trim(), first = $("firstName").value.trim();
    var aff = $("affiliation").value.trim(), title = $("title").value.trim();
    var contact = "", ctype = "";


    if (!selected) { var m = exactMatch(input.value); if (m) choose({ ko: m.ko, en: m.en }); }

    var bad = false, firstBad = null;
    function check(cond, id, els) { var b = setErr(id, els, cond); if (b && !firstBad) firstBad = els[0]; bad = bad || b; }
    var nameBad = !last || !first;
    $("err-name").classList.toggle("show", nameBad);
    $("lastName").classList.toggle("invalid", !last);
    $("firstName").classList.toggle("invalid", !first);
    if (nameBad) { bad = true; firstBad = !last ? $("lastName") : $("firstName"); }
    check(!selected, "err-country", [input]);
    check(!aff, "err-affiliation", [$("affiliation")]);

    if (bad) {
      showAlert("입력하지 않았거나 확인이 필요한 항목이 있습니다.<br>Please check the highlighted fields.");
      if (firstBad) firstBad.focus();
      return;
    }
    if (!agree.checked) {
      showAlert("개인정보 처리방침에 동의하셔야 등록 가능합니다.<br>You must agree to the privacy policy to register.");
      agree.focus();
      return;
    }

    var data = {
      lastName: last, firstName: first, displayName: displayName(last, first),
      countryKo: selected.ko, countryEn: selected.custom ? selected.ko : selected.en,
      affiliation: aff, title: title,
      contact: contact, contactType: ctype,
      consent: true, website: e.target.website.value
    };

    btn.disabled = true;
    btn.textContent = "등록 중… Registering…";
    window.Api.call("register", { data: data }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.message) || "error");
      $("doneNum").textContent = res.id;
      $("doneName").textContent = res.displayName || data.displayName;
      $("formView").hidden = true;
      $("doneView").hidden = false;
      window.scrollTo(0, 0);
    }).catch(function (err) {
      showAlert("등록 중 문제가 발생했습니다. 잠시 후 다시 시도하시거나 등록 데스크에 문의해 주세요.<br>" +
                "Something went wrong. Please try again or ask at the registration desk." +
                (err && err.message && err.message !== "error" ? "<br><small>(" + String(err.message).replace(/[<>&]/g, "") + ")</small>" : ""));
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "등록하기 · Register";
    });
  });

  // 새로 등록하기 (한 기기를 여러 사람이 쓰는 경우)
  $("againBtn").addEventListener("click", function () {
    $("regForm").reset();
    clearPick(); syncBtn(); hideAlert();
    document.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
    document.querySelectorAll(".err.show").forEach(function (el) { el.classList.remove("show"); });
    $("doneView").hidden = true;
    $("formView").hidden = false;
    window.scrollTo(0, 0);
  });
})();
