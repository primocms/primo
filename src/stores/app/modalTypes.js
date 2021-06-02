import {ComponentEditor,SymbolLibrary,PageSections,SitePages,Styles,Fields,HTML} from '../../views/modal'

export const modalTypes = {
  'COMPONENT_EDITOR' : {
    component: ComponentEditor,
    header: {
      title: 'Create Component',
      icon: 'fas fa-code'
    },
    variants: 'fullscreen',
    // showSwitch: true
  },
  'SYMBOL_LIBRARY' : {
    component: SymbolLibrary,
    header: {
      title: 'Component Library',
      icon: 'fas fa-clone'
    },
    variants: 'fullscreen',
    // showSwitch: true 
  },
  'SITE_PAGES' : {
    component: SitePages,
    header: {
      title: 'Pages',
      icon: 'fas fa-th-large'
    },
    variants: 'max-w-xl'
  },
  'FIELDS' : {
    component: Fields,
    // header: {
    //   title: 'Page Data',
    //   icon: 'fas fa-database'
    // },
    variants: 'max-w-3xl',
    // showSwitch: true 
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
    component: HTML,
    header: {
      title: 'HTML',
      icon: 'fab fa-html5'
    },
    variants: 'max-w-2xl'
  },
}