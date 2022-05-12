import { EditorView, Decoration, ViewUpdate, ViewPlugin, DecorationSet } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { RangeSetBuilder } from "@codemirror/rangeset"
import { syntaxTree } from "@codemirror/language"
import { some as _some } from 'lodash-es'

const sveltePlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = applySvelteSyntax(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged)
      this.decorations = applySvelteSyntax(update.view)
  }
}, {
  decorations: v => v.decorations
})


const baseTheme = EditorView.baseTheme({
  ".cm-svelte-keyword": {
    color: 'rgb(197,134,192)'
  },
  ".cm-svelte-bracket, .cm-svelte-bracket *": {
    color: 'rgb(212,212,212) !important'
  },
  ".cm-svelte-variable, .cm-svelte-variable *": {
    color: 'rgb(156,218,252) !important'
  },
})

const highlightEntities = {
  bracket: Decoration.mark({ class: "cm-svelte-bracket" }),
  variable: Decoration.mark({ class: "cm-svelte-variable" }),
  keyword: Decoration.mark({ class: "cm-svelte-keyword" }),
}

function applySvelteSyntax(view: EditorView) {
  let builder = new RangeSetBuilder<Decoration>()
  const actions = []

  syntaxTree(view.state).iterate({
    from: view.visibleRanges['from'],
    to: view.visibleRanges['to'],
    enter: (type, from, to) => {
      // highlight attributes when svelte variable
      if (type.name === 'Text') {
        const string = view.state.doc.sliceString(from, to)

        const [stringWithBrackets] = string.match(/({.*})/g) || [];
        if (stringWithBrackets) {
          const individualWords = stringWithBrackets.split(' ')

          individualWords.forEach((word) => {

            let position = from + string.indexOf(word, 0)

            const specialCharacters = ['{', '}']

            specialCharacters.forEach(highlightSpecialChar)

            function highlightSpecialChar(character, i) {
              const regex = new RegExp(character, 'g');
              const characterPosition = [...word.matchAll(regex)] // word.indexOf(character)
              if (characterPosition) {
                characterPosition.forEach(({ index }) => {
                  actions.push({
                    start: position + index,
                    length: 1,
                    mark: highlightEntities.bracket,
                    string: character
                  })
                })
              }
            }

            const keywords = ['#each', '/each', 'as', '@html', '/if', '#if', ':else']

            keywords.forEach(highlightKeyword)

            function highlightKeyword(keyword) {
              const keywordPosition = word.indexOf(keyword)

              if (keywordPosition === -1) return

              actions.push({
                start: position + keywordPosition,
                length: keyword.length,
                mark: highlightEntities.keyword,
                string: keyword
              })
            }

            const [enclosedVariable] = word.match(/({.*})/g) || []

            if (enclosedVariable) {
              const variable = enclosedVariable.replace(/[{}]/g, "")

              if (keywords.includes(variable)) return

              const newPosition = from + string.indexOf(variable)

              actions.push({
                start: newPosition,
                end: newPosition + variable.length,
                mark: highlightEntities.variable
              })
            } else if (word.match(/([{}])/g)) {
              const variable = word.replace(/[{}]/g, "")
              if (keywords.includes(variable)) return

              const newPosition = from + string.indexOf(word)

              actions.push({
                start: newPosition,
                end: newPosition + variable.length,
                mark: highlightEntities.variable
              })
            } else {
              const isKeyword = _some(keywords, keyword => word.includes(keyword), false)
              if (isKeyword) return

              const newPosition = from + string.indexOf(word)
              actions.push({
                start: newPosition,
                end: newPosition + word.length,
                mark: highlightEntities.variable
              })
            }

          })
        }

      } else if (type.name === 'UnquotedAttributeValue') {
        const string = view.state.doc.sliceString(from, to)
        actions.push({
          start: from,
          end: from + 1,
          mark: highlightEntities.bracket
        })
        actions.push({
          start: from + 1,
          end: from + string.length - 1,
          mark: highlightEntities.variable
        })
        actions.push({
          start: from + string.length - 1,
          end: from + string.length,
          mark: highlightEntities.bracket
        })
      }
    }
  })

  const sorted = actions.sort((a, b) => a.start - b.start)

  sorted.forEach(({ start, end, length, mark }) => {
    builder.add(start, length ? (start + length) : end, mark)
  })
  return builder.finish()
}

export default function svelteSyntaxExtension(): Extension {
  return [
    baseTheme,
    sveltePlugin
  ]
}