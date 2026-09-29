// Игровые данные для "Настолки"

import type { Lang } from "./i18n"

export type MethodId = "words" | "songs" | "drawings" | "gestures" | "yesno" | "choice" | "reroll"

export interface Method {
  id: MethodId
  /** Короткое название для грани кубика (русский) */
  label: string
  /** Подсказка/описание, что делать (русский) */
  hint: string
  /** English label */
  labelEn: string
  /** English hint */
  hintEn: string
  /** Иконка (имя из lucide-react) */
  icon: string
  /** Цвет грани (Tailwind классы) */
  color: string
  /** Градиент для фона */
  gradient: string
}

/** Get localized label/hint for a method based on language */
export function methodLabel(method: Method, lang: Lang): string {
  return lang === "en" ? method.labelEn : method.label
}

export function methodHint(method: Method, lang: Lang): string {
  return lang === "en" ? method.hintEn : method.hint
}

export const METHODS: Record<Exclude<MethodId, "choice" | "reroll">, Method> = {
  words: {
    id: "words",
    label: "Словами",
    hint: "Объясни слово другими словами. Нельзя называть однокоренные.",
    labelEn: "Words",
    hintEn: "Explain the word using other words. Don't use cognates.",
    icon: "Type",
    color: "bg-emerald-500 text-white",
    gradient: "from-emerald-400 to-teal-500",
  },
  songs: {
    id: "songs",
    label: "Песнями",
    hint: "Спой фрагмент песни, в которой встречается это слово или которая с ним связана.",
    labelEn: "Songs",
    hintEn: "Sing a snippet of a song that contains the word or is related to it.",
    icon: "Music",
    color: "bg-rose-500 text-white",
    gradient: "from-rose-400 to-pink-500",
  },
  drawings: {
    id: "drawings",
    label: "Рисунком",
    hint: "Нарисуй слово на листе бумаги. Нельзя писать буквы и цифры.",
    labelEn: "Drawing",
    hintEn: "Draw the word on a piece of paper. No letters or numbers allowed.",
    icon: "Brush",
    color: "bg-amber-500 text-white",
    gradient: "from-amber-400 to-orange-500",
  },
  gestures: {
    id: "gestures",
    label: "Жестами",
    hint: "Покажи слово жестами и мимикой. Нельзя издавать звуки.",
    labelEn: "Gestures",
    hintEn: "Show the word with gestures and facial expressions. No sounds allowed.",
    icon: "Hand",
    color: "bg-violet-500 text-white",
    gradient: "from-violet-400 to-purple-500",
  },
  yesno: {
    id: "yesno",
    label: "Да-Нет",
    hint: "Команда задаёт вопросы, на которые можно ответить только «да» или «нет». Ведущий отвечает, помогая угадать слово.",
    labelEn: "Yes-No",
    hintEn: "The team asks questions that can only be answered with 'yes' or 'no'. The host answers to help guess the word.",
    icon: "HelpCircle",
    color: "bg-teal-500 text-white",
    gradient: "from-teal-400 to-cyan-500",
  },
}

export const SPECIAL_METHODS: Record<"choice" | "reroll", Method> = {
  choice: {
    id: "choice",
    label: "Выбор",
    hint: "Команда сама выбирает способ объяснения: словами, песнями, рисунком, жестами или да-нет.",
    labelEn: "Choice",
    hintEn: "The team picks the explanation method: words, songs, drawing, gestures, or yes-no.",
    icon: "Sparkles",
    color: "bg-sky-500 text-white",
    gradient: "from-sky-400 to-cyan-500",
  },
  reroll: {
    id: "reroll",
    label: "Ещё раз",
    hint: "Бросай кубик ещё раз — даём шанс на бонусный раунд!",
    labelEn: "Reroll",
    hintEn: "Roll the dice again — get a chance for a bonus round!",
    icon: "Dices",
    color: "bg-indigo-500 text-white",
    gradient: "from-indigo-400 to-blue-500",
  },
}

/** Все грани кубика — 8 вариантов */
export const DICE_FACES: Method[] = [
  METHODS.words,
  METHODS.songs,
  METHODS.drawings,
  METHODS.gestures,
  METHODS.yesno,
  SPECIAL_METHODS.choice,
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
  | "it_architecture"
  | "it_processing"
  | "it_theory"
  | "it_programming"
  | "it_security"
  | "it_internet"
  | "it_ai"

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

export const METHOD_POINTS: Record<Exclude<MethodId, "choice" | "reroll">, number> = {
  words: 1,
  songs: 2,
  drawings: 2,
  gestures: 3,
  yesno: 2,
}

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

export function getRoundPoints(
  method: Method | null,
  chosenMethodForChoice: MethodId | null,
  word: WordEntry | null,
): number {
  if (!method || !word) return 0
  let methodId: MethodId = method.id
  if (method.id === "choice" && chosenMethodForChoice) methodId = chosenMethodForChoice
  if (methodId === "reroll") return 0
  const m = METHOD_POINTS[methodId as Exclude<MethodId, "choice" | "reroll">] ?? 1
  const d = DIFFICULTY_POINTS[word.difficulty ?? "medium"] ?? 2
  return m + d
}

/**
 * Бонусные очки за серию успешных раундов.
 * Серия считается у команды: 0 для streak<3, +1 для 3-4, +2 для 5-9, +3 для 10+.
 * Бонус применяется к basePoints перед умножением на множитель.
 */
export function getStreakBonus(streak: number): number {
  if (streak < 3) return 0
  if (streak < 5) return 1
  if (streak < 10) return 2
  return 3
}

/** Возвращает true, если данный streak — это milestone (3, 5 или 10) */
export function isStreakMilestone(streak: number): boolean {
  return streak === 3 || streak === 5 || streak === 10
}

export interface WordEntry {
  word: string
  /** English version of the word (for English language display) */
  wordEn?: string
  category: WordCategory
  difficulty?: Difficulty
  hint?: string
}

/** Get the word for the given language */
export function localizedWord(entry: WordEntry, lang: Lang): string {
  if (lang === "en" && entry.wordEn) return entry.wordEn
  return entry.word
}

export const WORDS: WordEntry[] = [
  // Животные / Animals
  { word: "Медведь", wordEn: "Bear", category: "animals" },
  { word: "Лиса", wordEn: "Fox", category: "animals" },
  { word: "Крокодил", wordEn: "Crocodile", category: "animals" },
  { word: "Попугай", wordEn: "Parrot", category: "animals" },
  { word: "Дельфин", wordEn: "Dolphin", category: "animals" },
  { word: "Страус", wordEn: "Ostrich", category: "animals" },
  { word: "Хамелеон", wordEn: "Chameleon", category: "animals" },
  { word: "Осьминог", wordEn: "Octopus", category: "animals" },
  { word: "Бегемот", wordEn: "Hippopotamus", category: "animals" },
  { word: "Жираф", wordEn: "Giraffe", category: "animals" },
  { word: "Ёжик", wordEn: "Hedgehog", category: "animals" },
  { word: "Пингвин", wordEn: "Penguin", category: "animals" },
  { word: "Кенгуру", wordEn: "Kangaroo", category: "animals" },
  { word: "Сова", wordEn: "Owl", category: "animals" },
  { word: "Панда", wordEn: "Panda", category: "animals" },

  // Еда / Food
  { word: "Пельмени", wordEn: "Dumplings", category: "food" },
  { word: "Пицца", wordEn: "Pizza", category: "food" },
  { word: "Борщ", wordEn: "Borscht", category: "food" },
  { word: "Мороженое", wordEn: "Ice cream", category: "food" },
  { word: "Шашлык", wordEn: "Barbecue", category: "food" },
  { word: "Суши", wordEn: "Sushi", category: "food" },
  { word: "Блины", wordEn: "Pancakes", category: "food" },
  { word: "Хот-дог", wordEn: "Hot dog", category: "food" },
  { word: "Гречка", wordEn: "Buckwheat", category: "food" },
  { word: "Капучино", wordEn: "Cappuccino", category: "food" },
  { word: "Окрошка", wordEn: "Cold soup", category: "food" },
  { word: "Тирамису", wordEn: "Tiramisu", category: "food" },
  { word: "Винегрет", wordEn: "Vinaigrette", category: "food" },
  { word: "Бургер", wordEn: "Burger", category: "food" },
  { word: "Чебурек", wordEn: "Cheburek", category: "food" },

  // Профессии / Professions
  { word: "Врач", wordEn: "Doctor", category: "professions" },
  { word: "Программист", wordEn: "Programmer", category: "professions" },
  { word: "Пожарный", wordEn: "Firefighter", category: "professions" },
  { word: "Космонавт", wordEn: "Astronaut", category: "professions" },
  { word: "Учитель", wordEn: "Teacher", category: "professions" },
  { word: "Повар", wordEn: "Chef", category: "professions" },
  { word: "Хирург", wordEn: "Surgeon", category: "professions" },
  { word: "Балерина", wordEn: "Ballerina", category: "professions" },
  { word: "Сантехник", wordEn: "Plumber", category: "professions" },
  { word: "Археолог", wordEn: "Archaeologist", category: "professions" },
  { word: "Дрессировщик", wordEn: "Animal trainer", category: "professions" },
  { word: "Метеоролог", wordEn: "Meteorologist", category: "professions" },
  { word: "Бариста", wordEn: "Barista", category: "professions" },
  { word: "Сомелье", wordEn: "Sommelier", category: "professions" },
  { word: "Актёр", wordEn: "Actor", category: "professions" },

  // Спорт / Sports
  { word: "Футбол", wordEn: "Football", category: "sports" },
  { word: "Теннис", wordEn: "Tennis", category: "sports" },
  { word: "Шахматы", wordEn: "Chess", category: "sports" },
  { word: "Серфинг", wordEn: "Surfing", category: "sports" },
  { word: "Бокс", wordEn: "Boxing", category: "sports" },
  { word: "Гольф", wordEn: "Golf", category: "sports" },
  { word: "Хоккей", wordEn: "Hockey", category: "sports" },
  { word: "Баскетбол", wordEn: "Basketball", category: "sports" },
  { word: "Дайвинг", wordEn: "Diving", category: "sports" },
  { word: "Йога", wordEn: "Yoga", category: "sports" },
  { word: "Парашютизм", wordEn: "Skydiving", category: "sports" },
  { word: "Фигурное катание", wordEn: "Figure skating", category: "sports" },
  { word: "Сноуборд", wordEn: "Snowboard", category: "sports" },
  { word: "Регби", wordEn: "Rugby", category: "sports" },
  { word: "Карате", wordEn: "Karate", category: "sports" },

  // Предметы / Objects
  { word: "Утюг", wordEn: "Iron", category: "objects" },
  { word: "Чемодан", wordEn: "Suitcase", category: "objects" },
  { word: "Зонтик", wordEn: "Umbrella", category: "objects" },
  { word: "Телевизор", wordEn: "TV set", category: "objects" },
  { word: "Будильник", wordEn: "Alarm clock", category: "objects" },
  { word: "Пылесос", wordEn: "Vacuum cleaner", category: "objects" },
  { word: "Очки", wordEn: "Glasses", category: "objects" },
  { word: "Велосипед", wordEn: "Bicycle", category: "objects" },
  { word: "Самовар", wordEn: "Samovar", category: "objects" },
  { word: "Подзорная труба", wordEn: "Spyglass", category: "objects" },
  { word: "Бинокль", wordEn: "Binoculars", category: "objects" },
  { word: "Микроволновка", wordEn: "Microwave", category: "objects" },
  { word: "Калькулятор", wordEn: "Calculator", category: "objects" },
  { word: "Компас", wordEn: "Compass", category: "objects" },
  { word: "Веник", wordEn: "Broom", category: "objects" },

  // Места / Places
  { word: "Эйфелева башня", wordEn: "Eiffel Tower", category: "places" },
  { word: "Красная площадь", wordEn: "Red Square", category: "places" },
  { word: "Пирамида Хеопса", wordEn: "Pyramid of Giza", category: "places" },
  { word: "Колизей", wordEn: "Colosseum", category: "places" },
  { word: "Биг-Бен", wordEn: "Big Ben", category: "places" },
  { word: "Метро", wordEn: "Subway", category: "places" },
  { word: "Цирк", wordEn: "Circus", category: "places" },
  { word: "Баня", wordEn: "Sauna", category: "places" },
  { word: "Библиотека", wordEn: "Library", category: "places" },
  { word: "Луна-парк", wordEn: "Amusement park", category: "places" },
  { word: "Аквапарк", wordEn: "Water park", category: "places" },
  { word: "Остров", wordEn: "Island", category: "places" },
  { word: "Вулкан", wordEn: "Volcano", category: "places" },
  { word: "Маяк", wordEn: "Lighthouse", category: "places" },
  { word: "Замок", wordEn: "Castle", category: "places" },

  // Природа / Nature
  { word: "Водопад", wordEn: "Waterfall", category: "nature" },
  { word: "Радуга", wordEn: "Rainbow", category: "nature" },
  { word: "Молния", wordEn: "Lightning", category: "nature" },
  { word: "Снегопад", wordEn: "Snowfall", category: "nature" },
  { word: "Северное сияние", wordEn: "Northern lights", category: "nature" },
  { word: "Торнадо", wordEn: "Tornado", category: "nature" },
  { word: "Закат", wordEn: "Sunset", category: "nature" },
  { word: "Метеорит", wordEn: "Meteorite", category: "nature" },
  { word: "Гейзер", wordEn: "Geyser", category: "nature" },
  { word: "Айсберг", wordEn: "Iceberg", category: "nature" },
  { word: "Гриб", wordEn: "Mushroom", category: "nature" },
  { word: "Одуванчик", wordEn: "Dandelion", category: "nature" },

  // Кино и культура / Movies and culture
  { word: "Бэтмен", wordEn: "Batman", category: "movies" },
  { word: "Гарри Поттер", wordEn: "Harry Potter", category: "movies" },
  { word: "Шрек", wordEn: "Shrek", category: "movies" },
  { word: "Человек-паук", wordEn: "Spider-Man", category: "movies" },
  { word: "Король Лев", wordEn: "The Lion King", category: "movies" },
  { word: "Титаник", wordEn: "Titanic", category: "movies" },
  { word: "Маска", wordEn: "The Mask", category: "movies" },
  { word: "Один дома", wordEn: "Home Alone", category: "movies" },
  { word: "Звёздные войны", wordEn: "Star Wars", category: "movies" },
  { word: "Холодное сердце", wordEn: "Frozen", category: "movies" },
  { word: "Аватар", wordEn: "Avatar", category: "movies" },
  { word: "Джокер", wordEn: "Joker", category: "movies" },

  // Абстракции / Abstract — эмоции и чувства с чётким визуальным/жестовым образом
  { word: "Любовь", wordEn: "Love", category: "abstract" },
  { word: "Дружба", wordEn: "Friendship", category: "abstract" },
  { word: "Счастье", wordEn: "Happiness", category: "abstract" },
  { word: "Лень", wordEn: "Laziness", category: "abstract" },
  { word: "Гнев", wordEn: "Anger", category: "abstract" },
  { word: "Грусть", wordEn: "Sadness", category: "abstract" },
  { word: "Усталость", wordEn: "Tiredness", category: "abstract" },
  { word: "Скука", wordEn: "Boredom", category: "abstract" },
  { word: "Удивление", wordEn: "Surprise", category: "abstract" },
  { word: "Страх", wordEn: "Fear", category: "abstract" },

  // Бытовое / Everyday
  { word: "Стирка", wordEn: "Laundry", category: "everyday" },
  { word: "Уборка", wordEn: "Cleaning", category: "everyday" },
  { word: "Ремонт", wordEn: "Renovation", category: "everyday" },
  { word: "Пробка", wordEn: "Traffic jam", category: "everyday" },
  { word: "Очередь", wordEn: "Queue", category: "everyday" },
  { word: "Деньги", wordEn: "Money", category: "everyday" },
  { word: "Отпуск", wordEn: "Vacation", category: "everyday" },
  { word: "Кофе с молоком", wordEn: "Latte", category: "everyday" },
  { word: "Завтрак", wordEn: "Breakfast", category: "everyday" },
  { word: "Покупки", wordEn: "Shopping", category: "everyday" },

  // ═══ IT: Архитектура информационных систем ═══
  { word: "Компьютер", wordEn: "Computer", category: "it_architecture", difficulty: "easy" },
  { word: "Сервер", wordEn: "Server", category: "it_architecture", difficulty: "easy" },
  { word: "Клиент", wordEn: "Client", category: "it_architecture", difficulty: "easy" },
  { word: "База данных", wordEn: "Database", category: "it_architecture", difficulty: "easy" },
  { word: "Сеть", wordEn: "Network", category: "it_architecture", difficulty: "easy" },
  { word: "Интернет", wordEn: "Internet", category: "it_architecture", difficulty: "easy" },
  { word: "Сайт", wordEn: "Website", category: "it_architecture", difficulty: "easy" },
  { word: "Приложение", wordEn: "Application", category: "it_architecture", difficulty: "easy" },
  { word: "Программа", wordEn: "Program", category: "it_architecture", difficulty: "easy" },
  { word: "Файл", wordEn: "File", category: "it_architecture", difficulty: "easy" },
  { word: "Пароль", wordEn: "Password", category: "it_architecture", difficulty: "easy" },
  { word: "Пользователь", wordEn: "User", category: "it_architecture", difficulty: "easy" },
  { word: "Админ", wordEn: "Admin", category: "it_architecture", difficulty: "medium" },
  { word: "Облако", wordEn: "Cloud", category: "it_architecture", difficulty: "medium" },
  { word: "Интерфейс", wordEn: "Interface", category: "it_architecture", difficulty: "medium" },
  { word: "Кэш", wordEn: "Cache", category: "it_architecture", difficulty: "medium" },

  // ═══ IT: Технологии обработки информации ═══
  { word: "Сжатие", wordEn: "Compression", category: "it_processing", difficulty: "medium" },
  { word: "Текст", wordEn: "Text", category: "it_processing", difficulty: "easy" },
  { word: "Картинка", wordEn: "Image", category: "it_processing", difficulty: "easy" },
  { word: "Звук", wordEn: "Sound", category: "it_processing", difficulty: "easy" },
  { word: "Видео", wordEn: "Video", category: "it_processing", difficulty: "easy" },
  { word: "Таблица", wordEn: "Table", category: "it_processing", difficulty: "easy" },
  { word: "Папка", wordEn: "Folder", category: "it_processing", difficulty: "easy" },
  { word: "Архив", wordEn: "Archive", category: "it_processing", difficulty: "easy" },
  { word: "Поиск", wordEn: "Search", category: "it_processing", difficulty: "easy" },
  { word: "Сортировка", wordEn: "Sorting", category: "it_processing", difficulty: "easy" },
  { word: "Фильтр", wordEn: "Filter", category: "it_processing", difficulty: "easy" },
  { word: "Копия", wordEn: "Copy", category: "it_processing", difficulty: "easy" },
  { word: "Сохранение", wordEn: "Save", category: "it_processing", difficulty: "easy" },

  // ═══ IT: Теория информационных процессов и систем ═══
  { word: "Сообщение", wordEn: "Message", category: "it_theory", difficulty: "easy" },
  { word: "Сигнал", wordEn: "Signal", category: "it_theory", difficulty: "medium" },
  { word: "Шум", wordEn: "Noise", category: "it_theory", difficulty: "medium" },
  { word: "Связь", wordEn: "Communication", category: "it_theory", difficulty: "easy" },
  { word: "Телефон", wordEn: "Phone", category: "it_theory", difficulty: "easy" },
  { word: "Радио", wordEn: "Radio", category: "it_theory", difficulty: "easy" },
  { word: "Код", wordEn: "Code", category: "it_theory", difficulty: "easy" },
  { word: "Шифр", wordEn: "Cipher", category: "it_theory", difficulty: "medium" },
  { word: "Память", wordEn: "Memory", category: "it_theory", difficulty: "easy" },
  { word: "Скорость", wordEn: "Speed", category: "it_theory", difficulty: "easy" },

  // ═══ IT: Программирование и разработка ═══
  { word: "Баг", wordEn: "Bug", category: "it_programming", difficulty: "easy" },
  { word: "Вирус", wordEn: "Virus", category: "it_programming", difficulty: "easy" },
  { word: "Браузер", wordEn: "Browser", category: "it_programming", difficulty: "easy" },
  { word: "Иконка", wordEn: "Icon", category: "it_programming", difficulty: "easy" },
  { word: "Курсор", wordEn: "Cursor", category: "it_programming", difficulty: "easy" },
  { word: "Кнопка", wordEn: "Button", category: "it_programming", difficulty: "easy" },
  { word: "Окно", wordEn: "Window", category: "it_programming", difficulty: "easy" },
  { word: "Принтер", wordEn: "Printer", category: "it_programming", difficulty: "easy" },
  { word: "Скрипт", wordEn: "Script", category: "it_programming", difficulty: "medium" },
  { word: "Меню", wordEn: "Menu", category: "it_programming", difficulty: "medium" },
  { word: "Клавиатура", wordEn: "Keyboard", category: "it_programming", difficulty: "medium" },
  { word: "Колонка", wordEn: "Speaker", category: "it_programming", difficulty: "medium" },

  // ═══ IT: Кибербезопасность ═══
  { word: "Хакер", wordEn: "Hacker", category: "it_security", difficulty: "easy" },
  { word: "Бэкап", wordEn: "Backup", category: "it_security", difficulty: "easy" },
  { word: "Ключ", wordEn: "Key", category: "it_security", difficulty: "easy" },
  { word: "Антивирус", wordEn: "Antivirus", category: "it_security", difficulty: "easy" },
  { word: "Щит", wordEn: "Shield", category: "it_security", difficulty: "easy" },
  { word: "Брандмауэр", wordEn: "Firewall", category: "it_security", difficulty: "medium" },
  { word: "Фишинг", wordEn: "Phishing", category: "it_security", difficulty: "medium" },
  { word: "Шпион", wordEn: "Spy", category: "it_security", difficulty: "medium" },
  { word: "Капча", wordEn: "Captcha", category: "it_security", difficulty: "medium" },
  { word: "Троян", wordEn: "Trojan", category: "it_security", difficulty: "medium" },

  // ═══ IT: Интернет и социальные сети ═══
  { word: "Ссылка", wordEn: "Link", category: "it_internet", difficulty: "easy" },
  { word: "Чат", wordEn: "Chat", category: "it_internet", difficulty: "easy" },
  { word: "Почта", wordEn: "Mail", category: "it_internet", difficulty: "easy" },
  { word: "Лайк", wordEn: "Like", category: "it_internet", difficulty: "easy" },
  { word: "Хэштег", wordEn: "Hashtag", category: "it_internet", difficulty: "easy" },
  { word: "Селфи", wordEn: "Selfie", category: "it_internet", difficulty: "easy" },
  { word: "Блог", wordEn: "Blog", category: "it_internet", difficulty: "medium" },
  { word: "Мем", wordEn: "Meme", category: "it_internet", difficulty: "medium" },
  { word: "Стрим", wordEn: "Stream", category: "it_internet", difficulty: "medium" },
  { word: "Подписчик", wordEn: "Subscriber", category: "it_internet", difficulty: "medium" },

  // ═══ IT: Искусственный интеллект ═══
  { word: "Робот", wordEn: "Robot", category: "it_ai", difficulty: "easy" },
  { word: "Дрон", wordEn: "Drone", category: "it_ai", difficulty: "easy" },
  { word: "Робот-пылесос", wordEn: "Robot vacuum", category: "it_ai", difficulty: "easy" },
  { word: "Умные часы", wordEn: "Smartwatch", category: "it_ai", difficulty: "easy" },
  { word: "Нейросеть", wordEn: "Neural network", category: "it_ai", difficulty: "medium" },
  { word: "Чат-бот", wordEn: "Chatbot", category: "it_ai", difficulty: "medium" },
  { word: "Автопилот", wordEn: "Autopilot", category: "it_ai", difficulty: "medium" },
  { word: "Распознавание", wordEn: "Recognition", category: "it_ai", difficulty: "medium" },
  { word: "Голосовой помощник", wordEn: "Voice assistant", category: "it_ai", difficulty: "medium" },
  { word: "Виртуальная реальность", wordEn: "Virtual reality", category: "it_ai", difficulty: "hard" },
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
  it_architecture: "ИТ: Архитектура информационных систем",
  it_processing: "ИТ: Технологии обработки информации",
  it_theory: "ИТ: Теория информационных процессов и систем",
  it_programming: "ИТ: Программирование и разработка",
  it_security: "ИТ: Кибербезопасность",
  it_internet: "ИТ: Интернет и социальные сети",
  it_ai: "ИТ: Искусственный интеллект",
}

/** Случайное слово из банка */
export function pickRandomWord(exclude: string[] = [], enabledCategories: WordCategory[] = []): WordEntry {
  let pool = WORDS.filter((w) => !exclude.includes(w.word) && !exclude.includes(w.wordEn ?? ""))
  if (enabledCategories.length > 0) pool = pool.filter((w) => enabledCategories.includes(w.category))
  const arr = pool.length > 0 ? pool : WORDS
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Случайная грань кубика (1..6) */
export function rollDie(): Method {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]
}

/** Класс для подбора слов с учётом пользовательского списка и фильтров */
export class WordPicker {
  private builtIn: WordEntry[]
  private custom: WordEntry[]
  private recent: string[] = []

  constructor(customWords: string[] = [], enabledCategories: WordCategory[] = [], enabledDifficulties: Difficulty[] = []) {
    let pool = WORDS
    if (enabledCategories.length > 0) pool = pool.filter((w) => enabledCategories.includes(w.category))
    if (enabledDifficulties.length > 0) pool = pool.filter((w) => enabledDifficulties.includes((w.difficulty ?? "medium") as Difficulty))
    this.builtIn = pool
    this.custom = customWords.map((w) => w.trim()).filter((w) => w.length > 0).map((w) => ({ word: w, category: "everyday" as WordCategory, difficulty: "medium" as Difficulty }))
  }

  next(): WordEntry {
    const all = [...this.custom, ...this.builtIn]
    let pool = all.filter((w) => !this.recent.includes(w.word) && !this.recent.includes(w.wordEn ?? ""))
    if (pool.length === 0) { this.recent = []; pool = all }
    if (pool.length === 0) return { word: "—", category: "everyday" }
    const entry = pool[Math.floor(Math.random() * pool.length)]
    this.recent = [...this.recent.slice(-29), entry.word, entry.wordEn ?? entry.word]
    return entry
  }

  swap(currentWord: string): WordEntry {
    const all = [...this.custom, ...this.builtIn]
    let pool = all.filter((w) => !this.recent.includes(w.word) && !this.recent.includes(w.wordEn ?? "") && w.word !== currentWord && w.wordEn !== currentWord)
    if (pool.length === 0) { this.recent = this.recent.filter((w) => w !== currentWord); pool = all.filter((w) => w.word !== currentWord && w.wordEn !== currentWord) }
    if (pool.length === 0) return { word: currentWord, category: "everyday" }
    const entry = pool[Math.floor(Math.random() * pool.length)]
    this.recent = [...this.recent.slice(-29), entry.word, entry.wordEn ?? entry.word]
    return entry
  }
}
