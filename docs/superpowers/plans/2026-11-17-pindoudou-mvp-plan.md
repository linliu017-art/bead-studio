# 拼拼豆豆儿 MVP 首页与完整闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把现有拼豆试玩改成一个可直接试玩的完整 MVP：从首页地图进入关卡，完成拼豆、熨烫、收藏，再进入作品集或自制图纸。

**Architecture:** 保留 Cocos Creator 现有单场景和 `BeadGame` 导航模型，在 `showLevels`、`showShelf`、`showPatterns` 和游戏工作台上统一一套“甜品地图 + 拼豆工坊”视觉语言。纯逻辑只增加首页状态摘要函数，UI 继续使用现有 Graphics/Label/ScrollView，避免引入运行时依赖。

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Vitest, existing Graphics/Label/ScrollView.

**Spec:** 本次用户需求：参考开心消消乐的关卡地图和成长反馈，保持拼豆的纸板、豆盒、熨烫和手作质感，跑通首页、关卡、拼豆、收藏、自制图纸 MVP。

## Global Constraints

- 继续支持网页试玩和微信构建，不增加第三方运行时依赖。
- 关卡解锁仍由前一关完成状态决定，进度仍保存在当前设备。
- 现有拼豆规则、熨烫流程、自制图纸和打印图纸能力保持可用。
- UI 文案使用简体中文，按钮必须在窄屏和滚动容器中可点击。

## Review Focus

- 首次打开没有存档时，用户能在 3 秒内找到“开始第一关”。
- 有进行中关卡时，首页能显示继续入口和真实进度。
- 关卡锁定、已完成、进行中三种状态在地图上清楚区分。
- 作品集和自制图纸入口不依赖完成首关。
- 小屏幕滚动时，地图卡片与底部操作不互相遮挡。

### Task 1: Add tested home progress summary

**Files:**
- Create: `assets/scripts/core/HomeProgress.ts`
- Test: `tests/homeProgress.test.ts`

**Interfaces:**
- Produces `summarizeHomeProgress(levels, storage): { completed, inProgress, unlocked, total, nextIndex }`.

- [ ] Write failing tests for first launch, in-progress, and completed sequences.
- [ ] Run the focused test and verify it fails because the helper is missing.
- [ ] Implement the pure summary helper using `levelUnlocked` and `loadLevel`.
- [ ] Run the focused test and the full test suite.

### Task 2: Redesign the level map as the home screen

**Files:**
- Modify: `assets/scripts/game/BeadGame.ts`
- Modify: `assets/scripts/game/Theme.ts`

**Interfaces:**
- Consumes `summarizeHomeProgress` from Task 1.
- Keeps `activateLevel`, `showShelf`, and `showPatterns` as existing navigation targets.

- [ ] Add hero header, progress badge, “继续拼豆” card, and a staggered connected level map.
- [ ] Add clear state copy for locked, available, in-progress, and completed nodes.
- [ ] Add a bottom action row for 自制图纸 and 作品集.
- [ ] Keep sound toggle available without competing with the primary CTA.
- [ ] Build and manually open the local preview.

### Task 3: Bring collection and personal-pattern pages into the same MVP shell

**Files:**
- Modify: `assets/scripts/game/BeadGame.ts`

- [ ] Add collection summary and empty-state action to the collection page.
- [ ] Add personal-pattern explanation, board-size hints, and a direct “选图制作” CTA.
- [ ] Ensure both pages return to the home map without losing scroll or saved state.
- [ ] Verify the routes manually in the local browser.

### Task 4: Verify end-to-end build

**Files:**
- Modify: `README.md` only if the final MVP route or copy changes.

- [ ] Run `pnpm check`.
- [ ] Run `pnpm build:web`.
- [ ] Open `http://127.0.0.1:4312/first-level/` and exercise home → level → collection.

