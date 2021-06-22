import { tabStopStart, tabStopEnd } from './utils';

/**
 * Produces tabstop for CodeMirror editor
 */
export function field() {
    let handled = -1;
    return (index: number, placeholder: string) => {
        if (handled === -1 || handled === index - 1) {
            handled = index;
            return placeholder
                ? tabStopStart + placeholder + tabStopEnd
                : tabStopStart;
        }

        return placeholder || '';
    }
}

/**
 * Returns indentation of given line
 */
export function lineIndent(editor: CodeMirror.Editor, line: number): string {
    const lineStr = editor.getLine(line);
    const indent = lineStr.match(/^\s+/);
    return indent ? indent[0] : '';
}

/**
 * Returns token used for single indentation in given editor
 */
export function getIndentation(editor: CodeMirror.Editor): string {
    if (!editor.getOption('indentWithTabs')) {
        return ' '.repeat(editor.getOption('indentUnit') || 0);
    }

    return '\t';
}
