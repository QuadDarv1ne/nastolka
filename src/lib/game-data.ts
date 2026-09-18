// Игровые данные для Настолки

export type MethodId = "words" | "songs" | "drawings" | "gestures" | "choice" | "reroll"

export interface Method {
  id: MethodId
  /** Короткое название для грани кубика */
  label: string
  /** Подсказка/описание, что делать */
  hint: string
  /** Иконка (имя из lucide-react) */
  icon: string
  /** Цвет грани (Tailwind классы) */
  color: string
  /** Градиент для фона */
  gradient: string
}

export const METHODS: Record<Exclude<MethodId, "choice" | "reroll">, Method> = {
  words: {
    id: "words",
    label: "Словами",
    hint: "Объясни слово другими словами. Нельзя называть однокоренные.",
    icon: "Type",
    color: "bg-emerald-500 text-white",
    gradient: "from-emerald-400 to-teal-500",
  },
  songs: {
    id: "songs",
    label: "Песнями",
    hint: "Спой фрагмент песни, в которой встречается это слово или которая с ним связана.",
    icon: "Music",
    color: "bg-rose-500 text-white",
    gradient: "from-rose-400 to-pink-500",
  },
  drawings: {
    id: "drawings",
    label: "Рисунком",
    hint: "Нарисуй слово на листе бумаги. Нельзя писать буквы и цифры.",
    icon: "Brush",
    color: "bg-amber-500 text-white",
    gradient: "from-amber-400 to-orange-500",
  },
  gestures: {
    id: "gestures",
    label: "Жестами",
    hint: "Покажи слово жестами и мимикой. Нельзя издавать звуки.",
    icon: "Hand",
    color: "bg-violet-500 text-white",
    gradient: "from-violet-400 to-purple-500",
  },
}

export const SPECIAL_METHODS: Record<"choice" | "reroll", Method> = {
  choice: {
    id: "choice",
    label: "Выбор",
    hint: "Команда сама выбирает способ объяснения: словами, песнями, рисунком или жестами.",
    icon: "Sparkles",
    color: "bg-sky-500 text-white",
    gradient: "from-sky-400 to-cyan-500",
  },
  reroll: {
    id: "reroll",
    label: "Ещё раз",
    hint: "Бросай кубик ещё раз — даём шанс на бонусный раунд!",
    icon: "Dices",
    color: "bg-indigo-500 text-white",
    gradient: "from-indigo-400 to-blue-500",
  },
}

/** Все грани кубика в порядке 1..6 */
export const DICE_FACES: Method[] = [
  METHODS.words,
  METHODS.songs,
  METHODS.drawings,
  METHODS.gestures,
  SPECIAL_METHODS.choice,
  SPECIAL_METHODS.reroll,
]

export type WordCategory =
  | "animals"
  | "food"
  | "professions"
  | "sports"
  | "objects"
  | "places"
  | "nature"
  | "movies"
  | "abstract"
  | "everyday"

export type Difficulty = "easy" | "medium" | "hard"

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Лёгкое",
  medium: "Среднее",
  hard: "Сложное",
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-500 text-white",
  medium: "bg-amber-500 text-white",
  hard: "bg-rose-500 text-white",
}

/** Очки за способ объяснения */
export const METHOD_POINTS: Record<Exclude<MethodId, "choice" | "reroll">, number> = {
  words: 1,
  songs: 2,
  drawings: 2,
  gestures: 3,
}

/** Очки за сложность слова */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

/**
 * Вычислить очки за раунд: сумма очков метода и сложности.
 * Для Выбор используется выбранный метод, для остальных — сам метод.
 */
export function getRoundPoints(
  method: Method | null,
  chosenMethodForChoice: MethodId | null,
  word: WordEntry | null,
): number {
  if (!method || !word) return 0
  let methodId: MethodId = method.id
  if (method.id === "choice" && chosenMethodForChoice) {
    methodId = chosenMethodForChoice
  }
  if (methodId === "reroll") return 0
  const m = METHOD_POINTS[methodId as Exclude<MethodId, "choice" | "reroll">] ?? 1
  const d = DIFFICULTY_POINTS[word.difficulty ?? "medium"] ?? 2
  return m + d
}

export interface WordEntry {
  word: string
  category: WordCategory
  /** Сложность слова (по умолчанию medium) */
  difficulty?: Difficulty
  /** Опциональная подсказка-ассоциация для команды */
  hint?: string
}

export const WORDS: WordEntry[] = [
  // Животные
  { word: "Медведь", category: "animals", difficulty: "easy" },
  { word: "Лиса", category: "animals", difficulty: "easy" },
  { word: "Крокодил", category: "animals", difficulty: "medium" },
  { word: "Попугай", category: "animals", difficulty: "medium" },
  { word: "Дельфин", category: "animals", difficulty: "medium" },
  { word: "Страус", category: "animals", difficulty: "medium" },
  { word: "Хамелеон", category: "animals", difficulty: "hard" },
  { word: "Осьминог", category: "animals", difficulty: "medium" },
  { word: "Бегемот", category: "animals", difficulty: "easy" },
  { word: "Жираф", category: "animals", difficulty: "easy" },
  { word: "Ёжик", category: "animals", difficulty: "easy" },
  { word: "Пингвин", category: "animals", difficulty: "medium" },
  { word: "Кенгуру", category: "animals", difficulty: "medium" },
  { word: "Сова", category: "animals", difficulty: "easy" },
  { word: "Панда", category: "animals", difficulty: "easy" },

  // Еда
  { word: "Пельмени", category: "food", difficulty: "easy" },
  { word: "Пицца", category: "food", difficulty: "easy" },
  { word: "Борщ", category: "food", difficulty: "easy" },
  { word: "Мороженое", category: "food", difficulty: "easy" },
  { word: "Шашлык", category: "food", difficulty: "medium" },
  { word: "Суши", category: "food", difficulty: "easy" },
  { word: "Блины", category: "food", difficulty: "easy" },
  { word: "Хот-дог", category: "food", difficulty: "easy" },
  { word: "Гречка", category: "food", difficulty: "medium" },
  { word: "Капучино", category: "food", difficulty: "medium" },
  { word: "Окрошка", category: "food", difficulty: "hard" },
  { word: "Тирамису", category: "food", difficulty: "hard" },
  { word: "Винегрет", category: "food", difficulty: "hard" },
  { word: "Бургер", category: "food", difficulty: "easy" },
  { word: "Чебурек", category: "food", difficulty: "medium" },

  // Профессии
  { word: "Врач", category: "professions", difficulty: "easy" },
  { word: "Программист", category: "professions", difficulty: "medium" },
  { word: "Пожарный", category: "professions", difficulty: "medium" },
  { word: "Космонавт", category: "professions", difficulty: "medium" },
  { word: "Учитель", category: "professions", difficulty: "easy" },
  { word: "Повар", category: "professions", difficulty: "easy" },
  { word: "Хирург", category: "professions", difficulty: "medium" },
  { word: "Балерина", category: "professions", difficulty: "medium" },
  { word: "Сантехник", category: "professions", difficulty: "medium" },
  { word: "Археолог", category: "professions", difficulty: "hard" },
  { word: "Дрессировщик", category: "professions", difficulty: "hard" },
  { word: "Метеоролог", category: "professions", difficulty: "hard" },
  { word: "Бариста", category: "professions", difficulty: "medium" },
  { word: "Сомелье", category: "professions", difficulty: "hard" },
  { word: "Актёр", category: "professions", difficulty: "easy" },

  // Спорт
  { word: "Футбол", category: "sports", difficulty: "easy" },
  { word: "Теннис", category: "sports", difficulty: "medium" },
  { word: "Шахматы", category: "sports", difficulty: "medium" },
  { word: "Серфинг", category: "sports", difficulty: "medium" },
  { word: "Бокс", category: "sports", difficulty: "easy" },
  { word: "Гольф", category: "sports", difficulty: "medium" },
  { word: "Хоккей", category: "sports", difficulty: "easy" },
  { word: "Баскетбол", category: "sports", difficulty: "medium" },
  { word: "Дайвинг", category: "sports", difficulty: "medium" },
  { word: "Йога", category: "sports", difficulty: "easy" },
  { word: "Парашютизм", category: "sports", difficulty: "hard" },
  { word: "Фигурное катание", category: "sports", difficulty: "hard" },
  { word: "Сноуборд", category: "sports", difficulty: "medium" },
  { word: "Регби", category: "sports", difficulty: "hard" },
  { word: "Карате", category: "sports", difficulty: "medium" },

  // Предметы
  { word: "Утюг", category: "objects", difficulty: "easy" },
  { word: "Чемодан", category: "objects", difficulty: "medium" },
  { word: "Зонтик", category: "objects", difficulty: "easy" },
  { word: "Телевизор", category: "objects", difficulty: "medium" },
  { word: "Будильник", category: "objects", difficulty: "medium" },
  { word: "Пылесос", category: "objects", difficulty: "medium" },
  { word: "Очки", category: "objects", difficulty: "easy" },
  { word: "Велосипед", category: "objects", difficulty: "medium" },
  { word: "Самовар", category: "objects", difficulty: "hard" },
  { word: "Подзорная труба", category: "objects", difficulty: "hard" },
  { word: "Бинокль", category: "objects", difficulty: "medium" },
  { word: "Микроволновка", category: "objects", difficulty: "medium" },
  { word: "Калькулятор", category: "objects", difficulty: "medium" },
  { word: "Компас", category: "objects", difficulty: "medium" },
  { word: "Веник", category: "objects", difficulty: "easy" },

  // Места
  { word: "Эйфелева башня", category: "places", difficulty: "hard" },
  { word: "Красная площадь", category: "places", difficulty: "hard" },
  { word: "Пирамида Хеопса", category: "places", difficulty: "hard" },
  { word: "Колизей", category: "places", difficulty: "hard" },
  { word: "Биг-Бен", category: "places", difficulty: "hard" },
  { word: "Метро", category: "places", difficulty: "easy" },
  { word: "Цирк", category: "places", difficulty: "easy" },
  { word: "Баня", category: "places", difficulty: "easy" },
  { word: "Библиотека", category: "places", difficulty: "medium" },
  { word: "Луна-парк", category: "places", difficulty: "medium" },
  { word: "Аквапарк", category: "places", difficulty: "medium" },
  { word: "Остров", category: "places", difficulty: "medium" },
  { word: "Вулкан", category: "places", difficulty: "medium" },
  { word: "Маяк", category: "places", difficulty: "medium" },
  { word: "Замок", category: "places", difficulty: "easy" },

  // Природа
  { word: "Водопад", category: "nature", difficulty: "medium" },
  { word: "Радуга", category: "nature", difficulty: "easy" },
  { word: "Молния", category: "nature", difficulty: "medium" },
  { word: "Снегопад", category: "nature", difficulty: "medium" },
  { word: "Северное сияние", category: "nature", difficulty: "hard" },
  { word: "Торнадо", category: "nature", difficulty: "hard" },
  { word: "Закат", category: "nature", difficulty: "easy" },
  { word: "Метеорит", category: "nature", difficulty: "hard" },
  { word: "Гейзер", category: "nature", difficulty: "hard" },
  { word: "Айсберг", category: "nature", difficulty: "medium" },
  { word: "Гриб", category: "nature", difficulty: "easy" },
  { word: "Одуванчик", category: "nature", difficulty: "medium" },

  // Кино и культура
  { word: "Бэтмен", category: "movies", difficulty: "medium" },
  { word: "Гарри Поттер", category: "movies", difficulty: "medium" },
  { word: "Шрек", category: "movies", difficulty: "easy" },
  { word: "Человек-паук", category: "movies", difficulty: "medium" },
  { word: "Король Лев", category: "movies", difficulty: "medium" },
  { word: "Титаник", category: "movies", difficulty: "medium" },
  { word: "Маска", category: "movies", difficulty: "easy" },
  { word: "Один дома", category: "movies", difficulty: "medium" },
  { word: "Звёздные войны", category: "movies", difficulty: "hard" },
  { word: "Холодное сердце", category: "movies", difficulty: "hard" },
  { word: "Аватар", category: "movies", difficulty: "medium" },
  { word: "Джокер", category: "movies", difficulty: "medium" },

  // Абстракции
  { word: "Любовь", category: "abstract", difficulty: "medium" },
  { word: "Дружба", category: "abstract", difficulty: "medium" },
  { word: "Тоска", category: "abstract", difficulty: "hard" },
  { word: "Счастье", category: "abstract", difficulty: "medium" },
  { word: "Ностальгия", category: "abstract", difficulty: "hard" },
  { word: "Вдохновение", category: "abstract", difficulty: "hard" },
  { word: "Зависть", category: "abstract", difficulty: "hard" },
  { word: "Лень", category: "abstract", difficulty: "easy" },
  { word: "Свобода", category: "abstract", difficulty: "medium" },
  { word: "Ревность", category: "abstract", difficulty: "hard" },

  // Бытовое
  { word: "Стирка", category: "everyday", difficulty: "medium" },
  { word: "Уборка", category: "everyday", difficulty: "medium" },
  { word: "Ремонт", category: "everyday", difficulty: "medium" },
  { word: "Пробка", category: "everyday", difficulty: "medium" },
  { word: "Будильник", category: "everyday", difficulty: "medium" },
  { word: "Очередь", category: "everyday", difficulty: "medium" },
  { word: "Деньги", category: "everyday", difficulty: "easy" },
  { word: "Отпуск", category: "everyday", difficulty: "easy" },
  { word: "Дедлайн", category: "everyday", difficulty: "hard" },
  { word: "Кофе с молоком", category: "everyday", difficulty: "medium" },

  // ─── Дополнительные слова (v10) ───

  // Животные — доп
  { word: "Капибара", category: "animals", difficulty: "medium" },
  { word: "Енот", category: "animals", difficulty: "easy" },
  { word: "Лемур", category: "animals", difficulty: "hard" },
  { word: "Тукан", category: "animals", difficulty: "medium" },
  { word: "Морской котик", category: "animals", difficulty: "hard" },
  { word: "Черепаха", category: "animals", difficulty: "medium" },
  { word: "Хорёк", category: "animals", difficulty: "hard" },
  { word: "Ленивец", category: "animals", difficulty: "medium" },

  // Еда — доп
  { word: "Хот-дог", category: "food", difficulty: "easy" },
  { word: "Лаваш", category: "food", difficulty: "medium" },
  { word: "Халва", category: "food", difficulty: "hard" },
  { word: "Селёдка", category: "food", difficulty: "medium" },
  { word: "Сырники", category: "food", difficulty: "medium" },
  { word: "Лавашак", category: "food", difficulty: "hard" },
  { word: "Квас", category: "food", difficulty: "medium" },
  { word: "Пахлава", category: "food", difficulty: "hard" },

  // Профессии — доп
  { word: "Пилот", category: "professions", difficulty: "easy" },
  { word: "Юрист", category: "professions", difficulty: "medium" },
  { word: "Каскадёр", category: "professions", difficulty: "hard" },
  { word: "Тату-мастер", category: "professions", difficulty: "hard" },
  { word: "Астроном", category: "professions", difficulty: "hard" },
  { word: "Психолог", category: "professions", difficulty: "medium" },
  { word: "Аниматор", category: "professions", difficulty: "medium" },
  { word: "Диджей", category: "professions", difficulty: "easy" },

  // Спорт — доп
  { word: "Сёрфинг", category: "sports", difficulty: "medium" },
  { word: "Кёрлинг", category: "sports", difficulty: "hard" },
  { word: "Прыжки с парашютом", category: "sports", difficulty: "hard" },
  { word: "Скалолазание", category: "sports", difficulty: "hard" },
  { word: "Боулинг", category: "sports", difficulty: "easy" },
  { word: "Дартс", category: "sports", difficulty: "easy" },
  { word: "Бильярд", category: "sports", difficulty: "medium" },
  { word: "Полотно", category: "sports", difficulty: "hard" },

  // Предметы — доп
  { word: "Календарь", category: "objects", difficulty: "medium" },
  { word: "Подсвечник", category: "objects", difficulty: "hard" },
  { word: "Лупа", category: "objects", difficulty: "easy" },
  { word: "Флешка", category: "objects", difficulty: "medium" },
  { word: "Лопата", category: "objects", difficulty: "easy" },
  { word: "Термометр", category: "objects", difficulty: "hard" },
  { word: "Глобус", category: "objects", difficulty: "medium" },
  { word: "Часы", category: "objects", difficulty: "easy" },

  // Места — доп
  { word: "Эрмитаж", category: "places", difficulty: "hard" },
  { word: "Стадион", category: "places", difficulty: "easy" },
  { word: "Кинотеатр", category: "places", difficulty: "easy" },
  { word: "ТЦ", category: "places", difficulty: "medium" },
  { word: "Зоопарк", category: "places", difficulty: "easy" },
  { word: "Горы", category: "places", difficulty: "easy" },
  { word: "Пляж", category: "places", difficulty: "easy" },
  { word: "Водохранилище", category: "places", difficulty: "hard" },

  // Природа — доп
  { word: "Звезда", category: "nature", difficulty: "easy" },
  { word: "Луна", category: "nature", difficulty: "easy" },
  { word: "Туман", category: "nature", difficulty: "medium" },
  { word: "Роса", category: "nature", difficulty: "hard" },
  { word: "Гроза", category: "nature", difficulty: "medium" },
  { word: "Полярная звезда", category: "nature", difficulty: "hard" },
  { word: "Облако", category: "nature", difficulty: "easy" },
  { word: "Комета", category: "nature", difficulty: "medium" },

  // Кино — доп
  { word: "Властелин колец", category: "movies", difficulty: "hard" },
  { word: "Назад в будущее", category: "movies", difficulty: "hard" },
  { word: "Чебурашка", category: "movies", difficulty: "easy" },
  { word: "Масяня", category: "movies", difficulty: "medium" },
  { word: "Ну, погоди!", category: "movies", difficulty: "medium" },
  { word: "Бременские музыканты", category: "movies", difficulty: "hard" },
  { word: "Барбоскины", category: "movies", difficulty: "medium" },
  { word: "Холодное сердце 2", category: "movies", difficulty: "hard" },

  // Абстракции — доп
  { word: "Уверенность", category: "abstract", difficulty: "hard" },
  { word: "Грусть", category: "abstract", difficulty: "medium" },
  { word: "Скука", category: "abstract", difficulty: "medium" },
  { word: "Нежность", category: "abstract", difficulty: "hard" },
  { word: "Энергия", category: "abstract", difficulty: "medium" },
  { word: "Харизма", category: "abstract", difficulty: "hard" },
  { word: "Дружелюбие", category: "abstract", difficulty: "hard" },
  { word: "Храбрость", category: "abstract", difficulty: "hard" },

  // Бытовое — доп
  { word: "Зарядка", category: "everyday", difficulty: "easy" },
  { word: "Завтрак", category: "everyday", difficulty: "easy" },
  { word: "Пробка на дороге", category: "everyday", difficulty: "medium" },
  { word: "День рождения", category: "everyday", difficulty: "easy" },
  { word: "Квиз", category: "everyday", difficulty: "medium" },
  { word: "Абонемент", category: "everyday", difficulty: "hard" },
  { word: "Подписка", category: "everyday", difficulty: "medium" },
  { word: "Спонтанность", category: "everyday", difficulty: "hard" },
]

export const CATEGORY_LABELS: Record<WordCategory, string> = {
  animals: "Животные",
  food: "Еда",
  professions: "Профессии",
  sports: "Спорт",
  objects: "Предметы",
  places: "Места",
  nature: "Природа",
  movies: "Кино",
  abstract: "Абстракции",
  everyday: "Бытовое",
}

/**
 * Класс для подбора слов с учётом пользовательского списка.
 * Создаётся один раз на старте игры.
 */
export class WordPicker {
  private builtIn: WordEntry[]
  private custom: WordEntry[]
  private recent: string[] = []

  constructor(
    customWords: string[] = [],
    enabledCategories: WordCategory[] = [],
    enabledDifficulties: Difficulty[] = [],
  ) {
    let pool = WORDS
    if (enabledCategories.length > 0) {
      pool = pool.filter((w) => enabledCategories.includes(w.category))
    }
    if (enabledDifficulties.length > 0) {
      pool = pool.filter((w) => enabledDifficulties.includes((w.difficulty ?? "medium") as Difficulty))
    }
    this.builtIn = pool
    this.custom = customWords
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .map((w) => ({ word: w, category: "everyday" as WordCategory, difficulty: "medium" as Difficulty }))
  }

  /** Случайное слово, не повторяя последние ~30 */
  next(): WordEntry {
    const all = [...this.custom, ...this.builtIn]
    let pool = all.filter((w) => !this.recent.includes(w.word))
    if (pool.length === 0) {
      // Кончились уникальные — обнуляем recent и берём из всего пула
      this.recent = []
      pool = all
    }
    if (pool.length === 0) {
      // На случай если пользователь передал пустой список и встроенный пуст
      return { word: "—", category: "everyday" }
    }
    const entry = pool[Math.floor(Math.random() * pool.length)]
    this.recent = [...this.recent.slice(-29), entry.word]
    return entry
  }

  /** Заменить текущее слово (когда игрок жмёт Заменить) */
  swap(currentWord: string): WordEntry {
    const all = [...this.custom, ...this.builtIn]
    let pool = all.filter((w) => !this.recent.includes(w.word) && w.word !== currentWord)
    if (pool.length === 0) {
      this.recent = this.recent.filter((w) => w !== currentWord)
      pool = all.filter((w) => w.word !== currentWord)
    }
    if (pool.length === 0) return { word: currentWord, category: "everyday" }
    const entry = pool[Math.floor(Math.random() * pool.length)]
    this.recent = [...this.recent.slice(-29), entry.word]
    return entry
  }

  get totalAvailable(): number {
    return this.custom.length + this.builtIn.length
  }
}

/** Случайное слово из банка. exclude — список слов, которые не должны выпасть.
 *  enabledCategories — фильтр по категориям (пустой массив = все категории) */
export function pickRandomWord(exclude: string[] = [], enabledCategories: WordCategory[] = []): WordEntry {
  let pool = WORDS.filter((w) => !exclude.includes(w.word))
  if (enabledCategories.length > 0) {
    pool = pool.filter((w) => enabledCategories.includes(w.category))
  }
  const arr = pool.length > 0 ? pool : WORDS
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Случайная грань кубика (1..6) */
export function rollDie(): Method {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]
}
