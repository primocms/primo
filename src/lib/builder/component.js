const compilers = {}

// Keep registration polling in the returned promise. An async timer callback
// inside a resolve-only Promise loses compiler rejections and leaves the caller
// loading forever. Each request also needs its own registration budget.
async function runProcessor(language, raw) {
 for (let attempt = 0; attempt < 100; attempt++) {
  const compiler = compilers[language]
  if (compiler) return await compiler(raw)
  await new Promise(resolve => setTimeout(resolve, 100))
 }
 throw new Error(`${language.toUpperCase()} compiler did not register`)
}

export const processors = {
 html: (raw, data) => runProcessor('html', raw),
 css: (raw, data) => runProcessor('css', raw),
 js: async (raw, options) => raw
}

export function registerProcessors(fns) {
 for (const [language, processor] of Object.entries(fns)) compilers[language] = processor
}
