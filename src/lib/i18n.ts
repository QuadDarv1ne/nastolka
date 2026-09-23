// Простой i18n-модуль без сторонних библиотек. Хранит язык в localStorage.
// Все строки вынесены в словарь; обращение через t(key) или t(key, params).

export type Lang = "ru" | "en"

const LANG_STORAGE_KEY = "nastolka-lang-v1"

/**
 * Default language used for both server-side rendering AND the first client render.
 * Reading from localStorage happens only AFTER hydration, in a useEffect,
 * so that server-rendered HTML and the first client render always match —
 * preventing React hydration mismatches.
 */
export const DEFAULT_LANG: Lang = "ru"

export function getInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === "ru" || saved === "en") return saved
    // Авто-определение по языку браузера
    if (typeof navigator !== "undefined" && navigator.language?.startsWith("en")) return "en"
  } catch {
    // ignore
  }
  return DEFAULT_LANG
}

export function saveLang(lang: Lang) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // ignore
  }
}

// Словарь всех строк. Ключи — на английском (camelCase), значения — ru/en.
export const STRINGS = {
  // Шапка и общие
  appName: { ru: "Настолка", en: "Nastolka" },
  // Drawing canvas
  clearCanvas: { ru: "Очистить", en: "Clear" },
  drawWithFinger: { ru: "рисуй пальцем", en: "draw with finger" },
  colorLabel: { ru: "Цвет", en: "Color" },
  thinBrush: { ru: "Тонкая кисть", en: "Thin brush" },
  mediumBrush: { ru: "Средняя кисть", en: "Medium brush" },
  thickBrush: { ru: "Толстая кисть", en: "Thick brush" },
  // Game board
  closeLabel: { ru: "Закрыть", en: "Close" },
  recentMoves: { ru: "Последние ходы", en: "Recent moves" },
  ptsShort: { ru: "очк.", en: "pts" },
  // Multiplayer dialog
  mpInRoom: { ru: "в комнате", en: "in room" },
  mpRoomCode: { ru: "Код комнаты", en: "Room code" },
  // Chips
  chipLeft: { ru: "осталось", en: "left" },
  // History stats (с шаблонами {scored}, {total}, {rate})
  historyGuessedOf: { ru: "Угадано {scored} из {total} · успех {rate}%", en: "Guessed {scored} of {total} · success {rate}%" },
  appSubtitle: { ru: "Версия настольной игры из шоу Шальнова и Бебуришвили", en: "Board game from Shalnov & Beburishvili show" },
  rules: { ru: "Правила", en: "Rules" },
  history: { ru: "История", en: "History" },
  historyFull: { ru: "История игры", en: "Game history" },
  achievements: { ru: "Достижения", en: "Achievements" },
  share: { ru: "Поделиться", en: "Share" },
  mute: { ru: "Выключить звук", en: "Mute" },
  unmute: { ru: "Включить звук", en: "Unmute" },
  themeDark: { ru: "Сменить тему", en: "Toggle theme" },

  // Setup
  setupTitle: { ru: "Соберём команды", en: "Set up teams" },
  setupDescription: {
    ru: "Выберите число команд, задайте им имена и цвета. Цель по очкам и время раунда — ниже.",
    en: "Pick number of teams, name and color them. Target score and round time below.",
  },
  teamCount: { ru: "Число команд", en: "Number of teams" },
  twoTeams: { ru: "2 команды", en: "2 teams" },
  threeTeams: { ru: "3 команды", en: "3 teams" },
  fourTeams: { ru: "4 команды", en: "4 teams" },
  teamA: { ru: "Команда А", en: "Team A" },
  teamB: { ru: "Команда Б", en: "Team B" },
  teamV: { ru: "Команда В", en: "Team C" },
  teamG: { ru: "Команда Г", en: "Team D" },
  teamName: { ru: "Название команды", en: "Team name" },
  targetScore: { ru: "Играем до", en: "Play to" },
  pointsShort: { ru: "очков", en: "points" },
  roundTime: { ru: "Время на раунд", en: "Round time" },
  secShort: { ru: "сек", en: "sec" },
  categories: { ru: "Категории слов", en: "Word categories" },
  allCategories: { ru: "выбраны все", en: "all selected" },
  selectAll: { ru: "выбрать все", en: "select all" },
  allCategoriesHint: { ru: "Играем со всеми категориями", en: "Playing with all categories" },
  categoriesSelected: { ru: "Выбрано категорий:", en: "Selected categories:" },
  difficulty: { ru: "Сложность слов", en: "Word difficulty" },
  allDifficultiesHint: { ru: "Играем со всеми сложностями", en: "Playing with all difficulties" },
  difficultiesSelected: { ru: "Выбрано уровней:", en: "Selected levels:" },
  customWords: { ru: "Свои слова (необязательно)", en: "Custom words (optional)" },
  customWordsHint: {
    ru: "Эти слова добавятся к встроенному банку (~120 слов) и попадут в игру наравне с остальными. Идеально для вечеринок: имена друзей, локальные шутки, места.",
    en: "These words will join the built-in pool (~120 words). Perfect for parties: friends' names, local jokes, places.",
  },
  customWordsAdded: { ru: "Добавлено слов:", en: "Added words:" },
  customWordsExpand: { ru: "разверните, чтобы изменить", en: "expand to edit" },
  collapse: { ru: "свернуть ▲", en: "collapse ▲" },
  expand: { ru: "развернуть ▼", en: "expand ▼" },
  startGame: { ru: "Начать игру", en: "Start game" },

  // Категории — ключи совпадают с WordCategory в game-data.ts
  catAnimals: { ru: "Животные", en: "Animals" },
  catFood: { ru: "Еда", en: "Food" },
  catProfessions: { ru: "Профессии", en: "Professions" },
  catSports: { ru: "Спорт", en: "Sports" },
  catObjects: { ru: "Предметы", en: "Objects" },
  catPlaces: { ru: "Места", en: "Places" },
  catNature: { ru: "Природа", en: "Nature" },
  catMovies: { ru: "Кино", en: "Movies" },
  catAbstract: { ru: "Абстракции", en: "Abstract" },
  catEveryday: { ru: "Бытовое", en: "Everyday" },

  // Сложность — ключи совпадают с Difficulty в game-data.ts
  diffEasy: { ru: "Лёгкое", en: "Easy" },
  diffMedium: { ru: "Среднее", en: "Medium" },
  diffHard: { ru: "Сложное", en: "Hard" },

  // Этапы игры
  rollDice: { ru: "Бросить кубик", en: "Roll the dice" },
  reroll: { ru: "Бросить ещё раз", en: "Roll again" },
  rolling: { ru: "Бросок…", en: "Rolling…" },
  toWord: { ru: "К слову", en: "To the word" },
  showWord: { ru: "Показать слово", en: "Show word" },
  wordHidden: { ru: "Загаданное слово", en: "Secret word" },
  wordHiddenHint: {
    ru: "Только один игрок смотрит на экран. Остальные — отворачиваются.",
    en: "Only one player looks at the screen. Others turn away.",
  },
  guessed: { ru: "Угадали!", en: "Guessed!" },
  skip: { ru: "Пропустить", en: "Skip" },
  swapWord: { ru: "Заменить слово", en: "Swap word" },
  swapsUsed: { ru: "замен", en: "swaps" },
  pause: { ru: "Пауза", en: "Pause" },
  resume: { ru: "Продолжить", en: "Resume" },
  pausedHint: { ru: "Пауза. Слово скрыто.", en: "Paused. Word is hidden." },
  exit: { ru: "Выйти", en: "Exit" },

  // Этапы раунда
  yourTurn: { ru: "ХОДИТ", en: "PLAYING" },
  teamTurn: { ru: "ХОД КОМАНДЫ", en: "TEAM TURN" },
  onePlayerHint: {
    ru: "Один игрок из команды берёт телефон и бросает кубик. Выпадет способ объяснения: словами, песнями, рисунком или жестами. Остальные угадывают.",
    en: "One player takes the phone and rolls the dice. A way of explaining will appear: words, songs, drawing or gestures. Others guess.",
  },
  time: { ru: "Время", en: "Time" },
  forAnswer: { ru: "За ответ:", en: "For answer:" },
  pointsSuffix: { ru: "очка", en: "points" },  // 2-4
  pointsSuffix2: { ru: "очков", en: "points" }, // 5+, 0
  pointsSuffix1: { ru: "очко", en: "point" },   // 1
  explainByMethod: { ru: "Объясни способом", en: "Explain using" },
  clear: { ru: "Очистить", en: "Clear" },
  scoredResultHint: {
    ru: "Угадали — жми Угадали!, не получается — Пропустить (очки не идут).",
    en: "Guessed? Press \"Guessed!\". Failed? Press \"Skip\" (no points).",
  },

  // Round end
  teamGuessed: { ru: "Команда угадала!", en: "Team guessed!" },
  roundFailed: { ru: "Раунд не сыгран", en: "Round failed" },
  multiplierUsed: { ru: "Использован множитель", en: "Multiplier used" },
  baseToFinal: { ru: "Базовые очки", en: "Base points" },
  finalToPoints: { ru: "финальные", en: "final" },
  wordWas: { ru: "Загаданное слово было:", en: "The word was:" },
  score: { ru: "Счёт", en: "Score" },
  passTurn: { ru: "Передать ход", en: "Pass turn" },

  // Кража хода
  stealTurn: { ru: "Кража хода", en: "Steal turn" },
  stealNoticeTitle: { ru: "Кража хода у команды", en: "Steal turn for team" },
  stealNoticeHint: {
    ru: "Один раз за всю игру эта команда может украсть ход у соперника — после своего раунда жмите Кража хода вместо Передать ход.",
    en: "Once per game this team can steal the turn from opponents — after your round press \"Steal turn\" instead of \"Pass turn\".",
  },
  stealActivate: { ru: "Кража хода! Играем ещё раз", en: "Steal turn! Play again" },

  // Game over
  winner: { ru: "ПОБЕДИТЕЛЬ", en: "WINNER" },
  finalScore: { ru: "Финальный счёт:", en: "Final score:" },
  roundsPlayed: { ru: "Сыграно раундов:", en: "Rounds played:" },
  swapsTotal: { ru: "замен слова", en: "word swaps" },
  playAgain: { ru: "Сыграть ещё раз", en: "Play again" },
  gameStats: { ru: "Статистика игры", en: "Game stats" },
  newGame: { ru: "Новая игра (другие команды)", en: "New game (other teams)" },

  // Фишки
  chipX2: { ru: "удвоить", en: "double" },
  chipTime: { ru: "время", en: "time" },
  chipX2Label: { ru: "осталось", en: "left" },
  chipX2Active: { ru: "×2 активирован!", en: "×2 activated!" },

  // Методы (для отображения на кубике/бейджах)
  methodWords: { ru: "Словами", en: "Words" },
  methodSongs: { ru: "Песнями", en: "Songs" },
  methodDrawings: { ru: "Рисунком", en: "Drawing" },
  methodGestures: { ru: "Жестами", en: "Gestures" },
  methodChoice: { ru: "Выбор", en: "Choice" },
  methodReroll: { ru: "Ещё раз", en: "Reroll" },

  methodWordsHint: { ru: "Объясни слово другими словами. Нельзя называть однокоренные.", en: "Explain with other words. No cognates." },
  methodSongsHint: { ru: "Спой фрагмент песни, в которой встречается это слово или которая с ним связана.", en: "Sing a song fragment that mentions or relates to this word." },
  methodDrawingsHint: { ru: "Нарисуй слово: прямо на экране в холсте под словом (пальцем или мышью) или на листе бумаги. Нельзя писать буквы и цифры.", en: "Draw the word: on the canvas below (finger/mouse) or on paper. No letters or digits." },
  methodGesturesHint: { ru: "Покажи слово жестами и мимикой. Нельзя издавать звуки.", en: "Show the word with gestures and mimics. No sounds." },
  methodChoiceHint: { ru: "Команда сама выбирает способ объяснения.", en: "The team picks the way of explaining." },
  methodRerollHint: { ru: "Бросай кубик ещё раз — даём шанс на бонусный раунд!", en: "Roll again — bonus round!" },

  chooseMethod: { ru: "Выберите способ объяснения:", en: "Pick the way of explaining:" },

  // Rules dialog
  rulesTitle: { ru: "Как играть в Настолку", en: "How to play Nastolka" },
  rulesDescription: { ru: "Короткая памятка по правилам — для тех, кто первый раз играет.", en: "Quick rules — for first-time players." },
  rulesIntro: {
    ru: "Настолка — командная игра на объяснение слов. Две команды по очереди бросают один общий кубик. На гранях кубика — не цифры, а способы объяснения:",
    en: "Nastolka is a team word-explaining game. Two teams take turns rolling a single dice. The dice faces show not numbers, but ways of explaining:",
  },
  rulesByMethod: { ru: "За способ", en: "By method" },
  rulesByDifficulty: { ru: "За сложность", en: "By difficulty" },
  rulesExample: { ru: "Очки = сумма за способ + за сложность слова.", en: "Points = method + difficulty." },
  rulesExampleDetail: { ru: " Например: Жестами (3) + Сложное (3) = 6 очков.", en: " Example: Gestures (3) + Hard (3) = 6 points." },
  rulesPointsTitle: { ru: "Сколько очков даётся за ответ", en: "How many points per answer" },
  rulesRound: { ru: "Как проходит раунд", en: "How a round goes" },
  rulesRound1: { ru: "Команда бросает кубик и видит способ объяснения.", en: "Team rolls the dice and sees the way of explaining." },
  rulesRound2: { ru: "Один игрок берёт телефон и видит загаданное слово.", en: "One player takes the phone and sees the secret word." },
  rulesRound3: { ru: "Остальные игроки команды отворачиваются, не видят экран.", en: "Other team members turn away, can't see the screen." },
  rulesRound4: { ru: "Игрок объясняет слово выбранным способом. Команда угадывает.", en: "Player explains the word. The team guesses." },
  rulesRound5: { ru: "Угадали — очки начисляются по таблице ниже. Не получилось за время — 0 очков.", en: "Guessed — points awarded per table below. Failed in time — 0 points." },
  rulesRound6: { ru: "Ход переходит другой команде.", en: "Turn passes to the other team." },
  rulesChipsTitle: { ru: "Фишки команды (4 на всю игру)", en: "Team chips (4 per game)" },
  rulesChipsHint: { ru: "Каждая команда получает по 4 фишки — используйте стратегически!", en: "Each team gets 4 chips — use them strategically!" },
  rulesChipX2: { ru: "удвоить очки за текущий раунд. Активируется до нажатия Угадали!.", en: "double points for the round. Activate before pressing \"Guessed!\"." },
  rulesChipPlus10: { ru: "добавить 10 секунд к таймеру во время раунда.", en: "add 10 seconds during the round." },
  rulesChipPlus5: { ru: "добавить 5 секунд к таймеру во время раунда.", en: "add 5 seconds during the round." },
  rulesStealTurn: { ru: "🎲 Кража хода (1 рандомной команде) — украсть ход у соперника, остаться за кубиком.", en: "🎲 Steal turn (1 random team) — steal the turn, stay at the dice." },
  rulesStealHint: {
    ru: "В начале игры случайно одной команде выдаётся карточка Кража хода. После своего раунда можно украть ход у соперника — жмите Кража хода вместо Передать ход, и команда играет ещё один раунд подряд.",
    en: "At the start, one random team gets a \"Steal turn\" card. After your round, press \"Steal turn\" instead of \"Pass turn\" to play one more round in a row.",
  },
  rulesTip: {
    ru: "Совет: ×2 выгоднее всего на способе Жестами (3 очка) со Сложным словом (3 очка) — итого 6 × 2 = 12 очков!",
    en: "Tip: ×2 is best with Gestures (3) + Hard word (3) — total 6 × 2 = 12 points!",
  },
  rulesWin: { ru: "Первая команда, набравшая заданное количество очков, побеждает. Удачи и весёлой игры!", en: "First team to reach the target wins. Good luck!" },
  rulesPieces: { ru: "шт.", en: "x" },
  rulesSeconds: { ru: "секунд", en: "seconds" },

  // Метод-точки (1/2/2/3) в правилах
  rulesWords1: { ru: "🗣️ Словами — 1 очко", en: "🗣️ Words — 1 point" },
  rulesSongs2: { ru: "🎵 Песнями — 2 очка", en: "🎵 Songs — 2 points" },
  rulesDrawings2: { ru: "🎨 Рисунком — 2 очка", en: "🎨 Drawing — 2 points" },
  rulesGestures3: { ru: "🤟 Жестами — 3 очка", en: "🤟 Gestures — 3 points" },
  rulesEasy1: { ru: "🟢 Лёгкое — 1 очко", en: "🟢 Easy — 1 point" },
  rulesMedium2: { ru: "🟡 Среднее — 2 очка", en: "🟡 Medium — 2 points" },
  rulesHard3: { ru: "🔴 Сложное — 3 очка", en: "🔴 Hard — 3 points" },

  // Footer
  footer: {
    ru: "Фанатская интерактивная версия настольной игры Настолка. Вдохновлено шоу Шальнова и Бебуришвили на канале Medium Sport.",
    en: "Fan interactive version of the Nastolka board game. Inspired by Shalnov & Beburishvili show on Medium Sport.",
  },

  // Достижения
  achTitle: { ru: "Достижения", en: "Achievements" },
  achDescription: { ru: "Глобальная статистика за все сессии — переживает перезагрузку и закрытие вкладки.", en: "Global stats across all sessions — survives reload and tab close." },
  achGamesPlayed: { ru: "сыграно игр", en: "games played" },
  achTotalPoints: { ru: "всего очков", en: "total points" },
  achWordsGuessed: { ru: "угадано слов", en: "words guessed" },
  achWordsSkipped: { ru: "пропущено слов", en: "words skipped" },
  achSwaps: { ru: "замен слова", en: "word swaps" },
  achBestRound: { ru: "лучший раунд", en: "best round" },
  achSuccessRate: { ru: "Общая успешность", en: "Overall success" },
  achWordsRatio: { ru: "из", en: "of" },
  achWords: { ru: "слов", en: "words" },
  achRecords: { ru: "Рекорды", en: "Records" },
  achLongestGame: { ru: "Самая длинная игра", en: "Longest game" },
  achRounds: { ru: "раундов", en: "rounds" },
  achBestScore: { ru: "Самый большой счёт победителя", en: "Best winner score" },
  achBestRoundRecord: { ru: "Лучший раунд за все сессии", en: "Best round across sessions" },
  achAveragePerGame: { ru: "Среднее за игру", en: "Average per game" },
  achLastGame: { ru: "Последняя игра:", en: "Last game:" },
  achNeverPlayed: { ru: "ещё не играли", en: "never played yet" },
  achReset: { ru: "Сбросить статистику", en: "Reset stats" },
  achResetConfirm: { ru: "Точно сбросить всю статистику? Это действие нельзя отменить.", en: "Reset all stats? This cannot be undone." },
  achEmpty: { ru: "Пока ничего не играли. Бросьте кубик и сыграйте первый раунд.", en: "Nothing played yet. Roll the dice and play your first round." },

  // History dialog
  historyTitle: { ru: "История игры", en: "Game history" },
  historyTotalRounds: { ru: "Всего сыграно раундов:", en: "Total rounds played:" },
  historySwaps: { ru: "Замен слова:", en: "Word swaps:" },
  historySuccessByMethod: { ru: "Успешность по способам", en: "Success by method" },
  historyRounds: { ru: "Раунды", en: "Rounds" },

  // Share
  shareText: {
    ru: "Играем в Настолку — командную игру на объяснение слов! Бросай кубик, объясняй, зарабатывай очки.",
    en: "Playing Nastolka — a team word-explaining game! Roll the dice, explain, score points.",
  },
  shareCopied: { ru: "Ссылка скопирована в буфер обмена!", en: "Link copied to clipboard!" },

  // PWA manifest (используется в layout)
  appNameShort: { ru: "Настолка", en: "Nastolka" },

  // Multiplayer
  mpTitle: { ru: "Мультиплеер", en: "Multiplayer" },
  mpDescription: {
    ru: "Играйте на двух устройствах одновременно. Состояние игры синхронизируется автоматически.",
    en: "Play on two devices simultaneously. Game state syncs automatically.",
  },
  mpConnected: { ru: "Подключено", en: "Connected" },
  mpPlayers: { ru: "игрока", en: "players" },
  mpPlayer: { ru: "игрок", en: "player" },
  mpCreateRoom: { ru: "Создать комнату", en: "Create room" },
  mpJoinByCode: { ru: "Присоединиться по коду", en: "Join by code" },
  mpInfo: {
    ru: "ℹ️ Для мультиплеера нужно, чтобы на одном устройстве была открыта игра как хост, а на другом — гость по коду. Все действия синхронизируются в реальном времени.",
    en: "ℹ️ Multiplayer requires one device as host, the other joins by code. All actions sync in real time.",
  },
  mpCreateDescription: {
    ru: "Создадим новую комнату. Получите 4-значный код — передайте его второму игроку.",
    en: "Create a new room. You'll get a 4-digit code — share it with the other player.",
  },
  mpCreating: { ru: "Создаём…", en: "Creating…" },
  mpBack: { ru: "Назад", en: "Back" },
  mpRoomCodeLabel: { ru: "Код комнаты (4 символа)", en: "Room code (4 chars)" },
  mpJoining: { ru: "Подключаемся…", en: "Connecting…" },
  mpJoin: { ru: "Подключиться", en: "Join" },
  mpCodeCopied: { ru: "Скопировано!", en: "Copied!" },
  mpCopyCode: { ru: "Скопировать код", en: "Copy code" },
  mpCodeShareHint: {
    ru: "Передайте код второму игроку. Он введёт его на своём устройстве.",
    en: "Share the code with the other player. They'll enter it on their device.",
  },
  mpStartOver: { ru: "Начать заново", en: "Start over" },
  mpErrorTitle: { ru: "⚠️ Не удалось подключиться", en: "⚠️ Failed to connect" },
  mpDisconnected: {
    ru: "Связь с комнатой потеряна. Игра продолжается локально — подключитесь заново, чтобы синхронизироваться.",
    en: "Connection to the room was lost. The game continues locally — reconnect to sync again.",
  },
  mpReconnectFailed: {
    ru: "Не удалось переподключиться к комнате. Отключитесь и создайте комнату заново.",
    en: "Reconnecting to the room failed. Disconnect and create the room again.",
  },
  mpDisconnect: { ru: "Отключиться", en: "Disconnect" },
  mpConnectionLost: { ru: "Связь с комнатой потеряна", en: "Room connection lost" },
  mpErrorHint: {
    ru: "Проверьте, что мини-сервер мультиплеера запущен (порт 3003). На Amvera — нужен WebSocket-сервис в проекте.",
    en: "Make sure the multiplayer mini-service is running (port 3003). On Amvera — needs a WebSocket service.",
  },
  mpErrorRetry: { ru: "Закрыть ошибку и попробовать снова", en: "Close error and retry" },
  mpModeTitle: { ru: "Режим синхронизации", en: "Sync mode" },
  mpModeHost: { ru: "Хост (управляет игрой)", en: "Host (controls the game)" },
  mpModeSync: { ru: "Синхронный (видят оба)", en: "Synced (both can act)" },
  mpModeHostHint: {
    ru: "Только хост бросает кубик и видит слова. Гости только наблюдают прогресс в реальном времени.",
    en: "Only host rolls the dice and sees words. Guests watch progress in real time.",
  },
  mpModeSyncHint: {
    ru: "Любой участник может действовать — состояние полностью синхронизировано между всеми устройствами.",
    en: "Any participant can act — state is fully synced between all devices.",
  },
  mpWaitingForHost: {
    ru: "Ждём, пока хост начнёт игру…",
    en: "Waiting for host to start the game…",
  },
  mpGuestCantAct: {
    ru: "Вы гость. Дождитесь хода хоста.",
    en: "You are a guest. Wait for the host's turn.",
  },

  // Дополнительные строки для setup
  customWordsPlaceholder: {
    ru: "Одно слово в строке — попадут в общий пул:\nМамина машина\nДядя Коля\nКот Стёпка\nНаша школа",
    en: "One word per line — joins the pool:\nMom's car\nUncle Nick\nCat Stepka\nOur school",
  },
  customWordsExpandHint: { ru: "разверните, чтобы изменить", en: "expand to edit" },
  addedWords: { ru: "Добавлено слов:", en: "Added words:" },

  // Этапы round_end
  scoreLabel: { ru: "Счёт", en: "Score" },

  // Прочие
  loadingText: { ru: "Загрузка…", en: "Loading…" },
  dismissError: { ru: "Закрыть", en: "Dismiss" },

  // Достижения — tile labels (короткие)
  achBestRoundShort: { ru: "лучший раунд", en: "best round" },
  achTotalPointsShort: { ru: "всего очков", en: "total points" },

  // Карточка кражи хода
  stealCardHint: {
    ru: "Один раз за всю игру эта команда может украсть ход у соперника — после своего раунда жмите Кража хода вместо Передать ход.",
    en: "Once per game this team can steal the turn — after your round press \"Steal turn\" instead of \"Pass turn\".",
  },
  stealTurnButton: { ru: "🎲 Кража хода! Играем ещё раз", en: "🎲 Steal turn! Play again" },

  // Игровая доска (Монополия-стайл)
  gameBoard: { ru: "Игровая доска", en: "Game Board" },
  startLabel: { ru: "Старт", en: "Start" },
  finishLabel: { ru: "Финиш", en: "Finish" },
  counterclockwise: { ru: "против часовой", en: "counterclockwise" },
  targetLabel: { ru: "Цель", en: "Target" },
  startToFinish: { ru: "Старт → Финиш", en: "Start → Finish" },
  leader: { ru: "ЛИДЕР", en: "LEADER" },
  teamsLabel: { ru: "Команды", en: "Teams" },

  // Отсчёт перед раундом
  getReady: { ru: "Приготовьтесь!", en: "Get ready!" },
  goLabel: { ru: "Старт!", en: "Go!" },

  // Отмена раунда
  undoRound: { ru: "Отменить раунд", en: "Undo round" },

  // Лучший раунд (MVP на экране победы)
  bestRound: { ru: "Лучший раунд", en: "Best round" },

  // Настройки (звук и вибрация)
  settingsTitle: { ru: "Настройки", en: "Settings" },
  settingsSubtitle: { ru: "Управление звуком и вибрацией", en: "Sound and vibration controls" },
  soundLabel: { ru: "Звук", en: "Sound" },
  soundHint: { ru: "Звуковые эффекты игры", en: "Game sound effects" },
  vibrationLabel: { ru: "Вибрация", en: "Vibration" },
  vibrationHint: { ru: "Тактильная отдача на телефоне", en: "Haptic feedback on phone" },
  testSoundVibration: { ru: "Тест звука и вибрации", en: "Test sound & vibration" },
  countdownLabel: { ru: "Отсчёт 3-2-1", en: "3-2-1 countdown" },
  countdownHint: { ru: "Обратный отсчёт перед началом раунда", en: "Countdown before each round" },

  // Быстрая игра
  quickGame: { ru: "Быстрая игра", en: "Quick game" },
  quickGameHint: {
    ru: "2 команды · до 10 очков · 60 сек · все категории",
    en: "2 teams · up to 10 pts · 60 sec · all categories",
  },

  // Multiplayer footer in dialog
  mpCurrentRoom: { ru: "Код комнаты:", en: "Room code:" },

  // Дополнительные строки, которые упустил раньше
  teamTurnShort: { ru: "Ход команды", en: "Team turn" },
  playing: { ru: "Ходит", en: "Playing" },
  pausedHint2: { ru: "Нажмите Продолжить, чтобы возобновить таймер.", en: "Press \"Resume\" to continue the timer." },
  forAnswerLabel: { ru: "За ответ:", en: "For answer:" },
  multiplierActivated: { ru: "активирован!", en: "activated!" },
  explainByMethodPrefix: { ru: "Объясни способом", en: "Explain using" },
  wordWasLabel: { ru: "Загаданное слово было:", en: "The word was:" },
  wordHiddenLabel: { ru: "Загаданное слово", en: "Secret word" },
  swapWordLabel: { ru: "Заменить слово", en: "Swap word" },
  swapsCount: { ru: "замен", en: "swaps" },
  scoredHint: { ru: "Угадали — жми Угадали!, не получается — Пропустить (очки не идут).", en: "Guessed? Press \"Guessed!\". Failed? Press \"Skip\" (no points)." },
  footerText: {
    ru: "Фанатская интерактивная версия настольной игры Настолка. Вдохновлено шоу Шальнова и Бебуришвили на канале Medium Sport.",
    en: "Fan interactive version of the Nastolka board game. Inspired by Shalnov & Beburishvili show on Medium Sport.",
  },
  teamNamePlaceholder: { ru: "Название команды", en: "Team name" },
  chooseMethodPrompt: { ru: "Выберите способ объяснения:", en: "Pick the way of explaining:" },

  // Карточка кражи хода (заметка вверху)
  stealActivateShort: { ru: "🎲 Кража", en: "🎲 Steal" },

  // Цвета команд
  colorPink: { ru: "Розовый", en: "Pink" },
  colorGreen: { ru: "Зелёный", en: "Green" },
  colorBlue: { ru: "Синий", en: "Blue" },
  colorOrange: { ru: "Оранжевый", en: "Orange" },
  colorViolet: { ru: "Фиолетовый", en: "Violet" },
  colorCyan: { ru: "Бирюзовый", en: "Cyan" },

  // Мелкие подписи фишек
  chipDouble: { ru: "удвоить", en: "double" },

  // Ручной адрес сервера мультиплеера
  mpAdvanced: { ru: "Дополнительно", en: "Advanced" },
  mpServerUrlLabel: { ru: "Адрес сервера мультиплеера", en: "Multiplayer server URL" },
  mpServerUrlPlaceholder: { ru: "http://192.168.1.5:3003", en: "http://192.168.1.5:3003" },
  mpServerUrlHint: {
    ru: "Обычно не нужно. Заполните, если устройства в разных сетях или сервер на другом хосте. Пусто = искать автоматически.",
    en: "Usually not needed. Fill it in if devices are on different networks or the server is on another host. Empty = auto-detect.",
  },
  mpServerUrlSaved: { ru: "Сохранено", en: "Saved" },
  mpServerUrlClear: { ru: "Сбросить", en: "Reset" },
  mpSave: { ru: "Сохранить", en: "Save" },
} as const

export type StringKey = keyof typeof STRINGS

/** Получить строку на текущем языке */
export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.ru ?? key
}

/** Маппинг WordCategory → ключ i18n */
const CATEGORY_I18N_KEYS: Record<string, StringKey> = {
  animals: "catAnimals",
  food: "catFood",
  professions: "catProfessions",
  sports: "catSports",
  objects: "catObjects",
  places: "catPlaces",
  nature: "catNature",
  movies: "catMovies",
  abstract: "catAbstract",
  everyday: "catEveryday",
}

/** Маппинг Difficulty → ключ i18n */
const DIFFICULTY_I18N_KEYS: Record<string, StringKey> = {
  easy: "diffEasy",
  medium: "diffMedium",
  hard: "diffHard",
}

/** Получить локализованное название категории по её ключу (animals, food, ...) */
export function categoryLabel(lang: Lang, category: string): string {
  const key = CATEGORY_I18N_KEYS[category]
  return key ? t(lang, key) : category
}

/** Получить локализованное название сложности по её ключу (easy, medium, hard) */
export function difficultyLabel(lang: Lang, difficulty: string): string {
  const key = DIFFICULTY_I18N_KEYS[difficulty]
  return key ? t(lang, key) : difficulty
}
