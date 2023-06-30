# Development

Primo gives you the ability to develop your site directly from Primo by embedding a development environment within the CMS's interface. This means you can immediately access your site's code & don't need to spend time setting up a local development environment, while still having the option to use a traditional development environment for more advanced components. 

## Fields
Fields allow you to define form fields that appear in the CMS. When the site is published, the value of those fields is compiled into static HTML. When you create a new field, you need to integrate it with your code using Svelte syntax (see below).

### Field Types
You can define 7 basic input types (text, image, Markdown, number, switch, URL, link), 1 informational type, and 2 composite types (group & repeater).
* Text
* Number
* Image - accessible with `{image.url}` and `{image.alt}`
* Markdown - accessible with `{@html description.html}` or `{description.markdown}`
* Switch (true/false)
* URL
* Link - accessible with `{link.url}` and `{link.label}`
* Info (enables writing instructions to CMS users using Markdown)
* Group (used to group fields together)
* Repeater (used for content lists)

### Static Fields
You can set any field as **Static**, meaning that its value will be the same across all instances of it. This is useful for content that doesn't change across pages, like navigation, social links, and forms. Updating a static content value on one page will update it everywhere.

## Templating with Svelte

Primo utilizes [Svelte](<https://svelte.dev/>) as a templating engine. Svelte is a popular next-generation web development framework used to build interactive web applications. Since Svelte is a superset of HTML and has much more powerful templating capabilities compared to more traditional templating engines like [Handlebars](<https://handlebarsjs.com/>), it's the perfect tool for creating simple, powerful components within Primo. 

Field values can be accessed from the code using the field's key in order to output values into code, conditionally render content, and more.

### [Text](<https://svelte.dev/docs#template-syntax-text-expressions>)

Output the value of a text/number field or the value of a JavaScript expression.

```html
<h1>{heading}</h1>
<h2>{heading.toUpperCase()}</h2>
```

### [HTML (Markdown Field)](<https://svelte.dev/docs#template-syntax-html>)

Output the HTML value of **Markdown** field using the `@html` tag inside a text expression and `.html`. Its Markdown value can be accessed with `.markdown`.

Use the :global() modifier to target tags within the content (e.g. `:global(h1) { font-size: 30px })`.

Note that HTML can only properly render within a `div` tag as it can contain heading elements. Attempting to render it within a `p` or `span` will create issues.

```html
<div>{@html content.html}</div>
```

### [If Conditional](<https://svelte.dev/docs#template-syntax-if>)

Conditionally render a block of code. This is particularly useful with the 'Switch' field type.

```html
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

### [Each Loop](<https://svelte.dev/docs#template-syntax-each>)

Iteratively render a **Repeater** field.

```html
{#each links as link}
  <a href={link.url}>{link.label}</a>
{/each}
```

## CSS
All CSS written in your Blocks is [scoped](https://svelte.dev/docs/svelte-components#style), meaning that it only applies to HTML within that Block and doesn't affect other Blocks. Styles written in your Page apply to all the Blocks on the page, and styles written in your Site apply to all the Blocks on your site.  

### Global Styles
For CSS written within your Blocks to apply to the corresponding Block's HTML, the HTML needs to be written out, but in cases where HTML is generated (particularly when rendering a Markdown field) it's necessary to use the `global` modifier. 

For example, if in your HTML you have: 
```html
<div class="content">{@html content.html}</div>
```

You can target any HTML created within the `.content` element with:
```css
.content {
  :global(a) {
    text-decoration: underline yellow;
  }
}
```

### Nesting & Autoprefixing
Primo preprocesses your CSS using [PostCSS](https://postcss.org) to enable **nesting** & **autoprefixing**. For example:

```scss
ul {
  user-select: none;

  li {
    color: red;
  }
}
```
Becomes
```css
ul {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
ul li {
  color: red;
}
```

## Importing JS Libraries
You can import most JS libraries from your Blocks' JavaScript with either an absolute path (without needing to import them first) or a URL. You can also import your own [externally-managed components](https://docs.primocms.org/guides/using-external-svelte-components) using this method. 

```javascript
import confetti from 'canvas-confetti' 
confetti()
```
```javascript
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/+esm'
confetti()
```

## Global CSS
Themes in Primo come with pre-written CSS written at the site level which makes it easier to develop your websites. CSS is included for standardizing styles, setting theme values (for themeing Blocks), and for styling elements shared across Primo Blocks like `heading` and `button`. Any styles added in Site CSS can be overwritten by Page CSS and Block CSS in a natural cascading order.

### Reset
These styles standardize how your site looks across different browsers and devices.

### Design tokens
[CSS Custom Properties](<https://developer.mozilla.org/en-US/docs/Web/CSS/--*>) (or *variables*) are used within all Themes to correspond to particular style declarations within their Blocks and Primo Library Blocks, enabling them to adapt to the design of any sites they're added to and have their styles updated from one place. They do this by using these values for particular properties like `color`, `border-radius`, and `box-shadow` which should remain consistent within a site but are variable across different sites (e.g. rounded corners on one site, sharp corners on another).

`--color-accent` is a custom design token used to set the site's accent color.

```css
:root {
  /* Custom theme tokens */
  --color-accent: #5a5a5a;

  /* Base values */
  --font-family: "Bespoke Serif", serif;
  --box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.2);
  --border-radius: 8px;
  --border-color: #cbcace;
}
```

### Primo Elements
These are classes used across most Primo Library components which keep their design consistent. They're listed here in order from most to least frequently used.

- `.heading` applies to all component headings except for those within Hero components.

- `.section-container` maintains a fixed max-width and padding for most components, while allowing others to maintain a full page width.

- `.link` is for underlined links.

- `.button` is for buttons and links styled as buttons.

### Primo Classes
Primo adds certain classes to Blocks that make it easier to style your site within Primo and prevents styles from affecting the app's UI (e.g. overwriting the toolbar's font family).

- "`#page`" is added to every page's `body` tag, and should be used in place of `body` or `html` whenever possible.

- "`.section`" is added to the root element of every section. Each section also has a unique ID prefixed with "`section-`" (e.g. `section-kdl99dl`).

## Adjusting the code preview

### Setting the screen size
* Setting the preview window to **Static** enables you to toggle between device types (mobile, tablet, laptop, desktop) or manually set a specific screen width. 
* Setting the preview window to **Dynamic** fixes it to the actual width of the preview pane, allowing you to adjust it by dragging the pane to be larger or smaller. 

### Toggling the screen orientation
You can toggle the Editor screen to show the preview on the right side of the code (horizontal) or below it (vertical). Horizontal is typically preferrable, but vertical works better for hiding the preview and showing more of the code, enabling you to hide the preview in vertical mode and show it in horizontal mode so you can quickly switch between showing and hiding the preview.

### Setting auto-refresh
Primo instantly updates your code changes in the preview by default, but it can be useful to turn this feature off when working with large Blocks to prevent sluggish behavior. In that case, **you can refresh the preview by pressing Mod+R** (i.e. `Command-R` on Mac and `Control-R` on Windows).

### Hotkeys
You can toggle the HTML/CSS/JS code panes with `Mod+1`, `Mod+2`, and `Mod+3` respectively (i.e. `Command+1` on Mac and `Control+1` on Windows). You may need to click into a code pane first to capture these key events.

## On-page editing

Primo will automatically make fields editable on the page by matching a Block's field values to its value within the Block's DOM element, but there may be instances where you'll need to explicitly set a field value as being editable.

### Implicitly setting on-page editable fields

All text, link, and image fields will be automatically editable, including those within Repeater and Group fields, so long as they are within their own element without any other text.

```html
<!-- These will be editable on the page -->
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

### Explicitly setting on-page editable fields

You can explicitly set a field value to be on-page editable by setting a `data-key` attribute with a value matching the field's key. This should only be necessary in cases where Primo can't automatically detect the field value.

```html
<div data-key="description">{@html description.html}</div>

<!-- Repeater field -->
<ul>
  {#each teasers as teaser, i}
    <li data-key="teasers[{i}].item">{teaser.item}</li>
  {/each}
</ul>
```