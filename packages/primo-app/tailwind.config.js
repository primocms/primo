module.exports = {
  purge: {
    enabled: true,
    content: ["src/**/*.svelte"],
    options: {
      // Fixes class:whatever-tailwind-utility issue
      defaultExtractor: content => {
        const regExp = new RegExp(/[A-Za-z0-9-_:/]+/g);

        const matchedTokens = [];

        let match = regExp.exec(content);

        while (match) {
            if (match[0].startsWith('class:')) {
                matchedTokens.push(match[0].substring(6));
            } else {
                matchedTokens.push(match[0]);
            }

            match = regExp.exec(content);
        }

        return matchedTokens;
      }
    }
  },
  // important: true,
  theme: {
    container: {
      center: true
    },
    extend: {
      colors: {
        primored: 'rgb(248,68,73)',
        codeblack: 'rgb(30,30,30)'
      }
    }
  },
  variants: {},
  plugins: [],
}
