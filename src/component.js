export const processors = {
  html: async (raw, data) => {
    console.log('original processor')
    const final = raw
    return final
  },
  css: async (raw, options) => {
    const final = raw
    return final
  },
  js: async (raw, options) => {
    const final = raw
    return final
  }
}

export function registerProcessors(fns) {
  console.log('Registering processor')
  for (const [lang, processor] of Object.entries(fns)) {
    processors[lang] = processor
  }
}

export function registerComponentTypes(fns) {
  // TODO
}