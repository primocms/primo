import {flatten} from "lodash"
import modal from '../../../stores/app/modal'

export const makeEditorialButtons = () => [
    [ 
      {
        title: 'Heading', 
        icon: 'heading', 
        key: 'h',
        id: 'h1'
      },
      {
        title: 'Subheading', 
        icon: 'heading heading2', 
        id: 'h2'
      },
    ],
    [
      {
        title: 'Bold', 
        icon: 'bold', 
        key: 'b',
        id: 'bold'
      },
      {
        title: 'Italic', 
        icon: 'italic', 
        key: 'i',
        id: 'italic'
      },
      {
        title: 'Highlight', 
        icon: 'highlighter', 
        key: 'l',
        id: 'highlight'
      }
    ],
    [
      {
        title: 'Link', 
        icon: 'link', 
        key: 'k',
        id: 'link'
      }
    ],
    [
      {
        title: 'CodeFormat', 
        icon: 'code', 
        id: 'code'
      },
      {
        title: 'Quote', 
        icon: 'quote-left',
        id: 'blockquote'
      }
    ],
    [
      {
        title: 'Unordered List', 
        icon: 'list-ul', 
        id: 'ul'
      },
      {
        title: 'Ordered List', 
        icon: 'list-ol', 
        id: 'ol'
      }
    ],
  ]

export const makeEditorButtons = ({handleClose}) => [
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES') 
      }
    ],
    [
      {
        title: 'Content',
        icon: 'heading',
        buttons: flatten(makeEditorialButtons())
      },
      {
        title: 'Symbol Library',
        id: 'symbol-library',
        icon: 'clone',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: handleClose
          }
        }) 
      },
      {
        title: 'Page Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
    ],
    [
      {
        title: 'Content', 
        icon: 'database', 
        onclick: () => modal.show('FIELDS')
      }
    ]
  ]

export const makeDeveloperButtons = ({handleClose}) => [
    [
      {
        id: 'toolbar--pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES') 
      }
    ],
    [
      {
        id: 'toolbar--formatting',
        title: 'Content',
        icon: 'heading',
        buttons: flatten(makeEditorialButtons())
      }
    ],
    [
      {
        id: 'toolbar--component',
        title: 'Component',
        icon: 'code',
        onclick: () => modal.show('COMPONENT_EDITOR', {
          header: {
            title: 'Create Component',
            icon: 'fas fa-code',
            button: {
              icon: 'fas fa-plus',
              label: 'Add to page',
              onclick: handleClose
            }
          }
        })
      },
      {
        title: 'Symbol',
        id: 'toolbar--symbols',
        icon: 'clone',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: handleClose
          }
        }) 
      },
      {
        id: 'toolbar--sections',
        title: 'Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
    ],
    [
      {
        id: 'toolbar--html',
        title: 'HTML',
        icon: 'fab fa-html5',
        onclick: () => modal.show('WRAPPER'),
      },
      {
        id: 'toolbar--css',
        title: 'CSS',
        icon: 'fab fa-css3',
        onclick: () => modal.show('STYLES')
      }
    ],
    [
      {
        id: 'toolbar--fields',
        title: 'Fields',
        icon: 'database',
        onclick: () => modal.show('FIELDS')
      }
    ],
  ]