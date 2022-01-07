const colors = require('tailwindcss/colors')

module.exports = {
  purge: {
    content: ["./src/**/*.svelte"],
    options: {
      safelist: ['max-w-xs', 'px-4'],
      defaultExtractor: content => [
          ...(content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || []),
          ...(content.match(/(?<=class:)[^=>\/\s]*/g) || []),
      ],
    },
  },
  theme: {
    fontFamily: {
      sans: ['Open Sans', 'sans-serif'],
      mont: ['Montserrat','sans-serif']
    },
    container: {
      center: true
    },
    extend: {
      colors: {
        primored: 'rgb(248,68,73)',
        codeblack: 'rgb(30,30,30)',
        black: '#111',
        gray: colors.trueGray,
      }
    }
  },
  variants: {},
};