export const makeValidUrl = (str = '') => {
  if (str) {
    return str.replace(/\s+/g, '-').replace(/[^0-9a-z\-._]/ig, '').toLowerCase()
  } else {
    return ''
  }
}

export function clickOutside(node) {
    
  const handleClick = event => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(
        new CustomEvent('click_outside', node)
      )
    }
  }

  document.addEventListener('click', handleClick, true);
  
  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
  }
}