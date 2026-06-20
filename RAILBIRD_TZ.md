# ТЗ для Claude Code — RAILBIRD

**Gigling Racing form guide & edge finder для GIGATHON #1 (Gigaverse, дедлайн 26 июня 2026).**

> Имя проекта *RAILBIRD* (railbird = тот, кто изучает скачки с борта дорожки — ровно то, что игра просит делать вручную). Сменяемо. Альтернативы: Paddock, Furlong, Photo Finish.

---

## 0. TL;DR для исполнителя

Игра прячет статы Giglings и прямым текстом говорит игроку «гоняй, веди заметки, изучай форму». RAILBIRD автоматизирует эту ручную работу: тянет публичную историю гонок, выводит скрытый профиль каждого питомца, и для **открытых** гонок считает вероятности победы → честные одды → **+EV пики** против структуры выплат (как edge-finder на Polymarket, только для пет-рейсинга).

Стек: **Next.js 14 (App Router) + TypeScript + Tailwind + viem + pusher-js**, деплой Vercel. Модель — на чистом TS (никакого Python-сервиса). MVP — **read-only, без JWT, без записи в чейн**.

Категории под судейство: основная **Player Tools & Analytics**; фрейминг даёт ещё **Novel & Experimental** (prediction markets) и **Educational** → заявка на **Best Overall** (multi-domain bonus).

**НЕ делать** автопилот/бота как ядро — правила хакатона прямо «discourage automation-only tools». AI — только опциональный текстовый разбор, усиливающий игрока, не заменяющий.

---

## 1. Проблема и ценность (для submission-формы)

- **Проблема:** статы (Start / Speed / Stamina / Finish) и трейты Giglings скрыты и раскрываются только наблюдением за гонками. Публично известны лишь пол, фракция, редкость. Игрок, делающий ставку/заходящий в гонку, по сути летит вслепую и ведёт заметки руками. Нет инструмента оценки шансов и поиска value.
- **Решение:** RAILBIRD ведёт «заметки» за игрока — реконструирует профиль из истории, оценивает шансы поля в конкретной гонке (с учётом дистанции, погоды, фракционных участков, предметов) и подсвечивает, где математическое ожидание захода положительное.
- **Почему хорошо ложится в Gigling Racing:** инструмент существует ровно потому, что геймдизайн построен на скрытой информации. Это не «дашборд ради дашборда» — это то, что игра делает обязательным.

---

## 2. Технические факты (источник истины — Builder Guide + docs.gigaverse.io)

### 2.1 Сеть / контракт
- Abstract mainnet, `chainId 2741` (viem chain: `abstract`). Тестнет `abs-testnet` `chainId 11124` — для отладки записи.
- `PetRacingSystem` (abstract mainnet): `0x16e0B3D6394CE7597D34b73f5E5Fb165fD74394E`
- Список контрактов: `GET https://gigaverse.io/api/contracts`
- ABI: `contracts-zk/out/PetRacingSystem.json` (если нет под рукой — собрать из `getRace`/`previewPayouts`/событий вручную).
- Giglings = ERC-721 на Abstract (коллекция `gigaverse-giglings` на OpenSea).

### 2.2 REST API (`https://gigaverse.io/api/racing`)
**Публичные (без auth) — на них строится весь MVP:**
```
GET /races?limit=50                 # недавние гонки: phase, entryFee, pool, source
GET /race/{raceId}                  # полное состояние: entries, per-pet payouts
GET /race-state?raceId=...          # диагностика: то же, но прямо из чейна (без лага индексера)
GET /pets/stats?ids=1,2,3           # батч racing-стат (кэш ~60с)
GET /pets/{petId}/stats             # история 15 гонок + ELO
GET /races/{address}?limit=50       # история гонок игрока
GET /leaderboard/elo?limit=&offset=&factions=&rarities=&genders=
GET /stats                          # глобальная агрегатная стата
GET /scheduled                      # предстоящие разовые гонки
POST /lobby/sync                    # bulk-снапшот лобби (races, my races, payouts, claims)
GET /payouts/{address}
GET /host-eligibility/{address}     # гейты/лимиты/конфиг для createRace
```
**Auth (JWT, `Authorization: Bearer <jwt>`) — НЕ нужны для MVP:** `/race/{id}/items`, `/race/{id}/use-item`, `/items`, `/attestation`, чаты, приватный `/pets`.

> CORS: дёргать gigaverse API **с сервера** через Next route handlers (`app/api/...`), не из браузера. Заодно кэш и нормализация.

### 2.3 Realtime (Pusher-совместимый, публичные каналы — анонимно)
```
race-{raceId}     → tick-advanced, race-broadcast, item-submitted, chat-message
racing.lobby      → race-updated, lobby-snapshot, lobby-heartbeat
global.chat.racing→ racing.chat.message
```
Приватные/presence — через `POST /api/gigasocket/pusher/auth` (для MVP не нужно).

### 2.4 Ключевые события (Abstract RPC, для исторического датасета)
```
RaceResolved(raceId, finalRanking[], msFinishTimes[], extraParamIds[], extraParamVals[])
PetJoined(raceId, petId, owner)
PhaseAdvanced(raceId, newPhase)
JackpotWon(raceId, petId, winner, amount, placement)
PetRaceRecorded(petId, raceId, racesRun)   # список гонок пета НЕ хранится ончейн — собирать из этих логов
```

### 2.5 Кодировка параметров гонки (`extraParamIds`)
```
100 items    : 0=none, 1=dung, 2=butterflies, 3=all
200 weather  : 0=hot, 1=cold, 2=rainy, 3=snowing      # ⚠ см. open question
300 faction  : 0=none,1=crusader,2=overseer,3=athena,4=archon,5=foxglove,6=summoner,7=chobo,8=gigus
```

### 2.6 Игровая механика (для модели)
- **4 фазовых стата:** Start (старт из ворот), Speed (крейсер в середине), Stamina (длинные дистанции), Finish (финишный рывок). **Рероллятся каждую гонку** от базовых → это распределение, не фикс.
- **Дистанция** (trackLength, кратно 100 м): короткие → вес Start/Speed; длинные → Stamina/Finish.
- **Погода/условия трассы:** питомец предпочитает одно из (cold/average/hot) → небольшой бонус к скорости при матче.
- **Фракции (8):** трасса разбита на участки разных фракций; на «своём» участке питомец получает буст. **Микс участков раскрывается на старте гонки.** Gigus встречается чаще всех.
- **Редкость (6):** Uncommon→Rare→Epic→Legendary→Relic→Giga. Выше редкость = выше пол статов + больше трейтов. **Публична.** Сильный приор.
- **Трейты:** скрыты, тиры ★/★★/★★★, срабатывают по условиям (мощный старт, финишный рывок, иммунитет к погоде).
- **Скрыто (выводим из истории):** 4 стата, трейты, предпочтения дистанции/погоды. **Публично:** пол, фракция, редкость, ELO, история результатов с условиями + msFinishTimes.
- **Карьера конечна:** `getPetRacesRun(petId)`, `canPetRace(petId, owner)`, кулдауны. После исчерпания — брид (механика брида ещё не вышла → НЕ в MVP).
- **Выплаты/джекпот:** `previewPayouts(raceId)` отдаёт всю fee/payout-математику (current vs projected). Джекпот катится только за 1-е место; шанс `maxChanceBps·min(entryFee,target)/target`, выигрыш `winnableBps·eligibleJackpot/10000`. Конфиг — `getJackpotConfig()`/`/stats`. Бесплатные гонки (entryFee=0) джекпот не катят.

---

## 3. Модель хендикапа (`lib/model/`)

Цель: для гонки с известным полем `petIds[]` и условиями `{trackLength, weather, items, factionStretchMix}` выдать `winProb[petId]`, `fairOdds[petId]`, и `EV_enter` (для своих питомцев) / `valueRating` (для зрителя/беттора).

### 3.1 v1 — ship-fast (день 1–3)
1. **Базовая сила** `S_i`: z-score от ELO питомца (`/pets/{id}/stats` или `/leaderboard/elo`). Главный сигнал.
2. **Приор редкости:** ординальный бонус (Uncommon=0 … Giga=+k). Малый вес, но бесплатный публичный сигнал.
3. **Кондишн-бонусы** (если хватает истории): из 15 последних гонок строим перцентиль msFinishTime по бакетам:
   - дистанция (короткая/средняя/длинная);
   - погода (матч предпочтения);
   - доля фракционных участков под фракцию питомца в этой гонке.
   Добавляем бонус к `S_i`, когда условия предстоящей гонки совпадают с сильными бакетами пета.
4. **Вероятности — softmax по полю:** `p_i = exp(β·S_i) / Σ_j exp(β·S_j)`. β сначала вручную (≈1.0–2.0), потом калибруем (см. v2).
5. **Fair odds** = `1/p_i`. **Edge для беттора:** сравнить `p_i` с долей выплат за 1-е место из `previewPayouts`. **EV_enter** (свой пет): `Σ_k P(rank=k)·payout_k − joinFee`. В v1 `P(rank=k)` аппроксимируем простой моделью (Plackett–Luce из тех же `S_i`, либо грубо: P(top-N) масштабируем от p_i).
6. **Джекпот-надбавка к EV:** `p_winFirst · rollChance · expectedJackpotPayout`.

### 3.2 v2 — если есть время (день 5)
- **Калибровка β** на исторических `RaceResolved`: максимизируем log-likelihood реальных победителей. Бэктест на отложенных гонках, метрика — Brier score / top-1 accuracy.
- **Байес-шринкедж** малых выборок к приору (ELO+редкость): новая игра, данных мало → не переобучаться.
- **Reveal-meter:** «профиль раскрыт на N%» исходя из числа наблюдённых гонок пета — показывать неопределённость честно.

### 3.3 Контракт модуля
```ts
// lib/model/handicap.ts
type PetSnapshot = {
  petId: number; elo: number; rarity: Rarity; faction: Faction; gender: Gender;
  history: RaceResult[]; // rank, msFinishTime, conditions
};
type RaceConditions = {
  trackLength: number; weather: Weather; items: ItemsMode; factionStretchMix: Record<Faction, number>;
};
function handicap(field: PetSnapshot[], cond: RaceConditions, payout: PayoutPreview):
  Array<{ petId: number; winProb: number; fairOdds: number; rankDist: number[]; evEnter?: number; valueRating: number; revealPct: number }>;
```

---

## 4. Экраны / UI (`app/`)

1. **`/` Lobby (home):** все OPEN-гонки (`POST /lobby/sync`). Карточка: filled/fieldSize, entryFee, pool, дистанция, иконки погоды/предметов, топ-2 фаворита модели с win%, бейдж **EDGE** если есть +EV. Лайв-апдейты через `racing.lobby` Pusher.
2. **`/race/[id]` Race detail:** 8 карточек питомцев — win%-бар, fair odds, история H2H по msFinishTime, `previewPayouts` (current vs projected), джекпот-EV. Опц. live-режим через `race-{id}` (tick-advanced, item-submitted — «sabotage notifications»).
3. **`/gigling/[id]` Profile:** редкость/фракция/пол, ELO-тренд, **выведенный профиль статов** (4 бара с интервалами + reveal-meter), лучшие дистанция/погода, таблица формы.
4. **`/leaderboard` ELO board:** проксирует `/leaderboard/elo` с фильтрами faction/rarity/gender + колонка «value» от модели.
5. **`/stable` My Stable (stretch, кошелёк):** wagmi → твои Giglings, остаток карьеры (`getPetRacesRun` vs лимит), кулдауны (`canPetRace`), список открытых гонок где у твоего пета edge.
6. **Educational overlay (stretch):** тултипы-объяснялки (фракционные участки, погода, EV предметов, как читать одды) → закрывает категорию Educational.
7. **AI race-read (stretch):** Claude (Sonnet через Anthropic API в серверном route) — 2 предложения «почему этот фаворит». Усиление игрока, не автоматизация.

UI: мобайл-first, тёмная тема, читаемые шарабельные карточки (скрин под X-девлог). Можно лёгкий пиксель-арт-акцент в духе Gigaverse.

---

## 5. Архитектура / структура файлов

```
app/
  api/
    races/route.ts            # проксирует /lobby/sync, /races (CORS+cache)
    race/[id]/route.ts        # /race/{id} + previewPayouts(viem) merge
    pet/[id]/route.ts         # /pets/{id}/stats
    leaderboard/route.ts
    ai-read/route.ts          # (stretch) Anthropic Sonnet
  page.tsx                    # Lobby
  race/[id]/page.tsx
  gigling/[id]/page.tsx
  leaderboard/page.tsx
  stable/page.tsx             # (stretch)
lib/
  api/gigaverse.ts            # типизированный REST-клиент
  chain/petRacing.ts          # viem client, ABI, читатели событий, previewPayouts/getRace
  chain/abi.ts
  model/handicap.ts           # scoring, softmax, EV, Plackett–Luce
  model/infer.ts              # профиль пета из истории (бакеты, перцентили)
  model/calibrate.ts          # (v2) β на RaceResolved
  realtime/pusher.ts          # публичные каналы
  encode.ts                   # extraParamIds 100/200/300 ↔ человекочитаемое
types/racing.ts
components/
  RaceCard, PetCard, OddsBar, EdgeBadge, StatProfile, PayoutPreview, RevealMeter, WeatherIcon
```

Данные: для MVP **считать на лету** из REST + `previewPayouts`(viem) — не поднимать standing-индексер за 6 дней. Если нужен исторический датасет для калибровки — отдельный скрипт `scripts/pull-resolved.ts` тянет `RaceResolved`-логи в локальный JSON. Кэш REST (`/pets/stats` уже кэш ~60с — быть вежливым к API). React Query на клиенте для лайв-частей.

---

## 6. План на 6 дней

- **День 0 (сегодня):** прозвонить живые эндпоинты, снять реальные JSON-формы, проверить наличие/объём истории, **разрешить расхождение по weather (4 vs 3)** и проверить, отдаётся ли faction-stretch mix до резолва. Заскаффолдить Next + `lib/api/gigaverse.ts` + один route-proxy.
- **День 1–2:** Lobby + Race detail на реальных данных; `previewPayouts`; baseline win% только по ELO. Уже кликабельно.
- **День 3:** Gigling profile + `infer.ts` v1 (бакеты дистанция/погода/фракция); fair odds + EDGE-бейдж.
- **День 4:** полировка UI/мобайл, leaderboard, лайв-лобби (Pusher). **= shippable MVP.**
- **День 5 (stretch):** джекпот-EV, калибровка β, AI race-read, My Stable (wagmi).
- **День 6:** запись демо 60–90с, текст заявки (problem/why/API usage/future), финальный деплой, буфер на баги. **Сабмит до 26-го** (форма: https://forms.gle/nbs4a516hAUsQmEm8).

---

## 7. Риски и open questions (закрыть в день 0)

1. **Weather:** Builder Guide param 200 = hot/cold/rainy/snowing (4), а overview = cold/average/hot (3). Это «погода гонки» (хост) vs «предпочтение пета» — разные сущности. Проверить на реальном `/race/{id}` и `RaceResolved`.
2. **Faction-stretch mix:** микс участков «раскрывается на старте» — отдаётся ли он через API/`race-broadcast` **до** резолва? Если нет — фракционная поправка слабее, опираться на пол/редкость/ELO.
3. **Объём данных:** игра новая, выборка тонкая → модель шумная. Лекарство: ELO+редкость-приор + шринкедж + честный reveal-meter. Не переобучаться.
4. **Вариативность:** статы рероллятся каждую гонку → выдаём вероятности, не «гарантии». Формулировки UI: «edge», «value», не «predicted winner».
5. **Доверенный офчейн-резолвер:** исход не верифицируем ончейн, диктуется резолвером. Модель **только эмпирическая**, не детерминированная. Не продавать как «решение формулы».
6. **CORS / rate limits:** все внешние вызовы — серверные, с кэшем.
7. **JWT:** весь MVP на публичных эндпоинтах. Подтвердить, что `/pets/stats` и `/lobby/sync` работают без auth.

---

## 8. Чеклист заявки (под форму)

1. **Project Name:** RAILBIRD
2. **Short Description:** form guide & edge finder для Gigling Racing — считает скрытую форму питомцев и подсвечивает +EV гонки.
3. **Problem it Solves:** статы скрыты, игра требует ручного хендикаппинга; нет инструмента оценки шансов и value.
4. **How it Uses Gigaverse APIs/Data:** `/lobby/sync`, `/races`, `/race/{id}`, `/pets/stats`, `/pets/{id}/stats`, `/leaderboard/elo`, `/stats`; `previewPayouts`/`getRace` (viem); события `RaceResolved`/`PetJoined`; Pusher `racing.lobby` + `race-{id}`.
5. **Demo Link:** Vercel + видео 60–90с.
6. **Repo Link.**
7. **Future Potential:** оценка стоимости самок под брид, female-pricing, breeding-валюатор (когда выйдет механика), Telegram-алерт-бот по +EV гонкам, tournament suite. (Автопилот-агент — только пост-хакатон, чтобы не попасть под «automation-only».)

---

## 9. Позиционирование под судейство

- **Player Tools & Analytics** (основная): odds estimators, win-rate trackers, dashboards — точное попадание.
- **Novel & Experimental:** fair-odds vs пул = prediction-market-слой (прямо в примерах категории).
- **Educational & Onboarding:** explainer-оверлей механик/беттинга.
- → **Best Overall** через multi-domain bonus. Под веса судей: Execution (рабочий полированный апп на реальных данных) 30%, Creativity (скрытая инфо → инференс + edge) 25%, Usefulness (закрывает встроенную в геймдизайн боль) 20%, Alignment (чистый Gigling Racing) 20%, Potential 5%.
