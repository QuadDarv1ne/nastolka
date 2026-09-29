#!/usr/bin/env python3
"""Замена хардкод-русских строк на t(lang, ...) в page.tsx"""
import re

path = '/home/z/my-project/src/app/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('                    Ход команды\n', '                    {t(lang, "teamTurnShort")}\n'),
    ('                      Выйти\n', '                      {t(lang, "exit")}\n'),
    ('                          Загаданное слово\n', '                          {t(lang, "wordHiddenLabel")}\n'),
    ('                          Только один игрок смотрит на экран. Остальные — отворачиваются.\n', '                          {t(lang, "wordHiddenHint")}\n'),
    ('                          Пауза. Слово скрыто.\n', '                          {t(lang, "pausedHint")}\n'),
    ('                          Нажмите «Продолжить», чтобы возобновить таймер.\n', '                          {t(lang, "pausedHint2")}\n'),
    ('                        Объясни способом «{(getMethodForRound(state)!).label}»', '                        {t(lang, "explainByMethodPrefix")} «{(getMethodForRound(state)!).label}»'),
    ('                            ×{state.multiplier} активирован!', '                            ×{state.multiplier} {t(lang, "multiplierActivated")}'),
    ('                    Заменить слово{state.swapsUsed > 0 ? ` · замен: ${state.swapsUsed}` : ""}', '                    {t(lang, "swapWordLabel")}{state.swapsUsed > 0 ? ` · ${t(lang, "swapsCount")}: ${state.swapsUsed}` : ""}'),
    ('                    Угадали — жми «Угадали!», не получается — «Пропустить» (очки не идут).', '                    {t(lang, "scoredHint")}'),
    ('                      Загаданное слово было: <span className="font-bold text-foreground">{state.currentWord.word}</span>', '                      {t(lang, "wordWasLabel")} <span className="font-bold text-foreground">{state.currentWord.word}</span>'),
    ('                    Победитель\n', '                    {t(lang, "winner")}\n'),
    ('                    Финальный счёт: {state.teams.map((t) => t.score).join(" : ")}', '                    {t(lang, "finalScore")} {state.teams.map((t) => t.score).join(" : ")}'),
    ('                      Сыграно раундов: {state.history.length} · замен слова: {state.swapsUsed}', '                      {t(lang, "roundsPlayed")} {state.history.length} · {t(lang, "swapsCount")}: {state.swapsUsed}'),
    ('          Фанатская интерактивная версия настольной игры «Настолка».\n          Вдохновлено шоу Шальнова и Бебуришвили на канале Medium Sport.', '          {t(lang, "footerText")}'),
    ('          {paused ? "Пауза" : "Время"}', '          {paused ? t(lang, "pause") : t(lang, "time")}'),
    ('          {secondsLeft} сек', '          {secondsLeft} {t(lang, "secShort")}'),
    ('? "Команда угадала!"\n                      : "Раунд не сыгран"', '? t(lang, "teamGuessed")\n                      : t(lang, "roundFailed")'),
    ('                          Продолжить\n', '                          {t(lang, "resume")}\n'),
    ('                          Пауза\n', '                          {t(lang, "pause")}\n'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
    else:
        print(f"NOT FOUND: {old[:60]}...")

print(f"Applied {count}/{len(replacements)} replacements")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
