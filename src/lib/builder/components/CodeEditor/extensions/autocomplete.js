import {svelteLanguage} from '@replit/codemirror-lang-svelte'
import { cssLanguage } from "@codemirror/lang-css"
import { snippetCompletion } from '@codemirror/autocomplete'
import _ from 'lodash-es';

const Completion_Label = (value) => {
  if (Array.isArray(value)) {
    return `[ ${typeof(value[0])} ]`
  } else if (_.isObject(value)) {
    return '{ ' + Object.entries(value).map(([ key, value ]) => `${key}:${typeof(value)}`).join(', ') + ' }'
  } else {
    return typeof(value)
  }
}

function svelteCompletions(data) { 
  const completions = [
    snippetCompletion('{#if ${true}}\n\t${<span>Shown if true</span>}\n{:else}\n\t${<span>Shown if false</span>}\n{/if', {
      label: "{#if}",
      type: "text",
      detail: "Conditionally render a block of content",
    }),
    snippetCompletion('{#each ${["one", "two"]} as ${item}}\n\t${\{item\\}}\n{/each', {
      label: "{#each}", 
      type: "text",
      detail: "Loop over array or Repeater items"
    }),
    snippetCompletion('{#await ${promise}}\n\t${<span>promise is pending</span>}\n{:then ${value}}\n\t${<span>promise was fullfilled</span>}\n{:catch ${error}}\n\t${<span>promise was rejected</span>}\n{/await', {
      label: "{#await}", 
      type: "text",
      detail: "Show content depending on the states of a Promise"
    }),
    snippetCompletion('{#key ${"value"}}\n\t<span>this will re-render when "value" changes</span>\n{/key', {
      label: "{#key}", 
      type: "text", 
      detail: "Re-render a block when a value changes"
    }),
    snippetCompletion('{@html ${"<p>content</p>"}', {
      label: "{@html}", type: "text", detail: "Render HTML from a Markdown field"
    }),
    snippetCompletion('{@debug ${variable}', {
      label: "{@debug}", 
      type: "text", 
      detail: "Log a variable's value"
    }),
    snippetCompletion('{@const ${variable = "foo"}', {
      label: "{@const}", 
      type: "text", 
      detail: "Define a local constant"
    }),
  ]
  return svelteLanguage.data.of({
    autocomplete: (context) => {
      const word = context.matchBefore(/\S*/)

      // Svelte blocks
      if ((word.text.includes('{#') || word.text.includes('{@'))) {
        const position = (word.text.indexOf('{#') !== - 1 ? word.text.indexOf('{#') : word.text.indexOf('{@')) 
        return {
          from: word.from + position,
          options: completions
        }
      }
    
      // Field values
      if (word.text.includes('{')) {
        // matches child field values
        const position = word.text.indexOf('{') 

        if (word.text.includes('.')) {
          const options = Object.entries(data).filter(([key, value]) => (_.isObject(value) && !Array.isArray(value))).map(([key, value]) => {
            const child_options = Object.entries(value).map(([child_key, child_value]) => ({
              label: `${key}.${child_key}`,
              type: 'variable',
              detail: Completion_Label(child_value)
            }))
            return child_options
          })
          return {
            from: word.from + position + 1,
            options: _.flattenDeep(options)
          }
        }

        // matches root-level fields
        return {
          from: word.from + position + 1, // offset for bracket
          options: [
            ...Object.entries(data).map(([key, value]) => ({ 
              label: key, 
              type: 'variable', 
              detail: Completion_Label(value) 
            })),
            {
              label: '{#block}', 
              apply: '#',
              type: 'text', 
              detail: 'each, if, key, await',
              boost: -1
            },
            {
              label: '{@tag}',
              apply: '@', 
              type: 'text', 
              detail: 'html, const, debug',
              boost: -2
            }
          ]
        }
      }
    }
  })
}


function cssCompletions(list = []) {
  const variables = list.map(item => item.substring(0, item.length - 1))
  return cssLanguage.data.of({
    autocomplete: (context) => {
      const word = context.matchBefore(/\S*/)
      if (!word.text.startsWith('var(')) return null
      return {
        from: word.from,
        options: variables.map(item => ({
          label: `var(${item})`, 
          type: "text", 
          apply: `var(${item}`
        }))
      }
    }
  })
}

export function updateCompletions(Editor, variables, compartment) {
  Editor.dispatch({
    effects: compartment.reconfigure(cssCompletions(variables))
  })
}

export function extract_css_variables(css) {
  return css.match(/--\S*:/gm) || []
}

export {
  cssCompletions,
  svelteCompletions
}