'use strict'

import {writable,get} from 'svelte/store'
import Mousetrap from 'mousetrap'
// import {location,push} from 'svelte-spa-router'
import {router} from 'tinro'

const initialState = {
  type: null,
  component: null,
  componentProps: {},
  header: {
    title: '',
    icon: null
  },
  footer: null,
  variants: '',
  disableClose: false,
  disabledBgClose: false,
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
    showSwitch: true,
    disabledBgClose: true
  },
  'SYMBOL_LIBRARY' : {
    route: 'symbols',
    header: {
      title: 'Component Library',
      icon: 'fas fa-clone'
    },
    variants: 'fullscreen',
    showSwitch: true 
  },
  'SITE_PAGES' : {
    route: 'pages',
    header: {
      title: 'Pages',
      icon: 'fas fa-th-large'
    },
    variants: 'max-w-xl'
  },
  'FIELDS' : {
    route: 'fields',
    // header: {
    //   title: 'Page Data',
    //   icon: 'fas fa-database'
    // },
    variants: 'max-w-3xl',
    showSwitch: true,
    disabledBgClose: true
  },
  'STYLES' : {
    route: 'css',
    header: {
      title: 'CSS',
      icon: 'fab fa-css3'
    },
    variants: 'fullscreen',
    disabledBgClose: true
  },
  'WRAPPER' : {
    route: 'html',
    header: {
      title: 'HTML',
      icon: 'fab fa-html5'
    },
    variants: 'max-w-2xl',
    disabledBgClose: true
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
    store.update(s => ({ 
      ...initialState, 
      ...typeToShow,
      type,
    }))
  },
  hide: (nav = null) => {
    modal_cleanup()
    store.update(s => ({ 
      ...s,
      type: null,
    }))
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
