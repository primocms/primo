import {schema as baseSchema} from "prosemirror-schema-basic"
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {undo, redo, history} from "prosemirror-history"
import {keymap} from "prosemirror-keymap"
import {baseKeymap,toggleMark,setBlockType,wrapIn} from "prosemirror-commands"
import {DOMSerializer,DOMParser,Schema} from "prosemirror-model"
import {addListNodes,wrapInList} from "prosemirror-schema-list"

import {Plugin} from "prosemirror-state"

import {buildKeymap} from './keymap.js'

import {get} from 'svelte/store'
import {focusedNode} from '../../stores/app'

import {buildInputRules} from './inputrules.js'


const schema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseSchema.spec.marks
    .addToEnd("highlight", {
      toDOM() { return ["mark"] },
      parseDOM: [{tag: "mark"}]
    })
    .addToEnd("link", {
      attrs: {href: {}},
      toDOM(node) { return ["a", {href: node.attrs.href}] },
      parseDOM: [{tag: "a", getAttrs(dom) { return {href: dom.href} }}],
      inclusive: false
    })
    .addToEnd("code", {
      toDOM() { return ["code"] },
      parseDOM: [{tag: "code"}]
    })
})


function createBlock(blockType, options, id) {
  return {
    blockType: schema.nodes[blockType],
    options,
    command: setBlockType(schema.nodes[blockType], options),
    dom: document.querySelector(`#primo-toolbar--${id}`)
  }
}

function createLink() {
  return {
    isLink: true,
    command: toggleMark(schema.marks.link, { href: linkUrl }),
    dom: document.querySelector('#primo-toolbar--link')
  }
}

function toggleLink(state, dispatch) {
  let {doc, selection} = state
  if (selection.empty) return () => {}
  let attrs = null
  if (!doc.rangeHasMark(selection.from, selection.to, schema.marks.link)) {
    attrs = {href: prompt("Enter link", "")}
    if (!attrs.href) return () => {}
  }
  return toggleMark(schema.marks.link, attrs)
}

function handleLink(editorView) {
  const {state,dispatch} = editorView
  toggleLink(state, dispatch)(state, dispatch, editorView)
}

class MenuView {
  constructor(editorView) {

    this.editorView = editorView

    const items = [
      {
        command: toggleMark(schema.marks.highlight),
        dom: document.querySelector('#primo-toolbar--highlight')
      },
      {
        isLink: true,
        dom: document.querySelector('#primo-toolbar--link'),
      },
      // { // inline code, maybe turn on later
      //   command: toggleMark(schema.marks.code), 
      //   dom: document.querySelector('#primo-toolbar--code')
      // },
      {
        command: toggleMark(schema.marks.strong), 
        dom: document.querySelector('#primo-toolbar--bold')
      },
      {
        command: toggleMark(schema.marks.em), 
        dom: document.querySelector('#primo-toolbar--italic')
      },
      createBlock('code_block', {}, 'code'), 
      createBlock('heading', { level: 1 }, 'h1'),
      createBlock('heading', { level: 2 }, 'h2'),
      {
        command: wrapInList(schema.nodes.bullet_list),
        dom: document.querySelector('#primo-toolbar--ul')
      },
      {
        command: wrapInList(schema.nodes.ordered_list),
        dom: document.querySelector('#primo-toolbar--ol')
      },
      {
        command: wrapIn(schema.nodes.blockquote), 
        dom: document.querySelector('#primo-toolbar--blockquote')
      }
    ]

    this.items = items
    this.dom = document.querySelector("#primo-toolbar")
    this.update()

    this.dom.addEventListener("mousedown", e => {
      e.preventDefault()
      const focusedEditor = get(focusedNode)
      const focusedEditorId = focusedEditor ? focusedEditor.id : null
      const givenEditorId = editorView.dom.id.replace('editor-','')
      const givenEditorFocused = focusedEditorId === givenEditorId
    
      if (givenEditorFocused) editorView.focus()

      items.forEach(({command, dom, blockType, options, isLink}) => {
        const shouldChangeContent = dom.contains(e.target) && givenEditorFocused
        if (shouldChangeContent) {

          if (isLink) {
            handleLink(editorView)
          } else {
            // Check if item has block type (false if it's a mark) to apply it or set it to a paragraph (i.e. reset the block)
            let {$from, to, node} = editorView.state.selection
            const hasBlockType = to <= $from.end() && $from.parent.hasMarkup(blockType, options)
            if (hasBlockType) {
              setBlockType(schema.nodes.paragraph)(editorView.state, editorView.dispatch, editorView)
            } else {
              command(editorView.state, editorView.dispatch, editorView)
            }
          }

        }
      })
    })
  }

  update() {
    this.items.forEach(({command, dom}) => {
      if (command) {
        let active = command(this.editorView.state, null, this.editorView)
        // do something to `dom` if active is true
      }
    })
  }

  destroy() { this.dom.remove() }
}


function menuPlugin() {
  return new Plugin({
    view(editorView) {
      return new MenuView(editorView)
    }
  })
}

const menu = menuPlugin()

export function createEditor(editorNode, htmlString, eventListeners) {

  const contentNode = document.createElement("div");
  contentNode.innerHTML = htmlString;

  const state = EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(contentNode),
    plugins: [
      buildInputRules(schema),
      history(),
      // keymap({"Mod-z": undo, "Mod-y": redo}),
      keymap(buildKeymap(schema, {})),
      keymap(baseKeymap),
      document.querySelector('#primo-toolbar--ol') ? menu : null // ensure doc formatting items exist in toolbar
    ].filter(i => i)
  })

  const view = new EditorView(editorNode, {
    transformPastedHTML: (html) => {
      // TODO: Dispatch event to create component from html or wrap in <pre>
    },
    state,
    dispatchTransaction(transaction) {
      const newState = view.state.apply(transaction)
      view.updateState(newState)
      eventListeners.onchange(getHTML()) // TODO: Check if content changed before dispatching 
      if (view.focused) {
        const length = view.docView.posAtEnd - 1
        const currentSelection = newState.selection.to
        const lastCharacterSelected = (currentSelection === length)
        eventListeners.onselectionchange(lastCharacterSelected ? -1 : currentSelection)
      }
    }
  })

  function getHTML() {
    const div = document.createElement('div')
    const fragment = DOMSerializer
      .fromSchema(schema)
      .serializeFragment(view.state.doc.content)

    div.appendChild(fragment)

    return div.innerHTML
  }

  view.dom.onfocus = () => {
    const currentSelection = view.state.selection.to
    eventListeners.onfocus(currentSelection)
  }

  view.dom.onblur = () => {
    eventListeners.onblur()
  }

  view.dom.onkeydown = (e) => {
      eventListeners.onkeydown(e)
      const length = view.docView.posAtEnd - 1
      const backspacingEmptyNode = (view.focused && e.key === 'Backspace' && length === 1)
      if (backspacingEmptyNode) {
        eventListeners.ondelete(view.dom.innerHTML)
      }
  }

  return {
    state,
    view
  }

}
