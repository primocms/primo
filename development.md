# Development

In Primo, instead of editing text files in a file directory, you edit code within a focused context - be that a site, a page, or a component. The goal of this strategy is that developers only ever see the code which they're actively working on and can give content editors the ability to build entire pages using pre-coded blocks.

## Blocks

Components allow you to write complex UI elements which you can use across any and all of your Primo sites. Since Primo blocks are written in [Svelte](<https://svelte.dev>), they're capable of powerful interactivity and functionality (Primo itself is built with Svelte).

### Code

#### HTML

From the HTML tab, you can integrate the fields created under the Fields tab with the component so that content entered in the CMS can be compiled into static HTML.

To integrate a field, reference its Field key as a variable from your HTML and JS and use [Svelte's templating syntax](<https://svelte.dev/docs#template-syntax>) to connect it (see Templating to learn how to use Svelte's templating syntax to template blocks).

- Templating

- Events

- Reactivity


<!-- -->

#### CSS

Your component's encapsulated CSS is fed through PostCSS before making it to Svelte, which enables support for nesting and auto prefixing. Note that any styles in your Site CSS & Page CSS are respectively added above your component's CSS, so that your component looks in the preview as it will on the page.

- Encapsulation

- Nesting

- Autoprefixing


<!-- -->

#### JavaScript

Just like in your component's HTML, you can access and modify field values as variables from your JS based on their Field ID. To import JS libraries, write absolute import statements like you would in a bundler (i.e. import lodash from 'lodash') - primo imports them in the background from skypack.dev. All of Svelte's superpowers are available from your JS - including transitions, stores, reactive statements, and more.

- Libraries

- Transitions

- Reactivity


<!-- -->

## Page & Site

### HTML

#### Head tag

HTML added to the Page will be added below any HTML added to the Site. HTML added to the Site will appear on every page on the site.

Code placed here will appear within the head tag of the page. This is typically where you'd put meta and link tags. You can also use variables which correspond to the page/site Fields.

### CSS

Templates in Primo come with pre-written CSS written at the site level which makes it easier to get started with building sites. CSS is included for standardizing styles, setting theme values (for themeing components), elements like `heading` and `button`, and for styling Content Sections. Any styles added in Site CSS can be overwritten by Page CSS and Component CSS in a natural cascading order from general to specific.

#### Reset

These are styles to standardize how components look across different browsers and devices.

#### Theme Values

Theme values are CSS [Custom Properties](<https://developer.mozilla.org/en-US/docs/Web/CSS/--*>) (or variables) that correspond to particular style declarations within Primo Library components, enabling them to be added to any site and automatically conforming to its design. They do this by using these values for particular properties like color, border-radius, box-shadow, etc. which should remain consistent within a site but are variable across different sites (e.g. rounded corners across one site, sharp corners across another).

#### Primo Classes

Primo adds certain classes to your page, sections, and components that make it easier to style your site within Primo and prevents styles from affecting the app's UI (e.g. overwriting the toolbar's font family).

- `.primo-page` is added to every page's `body` tag, and should be used in place of `body` or `html` when possible

- `.primo-section` is added to the root element of every section. It can be used in conjunction with `.has-content` and `.has-component` to target sections containing Content or a Component, respectively.


<!-- -->

#### Elements

These are classes used across most Primo Library components and Content Sections which keep their design consistent. They're listed here in order from most to least frequently used.

- `.heading` applies to all component headings except for those within Hero components.

- `.section-container` maintains a fixed max-width and padding for most components, while allowing others to maintain a full page width. It gets added automatically to each Content Section as well, enabling you to keep them consistent with the Component Sections.

- `.link` is for links and is automatically added to links created in Content Sections to keep them consistent with links created in Components.

- `.button` styles buttons.


<!-- -->

### Fields

Fields added to the Page are accessible from the Page HTML and any components on the page. Fields added to the Site are accessible from the Page & Site HTML, as well as any components on the site.

Site fields can be overwritten by Page fields by using the same field ID, and Component fields can overwrite Page fields by using the same ID.


## Templating

Primo utilizes [Svelte](<https://svelte.dev/>) as a templating engine. Svelte is a popular next-generation web development framework used to build interactive web applications. Since Svelte is a superset of HTML and has much more powerful templating capabilities compared to more traditional templating engines like [Handlebars](<https://handlebarsjs.com/>), it's the perfect tool for creating simple, powerful components.

## Fields

Component Fields allow you to define form fields that appear on the CMS side of Primo. When the site is published, the value of those fields is compiled into static HTML.

At the moment, you can define 7 basic input types (text, image, Markdown, number, switch, URL, link), 1 informational type, and 2 composite types (group & repeater).

- Text

- Image - accessible with {image.url} and {image.alt}

- Markdown - accessible with {@html description}

- Number

- Switch (true/false)

- URL

- Link - accessible with {link.url} and {link.label}

- Info (enables writing instructions to CMS users)

- Group (used to group fields together)

- Repeater (used for content lists)


<!-- -->

## **Svelte**

Field values can be accessed from the code using the field's key in order to output values into code, conditionally render content, and more.

### [**Text**](<https://svelte.dev/docs#template-syntax-text-expressions>)

Output the value of a text/number field or the value of a JavaScript expression.

```
<h1>{heading}</h1>
<h2>{heading.toUpperCase()}</h2>
```

### [**HTML (Markdown Field)**](<https://svelte.dev/docs#template-syntax-html>)

Output the HTML value of **Markdown** field using the `@html` tag inside a text expression and `.html`. Its Markdown value can be accessed with `.markdown`.

Use the :global() modifier to target tags within the content (e.g. `:global(h1) { font-size: 30px })`.

Note that HTML can only properly render within a `div` tag as it can contain heading elements. Attempting to render it within a `p` or `span` will create issues.

```
<div>{@html content.html}</div>
```

### [**If Conditional**](<https://svelte.dev/docs#template-syntax-if>)

Conditionally render a block of code. This is particularly useful with the 'Switch' field type.

```
{#if image.url}
  <img src={image.url} />
{:else if heading}
  <h2>{heading}</h2>
{:else}
  <span>{fallback}</span>
{/if}

{#if show_footer}
  <footer>...</footer>
{/if}
```

In some cases, it may be preferable to simply use an OR or ternary operator within a text expression.

```html
<h1>{heading || title || fallback}</h1>
```

### [**Each Loop**](<https://svelte.dev/docs#template-syntax-each>)

Iteratively render a **Repeater** field.

```
{#each links as link}
  <a href={link.url}>{link.label}</a>
{/each}
```

## On-page editing

Primo will automatically make fields editable on the page by matching a block's field values to its value within the block's DOM element.

### Implicit

All field types besides 'Select' and 'Switch' will be automatically editable, including those within Repeater and Group fields, so long as they are within their own element without any other text.

```
<!-- These will work -->
<h1>
  <span>{heading}</span>
  <span>{subheading}</span>
</h1>
<div>
  <span>"</span>
  <div>{@html quote}</div>
  <span>"</span>
</div>

<!-- These will not -->
<h1>{heading} - {subheading}</h1>
<div>"{@html quote}"</div>
```

### Explicit

You can explicitly set a field value to be on-page editable by setting a `data-key` attribute with a value matching the field's key. This should only be necessary in cases where Primo can't automatically detect the field value.

```
<div data-key="description">{@html description.html}</div>

<!-- Repeater field -->
<ul>
  {#each teasers as teaser, i}
    <li data-key="teasers[{i}].item">{teaser.item}</li>
  {/each}
</ul>
```


