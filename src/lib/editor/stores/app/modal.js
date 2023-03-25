'use strict'

import {modalTypes as initialModalTypes} from './modalTypes'
import {writable,get} from 'svelte/store'
import Mousetrap from 'mousetrap'

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
  maxWidth: null,
  showSwitch: false,
  noPadding: false
}

const modalTypes = {
  ...initialModalTypes
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
      ...modalOptions,
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
        variants: options.width ? `${options.width}` : '',
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
