// import { createUniqueID } from './utilities'
import { customAlphabet } from 'nanoid/non-secure'

function createUniqueID(length: number = 5): string {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}


export const defaultStyles = {
  raw: `
  
.content {
  margin: 0 auto;
  width: 100%;
  padding-right: 2rem;
  padding-left: 2rem;
  font-size: 1.125rem;
  color: #374151;
  
  h1 { 
    font-size: 1.875rem;
    font-weight: 500;
    line-height: 1.2;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 500;
  }

  ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

  ul {
    list-style-type: disc;
    list-style-position: inside;
  }

  p {
    display: inline;
  }

  ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

  a {
    color: #1c64f2;
    text-decoration: underline;
  }

  blockquote {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
  }

  mark {
    --text-opacity: 1;
    color: #161e2e;
    --bg-opacity: 1;
    background-color: #fce96a;
  }
}

@media (min-width: 1024px) {
  .content h1 {
    font-size: 3rem;
  }

  .content h2 {
    font-size: 2.25rem;
  }
}
  `,
  final: `\
/* Default content styles */

.content {
  width: 100%;
  margin-right: auto;
  margin-left: auto;
  padding-right: 2rem;
  padding-left: 2rem
}

.content {
  font-size: 1.125rem;
  --text-opacity: 1;
  color: #374151;
  color: rgba(55, 65, 81, var(--text-opacity));
}

.content h1 {
    font-size: 1.875rem;
    font-weight: 500;
  }

.content h2 {
    font-size: 1.5rem;
    font-weight: 500;
  }

.content ol {
    list-style-type: decimal;
  }

.content ul {
    list-style-type: disc;
    list-style-position: inside;
  }

.content ul p {
      display: inline;
    }

.content ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

.content a {
    --text-opacity: 1;
    color: #1c64f2;
    color: rgba(28, 100, 242, var(--text-opacity));
    text-decoration: underline;
  }

.content blockquote {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
  }

.content mark {
    --text-opacity: 1;
    color: #161e2e;
    color: rgba(22, 30, 46, var(--text-opacity));
    --bg-opacity: 1;
    background-color: #fce96a;
    background-color: rgba(252, 233, 106, var(--bg-opacity));
  }

@media (min-width: 1024px) {
  .content h1 {
    font-size: 3rem;
  }

  .content h2 {
    font-size: 2.25rem;
  }
}
  `,
}

export type Field = {
  id: string,
  key: string,
  label: string,
  type: string,
  fields: any[],
  options: object,
  default: any,
  is_static: boolean
}

export const Field = (f = {}): Field => ({
  id: createUniqueID(),
  key: '',
  label: '',
  type: 'text',
  fields: [],
  options: {},
  default: '',
  is_static: false,
  ...f
})

export type Component = {
  type: 'component',
  id: string,
  symbolID: string | null
}

export const Component = (): Component => ({
  type: 'component',
  id: createUniqueID(),
  symbolID: null
})

export type Symbol = {
  type: 'symbol',
  id: string,
  name: string,
  code: {
    html: string,
    css: string,
    js: string
  },
  fields: any[],
  content: object
}

export const Symbol = (): Symbol => ({
  type: 'symbol',
  id: createUniqueID(),
  name: '',
  code: {
    css: '',
    html: '',
    js: ''
  },
  fields: [],
  content: {}
})

export const DEFAULTS = {
  page: {
    id: '',
    name: '',
    sections: [
      {
        id: createUniqueID(),
        type: 'options',
      }
    ],
    code: {
      html: {
        head: '',
        below: ''
      },
      css: '',
      js: ''
    },
    fields: [],
    pages: [],
  },
  code: {
    html: {
      head: '',
      below: ''
    },
    css: '',
    js: ''
  },
  fields: [],
  symbols: [],
}

export type Page = {
  id: string,
  name: string,
  sections: any[],
  code: {
    html: {
      head: string,
      below: string
    },
    css: string,
    js: string
  },
  fields: any[],
  pages: any[],
}

export const Page = (id = createUniqueID(), name = ''): Page => ({
  ...DEFAULTS.page,
  id,
  name,
  sections: [],
  code: {
    html: {
      head: '',
      below: ''
    },
    css: '',
    js: ''
  },
  fields: [],
  pages: [],
})

export type Site = {
  id: string,
  name: string,
  pages: any[],
  code: {
    html: {
      head: string,
      below: string
    },
    css: string,
    js: string
  },
  fields: any[],
  symbols: any[],
  content: {}
}

export const Site = ({ id, name } = { id: 'default', name: 'Default' }): Site => ({
  id,
  name,
  pages: [
    Page('index', 'Home Page')
  ],
  code: {
    html: {
      head: `
<meta name="viewport" content="width=device-width, initial-scale=1.0"> 
<meta charset="UTF-8">
      `,
      below: ''
    },
    css: `\
@import url("https://unpkg.com/@primo-app/primo@1.3.64/reset.css");

html {

  /* Colors */
  --color-accent: #154BF4;

  /* Default property values */
  --background: white;
  --color: #222;
  --padding: 2rem; 
  --box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.2); 
  --border-radius: 8px; 
  --max-width: 1200px;
  --border-color: #CBCACE;
  --transition-time: 0.1s;
  --transition: var(--transition-time) color,
    var(--transition-time) background-color,
      var(--transition-time) border-color,
        var(--transition-time) text-decoration-color,
          var(--transition-time) box-shadow, var(--transtion-time) transform;
}

#page {
  font-family: system-ui, sans-serif;
  color: var(--color);
  line-height: 1.6; 
  font-size: 1rem;
  background: var(--background);
}

.section .content {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--padding);

  img {
    width: 100%;
    margin: 2rem 0;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }

  p {
    padding: 0.25rem 0;
    line-height: 1.5;
  }

  a {
    text-decoration: underline;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 2.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  h3 {
    font-size: 1.75rem; 
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  ul {
    list-style: disc;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  ol {
    list-style: decimal;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  blockquote {
    padding: 2rem;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }
}

.section-container {
  max-width: var(--max-width, 1200px);
  margin: 0 auto;
  padding: 3rem var(--padding, 1rem); 
}

.heading {
  font-size: 3rem;
  line-height: 1;
  font-weight: 700;
  margin: 0;
}

.button {
  color: white;
  background: var(--color-accent);
  border-radius: 5px;
  padding: 8px 20px;
  transition: var(--transition);

  &:hover {
    box-shadow: 0 0 10px 5px rgba(0, 0, 0, 0.1);
  } 

  &.inverted {
    background: transparent; 
    color: var(--color-accent); 
    border: 2px solid var(--color-accent);
  }
}
    `,
    js: ''
  },
  fields: [],
  content: {
    'en': { // locale
      'index': { // page
      },
    }
  },
  symbols: []
})


export const locales = [
  {
    key: "af",
    name: "Afrikaans",
  },
  {
    key: "ar",
    name: "Arabic",
  },
  {
    key: "be",
    name: "Belarusian",
  },
  {
    key: "bg",
    name: "Bulgarian",
  },
  {
    key: "bs",
    name: "Bosnian",
  },
  {
    key: "ca",
    name: "Catalan",
  },
  {
    key: "cs",
    name: "Czech",
  },
  {
    key: "cy",
    name: "Welsh",
  },
  {
    key: "da",
    name: "Danish",
  },
  {
    key: "de",
    name: "German",
  },
  {
    key: "el",
    name: "Greek",
  },
  {
    key: "en",
    name: "English",
  },
  {
    key: "fa",
    name: "Persian",
  },
  {
    key: "fi",
    name: "Finnish",
  },
  {
    key: "fr",
    name: "French",
  },
  {
    key: "he",
    name: "Hebrew",
  },
  {
    key: "hi",
    name: "Hindi",
  },
  {
    key: "hu",
    name: "Hungarian",
  },
  {
    key: "hy-am",
    name: "Armenian",
  },
  {
    key: "id",
    name: "Indonesian",
  },
  {
    key: "is",
    name: "Icelandic",
  },
  {
    key: "it",
    name: "Italian",
  },
  {
    key: "ja",
    name: "Japanese",
  },
  {
    key: "ka",
    name: "Georgian",
  },
  {
    key: "kk",
    name: "Kazakh",
  },
  {
    key: "km",
    name: "Cambodian",
  },
  {
    key: "ko",
    name: "Korean",
  },
  {
    key: "lo",
    name: "Lao",
  },
  {
    key: "lt",
    name: "Lithuanian",
  },
  {
    key: "lv",
    name: "Latvian",
  },
  {
    key: "mk",
    name: "Macedonian",
  },
  {
    key: "mn",
    name: "Mongolian",
  },
  {
    key: "ms",
    name: "Malay",
  },
  {
    key: "my",
    name: "Burmese",
  },
  {
    key: "ne",
    name: "Nepalese",
  },
  {
    key: "nl",
    name: "Dutch",
  },
  {
    key: "pl",
    name: "Polish",
  },
  {
    key: "pt",
    name: "Portuguese",
  },
  {
    key: "ro",
    name: "Romanian",
  },
  {
    key: "ru",
    name: "Russian",
  },
  {
    key: "sk",
    name: "Slovak",
  },
  {
    key: "sl",
    name: "Slovenian",
  },
  {
    key: "sq",
    name: "Albanian",
  },
  {
    key: "sv",
    name: "Swedish",
  },
  {
    key: "th",
    name: "Thai",
  },
  {
    key: "tl-ph",
    name: "Tagalog (Philippines)",
  },
  {
    key: "tr",
    name: "Turkish",
  },
  {
    key: "uk",
    name: "Ukrainian",
  },
  {
    key: "ur",
    name: "Urdu",
  },
  {
    key: "uz",
    name: "Uzbek",
  },
  {
    key: "vi",
    name: "Vietnamese",
  },
  {
    key: "zh",
    name: "Chinese",
  },
  {
    key: "es",
    name: "Spanish",
  },
  {
    key: "et",
    name: "Estonian",
  },
];