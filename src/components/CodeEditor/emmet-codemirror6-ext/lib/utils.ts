import { AttributeToken } from '@emmetio/html-matcher';
import { CSSProperty, TextRange } from '@emmetio/action-utils';

/** Characters to indicate tab stop start and end in generated snippet */
export const tabStopStart = String.fromCodePoint(0xFFF0);
export const tabStopEnd = String.fromCodePoint(0xFFF1);
export const stateKey = '$$emmet';

export interface AbbrError {
    message: string,
    pos: number
}

export interface CMRange {
    anchor: CodeMirror.Position;
    head: CodeMirror.Position;
}

export type DisposeFn = () => void;

export interface EmmetState {
    id: string;
    tracker?: DisposeFn | null;
    tagMatch?: DisposeFn | null;
}

export const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

export const pairsEnd: string[] = [];
for (const key of Object.keys(pairs)) {
    pairsEnd.push(pairs[key]);
}

let idCounter = 0;

/**
 * Returns copy of region which starts and ends at non-space character
 */
export function narrowToNonSpace(editor: CodeMirror.Editor, range: TextRange): TextRange {
    const text = substr(editor, range);
    let startOffset = 0;
    let endOffset = text.length;

    while (startOffset < endOffset && isSpace(text[startOffset])) {
        startOffset++;
    }

    while (endOffset > startOffset && isSpace(text[endOffset - 1])) {
        endOffset--;
    }

    return [range[0] + startOffset, range[0] + endOffset];
}

/**
 * Replaces given range in editor with snippet contents
 */
export function replaceWithSnippet(editor: CodeMirror.Editor, range: TextRange, snippet: string): boolean {
    return editor.operation(() => {
        const snippetPayload = getSelectionsFromSnippet(snippet, range[0]);
        const [from, to] = toRange(editor, range);
        editor.replaceRange(snippetPayload.snippet, from, to);

        // Position cursor
        if (snippetPayload.ranges.length) {
            const selections = snippetPayload.ranges.map(r => {
                const [head, anchor] = toRange(editor, r);
                return {  head, anchor } as CodeMirror.Range;
            });
            editor.setSelections(selections);
        }

        return true;
    });
}

/**
 * Returns current caret position for single selection
 */
export function getCaret(editor: CodeMirror.Editor): number {
    const pos = editor.getCursor();
    return editor.indexFromPos(pos);
}

/**
 * Returns full text content of given editor
 */
export function getContent(editor: CodeMirror.Editor): string {
    return editor.getValue();
}

/**
 * Returns substring of given editor content for specified range
 */
export function substr(editor: CodeMirror.Editor, range: TextRange): string {
    const [from, to] = toRange(editor, range);
    return editor.getRange(from, to);
}

/**
 * Converts given index range to editor’s position range
 */
export function toRange(editor: CodeMirror.Editor, range: TextRange): [CodeMirror.Position, CodeMirror.Position] {
    return [
        editor.posFromIndex(range[0]),
        editor.posFromIndex(range[1])
    ];
}

/**
 * Returns value of given attribute, parsed by Emmet HTML matcher
 */
export function attributeValue(attr: AttributeToken): string | undefined {
    const { value } = attr
    return value && isQuoted(value)
        ? value.slice(1, -1)
        : value;
}

/**
 * Returns region that covers entire attribute
 */
export function attributeRange(attr: AttributeToken): TextRange {
    const end = attr.value != null ? attr.valueEnd! : attr.nameEnd;
    return [attr.nameStart, end];
}

/**
 * Returns patched version of given HTML attribute, parsed by Emmet HTML matcher
 */
export function patchAttribute(attr: AttributeToken, value: string | number, name = attr.name) {
    let before = '';
    let after = '';

    if (attr.value != null) {
        if (isQuoted(attr.value)) {
            // Quoted value or React-like expression
            before = attr.value[0];
            after = attr.value[attr.value.length - 1];
        }
    } else {
        // Attribute without value (boolean)
        before = after = '"';
    }

    return `${name}=${before}${value}${after}`;
}

/**
 * Returns patched version of given CSS property, parsed by Emmet CSS matcher
 */
export function patchProperty(editor: CodeMirror.Editor, prop: CSSProperty, value: string, name?: string) {
    if (name == null) {
        name = substr(editor, prop.name);
    }

    const before = substr(editor, [prop.before, prop.name[0]]);
    const between = substr(editor, [prop.name[1], prop.value[0]]);
    const after = substr(editor, [prop.value[1], prop.after]);

    return [before, name, between, value, after].join('');
}

/**
 * Check if given value is either quoted or written as expression
 */
export function isQuoted(value: string | undefined): boolean {
    return !!value && (isQuotedString(value) || isExprString(value));
}

export function isQuote(ch: string | undefined) {
    return ch === '"' || ch === "'";
}

/**
 * Check if given string is quoted with single or double quotes
 */
export function isQuotedString(str: string): boolean {
    return str.length > 1 && isQuote(str[0]) && str[0] === str.slice(-1);
}

/**
 * Check if given string contains expression, e.g. wrapped with `{` and `}`
 */
function isExprString(str: string): boolean {
    return str[0] === '{' && str.slice(-1) === '}';
}

export function isSpace(ch: string): boolean {
    return /^[\s\n\r]+$/.test(ch);
}

export function htmlEscape(str: string): string {
    const replaceMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
    };
    return str.replace(/[<>&]/g, ch => replaceMap[ch]);
}

/**
 * Returns special object for bypassing command handling
 */
export function pass(editor: CodeMirror.Editor) {
    return editor.constructor['Pass'];
}

/**
 * Converts given CodeMirror range to text range
 */
export function textRange(editor: CodeMirror.Editor, range: CMRange): TextRange {
    const head = editor.indexFromPos(range.head);
    const anchor = editor.indexFromPos(range.anchor);
    return [
        Math.min(head, anchor),
        Math.max(head, anchor)
    ];
}

/**
 * Check if `a` and `b` contains the same range
 */
export function rangesEqual(a: TextRange, b: TextRange): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

/**
 * Check if range `a` fully contains range `b`
 */
export function rangeContains(a: TextRange, b: TextRange): boolean {
    return a[0] <= b[0] && a[1] >= b[1];
}

/**
 * Check if given range is empty
 */
export function rangeEmpty(r: TextRange): boolean {
    return r[0] === r[1];
}

/**
 * Generates snippet with error pointer
 */
export function errorSnippet(err: AbbrError, baseClass = 'emmet-error-snippet'): string {
    const msg = err.message.split('\n')[0];
    const spacer = ' '.repeat(err.pos || 0);
    return `<div class="${baseClass}">
        <div class="${baseClass}-ptr">
            <div class="${baseClass}-line"></div>
            <div class="${baseClass}-tip"></div>
            <div class="${baseClass}-spacer">${spacer}</div>
        </div>
        <div class="${baseClass}-message">${htmlEscape(msg.replace(/\s+at\s+\d+$/, ''))}</div>
    </div>`;
}

/**
 * Returns last element in given array
 */
export function last<T>(arr: T[]): T | undefined {
    return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/**
 * Check if given editor instance has internal Emmet state
 */
export function hasInternalState(editor: CodeMirror.Editor): boolean {
    return stateKey in editor;
}

/**
 * Returns internal Emmet state for given editor instance
 */
export function getInternalState(editor: CodeMirror.Editor): EmmetState {
    if (!hasInternalState(editor)) {
        editor[stateKey] = { id: String(idCounter++) } as EmmetState;
    }

    return editor[stateKey];
}

/**
 * Finds and collects selections ranges from given snippet
 */
function getSelectionsFromSnippet(snippet: string, base = 0): { ranges: TextRange[], snippet: string } {
    // Find and collect selection ranges from snippet
    const ranges: TextRange[] = [];
    let result = '';
    let sel: TextRange | null = null;
    let offset = 0;
    let i = 0;
    let ch: string;

    while (i < snippet.length) {
        ch = snippet.charAt(i++);
        if (ch === tabStopStart || ch === tabStopEnd) {
            result += snippet.slice(offset, i - 1);
            offset = i;

            if (ch === tabStopStart) {
                sel = [base + result.length, base + result.length];
                ranges.push(sel);
            } else if (sel) {
                sel[1] = base + result.length;
                sel = null;
            }
        }
    }

    return {
        ranges,
        snippet: result + snippet.slice(offset)
    };
}
