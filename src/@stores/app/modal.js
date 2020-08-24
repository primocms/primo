'use strict'

import {writable,get} from 'svelte/store'
import {ComponentEditor,ComponentLibrary,PageSections,SitePages,PageStyles,SiteStyles,Styles,Fields,Dependencies,Build,Wrapper} from '../../@modal'
import Mousetrap from 'mousetrap'

const initialState = {
  visible: false,
  component: null,
  componentProps: {},
  header: {
    title: '',
    icon: null
  },
  variants: '',
  disableClose: false,
  showSwitch: false
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

const modalTypes = {
  'COMPONENT_EDITOR' : {
    component: ComponentEditor,
    header: {
      title: 'Create Component',
      icon: 'fas fa-code'
    },
    variants: 'fullscreen',
    showSwitch: true
  },
  'COMPONENT_LIBRARY' : {
    component: ComponentLibrary,
    header: {
      title: 'Symbol Library',
      icon: 'fas fa-clone'
    },
    variants: 'fullscreen',
    showSwitch: true 
  },
  'PAGE_SECTIONS' : {
    component: PageSections,
    header: {
      title: 'Add Page Section',
      icon: 'fas fa-columns'
    },
    variants: 'max-w-lg'
  },
  'SITE_PAGES' : {
    component: SitePages,
    header: {
      title: 'Pages',
      icon: 'fas fa-th-large'
    },
    variants: 'max-w-md'
  },
  'PAGE_STYLES' : {
    component: PageStyles,
    header: {
      title: 'Page Styles',
      icon: 'fab fa-css3'
    },
    variants: 'fullscreen'
  },
  'FIELDS' : {
    component: Fields,
    // header: {
    //   title: 'Page Data',
    //   icon: 'fas fa-database'
    // },
    variants: 'max-w-3xl',
    showSwitch: true 
  },
  'DEPENDENCIES' : {
    component: Dependencies,
    header: {
      title: 'Dependencies',
      icon: 'fas fa-cube'
    },
    variants: 'max-w-lg'
  },
  'SITE_STYLES' : {
    component: SiteStyles,
    header: {
      title: 'Site Styles',
      icon: 'fab fa-css3'
    },
    variants: 'fullscreen'
  },
  'STYLES' : {
    component: Styles,
    header: {
      title: 'CSS',
      icon: 'fab fa-css3'
    },
    variants: 'fullscreen'
  },
  'WRAPPER' : {
    component: Wrapper,
    header: {
      title: 'Wrapper',
      icon: 'fab fa-html5'
    },
    variants: 'max-w-xl'
  },
  'BUILD' : {
    component: Build,
    header: {
      title: 'Build',
      icon: 'fas fa-hammer'
    },
    // variants: 'fullscreen'
  },
}

export default {
  show: (type, props = {}, modalOptions = {}) => {
    const typeToShow = getModalType(type, props, modalOptions)
    modal_startup()
    store.update(s => ({ 
      ...s, 
      ...typeToShow,
      ...modalOptions,
      visible: true 
    }))
  },
  hide: () => {
    modal_cleanup()
    store.update(s => ({...initialState}) )
  },
  create: (modal) => {
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
        component,
        header: options.header,
        variants: options.width ? `max-w-${options.width}` : '',
        ...options,
        componentProps
      }
    }
  },
  subscribe: store.subscribe
}

function getModalType(type, props, modalOptions) {
  return {
    componentProps: props,
    ...modalTypes[type],
    ...modalOptions
  } || console.error('Invalid modal type:', type)
}
