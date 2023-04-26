const compilers = {}

let checked = 0

export const processors = {
  html: async (raw, data) => {
    return await new Promise((resolve) => {
      checkIfRegistered()
      async function checkIfRegistered() {
        const compiler = compilers['html']
        if (compiler) {
          const res = await compiler(raw)
          resolve(res)
        } else {
          checked++
          if (checked < 100) {
            setTimeout(checkIfRegistered, 100)
          }
        }
      }
    })
  },
  css: async (raw, data) => {
    return await new Promise((resolve) => {
      checkIfRegistered()
      async function checkIfRegistered() {
        const compiler = compilers['css']
        if (compiler) {
          const res = await compiler(raw)
          resolve(res)
        } else {
          checked++
          if (checked < 100) {
            setTimeout(checkIfRegistered, 100)
          }
        }
      }
    })
  },
  js: async (raw, options) => {
    const final = raw
    return final
  }
}

export function registerProcessors(fns) {
  for (const [lang, processor] of Object.entries(fns)) {
    compilers[lang] = processor
    // processors[lang] = processor
  }
}