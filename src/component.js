export const processors = {
  html: async (raw, data) => {
    const final = raw
    return final
  },
  css: async (raw) => {
    const final = raw
    return final
  },
  js: async (raw) => {
    const final = raw
    return final
  }
}

export function registerProcessors(fns) {
  for (const [lang, processor] of Object.entries(fns)) {
    processors[lang] = processor
  }
}

export function registerComponentTypes(fns) {
  // TODO
}