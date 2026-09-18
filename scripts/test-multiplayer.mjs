// E2E-тест мультиплеера: создаём комнату клиентом A, подключаемся клиентом B,
// синхронизируем состояние. Запуск: node scripts/test-multiplayer.mjs
import { io } from "socket.io-client";

const URL = "http://localhost:3003";
const OPTS = { path: "/", transports: ["polling", "websocket"], reconnection: false, timeout: 8000, forceNew: true };

const A = io(URL, OPTS);
const B = io(URL, OPTS);

const done = (msg) => { console.log(msg); A.disconnect(); B.disconnect(); process.exit(0); };
const fail = (msg) => { console.error("FAIL:", msg); A.disconnect(); B.disconnect(); process.exit(1); };

setTimeout(() => fail("таймаут теста"), 10000);

A.on("connect", () => {
  console.log("[A] connected:", A.id);
  A.emit("create-room", {});
});

A.on("room-created", ({ code }) => {
  console.log("[A] room created:", code);
  B.emit("join-room", { code });
});

B.on("room-joined", ({ code, members }) => {
  console.log(`[B] joined room ${code}, members=${members}`);
  // A отправляет состояние — B должен его получить
  A.emit("state-update", { state: { phase: "playing", score: 5 } });
});

B.on("state-update", ({ from, state }) => {
  done(`[B] received state-update from ${from}: ${JSON.stringify(state)} — OK`);
});

B.on("room-error", ({ message }) => fail("room-error: " + message));
A.on("connect_error", (e) => fail("A connect_error: " + e.message));
B.on("connect_error", (e) => fail("B connect_error: " + e.message));
