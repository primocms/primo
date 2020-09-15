

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

