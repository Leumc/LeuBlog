这是一篇演示文章，把目前支持的所有「HTML 增强排版」都用一遍。你可以把本文件的内容整段粘贴进后台「新建文章」的 Markdown 源里，右侧实时预览即可看到效果。

## 一、折叠框 `<details>`

折叠框默认收起，点击标题展开。下面这个是**收起**状态：

<details>
<summary>点我展开：折叠框里也能写 Markdown</summary>
<markdown>

折叠内容里可以正常使用 **加粗**、*斜体*、`行内代码`，以及列表：

- 第一点
- 第二点
- 第三点

</markdown>
</details>

下面这个用 `open` 属性让它**默认展开**：

<details open>
<summary>默认展开的折叠框</summary>
<markdown>

适合放「重要补充」「延伸阅读」，读者一眼就能看到，但又能手动收起。

</markdown>
</details>

## 二、提示框 `callout`

三种语义，左侧色条 + 图标各不相同：

<div class="callout info">
<markdown>

**信息（info）**：用来补充说明、给出背景。这是默认样式。

</markdown>
</div>

<div class="callout warn">
<markdown>

**警告（warn）**：提醒读者注意风险或易错点。

</markdown>
</div>

<div class="callout tip">
<markdown>

**技巧（tip）**：分享一个小窍门或最佳实践。

</markdown>
</div>

## 三、行内徽章 `badge`

徽章是行内的小标记，适合标注状态或版本，例如：本功能 <span class="badge">NEW</span>、接口 <span class="badge">v2</span>、此段 <span class="badge">实验性</span>。

## 四、分栏 `cols`

两栏并排排版，窄屏（手机）会自动堆叠成单栏。注意：栏内若要写 Markdown，请用 `<markdown>` 包裹。

<div class="cols">
<div><markdown>

**左栏**

- 苹果
- 香蕉
- 橙子

</markdown></div>
<div><markdown>

**右栏**

1. 第一步
2. 第二步
3. 第三步

</markdown></div>
</div>

## 五、`<markdown>` 标签是什么？

HTML 标签**内部**紧贴书写的 Markdown，默认不会被解析（会原样显示 `**这样**`）。把内容用 `<markdown>…</markdown>` 包起来，就会强制按 Markdown 渲染。上面的折叠框、提示框、分栏内部都用到了它。

折叠框里也能放代码块：

<details>
<summary>查看示例代码</summary>
<markdown>

```python
def greet(name: str) -> str:
    return f"你好，{name}！"
```

</markdown>
</details>

## 六、混合使用

普通 Markdown 与 HTML 组件可以自由混排：正文 <span class="badge">提示</span> 之后接一个折叠框，再接一段普通段落，都没有问题。
