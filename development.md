# Development

Primo gives developers the ability to develop their site directly from Primo by embedding a development environment within the CMS's interface. This means you can immediately access your site's code & don't need to spend time setting up a local development environment. 

## Fields

Fields allow you to define form fields that appear in the CMS. When the site is published, the value of those fields is compiled into static HTML.

You can define 7 basic input types (text, image, Markdown, number, switch, URL, link), 1 informational type, and 2 composite types (group & repeater).

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


## Templating with Svelte

Primo utilizes [Svelte](<https://svelte.dev/>) as a templating engine. Svelte is a popular next-generation web development framework used to build interactive web applications. Since Svelte is a superset of HTML and has much more powerful templating capabilities compared to more traditional templating engines like [Handlebars](<https://handlebarsjs.com/>), it's the perfect tool for creating simple, powerful components within Primo. 

Field values can be accessed from the code using the field's key in order to output values into code, conditionally render content, and more.

### [Text](<https://svelte.dev/docs#template-syntax-text-expressions>)

Output the value of a text/number field or the value of a JavaScript expression.

```
<h1>{heading}</h1>
<h2>{heading.toUpperCase()}</h2>
```

### [HTML (Markdown Field)](<https://svelte.dev/docs#template-syntax-html>)

Output the HTML value of **Markdown** field using the `@html` tag inside a text expression and `.html`. Its Markdown value can be accessed with `.markdown`.

Use the :global() modifier to target tags within the content (e.g. `:global(h1) { font-size: 30px })`.

Note that HTML can only properly render within a `div` tag as it can contain heading elements. Attempting to render it within a `p` or `span` will create issues.

```
<div>{@html content.html}</div>
```

### [If Conditional](<https://svelte.dev/docs#template-syntax-if>)

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

### [Each Loop](<https://svelte.dev/docs#template-syntax-each>)

Iteratively render a **Repeater** field.

```
{#each links as link}
  <a href={link.url}>{link.label}</a>
{/each}
```

## On-page editing

Primo will automatically make fields editable on the page by matching a block's field values to its value within the block's DOM element, but there may be instances where you'll need to explicitly set a field value as being editable.

### Implicitly setting on-page editable fields

All text, link, and image fields will be automatically editable, including those within Repeater and Group fields, so long as they are within their own element without any other text.

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

### Explicitly setting on-page editable fields

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


## Global CSS
Themes in Primo come with pre-written CSS written at the site level which makes it easier to develop your websites. CSS is included for standardizing styles, setting theme values (for themeing Blocks), and for styling elements shared across Primo Blocks like `heading` and `button`. Any styles added in Site CSS can be overwritten by Page CSS and Block CSS in a natural cascading order.

### Reset
These styles standardize how your site looks across different browsers and devices.

### CSS Variables
Theme values are CSS [Custom Properties](<https://developer.mozilla.org/en-US/docs/Web/CSS/--*>) (or *variables*) that correspond to particular style declarations within Primo Library Blocks, enabling them to adapt to the design of any sites they're added to. They do this by using these values for particular properties like `color`, `border-radius`, and `box-shadow` which should remain consistent within a site but are variable across different sites (e.g. rounded corners on one site, sharp corners on another).

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