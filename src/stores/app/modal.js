'use strict'

import {writable,get} from 'svelte/store'
import Mousetrap from 'mousetrap'
import {location,push} from 'svelte-spa-router'

const initialState = {
  component: null,
  componentProps: {},
  header: {
    title: '',
    icon: null
  },
  footer: null,
  variants: '',
  disableClose: false,
  showSwitch: false,
  noPadding: false
}

const modalTypes = {
  'COMPONENT_EDITOR' : {
    route: 'component',
    header: {
      title: 'Create Component',
      icon: 'fas fa-code'
    },
    variants: 'fullscreen',
    showSwitch: true
  },
  'COMPONENT_LIBRARY' : {
    route: 'symbols',
    header: {
      title: 'Symbol Library',
      icon: 'fas fa-clone'
    },
    variants: 'fullscreen',
    showSwitch: true 
  },
  'PAGE_SECTIONS' : {
    route: 'sections',
    header: {
      title: 'Add Page Section',
      icon: 'fas fa-columns'
    },
    variants: 'max-w-lg',
    showSwitch: false
  },
  'SITE_PAGES' : {
    route: 'pages',
    header: {
      title: 'Pages',
      icon: 'fas fa-th-large'
    },
    variants: 'max-w-md'
  },
  'FIELDS' : {
    route: 'fields',
    // header: {
    //   title: 'Page Data',
    //   icon: 'fas fa-database'
    // },
    variants: 'max-w-3xl',
    showSwitch: true 
  },
  'DEPENDENCIES' : {
    route: 'dependencies',
    header: {
      title: 'Dependencies',
      icon: 'fas fa-cube'
    },
    variants: 'max-w-xl',
    showSwitch: false
  },
  'STYLES' : {
    route: 'css',
    header: {
      title: 'CSS',
      icon: 'fab fa-css3'
    },
    variants: 'fullscreen'
  },
  'WRAPPER' : {
    route: 'html',
    header: {
      title: 'HTML',
      icon: 'fab fa-html5'
    },
    variants: 'max-w-2xl'
  },
  'RELEASE_NOTES' : {
    route: 'release-notes',
    header: {
      title: 'Release Notes',
      icon: 'fas fa-book-open'
    },
    // variants: 'fullscreen'
  },
}

const store = writable(initialState)

const modal_startup = () => {
  Mousetrap.bind('backspace', (e) => {
    e.preventDefault()
  })
}
const modal_cleanup = () => {
  Mousetrap.unbind('backspace')
}

export default {
  show: (type, componentProps = {}, modalOptions = {}) => {
    const typeToShow = getModalType(type, componentProps, modalOptions)
    modal_startup()
    push(`${get(location)}?m=${typeToShow.route}`) // accessed by App.svelte
    store.update(s => ({ 
      ...initialState, 
      ...typeToShow
    }))
  },
  hide: (nav = null) => {
    modal_cleanup()
    push(nav === null ? get(location) : `/${nav}`)
    // store.update(s => ({...initialState}) )
  },
  register: (modal) => {
    if (Array.isArray(modal)) {
      modal.forEach(createModal)
    } else if (typeof modal === 'object') {
      createModal(modal)
    } else {
      console.error('Could not register modal an array or object')
    }

    function createModal(modal) {
      const { id, component, componentProps={}, options={} } = modal
      modalTypes[id] = {
        ...options,
        component,
        header: options.header,
        variants: options.width ? `max-w-${options.width}` : '',
        componentProps
      }
    }
  },
  subscribe: store.subscribe
}

function getModalType(type, componentProps = {}, modalOptions = {}) {
  return {
    componentProps,
    ...modalTypes[type],
    ...modalOptions
  } || console.error('Invalid modal type:', type)
}
