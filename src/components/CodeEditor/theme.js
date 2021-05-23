import { EditorView } from '@codemirror/view';
import { HighlightStyle, tags } from '@codemirror/highlight';

const gray = "#569cd6", 
    coral = "#e06c75", 
    cyan = "#56b6c2", 
    invalid = "#ffffff", 
    blue = "gray", 
    stone = "#7d8799", // Brightened compared to original to increase contrast
    malibu = "#61afef", 
    sage = "#98c379", 
    whiskey = "#d19a66", 
    violet = "#c678dd", 
    darkBackground = "#21252b", 
    highlightBackground = "#222", 
    background = "rgb(30,30,30)", 
    selection = "#333", 
    cursor = "white";

/// The editor theme styles for One Dark.
const oneDarkTheme = EditorView.theme({
    "&": {
        color: blue,
        backgroundColor: background,
        "& ::selection": { backgroundColor: selection },
        caretColor: cursor,
        fontSize: '1rem'
    },
    '.cm-line': {
        fontFamily: `'Fira Code'`,
        color: '#eee'
    },
    "&.cm-focused .cm-cursor": { borderLeftColor: cursor },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: selection },
    ".cm-panels": { backgroundColor: darkBackground, color: blue },
    ".cm-panels.cm-panels-top": { borderBottom: "2px solid black" },
    ".cm-panels.cm-panels-bottom": { borderTop: "2px solid black" },
    ".cm-searchMatch": {
        backgroundColor: "#72a1ff59",
        outline: "1px solid #457dff"
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "#6199ff2f"
    },
    ".cm-activeLine": { backgroundColor: highlightBackground },
    ".cm-selectionMatch": { backgroundColor: "#aafe661a" },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "#bad0f847",
        outline: "1px solid #515a6b"
    },
    ".cm-gutters": {
        backgroundColor: background,
        color: stone,
        border: "none"
    },
    ".cm-lineNumbers .cm-gutterElement": { color: "inherit" },
    ".cm-foldPlaceholder": {
        backgroundColor: "transparent",
        border: "none",
        color: "#ddd"
    },
    ".cm-tooltip": {
        border: "1px solid #181a1f",
        backgroundColor: darkBackground
    },
    ".cm-tooltip-autocomplete": {
        "& > ul > li[aria-selected]": {
            backgroundColor: highlightBackground,
            color: blue
        }
    }
}, { dark: true });
/// The highlighting style for code in the One Dark theme.
const oneDarkHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword,
        color: violet },
    { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
        color: coral },
    { tag: [tags.function(tags.variableName), tags.labelName],
        color: malibu },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
        color: whiskey },
    { tag: [tags.definition(tags.name), tags.separator],
        color: blue },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace],
        color: gray },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)],
        color: cyan },
    { tag: [tags.meta, tags.comment],
        color: stone },
    { tag: tags.strong,
        fontWeight: "bold" },
    { tag: tags.emphasis,
        fontStyle: "italic" },
    { tag: tags.link,
        color: stone,
        textDecoration: "underline" },
    { tag: tags.heading,
        fontWeight: "bold",
        color: coral },
    { tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
        color: whiskey },
    { tag: [tags.processingInstruction, tags.string, tags.inserted],
        color: sage },
    { tag: tags.invalid,
        color: invalid },
]);
/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export default [oneDarkTheme, oneDarkHighlightStyle];