// E2E-тест мультиплеера: проверяет синхронизацию состояний, присвоение команд
// по deviceId, грейс-период и возврат устройства в комнату.
// Запуск: bun scripts/test-multiplayer.mjs (или node, если socket.io-client установлен)
//
// Сценарии:
//   1. A создаёт комнату → B присоединяется (peer-joined у A)
//      Команды: A → 0, B → 1, C → 2, D → 3 (по порядку входа)
//   2. A отправляет state-update → B получает его
//   3. Эхо: ретрансляция «не себе» — B не получает собственный пакет
//   4. C присоединяется → request-state → A отвечает send-state-to
//   5. D присоединяется, E отклоняется (лимит комнаты 4)
//   6. При полном лобби (4/4) сервер рандомизирует команды (team-reassigned)
//   7. Список лобби: list-lobbies → lobbies-list содержит комнату
//   8. Явный выход участника (leave-room) → peer-left с teamIndex + members-list
//   9. Обрыв связи (disconnect) → устройство остаётся в комнате (грейс-период),
//      members-list показывает connected:false
//  10. Возврат того же deviceId в грейс-периоде → room-joined с reconnected:true
//      и прежней командой
//
// Переменные: MP_URL (по умолчанию http://localhost:3003),
//             MP_PATH (по умолчанию /mp, должен совпадать с мини-сервисом)
import { io } from "socket.io-client";

const URL = process.env.MP_URL || "http://localhost:3003";
const PATH = process.env.MP_PATH || "/mp";
const OPTS = { path: PATH, transports: ["polling", "websocket"], reconnection: false, timeout: 8000, forceNew: true };

console.log(`[test] target ${URL}${PATH}`);

const sockets = [];
/** Профиль с явным стабильным deviceId — сервер привязывает команду к устройству */
const profile = (name, deviceId) => ({
  name,
  deviceType: "desktop",
  os: "Windows",
  browser: "Chrome",
  model: "ПК",
  lang: "ru",
  deviceId,
});
const client = (name, deviceId) => {
  const s = io(URL, OPTS);
  s._name = name;
  s._deviceId = deviceId;
  s._profile = profile(name, deviceId);
  sockets.push(s);
  return s;
};
const A = client("A", "dev-A");
const B = client("B", "dev-B");
const C = client("C", "dev-C");
const D = client("D", "dev-D");
const E = client("E", "dev-E");
const F = client("F", "dev-F"); // отдельный клиент для проверки списка лобби

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

const overallTimer = setTimeout(() => fail("таймаут теста", "не все шаги выполнились за 20 сек"), 20000);

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

/** Дождаться members-list, удовлетворяющего предикату (пропуская промежуточные) */
const waitForMembersList = (socket, predicate, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off("members-list", handler);
      reject(new Error(`таймаут ожидания members-list по условию от ${socket._name}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (predicate(payload)) {
        clearTimeout(t);
        socket.off("members-list", handler);
        resolve(payload);
      }
    };
    socket.on("members-list", handler);
  });

for (const s of sockets) {
  s.on("connect_error", (e) => fail("connect_error", `${s._name}: ${e.message}`));
}

/* ─── Шаг 1: создание комнаты и присвоение команд по порядку ─── */
A.on("connect", () => A.emit("create-room", { syncMode: "host", profile: A._profile }));
const createdA = await once(A, "room-created");
if (!createdA.code || createdA.code.length !== 4) fail("create-room", `код некорректен: ${createdA.code}`);
if (createdA.teamIndex !== 0) fail("create-room", `хост должен получить teamIndex=0, получено ${createdA.teamIndex}`);
if (createdA.syncMode !== "host") fail("create-room", `syncMode должен быть host, получено ${createdA.syncMode}`);
ok(`комната создана ${createdA.code}, хост = команда 0 (syncMode=${createdA.syncMode})`);
const code = createdA.code;

// Сразу после создания приходит members-list с профилем хоста (id = deviceId)
const hostList = await once(A, "members-list");
const hostMember = (hostList.members || []).find((m) => m.teamIndex === 0);
if (!hostMember || hostMember.profile?.name !== "A") {
  fail("members-list", `профиль хоста не пришёл: ${JSON.stringify(hostList)}`);
}
if (hostMember.id !== "dev-A") fail("members-list", `id участника должен быть deviceId, получено ${hostMember.id}`);
if (hostMember.connected !== true) fail("members-list", `connected должен быть true, получено ${hostMember.connected}`);
ok("members-list: профиль хоста (id=dev-A, connected=true)");

const peerJoinedP = once(A, "peer-joined");
const membersAfterJoinP = once(A, "members-list");
B.emit("join-room", { code, profile: B._profile });
const joinedB = await once(B, "room-joined");
if (joinedB.members !== 2) fail("room-joined", `ожидалось members=2, получено ${joinedB.members}`);
if (joinedB.teamIndex !== 1) fail("присвоение команд", `B должен получить teamIndex=1, получено ${joinedB.teamIndex}`);
if (joinedB.syncMode !== "host") fail("syncMode от сервера", `гость должен получить syncMode=host, получено ${joinedB.syncMode}`);
if (joinedB.reconnected !== false) fail("room-joined", `первый вход: reconnected должен быть false, получено ${joinedB.reconnected}`);
ok("B присоединился, teamIndex=1, syncMode=host (от сервера)");
const peerJoined = await peerJoinedP;
if (peerJoined.teamIndex !== 1) fail("peer-joined", `в payload должен быть teamIndex=1, получено ${peerJoined.teamIndex}`);
if (peerJoined.id !== "dev-B") fail("peer-joined", `id должен быть deviceId (dev-B), получено ${peerJoined.id}`);
if (peerJoined.profile?.name !== "B") fail("peer-joined", `профиль не пришёл: ${JSON.stringify(peerJoined.profile)}`);
ok("A получил peer-joined (teamIndex=1, id=dev-B)");
const membersAfterJoin = await membersAfterJoinP;
if ((membersAfterJoin.members || []).length !== 2) fail("members-list", `ожидались 2 участника: ${JSON.stringify(membersAfterJoin)}`);
ok("members-list: 2 участника с профилями");

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

/* ─── Шаг 4: C входит (teamIndex=2) → request-state → send-state-to ─── */
const cJoinedP = once(C, "room-joined");
const aRequestedP = once(A, "state-requested");
const cStateP = once(C, "state-update");
C.emit("join-room", { code, profile: C._profile });
const cJoined = await cJoinedP;
if (cJoined.members !== 3) fail("room-joined C", `ожидалось members=3, получено ${cJoined.members}`);
if (cJoined.teamIndex !== 2) fail("присвоение команд", `C должен получить teamIndex=2, получено ${cJoined.teamIndex}`);
ok("C присоединился, teamIndex=2");

C.emit("request-state", {});
const requested = await aRequestedP;
ok(`A получил state-requested от C (${requested.from.slice(0, 6)}…)`);
A.emit("send-state-to", { to: requested.from, state: { phase: "playing", tick: 5 } });

const cReceived = await cStateP;
if (cReceived?.state?.tick !== 5) fail("send-state-to", `C получил: ${JSON.stringify(cReceived)}`);
ok("C получил состояние через request-state/send-state-to");

/* ─── Шаг 5: D входит (teamIndex=3), полное лобби → рандомизация команд ─── */
const reassignAllP = once(A, "team-reassigned-all");
const reassignBP = once(B, "team-reassigned");
D.emit("join-room", { code, profile: D._profile });
await once(D, "room-joined");
ok("D присоединился, members=4 (лобби заполнено)");
// Сервер должен разослать team-reassigned всем (рандомизация при 4/4)
const reassignAll = await reassignAllP;
if (!Array.isArray(reassignAll.assignments) || reassignAll.assignments.length !== 4) {
  fail("рандомизация", `ожидались назначения для 4 участников: ${JSON.stringify(reassignAll)}`);
}
const teams = reassignAll.assignments.map((x) => x.teamIndex).sort();
if (teams.join() !== "0,1,2,3") fail("рандомизация", `команды должны быть 0..3 без дублей: ${teams.join()}`);
const ids = reassignAll.assignments.map((x) => x.id).sort();
if (ids.join() !== "dev-A,dev-B,dev-C,dev-D") fail("рандомизация", `назначения должны быть по deviceId: ${ids.join()}`);
ok("полное лобби: команды перемешаны (0..3 без дублей, ключ — deviceId)");
const reassignB = await reassignBP;
if (typeof reassignB.teamIndex !== "number") fail("team-reassigned", `B не получил свою команду: ${JSON.stringify(reassignB)}`);
ok(`B получил team-reassigned (новая команда ${reassignB.teamIndex})`);

/* ─── Шаг 6: лимит комнаты 4 — E отклоняется ─── */
const roomErrorP = once(E, "room-error");
E.emit("join-room", { code, profile: E._profile });
const err = await roomErrorP;
if (!err?.message?.includes("заполнена")) fail("лимит комнаты", `неожиданная ошибка: ${err?.message}`);
ok("пятый участник отклонён (лимит комнаты 4)");

/* ─── Шаг 7: список лобби — комната видна извне ─── */
const lobbyListP = once(F, "lobbies-list");
if (F.connected) F.emit("list-lobbies", {});
else F.on("connect", () => F.emit("list-lobbies", {}));
const lobbyList = await lobbyListP;
const found = (lobbyList.lobbies || []).find((l) => l.code === code);
if (!found) fail("список лобби", `комната ${code} не найдена в lobbies-list`);
if (found.members !== 4) fail("список лобби", `members должно быть 4, получено ${found.members}`);
if (found.status !== "playing") fail("список лобби", `status должно быть playing (после state-update), получено ${found.status}`);
if (found.syncMode !== "host") fail("список лобби", `syncMode должен быть host, получено ${found.syncMode}`);
const playerNames = (found.players || []).map((p) => p.profile?.name);
if (!playerNames.includes("A") || !playerNames.includes("B")) {
  fail("список лобби", `профили игроков не пришли: ${JSON.stringify(found.players)}`);
}
ok(`список лобби: комната ${code} видна (4/4, playing, host, профили: ${playerNames.join(", ")})`);

/* ─── Шаг 8: явный выход D (leave-room) — peer-left с teamIndex ─── */
const peerLeftP = once(A, "peer-left");
D.emit("leave-room", {});
const peerLeft = await peerLeftP;
if (peerLeft.members !== 3) fail("peer-left", `ожидалось members=3, получено ${peerLeft.members}`);
if (peerLeft.id !== "dev-D") fail("peer-left", `id должен быть deviceId (dev-D), получено ${peerLeft.id}`);
if (typeof peerLeft.teamIndex !== "number" || peerLeft.teamIndex < 0) {
  fail("peer-left teamIndex", `teamIndex отсутствует: ${JSON.stringify(peerLeft)}`);
}
ok(`A получил peer-left после явного выхода D (members=3, id=dev-D, teamIndex=${peerLeft.teamIndex})`);

/* ─── Шаг 9: обрыв связи B (disconnect) — устройство в грейс-периоде ─── */
// Ждём именно тот members-list, где B помечен офлайн (могут прийти промежуточные)
const membersGraceP = waitForMembersList(A, (p) =>
  (p.members || []).some((m) => m.id === "dev-B" && m.connected === false),
);
B.disconnect();
const membersGrace = await membersGraceP;
const bMember = (membersGrace.members || []).find((m) => m.id === "dev-B");
if (!bMember) fail("грейс-период", `B должен остаться в комнате: ${JSON.stringify(membersGrace)}`);
ok("обрыв B: устройство осталось в комнате (connected=false, грейс-период)");

/* ─── Шаг 10: возврат того же deviceId в грейс-периоде ─── */
const B2 = client("B2", "dev-B"); // то же устройство, новый сокет
const bRejoinedP = once(B2, "room-joined");
const bPeerBackP = once(A, "peer-joined");
B2.emit("join-room", { code, profile: B2._profile });
const bRejoined = await bRejoinedP;
if (bRejoined.reconnected !== true) fail("возврат в комнату", `reconnected должен быть true, получено ${bRejoined.reconnected}`);
if (bRejoined.teamIndex !== bMember.teamIndex) {
  fail("возврат в комнату", `устройство должно сохранить команду ${bMember.teamIndex}, получено ${bRejoined.teamIndex}`);
}
if (bRejoined.members !== 3) fail("возврат в комнату", `members должно быть 3, получено ${bRejoined.members}`);
ok(`устройство dev-B вернулось с прежней командой ${bRejoined.teamIndex} (reconnected=true)`);
const bPeerBack = await bPeerBackP;
if (bPeerBack.id !== "dev-B") fail("peer-joined (возврат)", `id должен быть dev-B, получено ${bPeerBack.id}`);
ok("A получил peer-joined о возврате dev-B");

clearTimeout(overallTimer);
finish();