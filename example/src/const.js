export const MODAL_TYPES = {
  image : 'Image (uploaded or from URL)',
  video : 'Video (embed from YouTube or Vimeo',
  embed : 'Custom Component',
  pageCode : 'Page code',
  sections : 'Page sections',
  settings : 'Page Settings (logo/site name, page nav)',
  publish: 'Publish site with password',
  unlock: 'Unlock page for editing',
  pages: 'Pages under domain name',
  componentLibrary: 'Component Library',
  login: 'Logging in and signing up',
  user: 'User settings',
  domain: 'Connect custom domain name',
  pageList: 'Pages within domain',
  pageStyles: 'Page Styles'
}

export const tailwindConfig = `{\n
  \ttheme: {\n
    \t\tcontainer: {\n
      \t\t\tcenter: true\n
    \t\t}\n
  \t},\n
  \tvariants: {}\n
}`


// TODO: Make these defaut site styles instead
export const pageStyles = `\
/* Default content styles */
.primo-content {
  @apply text-lg;
  h1 {
    @apply text-3xl font-medium;
  }
  h2 {
    @apply text-2xl font-medium;
  }
  ul {
    @apply list-disc list-inside;
    p {
        @apply inline;
    }
  } 
  ol {
    @apply list-decimal list-inside;
  } 
  a {
    @apply text-blue-600 underline;
  }
  blockquote {
      @apply shadow-md p-6;
  }
  mark {
    @apply text-gray-900 bg-yellow-200;
  }
  
  @screen lg {
    h1 {
      @apply text-5xl;
    }
    h2 {
      @apply text-4xl;
    }
  }
}`

