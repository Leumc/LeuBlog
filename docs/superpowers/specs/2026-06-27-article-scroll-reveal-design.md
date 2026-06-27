# 阅读动效（滚动浮现 / 打字机 / 关闭，读者可切换） — 设计文档

日期：2026-06-27

## 目标

为阅读文章提供可选的入场动效，提升沉浸感。提供三种模式，读者在顶部导航上自由切换，偏好存浏览器：

- `reveal`（**默认**）— 滚动渐次浮现：正文各顶级块随滚动进入视口时，逐个从下方淡入上浮。
- `typewriter` — 打字机：滚动进入视口的**文本块**逐字打出；非文本块（代码/图片/表格/分隔线）淡入浮现。
- `off` — 关闭：全部立即显示，无动效。

## 决策摘要

- **控制方**：读者端切换；选择存 `localStorage`；默认 `reveal`。
- **控件位置**：放进 `MainNav`（首页 `center` 变体经 `SiteHeader`、文章页 `brand` 变体都用它），故首页与文章页均可见。首页无正文，仅保存偏好。
- **颗粒度**：逐块（`.body` 直接子元素）。
- **触发**：两种动效均由 IntersectionObserver 在元素进入视口时触发，每块只触发一次。
- **reveal 强度**：上移 16px，时长 0.6s，`ease`。
- **typewriter**：文本块（`p / h1-h4 / ul / ol / blockquote`）逐字揭示并保留行内格式；非文本块（`figure / img / table / hr`）淡入。速度约 18ms/字，打字时块尾显示闪烁 caret，打完移除。
- **无障碍**：`prefers-reduced-motion: reduce` 时忽略所有模式，全部直接可见。

## 架构

组件间用 `localStorage` + `CustomEvent` 解耦，无需在 `(reading)/layout` 注入 React Context。

### 1. `src/components/reader/ReadingMotionControl.tsx`（新建，client）

紧凑分段控件，三项：`浮入 / 打字机 / 关闭`。

- 挂载后（`useEffect`）从 `localStorage` 读当前模式，缺省 `reveal`。SSR 先渲染默认态，挂载后再同步，避免 hydration mismatch。
- 点击切换：写 `localStorage`（key 如 `reading-motion`），并 `window.dispatchEvent(new CustomEvent("reading-motion", { detail: mode }))`。
- 高亮当前选中项。

存储 key 与事件名集中在一个小模块（如 `src/lib/reading-motion.ts`）导出常量与读写辅助，供控件与 `ArticleBody` 共用，避免字符串硬编码漂移。

### 2. `src/components/reader/MainNav.tsx`（改造）

已是 client 组件。在 `.wrap` 末尾渲染 `<ReadingMotionControl />`，两种 variant 均显示。

### 3. `src/components/reader/ArticleBody.tsx`（改造，承载全部动画逻辑）

现有 `useEffect` 已针对 `.body` 注入代码块工具条。新增动画逻辑，与之合并 cleanup（互不干扰：工具条插入 `.code-bar`，动画改 class / text node）。

- 读初始模式（`localStorage`，缺省 `reveal`）；监听 `reading-motion` 事件实现实时切换。
- 抽出 `applyMode(mode)`：先清理上一次（断开 observer、清除定时器、移除 `reveal`/`typing` 等类、把所有块还原为完整 HTML 可见态），再按新模式初始化。为支持模式切换与"还原"，挂载时先缓存每个直接子块的原始 `innerHTML`。
- **reveal**：给 `.body` 直接子元素加 `reveal` 类；IntersectionObserver（`threshold 0.1`，`rootMargin: 0px 0px -10% 0px`）进视口加 `reveal-in` 并 `unobserve`。
- **typewriter**：
  - 按标签分类直接子元素：文本块 `p/h1/h2/h3/h4/ul/ol/blockquote`；非文本块 `figure/img/table/hr`（及其它）。
  - 非文本块：加 `reveal` 类，IO 进视口加 `reveal-in`、`unobserve`（同 reveal 行为）。
  - 文本块：初始隐藏其内容（保留占位），IO 进视口时启动逐字揭示，`unobserve`（只打一次）。
  - **逐字揭示算法（保留行内格式）**：进入打字前，遍历该块所有 text node，记录 `[{node, fullText}]` 并把每个 node 文本清空；按累计字符数推进 `cursor`，每个 tick 把光标落在的 node 设为其前缀、之前的 node 设为全文、之后的 node 设为空。如此 `<strong>/<a>/<code>` 等行内元素结构与样式在打字过程中保留。块尾追加一个 caret 元素闪烁，打完移除该块的 `typing` 类与 caret。
  - 用 `setInterval`/`setTimeout` 控制速度（约 18ms/字），定时器登记进 cleanup。
- **off**：不加任何类，块还原为完整可见，不创建 observer。
- **健壮性 fallback**：`typeof IntersectionObserver === "undefined"` 时，直接全部可见（不进入 reveal/typewriter 分支）。

### 4. `src/styles/globals.css`（改造）

新增：

```css
/* 滚动浮现 */
.body > .reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.body > .reveal.reveal-in {
  opacity: 1;
  transform: none;
}

/* 打字机 caret */
.body > .typing .rm-caret {
  display: inline-block;
  width: 0.6ch;
  animation: rm-blink 1s steps(1) infinite;
}
@keyframes rm-blink { 50% { opacity: 0; } }

/* 减弱动态效果：忽略所有动效 */
@media (prefers-reduced-motion: reduce) {
  .body > .reveal { opacity: 1; transform: none; transition: none; }
}
```

加上 `ReadingMotionControl` 分段控件的样式（与 brandnav 协调，低调小号）。

## 数据流

纯客户端、无网络。SSR 渲染正文 HTML → `ArticleBody` 注入 `dangerouslySetInnerHTML` → 挂载缓存各块原始 HTML、读取模式、按模式初始化 IO/打字 → 读者点击 `ReadingMotionControl` → 写 localStorage + 派发 `reading-motion` 事件 → `ArticleBody` 监听到后 `applyMode` 重置并切换。

## 错误处理与边界

- **无 IntersectionObserver**：跳过动画，内容默认可见。
- **prefers-reduced-motion**：CSS 覆盖为可见态（reveal）；打字机模式下文本块若被标记隐藏，需保证 reduced-motion 时仍可见——实现上 reduced-motion 时直接走 `off` 等价路径（不隐藏文本、不打字）。
- **首屏已在视口内的块**：observer 挂载后立即触发，自然进场。
- **模式中途切换**：`applyMode` 先把所有块还原为缓存的原始 HTML 完整可见，再按新模式初始化；已过的块在新模式下若在视口外则保持可见（reveal/typewriter 仅对进入视口者触发，已可见者不回退）。
- **空正文/无子元素**：循环不执行，无副作用。
- **代码块工具条**：动画逻辑不改 figure 内部 DOM（仅在 figure 这一层加 `reveal` 类），工具条注入照常工作。

## 测试

- 手动：三模式逐一验证——reveal 各块上浮且只一次；typewriter 文本块逐字打、代码/图片淡入、caret 闪烁、打完正常；off 立即全显。
- 切换：阅读中途切换模式即时生效，不残留上一模式的隐藏态。
- 持久化：切换后刷新/换文章，模式保持；首页切换后进文章生效。
- 无障碍：系统开启"减弱动态效果"后全部直接显示、无打字。
- 回归：代码块语言标签 + 复制按钮仍正常。

## 不做（YAGNI）

- 不存后台 / 不做站点级默认配置（纯读者端）。
- 不做逐块速度配置项、不做打字音效。
- 不做来回滚动重复触发。
- 非文本块不逐字打（图片/表格/分隔线）。
- 不引入第三方动画库。
