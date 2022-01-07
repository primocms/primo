export const processors = {
  html: async (raw, data) => {
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
  for (const [lang, processor] of Object.entries(fns)) {
    processors[lang] = processor
  }
}