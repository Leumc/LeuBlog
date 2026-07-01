import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";

const markdownEditorExtensions = [markdown({ codeLanguages: languages }), EditorView.lineWrapping];
const markdownEditorBasicSetup = { lineNumbers: true, foldGutter: false };

export function getMarkdownEditorExtensions() {
  return markdownEditorExtensions;
}

export function getMarkdownEditorBasicSetup() {
  return markdownEditorBasicSetup;
}
