import {EditorView} from "@codemirror/basic-setup"
import {StateField, EditorState} from "@codemirror/state"
import {Tooltip, showTooltip} from "@codemirror/tooltip"
import {keymap} from "@codemirror/view"
import expand, { extract } from 'emmet';

export default function emmetExt({theme = {}, config = {}} = {}) {
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
   * Attempt to get a valid Emmet abbreviation from the current document selection
   * @param {EditorState} state
   * @returns {{start: number, end: number, abbreviation: string}|null}
   */
  function getEmmetAbbreviation(state) {
    const { from, to } = state.selection.main
    const {selection, start: selectionStart} = getSelection(state, from, to)
    const extraction = extract(selection)
    // if null, emmet failed to find a valid abbreviation in the selection/line
    if (extraction) {
      return {
        abbreviation: extraction.abbreviation,
        start: extraction.start + selectionStart,
        end: extraction.end + selectionStart,
      }
    }

    return null
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
              return {dom}
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
        const extraction = getEmmetAbbreviation(view.viewState.state);
        if (extraction) {
          const {abbreviation, start, end} = extraction
          const expanded = expand(abbreviation, config)
          view.dispatch({
            changes: {
              from: start,
              to: end,
              insert: expanded
            }
          })
          return true
        }
        return false
      }
    }]),
  ];
}