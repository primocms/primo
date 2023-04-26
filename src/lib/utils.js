import _ from 'lodash-es'

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

export function swap_array_item_index(arr, from, to) {
  let new_array = _.cloneDeep(arr)
  new_array[from] = arr[to]
  new_array[to] = arr[from]
  return new_array
}