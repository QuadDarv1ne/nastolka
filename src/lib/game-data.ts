// Игровые данные для Настолки

import type { Lang } from "./i18n"

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

/** Один из 4 базовых способов объяснения (для кубика «Выбор») */
export type BaseMethodId = Exclude<MethodId, "choice" | "reroll">

/** Method с суженным id — как хранится в METHODS */
export type BaseMethod = Method & { id: BaseMethodId }

export const METHODS: Record<BaseMethodId, Method> = {
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
  /** Русское слово — канонический ключ (антиповторы, история, localStorage) */
  word: string
  /** Параллельный перевод для английской локали */
  wordEn?: string
  category: WordCategory
  /** Сложность слова (по умолчанию medium) */
  difficulty?: Difficulty
  /** Опциональная подсказка-ассоциация для команды */
  hint?: string
}

/**
 * Слово для отображения в выбранной языке.
 * Русское остаётся ключом, поэтому при lang="ru" возвращаем word как есть,
 * а для "en" берём перевод; если его нет (свои слова игрока) — fallback на word.
 */
export function localizedWord(entry: Pick<WordEntry, "word" | "wordEn">, lang: Lang): string {
  if (lang === "en" && entry.wordEn) return entry.wordEn
  return entry.word
}

export const WORDS: WordEntry[] = [
  // Животные
  { word: "Медведь", wordEn: "Bear", category: "animals", difficulty: "easy" },
  { word: "Лиса", wordEn: "Fox", category: "animals", difficulty: "easy" },
  { word: "Крокодил", wordEn: "Crocodile", category: "animals", difficulty: "medium" },
  { word: "Попугай", wordEn: "Parrot", category: "animals", difficulty: "medium" },
  { word: "Дельфин", wordEn: "Dolphin", category: "animals", difficulty: "medium" },
  { word: "Страус", wordEn: "Ostrich", category: "animals", difficulty: "medium" },
  { word: "Хамелеон", wordEn: "Chameleon", category: "animals", difficulty: "hard" },
  { word: "Осьминог", wordEn: "Octopus", category: "animals", difficulty: "medium" },
  { word: "Бегемот", wordEn: "Hippopotamus", category: "animals", difficulty: "easy" },
  { word: "Жираф", wordEn: "Giraffe", category: "animals", difficulty: "easy" },
  { word: "Ёжик", wordEn: "Hedgehog", category: "animals", difficulty: "easy" },
  { word: "Пингвин", wordEn: "Penguin", category: "animals", difficulty: "medium" },
  { word: "Кенгуру", wordEn: "Kangaroo", category: "animals", difficulty: "medium" },
  { word: "Сова", wordEn: "Owl", category: "animals", difficulty: "easy" },
  { word: "Панда", wordEn: "Panda", category: "animals", difficulty: "easy" },

  // Еда
  { word: "Пельмени", wordEn: "Dumplings", category: "food", difficulty: "easy" },
  { word: "Пицца", wordEn: "Pizza", category: "food", difficulty: "easy" },
  { word: "Борщ", wordEn: "Borscht", category: "food", difficulty: "easy" },
  { word: "Мороженое", wordEn: "Ice cream", category: "food", difficulty: "easy" },
  { word: "Шашлык", wordEn: "Barbecue", category: "food", difficulty: "medium" },
  { word: "Суши", wordEn: "Sushi", category: "food", difficulty: "easy" },
  { word: "Блины", wordEn: "Pancakes", category: "food", difficulty: "easy" },
  { word: "Хот-дог", wordEn: "Hot dog", category: "food", difficulty: "easy" },
  { word: "Гречка", wordEn: "Buckwheat", category: "food", difficulty: "medium" },
  { word: "Капучино", wordEn: "Cappuccino", category: "food", difficulty: "medium" },
  { word: "Окрошка", wordEn: "Cold soup", category: "food", difficulty: "hard" },
  { word: "Тирамису", wordEn: "Tiramisu", category: "food", difficulty: "hard" },
  { word: "Винегрет", wordEn: "Vinaigrette", category: "food", difficulty: "hard" },
  { word: "Бургер", wordEn: "Burger", category: "food", difficulty: "easy" },
  { word: "Чебурек", wordEn: "Cheburek", category: "food", difficulty: "medium" },

  // Профессии
  { word: "Врач", wordEn: "Doctor", category: "professions", difficulty: "easy" },
  { word: "Программист", wordEn: "Programmer", category: "professions", difficulty: "medium" },
  { word: "Пожарный", wordEn: "Firefighter", category: "professions", difficulty: "medium" },
  { word: "Космонавт", wordEn: "Astronaut", category: "professions", difficulty: "medium" },
  { word: "Учитель", wordEn: "Teacher", category: "professions", difficulty: "easy" },
  { word: "Повар", wordEn: "Chef", category: "professions", difficulty: "easy" },
  { word: "Хирург", wordEn: "Surgeon", category: "professions", difficulty: "medium" },
  { word: "Балерина", wordEn: "Ballerina", category: "professions", difficulty: "medium" },
  { word: "Сантехник", wordEn: "Plumber", category: "professions", difficulty: "medium" },
  { word: "Археолог", wordEn: "Archaeologist", category: "professions", difficulty: "hard" },
  { word: "Дрессировщик", wordEn: "Animal trainer", category: "professions", difficulty: "hard" },
  { word: "Метеоролог", wordEn: "Meteorologist", category: "professions", difficulty: "hard" },
  { word: "Бариста", wordEn: "Barista", category: "professions", difficulty: "medium" },
  { word: "Сомелье", wordEn: "Sommelier", category: "professions", difficulty: "hard" },
  { word: "Актёр", wordEn: "Actor", category: "professions", difficulty: "easy" },

  // Спорт
  { word: "Футбол", wordEn: "Football", category: "sports", difficulty: "easy" },
  { word: "Теннис", wordEn: "Tennis", category: "sports", difficulty: "medium" },
  { word: "Шахматы", wordEn: "Chess", category: "sports", difficulty: "medium" },
  { word: "Серфинг", wordEn: "Surfing", category: "sports", difficulty: "medium" },
  { word: "Бокс", wordEn: "Boxing", category: "sports", difficulty: "easy" },
  { word: "Гольф", wordEn: "Golf", category: "sports", difficulty: "medium" },
  { word: "Хоккей", wordEn: "Hockey", category: "sports", difficulty: "easy" },
  { word: "Баскетбол", wordEn: "Basketball", category: "sports", difficulty: "medium" },
  { word: "Дайвинг", wordEn: "Diving", category: "sports", difficulty: "medium" },
  { word: "Йога", wordEn: "Yoga", category: "sports", difficulty: "easy" },
  { word: "Парашютизм", wordEn: "Skydiving", category: "sports", difficulty: "hard" },
  { word: "Фигурное катание", wordEn: "Figure skating", category: "sports", difficulty: "hard" },
  { word: "Сноуборд", wordEn: "Snowboard", category: "sports", difficulty: "medium" },
  { word: "Регби", wordEn: "Rugby", category: "sports", difficulty: "hard" },
  { word: "Карате", wordEn: "Karate", category: "sports", difficulty: "medium" },

  // Предметы
  { word: "Утюг", wordEn: "Iron", category: "objects", difficulty: "easy" },
  { word: "Чемодан", wordEn: "Suitcase", category: "objects", difficulty: "medium" },
  { word: "Зонтик", wordEn: "Umbrella", category: "objects", difficulty: "easy" },
  { word: "Телевизор", wordEn: "TV set", category: "objects", difficulty: "medium" },
  { word: "Будильник", wordEn: "Alarm clock", category: "objects", difficulty: "medium" },
  { word: "Пылесос", wordEn: "Vacuum cleaner", category: "objects", difficulty: "medium" },
  { word: "Очки", wordEn: "Glasses", category: "objects", difficulty: "easy" },
  { word: "Велосипед", wordEn: "Bicycle", category: "objects", difficulty: "medium" },
  { word: "Самовар", wordEn: "Samovar", category: "objects", difficulty: "hard" },
  { word: "Подзорная труба", wordEn: "Spyglass", category: "objects", difficulty: "hard" },
  { word: "Бинокль", wordEn: "Binoculars", category: "objects", difficulty: "medium" },
  { word: "Микроволновка", wordEn: "Microwave", category: "objects", difficulty: "medium" },
  { word: "Калькулятор", wordEn: "Calculator", category: "objects", difficulty: "medium" },
  { word: "Компас", wordEn: "Compass", category: "objects", difficulty: "medium" },
  { word: "Веник", wordEn: "Broom", category: "objects", difficulty: "easy" },

  // Места
  { word: "Эйфелева башня", wordEn: "Eiffel Tower", category: "places", difficulty: "hard" },
  { word: "Красная площадь", wordEn: "Red Square", category: "places", difficulty: "hard" },
  { word: "Пирамида Хеопса", wordEn: "Pyramid of Giza", category: "places", difficulty: "hard" },
  { word: "Колизей", wordEn: "Colosseum", category: "places", difficulty: "hard" },
  { word: "Биг-Бен", wordEn: "Big Ben", category: "places", difficulty: "hard" },
  { word: "Метро", wordEn: "Subway", category: "places", difficulty: "easy" },
  { word: "Цирк", wordEn: "Circus", category: "places", difficulty: "easy" },
  { word: "Баня", wordEn: "Sauna", category: "places", difficulty: "easy" },
  { word: "Библиотека", wordEn: "Library", category: "places", difficulty: "medium" },
  { word: "Луна-парк", wordEn: "Amusement park", category: "places", difficulty: "medium" },
  { word: "Аквапарк", wordEn: "Water park", category: "places", difficulty: "medium" },
  { word: "Остров", wordEn: "Island", category: "places", difficulty: "medium" },
  { word: "Вулкан", wordEn: "Volcano", category: "places", difficulty: "medium" },
  { word: "Маяк", wordEn: "Lighthouse", category: "places", difficulty: "medium" },
  { word: "Замок", wordEn: "Castle", category: "places", difficulty: "easy" },

  // Природа
  { word: "Водопад", wordEn: "Waterfall", category: "nature", difficulty: "medium" },
  { word: "Радуга", wordEn: "Rainbow", category: "nature", difficulty: "easy" },
  { word: "Молния", wordEn: "Lightning", category: "nature", difficulty: "medium" },
  { word: "Снегопад", wordEn: "Snowfall", category: "nature", difficulty: "medium" },
  { word: "Северное сияние", wordEn: "Northern lights", category: "nature", difficulty: "hard" },
  { word: "Торнадо", wordEn: "Tornado", category: "nature", difficulty: "hard" },
  { word: "Закат", wordEn: "Sunset", category: "nature", difficulty: "easy" },
  { word: "Метеорит", wordEn: "Meteorite", category: "nature", difficulty: "hard" },
  { word: "Гейзер", wordEn: "Geyser", category: "nature", difficulty: "hard" },
  { word: "Айсберг", wordEn: "Iceberg", category: "nature", difficulty: "medium" },
  { word: "Гриб", wordEn: "Mushroom", category: "nature", difficulty: "easy" },
  { word: "Одуванчик", wordEn: "Dandelion", category: "nature", difficulty: "medium" },

  // Кино и культура
  { word: "Бэтмен", wordEn: "Batman", category: "movies", difficulty: "medium" },
  { word: "Гарри Поттер", wordEn: "Harry Potter", category: "movies", difficulty: "medium" },
  { word: "Шрек", wordEn: "Shrek", category: "movies", difficulty: "easy" },
  { word: "Человек-паук", wordEn: "Spider-Man", category: "movies", difficulty: "medium" },
  { word: "Король Лев", wordEn: "The Lion King", category: "movies", difficulty: "medium" },
  { word: "Титаник", wordEn: "Titanic", category: "movies", difficulty: "medium" },
  { word: "Маска", wordEn: "The Mask", category: "movies", difficulty: "easy" },
  { word: "Один дома", wordEn: "Home Alone", category: "movies", difficulty: "medium" },
  { word: "Звёздные войны", wordEn: "Star Wars", category: "movies", difficulty: "hard" },
  { word: "Холодное сердце", wordEn: "Frozen", category: "movies", difficulty: "hard" },
  { word: "Аватар", wordEn: "Avatar", category: "movies", difficulty: "medium" },
  { word: "Джокер", wordEn: "Joker", category: "movies", difficulty: "medium" },

  // Абстракции
  { word: "Любовь", wordEn: "Love", category: "abstract", difficulty: "medium" },
  { word: "Дружба", wordEn: "Friendship", category: "abstract", difficulty: "medium" },
  { word: "Тоска", wordEn: "Yearning", category: "abstract", difficulty: "hard" },
  { word: "Счастье", wordEn: "Happiness", category: "abstract", difficulty: "medium" },
  { word: "Ностальгия", wordEn: "Nostalgia", category: "abstract", difficulty: "hard" },
  { word: "Вдохновение", wordEn: "Inspiration", category: "abstract", difficulty: "hard" },
  { word: "Зависть", wordEn: "Envy", category: "abstract", difficulty: "hard" },
  { word: "Лень", wordEn: "Laziness", category: "abstract", difficulty: "easy" },
  { word: "Свобода", wordEn: "Freedom", category: "abstract", difficulty: "medium" },
  { word: "Ревность", wordEn: "Jealousy", category: "abstract", difficulty: "hard" },

  // Бытовое
  { word: "Стирка", wordEn: "Laundry", category: "everyday", difficulty: "medium" },
  { word: "Уборка", wordEn: "Cleaning", category: "everyday", difficulty: "medium" },
  { word: "Ремонт", wordEn: "Renovation", category: "everyday", difficulty: "medium" },
  { word: "Пробка", wordEn: "Traffic jam", category: "everyday", difficulty: "medium" },
  { word: "Будильник", wordEn: "Alarm clock", category: "everyday", difficulty: "medium" },
  { word: "Очередь", wordEn: "Queue", category: "everyday", difficulty: "medium" },
  { word: "Деньги", wordEn: "Money", category: "everyday", difficulty: "easy" },
  { word: "Отпуск", wordEn: "Vacation", category: "everyday", difficulty: "easy" },
  { word: "Дедлайн", wordEn: "Deadline", category: "everyday", difficulty: "hard" },
  { word: "Кофе с молоком", wordEn: "Latte", category: "everyday", difficulty: "medium" },

  // ─── Дополнительные слова (v10) ───

  // Животные — доп
  { word: "Капибара", wordEn: "Capybara", category: "animals", difficulty: "medium" },
  { word: "Енот", wordEn: "Raccoon", category: "animals", difficulty: "easy" },
  { word: "Лемур", wordEn: "Lemur", category: "animals", difficulty: "hard" },
  { word: "Тукан", wordEn: "Toucan", category: "animals", difficulty: "medium" },
  { word: "Морской котик", wordEn: "Fur seal", category: "animals", difficulty: "hard" },
  { word: "Черепаха", wordEn: "Turtle", category: "animals", difficulty: "medium" },
  { word: "Хорёк", wordEn: "Ferret", category: "animals", difficulty: "hard" },
  { word: "Ленивец", wordEn: "Sloth", category: "animals", difficulty: "medium" },

  // Еда — доп
  { word: "Хот-дог", wordEn: "Hot dog", category: "food", difficulty: "easy" },
  { word: "Лаваш", wordEn: "Lavash", category: "food", difficulty: "medium" },
  { word: "Халва", wordEn: "Halva", category: "food", difficulty: "hard" },
  { word: "Селёдка", wordEn: "Herring", category: "food", difficulty: "medium" },
  { word: "Сырники", wordEn: "Syrniki", category: "food", difficulty: "medium" },
  { word: "Лавашак", wordEn: "Lavashak", category: "food", difficulty: "hard" },
  { word: "Квас", wordEn: "Kvass", category: "food", difficulty: "medium" },
  { word: "Пахлава", wordEn: "Pakhlava", category: "food", difficulty: "hard" },

  // Профессии — доп
  { word: "Пилот", wordEn: "Pilot", category: "professions", difficulty: "easy" },
  { word: "Юрист", wordEn: "Lawyer", category: "professions", difficulty: "medium" },
  { word: "Каскадёр", wordEn: "Stuntman", category: "professions", difficulty: "hard" },
  { word: "Тату-мастер", wordEn: "Tattoo artist", category: "professions", difficulty: "hard" },
  { word: "Астроном", wordEn: "Astronomer", category: "professions", difficulty: "hard" },
  { word: "Психолог", wordEn: "Psychologist", category: "professions", difficulty: "medium" },
  { word: "Аниматор", wordEn: "Animator", category: "professions", difficulty: "medium" },
  { word: "Диджей", wordEn: "DJ", category: "professions", difficulty: "easy" },

  // Спорт — доп
  { word: "Сёрфинг", wordEn: "Surfing", category: "sports", difficulty: "medium" },
  { word: "Кёрлинг", wordEn: "Curling", category: "sports", difficulty: "hard" },
  { word: "Прыжки с парашютом", wordEn: "Skydiving", category: "sports", difficulty: "hard" },
  { word: "Скалолазание", wordEn: "Rock climbing", category: "sports", difficulty: "hard" },
  { word: "Боулинг", wordEn: "Bowling", category: "sports", difficulty: "easy" },
  { word: "Дартс", wordEn: "Darts", category: "sports", difficulty: "easy" },
  { word: "Бильярд", wordEn: "Billiards", category: "sports", difficulty: "medium" },
  { word: "Полотно", wordEn: "Canvas", category: "sports", difficulty: "hard" },

  // Предметы — доп
  { word: "Календарь", wordEn: "Calendar", category: "objects", difficulty: "medium" },
  { word: "Подсвечник", wordEn: "Candlestick", category: "objects", difficulty: "hard" },
  { word: "Лупа", wordEn: "Magnifying glass", category: "objects", difficulty: "easy" },
  { word: "Флешка", wordEn: "USB flash drive", category: "objects", difficulty: "medium" },
  { word: "Лопата", wordEn: "Shovel", category: "objects", difficulty: "easy" },
  { word: "Термометр", wordEn: "Thermometer", category: "objects", difficulty: "hard" },
  { word: "Глобус", wordEn: "Globe", category: "objects", difficulty: "medium" },
  { word: "Часы", wordEn: "Clock", category: "objects", difficulty: "easy" },

  // Места — доп
  { word: "Эрмитаж", wordEn: "Hermitage", category: "places", difficulty: "hard" },
  { word: "Стадион", wordEn: "Stadium", category: "places", difficulty: "easy" },
  { word: "Кинотеатр", wordEn: "Cinema", category: "places", difficulty: "easy" },
  { word: "ТЦ", wordEn: "Shopping mall", category: "places", difficulty: "medium" },
  { word: "Зоопарк", wordEn: "Zoo", category: "places", difficulty: "easy" },
  { word: "Горы", wordEn: "Mountains", category: "places", difficulty: "easy" },
  { word: "Пляж", wordEn: "Beach", category: "places", difficulty: "easy" },
  { word: "Водохранилище", wordEn: "Reservoir", category: "places", difficulty: "hard" },

  // Природа — доп
  { word: "Звезда", wordEn: "Star", category: "nature", difficulty: "easy" },
  { word: "Луна", wordEn: "Moon", category: "nature", difficulty: "easy" },
  { word: "Туман", wordEn: "Fog", category: "nature", difficulty: "medium" },
  { word: "Роса", wordEn: "Dew", category: "nature", difficulty: "hard" },
  { word: "Гроза", wordEn: "Thunderstorm", category: "nature", difficulty: "medium" },
  { word: "Полярная звезда", wordEn: "North Star", category: "nature", difficulty: "hard" },
  { word: "Облако", wordEn: "Cloud", category: "nature", difficulty: "easy" },
  { word: "Комета", wordEn: "Comet", category: "nature", difficulty: "medium" },

  // Кино — доп
  { word: "Властелин колец", wordEn: "The Lord of the Rings", category: "movies", difficulty: "hard" },
  { word: "Назад в будущее", wordEn: "Back to the Future", category: "movies", difficulty: "hard" },
  { word: "Чебурашка", wordEn: "Cheburashka", category: "movies", difficulty: "easy" },
  { word: "Масяня", wordEn: "Masyanya", category: "movies", difficulty: "medium" },
  { word: "Ну, погоди!", wordEn: "Just You Wait!", category: "movies", difficulty: "medium" },
  { word: "Бременские музыканты", wordEn: "The Bremen Musicians", category: "movies", difficulty: "hard" },
  { word: "Барбоскины", wordEn: "The Barkers", category: "movies", difficulty: "medium" },
  { word: "Холодное сердце 2", wordEn: "Frozen 2", category: "movies", difficulty: "hard" },

  // Абстракции — доп
  { word: "Уверенность", wordEn: "Confidence", category: "abstract", difficulty: "hard" },
  { word: "Грусть", wordEn: "Sadness", category: "abstract", difficulty: "medium" },
  { word: "Скука", wordEn: "Boredom", category: "abstract", difficulty: "medium" },
  { word: "Нежность", wordEn: "Tenderness", category: "abstract", difficulty: "hard" },
  { word: "Энергия", wordEn: "Energy", category: "abstract", difficulty: "medium" },
  { word: "Харизма", wordEn: "Charisma", category: "abstract", difficulty: "hard" },
  { word: "Дружелюбие", wordEn: "Friendliness", category: "abstract", difficulty: "hard" },
  { word: "Храбрость", wordEn: "Bravery", category: "abstract", difficulty: "hard" },

  // Бытовое — доп
  { word: "Зарядка", wordEn: "Morning exercises", category: "everyday", difficulty: "easy" },
  { word: "Завтрак", wordEn: "Breakfast", category: "everyday", difficulty: "easy" },
  { word: "Пробка на дороге", wordEn: "Traffic jam", category: "everyday", difficulty: "medium" },
  { word: "День рождения", wordEn: "Birthday", category: "everyday", difficulty: "easy" },
  { word: "Квиз", wordEn: "Quiz", category: "everyday", difficulty: "medium" },
  { word: "Абонемент", wordEn: "Membership pass", category: "everyday", difficulty: "hard" },
  { word: "Подписка", wordEn: "Subscription", category: "everyday", difficulty: "medium" },
  { word: "Спонтанность", wordEn: "Spontaneity", category: "everyday", difficulty: "hard" },
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
      return { word: "—", wordEn: "—", category: "everyday" }
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
