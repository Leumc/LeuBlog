import { describe, expect, it } from "vitest";
import {
  getMarkdownEditorBasicSetup,
  getMarkdownEditorExtensions,
} from "./markdown-editor-config";

describe("markdown editor config", () => {
  it("keeps CodeMirror configuration references stable between renders", () => {
    expect(getMarkdownEditorExtensions()).toBe(getMarkdownEditorExtensions());
    expect(getMarkdownEditorBasicSetup()).toBe(getMarkdownEditorBasicSetup());
  });
});
