import { EditorView } from "@codemirror/basic-setup"
import { StateField, EditorState, EditorSelection, TransactionSpec, ChangeSpec } from "@codemirror/state"
import { Tooltip, showTooltip } from "@codemirror/tooltip"
import { keymap } from "@codemirror/view"
import { expand } from './lib/emmet';
import { extract, Config } from 'emmet';
import { syntaxInfo } from './lib/syntax'
import { getSelectionsFromSnippet, tabStopEnd, tabStopStart } from './lib/utils'

export interface EmmetExt {
  theme: Object,
  config: Config,
}

const ABBR_BLACKLIST = ['{}', '{{}}'];

/**
 *
 * @param theme
 * @param config
 * @param config.type - stylesheet | markup
 * @param config.syntax - e.g. css, stylus, scss, html
 */
export default function emmetExt(extConfig: EmmetExt) {
  const { theme, config } = extConfig;
  /**
   * Given a start and end position, parse out a text string from the document.
   * If start and end are the same (no selection), returns the current line.
   * @param {EditorState} state
   * @param {number} start
   * @param {number} end
   * @returns {{selection: string, start: number}}
   */
  function getSelection(state, start, end) {
    const lines = state.doc.text || '';
    let selection = '';
    let pointer = 0;
    let startPointer = 0;
    for (let i = 0; i < lines.length; i++) {
      let currLine = lines[i] + state.lineBreak;
      const lineLength = currLine.length
      if (start < (pointer + lineLength)) {
        // selection starts in this line
        if (start == end) {
          // get whole line if no selection range
          selection = lines[i] // exclude ending line break
          startPointer = pointer;
          break
        } else if (end < (pointer + lineLength)) {
          // if single line selection, pull out whole selection from here
          selection = currLine.substring(start - pointer, end - pointer)
          startPointer = start
          break
        } else {
          // this is the start of a multi-line selection
          selection = currLine.substring(start - pointer)
        }
      } else if (selection && end >= (pointer + lineLength)) {
        // this whole line is part of multi-line selection
        selection += currLine
      } else if (selection && end < (pointer + lineLength)) {
        // this line contains the end of multi-line selection
        selection += currLine.substring(0, end - pointer)
      }
      pointer += lineLength
    }
    return {
      selection,
      start: startPointer,
    };
  }

  /**
   * Search for next tab stop start/end to get the next range
   * to move the cursor to
   * @param {EditorState} state
   * @param {number} start - index to start searching from
   */
  function findNextTabStop(state: EditorState, start: number) {
    const doc = state.doc.toString();
    const nextTabStopStart = doc.indexOf(tabStopStart, start);
    const from = nextTabStopStart;
    if (nextTabStopStart > -1) {
      let to;
      const nextEnd = doc.indexOf(tabStopEnd, nextTabStopStart + 1);
      const nextStart = doc.indexOf(tabStopStart, nextTabStopStart + 1);

      if (nextEnd == -1) {
        to = nextTabStopStart + 1; // just this single tabStopStart
      } else if (nextStart == -1) {
        to = nextEnd + 1 // select through next tabStopEnd
      } else {
        to = Math.min(nextStart, nextEnd);
      }
      to = to === -1 ? nextTabStopStart + 1 : to;

      let placeholder = '';
      if (to - from > 2) {
        placeholder = state.doc.sliceString(from + 1, to - 1);
      }
      return {
        from: nextTabStopStart,
        to,
        placeholder,
      }
    }
    return null;
  }

  /**
   * Attempt to get a valid Emmet abbreviation from the current document selection
   * @param {EditorState} state
   * @returns {{start: number, end: number, abbreviation: string}|null}
   */
  function getEmmetAbbreviation(state: EditorState) {
    const { from, to } = state.selection.main
    let { selection, start: selectionStart } = getSelection(state, from, to)

    const info = syntaxInfo(config.syntax, state, from);
    if (!info.context) return null;
    if (info.type === 'stylesheet') {
      // ignore root level CSS
      if (!info.context.ancestors || !info.context.ancestors.length)
        return null;
    }

    if (selectionStart === 0) { // avoid bug where emmet doesn't work if selection starts at 0
      selectionStart = null
    }

    const extraction = extract(selection, selectionStart, {
      lookAhead: info.type !== 'stylesheet',
      type: info.type,
    });
    // if null, emmet failed to find a valid abbreviation in the selection/line
    if (extraction && !isExcluded(extraction.abbreviation)) {
      return {
        abbreviation: extraction.abbreviation,
        start: extraction.start + selectionStart,
        end: extraction.end + selectionStart,
      }
    }

    return null
  }

  /**
   * Check if abbreviation should be excluded from being run through
   * the `expand` command.
   * This is mainly for handlebars tokens, but there should probably be
   * a better way to do that.
   * @param abbr
   */
  function isExcluded(abbr) {
    if (ABBR_BLACKLIST.includes(abbr)) {
      return true;
    }

    // skip handlebars tokens
    if (abbr.match(/\{\{.*\}\}/)) {
      return true;
    }

    return false;
  }

  const cursorTooltipField = StateField.define<readonly Tooltip[]>({
    create: getCursorTooltips,

    update(tooltips, tr) {
      if (!tr.docChanged && !tr.selection) return tooltips
      return getCursorTooltips(tr.state)
    },

    provide: f => showTooltip.computeN([f], state => state.field(f))
  })
  function getCursorTooltips(state: EditorState): readonly Tooltip[] {
    return state.selection.ranges
      .filter(range => range.empty)
      .map(range => {
        let line = state.doc.lineAt(range.head)
        let text = line.number + ":" + (range.head - line.from)
        const extraction = getEmmetAbbreviation(state)
        if (extraction) {
          const expanded = expand(extraction.abbreviation, config)
          return {
            pos: extraction.start,
            above: false,
            strictSide: true,
            class: "cm-cursor-tooltip",
            create: () => {
              let dom = document.createElement("div")
              dom.classList.add('ͼh')
              dom.textContent = expanded
              return { dom }
            }
          }
        }
        return null;
      })
  }
  const cursorTooltipBaseTheme = EditorView.baseTheme({
    ".cm-tooltip.cm-cursor-tooltip": {
      whiteSpace: "pre",
      ...theme
    }
  })

  // to later add any tooltip functionality, make this an array and pass other extensions
  return [
    cursorTooltipBaseTheme,
    cursorTooltipField,
    keymap.of([{
      key: "Tab",
      run: (view: EditorView) => {
        const extraction = getEmmetAbbreviation(view.state);
        if (extraction) {
          const { abbreviation, start, end } = extraction

          const snippet = expand(abbreviation, config) as string;
          const snippetPayload = getSelectionsFromSnippet(snippet);
          const transaction = {
            changes: {
              from: start,
              to: end,
              insert: snippet
            } as ChangeSpec
          } as TransactionSpec;

          // position cursor at first position in snippet
          if (snippetPayload.ranges && snippetPayload.ranges.length) {
            const range = snippetPayload.ranges[0];

            // replace tab stop start/end characters of first selection
            const placeholder = range[1] - range[0] > 2 ? view.state.doc.sliceString(range[0] + 1, range[1] - 1) : "";
            const rangeStart = start + range[0];
            transaction.selection = EditorSelection.range(rangeStart, rangeStart + placeholder.length);
            transaction.changes.insert = snippet.slice(0, range[0]) +
              placeholder +
              snippet.slice(range[1]) +
              tabStopStart;
          }
          view.dispatch(transaction)
          return true
        }

        // if there is an upcoming tabstop, move cursor to it
        const { from } = view.state.selection.main
        const nextRange = findNextTabStop(view.state, from);
        if (nextRange) {
          // replace tab stop start/end characters of next selection
          view.dispatch({
            changes: {
              from: nextRange.from,
              to: nextRange.to,
              insert: nextRange.placeholder,
            },
            selection: EditorSelection.range(nextRange.from, nextRange.from + nextRange.placeholder.length),
          });
          return true;
        }

        return false;
      }
    }]),
  ];
}