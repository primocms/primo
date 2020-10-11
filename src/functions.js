export const functions = {}

export default {
  register: (fns) => {
    fns.forEach(item => {
      const [ name, fn ] = item
      functions[name] = fn
    })
  }
}