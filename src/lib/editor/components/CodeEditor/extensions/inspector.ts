import { EditorView, Decoration } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state';

const addUnderline = StateEffect.define<{ from: number, to: number }>()

const underlineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes)
    for (let e of tr.effects) if (e.is(addUnderline)) {
      underlines = underlines.update({
        add: [underlineMark.range(e.value.from, e.value.from)],
        filter: (f, t, value) => {
          if (value.spec.class === 'cm-highlight') return false
          else return true
        },
      })
    }
    return underlines
  },
  provide: f => EditorView.decorations.from(f)
})

const underlineMark = Decoration.line({ class: "cm-highlight" })

const underlineTheme = EditorView.baseTheme({
  ".cm-highlight": { background: "#333" }
})

export default function highlightActiveLine(Editor, loc) {
  if (!loc) return
  let activeLine
  for (let { from, to } of Editor.visibleRanges) {
    for (let pos = from; pos <= to;) {
      let line = Editor.state.doc.lineAt(pos)
      if (line.number === (loc.line + 1) && line.from !== line.to) {
        activeLine = line
        break;
      } else {
        pos = line.to + 1
      }
    }
  }

  if (activeLine) {
    highlightLine(Editor, activeLine);
  }

  function highlightLine(view: EditorView, line) {
    let effects: StateEffect<unknown>[] = [addUnderline.of({ from: line.from, to: line.to })]
    if (!effects.length) return false

    if (!view.state.field(underlineField, false))
      effects.push(StateEffect.appendConfig.of([underlineField, underlineTheme]))
    view.dispatch({ effects })
    return true
  }
}
