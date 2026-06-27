# 阅读页正文滚动渐次浮现动效 — 设计文档

日期：2026-06-27

## 目标

在阅读文章时，正文的各个顶级块（段落、标题、图片、代码块、引用、列表、表格等）随页面滚动进入视口时，逐个从下方淡入上浮。每个块只触发一次，触发后保持可见。营造"克制优雅"的阅读沉浸感。

## 决策摘要

- **触发方式**：滚动渐次浮现（元素进入视口时触发），而非整体一次性进场。
- **颗粒度**：逐块（`.body` 的直接子元素），不做逐字/逐词。
- **重复行为**：只触发一次，触发后 `unobserve`，不随来回滚动重复。
- **强度**：上移 16px，时长 0.6s，`ease` 缓动。
- **无障碍**：尊重 `prefers-reduced-motion: reduce`，此时直接显示、无位移无过渡。

## 实现落点（改动 2 个文件）

### 1. `src/components/reader/ArticleBody.tsx`

该组件已是 `"use client"`，已有一个针对 `.body` 内代码块注入工具条的 `useEffect`。在同一组件中新增 reveal 逻辑（可放在同一个或新增一个 `useEffect`，依赖同为 `[html]`）：

- 选中 `.body` 的所有直接子元素 `root.children` 作为动画单元。
- 健壮性 fallback：若 `typeof IntersectionObserver === "undefined"`，不加任何类，全部保持默认可见，直接返回。
- 给每个子元素加初始类 `reveal`。
- 创建一个 `IntersectionObserver`，配置 `threshold: 0.1` 与 `rootMargin`（底部留负边距，例如 `0px 0px -10% 0px`，使元素稍微进入再触发）。
- 元素 `isIntersecting` 时：加 `reveal-in` 类并对该元素 `unobserve`（保证只触发一次）。
- observe 每个加了 `reveal` 的元素。
- cleanup：`observer.disconnect()`，与现有代码块 cleanup 合并（现有返回的 cleanup 数组中追加一项，或在同一 return 中调用）。

注意：reveal 逻辑应与现有代码块工具条逻辑互不干扰——两者都读取 `.body`，但操作不同（一个加 class，一个插入 `.code-bar`），可共存。

### 2. `src/styles/globals.css`

在 `.body` 相关规则附近新增：

```css
.body > .reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.body > .reveal.reveal-in {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .body > .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

## 数据流

纯客户端、无网络/状态。流程：服务端渲染正文 HTML → `ArticleBody` 注入 `dangerouslySetInnerHTML` → `useEffect` 在挂载后给 `.body` 直接子元素加 `reveal` 并交由 IntersectionObserver 监听 → 滚动进入视口加 `reveal-in` 触发 CSS 过渡。

## 错误处理与边界

- **无 IntersectionObserver 支持**：跳过整套逻辑，内容默认可见（CSS 中初始 `opacity:0` 仅在 `.reveal` 类存在时生效，故不加类即正常显示）。
- **prefers-reduced-motion**：CSS media query 直接覆盖为可见态。
- **首屏已在视口内的块**：observer 挂载后会立即判定为 intersecting 并触发，形成自然进场。
- **空正文 / 无子元素**：`root.children` 为空，循环不执行，无副作用。

## 测试

- 手动验证：打开一篇长文，滚动时各块逐个上浮；首屏块进场上浮；滚回顶部不再重复触发。
- 无障碍验证：系统开启"减弱动态效果"后，内容直接显示无动画。
- 回归：代码块工具条（语言标签 + 复制按钮）仍正常工作。

## 不做（YAGNI）

- 不做来回滚动重复触发。
- 不做逐字/逐词动画。
- 不做横向位移、缩放、模糊等变体。
- 不加 stagger 间隔配置项或后台开关。
- 不引入第三方动画库。
