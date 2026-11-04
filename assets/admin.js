(function () {
  var C = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var REFRESH = Math.max(5, +C.ADMIN_REFRESH_SECONDS || 10) * 1000;

  document.querySelectorAll("[data-event-en]").forEach(function (el) { if (C.EVENT_NAME_EN) el.textContent = C.EVENT_NAME_EN; });
  document.querySelectorAll("[data-event-ko]").forEach(function (el) { if (C.EVENT_NAME_KO) el.textContent = C.EVENT_NAME_KO; });
  if (window.Api.demo) $("demoBanner").hidden = false;

  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d)) return String(iso);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  var toastTimer;
  function toast(msg, bad) {
    var t = $("toast"); t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = "toast"; }, 3200);
  }

  /* ---------------- 상태 ---------------- */
  var state = {
    key: ss("icpf_admin_key") || "",
    staff: ls("icpf_staff_name") || "",
    rows: [], seen: null, filter: "all", q: "",
    loading: false, pending: {}  // 두 번 눌러 확인 대기 중인 버튼
  };

  var COLS = [
    { k: "no", t: "번호" },
    { k: "time", t: "등록 시간" },
    { k: "name", t: "성명" },
    { k: "country", t: "국적" },
    { k: "affiliation", t: "소속" },
    { k: "title", t: "직함" },
    { k: "contact", t: "연락처" },
    { k: "badge", t: "이름표" },
    { k: "gift", t: "기념품" }
  ];
  var SORTS = [
    ["no", "등록 번호"], ["time", "등록 시간"], ["name", "성명"], ["country", "국적"],
    ["affiliation", "소속"], ["title", "직함"], ["contact", "연락처"],
    ["badge", "이름표 지급 여부"], ["gift", "기념품 지급 여부"]
  ];
  function fillSort(sel, withNone) {
    sel.innerHTML = (withNone ? '<option value="">(없음)</option>' : "") +
      SORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + "</option>"; }).join("");
  }
  fillSort($("sort1"), false); fillSort($("sort2"), true);
  $("sort1").value = ls("icpf_sort1") || "no";
  $("dir1").value = ls("icpf_dir1") || "desc";
  $("sort2").value = ls("icpf_sort2") || "";
  $("dir2").value = ls("icpf_dir2") || "asc";

  function sortVal(r, k) {
    switch (k) {
      case "no": return r.no;
      case "time": return r.time || "";
      case "name": return r.displayName || "";
      case "country": return r.countryKo || "";
      case "badge": return r.badge && r.badge.done ? "1" + (r.badge.at || "") : "0";
      case "gift": return r.gift && r.gift.done ? "1" + (r.gift.at || "") : "0";
      default: return r[k] || "";
    }
  }
  function cmp(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "ko", { numeric: true, sensitivity: "base" });
  }

  /* ---------------- 그리기 ---------------- */
  function renderHead() {
    var k1 = $("sort1").value, d1 = $("dir1").value;
    $("thead").innerHTML = COLS.map(function (c) {
      var arrow = c.k === k1 ? '<span class="arrow">' + (d1 === "asc" ? "↑" : "↓") + "</span>" : "";
      return '<th data-k="' + c.k + '">' + c.t + arrow + "</th>";
    }).join("");
  }

  function giveCell(r, item) {
    var it = r[item] || {};
    var label = item === "badge" ? "이름표" : "기념품";
    if (it.done) {
      return '<button class="give done" disabled>✓ 지급 완료</button>' +
        '<span class="give-meta">' + esc(fmt(it.at)) + (it.by ? " · " + esc(it.by) : "") +
        '<button class="undo" data-undo="' + item + '" data-id="' + esc(r.id) + '">취소</button></span>';
    }
    var pend = state.pending[r.id + "|" + item];
    return '<button class="give' + (pend ? " confirm" : "") + '" data-give="' + item + '" data-id="' + esc(r.id) + '">' +
      (pend ? "한 번 더 눌러 확인" : label + " 지급") + "</button>";
  }

  function render() {
    renderHead();
    var rows = state.rows.slice();
    var total = rows.length;
    var nb = rows.filter(function (r) { return r.badge && r.badge.done; }).length;
    var ng = rows.filter(function (r) { return r.gift && r.gift.done; }).length;
    $("stTotal").textContent = total;
    $("stBadge").innerHTML = nb + " <small>/ " + total + "</small>";
    $("stGift").innerHTML = ng + " <small>/ " + total + "</small>";

    if (state.filter === "badge") rows = rows.filter(function (r) { return !(r.badge && r.badge.done); });
    if (state.filter === "gift") rows = rows.filter(function (r) { return !(r.gift && r.gift.done); });
    var q = state.q.trim().toLowerCase();
    if (q) {
      var qd = q.replace(/\D/g, "");
      rows = rows.filter(function (r) {
        var hay = [r.id, r.displayName, r.lastName, r.firstName, r.countryKo, r.countryEn, r.affiliation, r.title, r.contact].join(" ").toLowerCase();
        if (hay.indexOf(q) >= 0) return true;
        return qd.length >= 4 && String(r.contact || "").replace(/\D/g, "").indexOf(qd) >= 0;
      });
    }
    var k1 = $("sort1").value, d1 = $("dir1").value === "asc" ? 1 : -1;
    var k2 = $("sort2").value, d2 = $("dir2").value === "asc" ? 1 : -1;
    rows.sort(function (a, b) {
      var c = cmp(sortVal(a, k1), sortVal(b, k1)) * d1;
      if (c === 0 && k2) c = cmp(sortVal(a, k2), sortVal(b, k2)) * d2;
      if (c === 0) c = (a.no - b.no);
      return c;
    });

    var fresh = {};
    if (state.seen) state.rows.forEach(function (r) { if (!state.seen[r.id]) fresh[r.id] = true; });
    state.seen = {}; state.rows.forEach(function (r) { state.seen[r.id] = true; });

    $("tbody").innerHTML = rows.map(function (r) {
      return '<tr class="' + (fresh[r.id] ? "flash" : "") + '">' +
        '<td class="num" data-label="번호">' + esc(r.id) + "</td>" +
        '<td class="time" data-label="등록">' + esc(fmt(r.time)) + "</td>" +
        '<td class="nm" data-label="성명">' + esc(r.displayName) + "</td>" +
        '<td data-label="국적">' + esc(r.countryKo) + (r.countryEn && r.countryEn !== r.countryKo ? '<span class="give-meta">' + esc(r.countryEn) + "</span>" : "") + "</td>" +
        '<td data-label="소속">' + esc(r.affiliation) + "</td>" +
        '<td data-label="직함">' + esc(r.title) + "</td>" +
        '<td data-label="연락처">' + esc(r.contact) + "</td>" +
        '<td class="give-cell">' + giveCell(r, "badge") + "</td>" +
        '<td class="give-cell">' + giveCell(r, "gift") + "</td>" +
        "</tr>";
    }).join("");
    $("empty").hidden = rows.length > 0;
  }

  /* ---------------- 서버 통신 ---------------- */
  function setStatus(ok, text) { $("dot").classList.toggle("off", !ok); $("statusText").textContent = text; }

  function load(force) {
    if (state.loading && !force) return Promise.resolve();
    state.loading = true;
    return window.Api.call("list", { key: state.key }).then(function (res) {
      if (!res.ok) {
        if (res.error === "auth") { logout(); showLoginErr(res.message); return; }
        throw new Error(res.message || "error");
      }
      state.rows = res.rows || [];
      render();
      setStatus(true, "마지막 업데이트 " + new Date().toLocaleTimeString("ko-KR"));
    }).catch(function (e) {
      setStatus(false, "연결 오류 — 잠시 후 다시 시도합니다 (" + e.message + ")");
    }).then(function () { state.loading = false; });
  }

  function mark(id, item, undo) {
    return window.Api.call("mark", { key: state.key, id: id, item: item, undo: !!undo, staff: state.staff }).then(function (res) {
      if (res.row) {
        state.rows = state.rows.map(function (r) { return r.id === res.row.id ? res.row : r; });
      }
      if (!res.ok) {
        if (res.error === "already") {
          var it = res.row && res.row[item] || {};
          toast("이미 지급되었습니다 — " + fmt(it.at) + (it.by ? " · " + it.by : ""), true);
        } else toast(res.message || "처리하지 못했습니다.", true);
      } else {
        var r = res.row || {};
        toast((undo ? "지급 취소: " : "지급 완료: ") + (r.displayName || id) + " · " + (item === "badge" ? "이름표" : "기념품"));
      }
      render();
    }).catch(function (e) { toast("연결 오류로 처리하지 못했습니다. 다시 눌러 주세요.", true); });
  }

  /* ---------------- 이벤트 ---------------- */
  $("tbody").addEventListener("click", function (e) {
    var g = e.target.closest("[data-give]");
    if (g) {
      var key = g.dataset.id + "|" + g.dataset.give;
      if (state.pending[key]) {
        delete state.pending[key];
        g.disabled = true; g.textContent = "처리 중…";
        mark(g.dataset.id, g.dataset.give, false);
      } else {
        state.pending = {}; state.pending[key] = true; render();
        setTimeout(function () { if (state.pending[key]) { delete state.pending[key]; render(); } }, 4000);
      }
      return;
    }
    var u = e.target.closest("[data-undo]");
    if (u) {
      var label = u.dataset.undo === "badge" ? "이름표" : "기념품";
      if (window.confirm(u.dataset.id + " " + label + " 지급을 취소할까요?")) mark(u.dataset.id, u.dataset.undo, true);
    }
  });
  $("thead").addEventListener("click", function (e) {
    var th = e.target.closest("th"); if (!th) return;
    var k = th.dataset.k;
    if ($("sort1").value === k) $("dir1").value = $("dir1").value === "asc" ? "desc" : "asc";
    else { $("sort1").value = k; $("dir1").value = "asc"; }
    saveSort(); render();
  });
  ["sort1", "dir1", "sort2", "dir2"].forEach(function (id) { $(id).addEventListener("change", function () { saveSort(); render(); }); });
  function saveSort() { ["sort1", "dir1", "sort2", "dir2"].forEach(function (id) { ls("icpf_" + id, $(id).value); }); }
  $("q").addEventListener("input", function () { state.q = this.value; render(); });
  document.querySelectorAll("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.filter = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("on", x === b); });
      render();
    });
  });
  $("refreshBtn").addEventListener("click", function () { load(true); });
  $("logoutBtn").addEventListener("click", function () { logout(); });

  var timer = null;
  function startTimer() {
    clearInterval(timer);
    timer = setInterval(function () { if (!document.hidden && $("auto").checked) load(); }, REFRESH);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && state.key) load(); });

  /* ---------------- 로그인 ---------------- */
  function showLoginErr(msg) { var a = $("loginAlert"); a.textContent = msg || "로그인하지 못했습니다."; a.classList.add("show"); }
  function enter(sheetUrl) {
    $("loginView").hidden = true; $("adminView").hidden = false;
    $("who").textContent = state.staff ? "스태프: " + state.staff : "";
    if (sheetUrl) { $("sheetLink").href = sheetUrl; $("sheetLink").hidden = false; }
    load(true); startTimer();
  }
  function logout() {
    ss("icpf_admin_key", null); state.key = ""; clearInterval(timer);
    $("adminView").hidden = true; $("loginView").hidden = false;
  }
  $("staffName").value = state.staff;
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var key = $("adminKey").value, staff = $("staffName").value.trim();
    $("loginBtn").disabled = true; $("loginAlert").classList.remove("show");
    window.Api.call("auth", { key: key }).then(function (res) {
      if (!res.ok) return showLoginErr(res.message);
      state.key = key; state.staff = staff;
      ss("icpf_admin_key", key); ls("icpf_staff_name", staff);
      $("adminKey").value = "";
      enter(res.sheetUrl);
    }).catch(function (err) {
      showLoginErr("서버에 연결하지 못했습니다. config.js의 API_URL을 확인해 주세요. (" + err.message + ")");
    }).then(function () { $("loginBtn").disabled = false; });
  });

  if (state.key) {
    window.Api.call("auth", { key: state.key }).then(function (res) {
      if (res.ok) enter(res.sheetUrl); else logout();
    }).catch(function () { enter(""); });
  }
})();
