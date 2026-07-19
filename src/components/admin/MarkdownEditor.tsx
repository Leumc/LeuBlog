"use client";

import CodeMirror, { type ReactCodeMirrorProps } from "@uiw/react-codemirror";
import {
  getMarkdownEditorBasicSetup,
  getMarkdownEditorExtensions,
} from "./markdown-editor-config";

type MarkdownEditorProps = Pick<
  ReactCodeMirrorProps,
  "value" | "height" | "onChange" | "onCreateEditor"
>;

export default function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <CodeMirror
      {...props}
      extensions={getMarkdownEditorExtensions()}
      basicSetup={getMarkdownEditorBasicSetup()}
    />
  );
}
