import {hoverTooltip} from "@codemirror/tooltip"
import ShortUniqueId from "short-unique-id";

export default function cssPeek({src = [], css = ''} = {}) {

  function getUniqueId() {
    return new ShortUniqueId().randomUUID(5).toLowerCase();
  }

  async function getCssContent() {
    const content = [css];

    // fetch from files in `src` prop
    for (let srcFile of src) {
      const response = await fetch(srcFile);
      if (response && response.status == 200) {
        const cssString = await response.text()
        content.push(cssString)
      }
    }

    return content.join("\n");
  }

  function getStyleSheet(unique_title) {
    console.log(document.styleSheets)
    for(var i=0; i<document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      console.log(sheet.title)
      if(sheet.title == unique_title) {
        return sheet;
      }
    }
  }

  /**
   * Injects all CSS content into a disabled <style> tag to use
   * the browser's parsing of the content and the built-in CSSStyleSheet in js
   * @param className
   */
  async function lookupCssClass(className: String) {
    const sheetTitle = getUniqueId();
    let stylesheet = getStyleSheet(sheetTitle)
    if (!stylesheet) {
      // if not already loaded on to page, grab content and load into <style> tag
      // todo: if css changes after this point, we need to find a way to refresh it
      const cssContent = await getCssContent()
      const el = document.createElement('style');
      el.innerHTML = cssContent;
      // disable it so it isn't applied. This flickers a little, so there could be a better way to do it.
      el.setAttribute('onload', 'this.disabled=true')
      el.title = sheetTitle;
      document.body.appendChild(el);
      stylesheet = getStyleSheet(sheetTitle);
    }

    if (!stylesheet)
      return null;

    // find rules for this class name
    const styles = [...stylesheet.cssRules].filter((rule: CSSRule) => {
      return rule.selectorText == '.' + className;
    });

    console.log({styles})

    return styles;
  }

  /**
   * Test if the start/end positions are within an html attr within the given line
   * @param attr - attribute type (e.g. "class")
   * @param line - text content
   * @param start
   * @param end
   */
  function isInAttribute(attr, line, start, end) {
    const regex = new RegExp( attr + '=[\'"]([\\w ]*?)[\'"]', 'gm');
    let m;

    while ((m = regex.exec(line)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      const matchStart = m.index + attr.length + 2;
      const matchEnd = m.index + m[0].length - 1;
      if (start >= matchStart && end <= matchEnd) {
        return true;
      }
    }
    return false;
  }

  function formatCssRules(rules: CSSRule[]) {
    return rules.map((rule) => {
      return rule.cssText
          .replaceAll("{ ", "{\n\t")
          .replaceAll("; ", ";\n\t")
          .replaceAll("\t}", "}")
    }).join('\n')
  }

  const cssClassHover = hoverTooltip(async (view, pos, side) => {
    // get the currently hovered word
    let {from, to, text} = view.state.doc.lineAt(pos)
    let start = pos, end = pos
    while (start > from && /\w/.test(text[start - from - 1])) start--
    while (end < to && /\w/.test(text[end - from])) end++
    if (start == pos && side < 0 || end == pos && side > 0)
      return null

    // check if hovering within class attribute (assumes it is not split across multiple lines)
    const word = text.slice(start, end);
    const isCssClass = isInAttribute('class', text, start, end)
    if (!isCssClass)
      return null

    // lookup and format matching CSS rules
    const styles = await lookupCssClass(word);
    let tooltipContent = "No matches found";
    if (styles && styles.length > 0)
      tooltipContent = formatCssRules(styles)

    return {
      pos: start,
      end,
      above: false,
      create(view) {
        let dom = document.createElement("div")
        dom.style.whiteSpace = 'pre'
        dom.textContent = tooltipContent
        return {dom}
      }
    }
  })

  return [
    cssClassHover,
  ];
}