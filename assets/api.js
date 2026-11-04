/* 서버(Google Apps Script)와 통신하는 부분입니다.
 * CONFIG.API_URL이 비어 있으면 브라우저 안에서만 동작하는 데모 모드로 실행됩니다.
 */
(function () {
  var url = (window.CONFIG && window.CONFIG.API_URL || "").trim();
  var DEMO = !/^https:\/\/script\.google(usercontent)?\.com\//.test(url);

  function post(action, payload) {
    var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
    // text/plain으로 보내야 브라우저의 사전 요청(CORS preflight) 없이 Apps Script로 전달됩니다.
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow"
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* ---------------- 데모 모드 (localStorage) ---------------- */
  var DEMO_KEY = "icpf_onsite_demo_db";
  var DEMO_ADMIN_KEY = "demo";
  function load() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || { seq: 0, rows: [] }; }
    catch (e) { return { seq: 0, rows: [] }; }
  }
  function save(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} }
  function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 250); }); }

  function demo(action, p) {
    var db = load();
    if (action === "register") {
      var d = p.data || {};
      var dup = db.rows.filter(function (r) {
        return r.lastName === d.lastName && r.firstName === d.firstName && r.contact === d.contact;
      })[0];
      if (dup) return wait({ ok: true, duplicate: true, id: dup.id, displayName: dup.displayName });
      db.seq += 1;
      var row = Object.assign({}, d, {
        id: "W-" + String(db.seq).padStart(4, "0"),
        no: db.seq,
        time: new Date().toISOString(),
        badge: { done: false, at: "", by: "" },
        gift: { done: false, at: "", by: "" }
      });
      db.rows.push(row); save(db);
      return wait({ ok: true, id: row.id, displayName: row.displayName });
    }
    if (p.key !== DEMO_ADMIN_KEY) return wait({ ok: false, error: "auth", message: "관리자 비밀번호가 올바르지 않습니다. (데모 비밀번호: demo)" });
    if (action === "auth") return wait({ ok: true, sheetUrl: "" });
    if (action === "list") return wait({ ok: true, rows: db.rows, serverTime: new Date().toISOString() });
    if (action === "mark") {
      var r = db.rows.filter(function (x) { return x.id === p.id; })[0];
      if (!r) return wait({ ok: false, error: "notfound", message: "등록 번호를 찾을 수 없습니다." });
      var item = r[p.item];
      if (!p.undo && item.done) return wait({ ok: false, error: "already", message: "이미 지급 처리되었습니다.", row: r });
      r[p.item] = p.undo ? { done: false, at: "", by: "" } : { done: true, at: new Date().toISOString(), by: p.staff || "" };
      save(db);
      return wait({ ok: true, row: r });
    }
    return wait({ ok: false, error: "action", message: "알 수 없는 요청입니다." });
  }

  window.Api = {
    demo: DEMO,
    call: function (action, payload) {
      if (DEMO) return demo(action, payload || {});
      return post(action, payload);
    },
    resetDemo: function () { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} }
  };
})();
