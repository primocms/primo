import {ComponentEditor,SymbolLibrary,PageSections,ReleaseNotes,SitePages,Styles,Fields,Dependencies,HTML} from '../../views/modal'

export const modalTypes = {
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
    component: SymbolLibrary,
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
    variants: 'max-w-lg',
    showSwitch: false
  },
  'SITE_PAGES' : {
    component: SitePages,
    header: {
      title: 'Pages',
      icon: 'fas fa-th-large'
    },
    variants: 'max-w-md'
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
    variants: 'max-w-xl',
    showSwitch: false
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
  'RELEASE_NOTES' : {
    component: ReleaseNotes,
    header: {
      title: 'Release Notes',
      icon: 'fas fa-book-open'
    },
    // variants: 'fullscreen'
  },
}