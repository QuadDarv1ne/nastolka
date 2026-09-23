// E2E-тест мультиплеера: проверяет синхронизацию состояний на уровне сервера.
// Запуск: bun scripts/test-multiplayer.mjs (или node, если socket.io-client установлен)
//
// Сценарии:
//   1. A создаёт комнату → B присоединяется (peer-joined у A)
//   2. A отправляет state-update → B получает его
//   3. Эхо: ретрансляция «не себе» — B не получает собственный пакет
//   4. C присоединяется → request-state → A отвечает send-state-to
//   5. D присоединяется, E отклоняется (лимит комнаты 4)
//
// Переменные: MP_URL (по умолчанию http://localhost:3003),
//             MP_PATH (по умолчанию /mp, должен совпадать с мини-сервисом)
import { io } from "socket.io-client";

const URL = process.env.MP_URL || "http://localhost:3003";
const PATH = process.env.MP_PATH || "/mp";
const OPTS = { path: PATH, transports: ["polling", "websocket"], reconnection: false, timeout: 8000, forceNew: true };

console.log(`[test] target ${URL}${PATH}`);

const sockets = [];
const client = (name) => {
  const s = io(URL, OPTS);
  s._name = name;
  sockets.push(s);
  return s;
};
const A = client("A");
const B = client("B");
const C = client("C");
const D = client("D");
const E = client("E");

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const fail = (name, msg) => {
  console.error("FAIL:", name, "—", msg || "(без деталей)");
  sockets.forEach((s) => { try { s.disconnect(); } catch {} });
  process.exit(1);
};
const finish = () => {
  console.log(`\nOK: ${passed} проверок пройдено`);
  sockets.forEach((s) => { try { s.disconnect(); } catch {} });
  process.exit(0);
};

const overallTimer = setTimeout(() => fail("таймаут теста", "не все шаги выполнились за 15 сек"), 15000);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Промисифицированный однократный слушатель
const once = (socket, event, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`таймаут ожидания "${event}" от ${socket._name}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

for (const s of sockets) {
  s.on("connect_error", (e) => fail("connect_error", `${s._name}: ${e.message}`));
  // room-error обрабатывается явно на шаге 5 (лимит комнаты) — здесь не fail
}

/* ─── Шаг 1: создание комнаты и присоединение B ─── */
A.on("connect", () => A.emit("create-room", {}));
const { code } = await once(A, "room-created");
if (!code || code.length !== 4) fail("create-room", `код комнаты некорректен: ${code}`);
ok(`комната создана, код ${code}`);

const peerJoinedP = once(A, "peer-joined");
B.emit("join-room", { code });
const joinedB = await once(B, "room-joined");
if (joinedB.members !== 2) fail("room-joined", `ожидалось members=2, получено ${joinedB.members}`);
ok("B присоединился, members=2");
const peerJoined = await peerJoinedP;
if (peerJoined.members !== 2) fail("peer-joined", `ожидалось members=2, получено ${peerJoined.members}`);
ok("A получил peer-joined (members=2)");

/* ─── Шаг 2: ретрансляция state-update A → B ─── */
const stateP = once(B, "state-update");
A.emit("state-update", { state: { phase: "playing", tick: 1 } });
const received = await stateP;
if (received?.state?.tick !== 1) fail("state-update", `B получил: ${JSON.stringify(received)}`);
ok("B получил состояние A (tick=1)");

/* ─── Шаг 3: эхо — ретрансляция «не себе» ─── */
let echoReceived = false;
B.on("state-update", (p) => { if (p?.state?.tick === 2) echoReceived = true; });
B.emit("state-update", { state: { phase: "playing", tick: 2 } });
await wait(400);
if (echoReceived) fail("эхо-защита", "B получил обратно собственный state-update");
ok("эхо-защита: свой пакет не возвращается отправителю");

/* ─── Шаг 4: C входит → request-state → A отвечает send-state-to ─── */
const cJoinedP = once(C, "room-joined");
const aRequestedP = once(A, "state-requested");
const cStateP = once(C, "state-update");
C.emit("join-room", { code });
const cJoined = await cJoinedP;
if (cJoined.members !== 3) fail("room-joined C", `ожидалось members=3, получено ${cJoined.members}`);
ok("C присоединился, members=3");

C.emit("request-state", {});
const requested = await aRequestedP;
ok(`A получил state-requested от C (${requested.from.slice(0, 6)}…)`);
A.emit("send-state-to", { to: requested.from, state: { phase: "playing", tick: 5 } });

const cReceived = await cStateP;
if (cReceived?.state?.tick !== 5) fail("send-state-to", `C получил: ${JSON.stringify(cReceived)}`);
ok("C получил состояние через request-state/send-state-to");

/* ─── Шаг 5: лимит комнаты 4 — E отклоняется ─── */
D.emit("join-room", { code });
await once(D, "room-joined");
ok("D присоединился, members=4");

const roomErrorP = once(E, "room-error");
E.emit("join-room", { code });
const err = await roomErrorP;
if (!err?.message?.includes("заполнен")) fail("лимит комнаты", `неожиданная ошибка: ${err?.message}`);
ok("пятый участник отклонён (лимит комнаты 4)");

clearTimeout(overallTimer);
finish();
