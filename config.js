/* ============================================================
 *  설정 파일 — 이 파일만 고치면 됩니다.
 * ============================================================
 *  API_URL : Google Apps Script를 "웹 앱"으로 배포한 뒤 받은 URL
 *            (https://script.google.com/macros/s/..../exec)
 *            비워 두면 "데모 모드"로 동작합니다. 데모 모드는 이 기기의
 *            브라우저에만 임시 저장되며 구글 시트에는 기록되지 않습니다.
 *
 *  ⚠️ 관리자 비밀번호는 여기에 넣지 마세요. (이 파일은 깃허브에 공개됩니다)
 *     비밀번호는 Apps Script의 Code.gs 안에서만 설정합니다.
 * ============================================================ */
window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycby6XnruJYVn49HjEugE6vcWX4gIv4LggJNKqG3opMeXMmyWCaFeg0HzEznzkLQ7BwtYkw/exec",

  // 화면에 표시되는 행사 이름
  EVENT_NAME_EN: "2026 The 10th Jeju International Casino Policy Forum",
  EVENT_NAME_KO: "2026 제10회 제주 국제카지노 정책포럼",

  // 관리자 페이지 자동 새로고침 간격(초). 너무 짧으면 구글 사용량 제한에 걸릴 수 있습니다.
  ADMIN_REFRESH_SECONDS: 10
};
