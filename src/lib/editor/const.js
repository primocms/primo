import { customAlphabet } from 'nanoid/non-secure'
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new field object with default values.
 * @param field - The field properties to be applied to the new field
 * @returns {import('$lib').Field} 
 */
export const Field = (field = {}) => ({
  id: createUniqueID(),
  key: '',
  label: '',
  type: 'text',
  fields: [],
  options: {},
  is_static: false,
  ...field
})

/**
 * Creates a new symbol object with default values.
 * @param symbol - The symbol properties to be applied to the new symbol
 * @returns {import('$lib').Symbol} 
 */
export const Symbol = (symbol = {}) => ({
  id: uuidv4(),
  name: '',
  code: {
    css: '',
    html: '',
    js: ''
  },
  fields: [],
  content: {
    en: {}
  },
  ...symbol
})

/**
 * Creates a new page object with default values.
 * @param page - The page properties to be applied to the new page
 * @returns {import('$lib').Page} 
 */
export const Page = (page = {}) => ({
  id: uuidv4(),
  url: '',
  name: '',
  code: {
    html: {
      head: '',
      below: ''
    },
    css: '',
    js: ''
  },
  fields: [],
  content: {
    en: {}
  },
  parent: null,
  site: '',
  created_at: new Date().toISOString(),
  ...page,
})

/**
 * Creates a new site object with default values.
 * @param site - The site properties to be applied to the new site
 * @returns {import('$lib').Site} 
 */
export const Site = ({ url, name } = { url: 'default', name: 'Default' }) => ({
  id: uuidv4(),
  url,
  name,
  code: {
    html: {
      head: ``,
      below: ''
    },
    css: `
@import url("https://unpkg.com/@primo-app/primo@1.3.64/reset.css");

#page {
  font-family: system-ui, sans-serif;
  color: var(--color);
  line-height: 1.6; 
  font-size: 1rem;
  background: var(--background);
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
    }
  },
  active_deployment: null,
  created_at: new Date().toISOString(),
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

function createUniqueID(length = 5) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}