var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { WidgetType, EditorView, Decoration, ViewPlugin, keymap } from "@codemirror/view";
import { EditorState, Facet, StateEffect, StateField, EditorSelection } from "@codemirror/state";
import { htmlLanguage, html as html$1 } from "@codemirror/lang-html";
import { cssLanguage, css as css$1 } from "@codemirror/lang-css";
import { snippet } from "@codemirror/autocomplete";
import { syntaxTree, language } from "@codemirror/language";
function isNumber$2(code2) {
  return code2 > 47 && code2 < 58;
}
function isAlpha$1(code2, from, to) {
  from = from || 65;
  to = to || 90;
  code2 &= ~32;
  return code2 >= from && code2 <= to;
}
function isAlphaNumericWord(code2) {
  return isNumber$2(code2) || isAlphaWord(code2);
}
function isAlphaWord(code2) {
  return code2 === 95 || isAlpha$1(code2);
}
function isWhiteSpace$3(code2) {
  return code2 === 32 || code2 === 9 || code2 === 160;
}
function isSpace$1(code2) {
  return isWhiteSpace$3(code2) || code2 === 10 || code2 === 13;
}
function isQuote$3(code2) {
  return code2 === 39 || code2 === 34;
}
class Scanner {
  constructor(str, start, end) {
    if (end == null && typeof str === "string") {
      end = str.length;
    }
    this.string = str;
    this.pos = this.start = start || 0;
    this.end = end || 0;
  }
  eof() {
    return this.pos >= this.end;
  }
  limit(start, end) {
    return new Scanner(this.string, start, end);
  }
  peek() {
    return this.string.charCodeAt(this.pos);
  }
  next() {
    if (this.pos < this.string.length) {
      return this.string.charCodeAt(this.pos++);
    }
  }
  eat(match) {
    const ch = this.peek();
    const ok = typeof match === "function" ? match(ch) : ch === match;
    if (ok) {
      this.next();
    }
    return ok;
  }
  eatWhile(match) {
    const start = this.pos;
    while (!this.eof() && this.eat(match)) {
    }
    return this.pos !== start;
  }
  backUp(n) {
    this.pos -= n || 1;
  }
  current() {
    return this.substring(this.start, this.pos);
  }
  substring(start, end) {
    return this.string.slice(start, end);
  }
  error(message, pos = this.pos) {
    return new ScannerError(`${message} at ${pos + 1}`, pos, this.string);
  }
}
class ScannerError extends Error {
  constructor(message, pos, str) {
    super(message);
    this.pos = pos;
    this.string = str;
  }
}
function tokenScanner$1(tokens) {
  return {
    tokens,
    start: 0,
    pos: 0,
    size: tokens.length
  };
}
function peek$3(scanner) {
  return scanner.tokens[scanner.pos];
}
function next(scanner) {
  return scanner.tokens[scanner.pos++];
}
function slice(scanner, from = scanner.start, to = scanner.pos) {
  return scanner.tokens.slice(from, to);
}
function readable$1(scanner) {
  return scanner.pos < scanner.size;
}
function consume$2(scanner, test) {
  const token2 = peek$3(scanner);
  if (token2 && test(token2)) {
    scanner.pos++;
    return true;
  }
  return false;
}
function error$2(scanner, message, token2 = peek$3(scanner)) {
  if (token2 && token2.start != null) {
    message += ` at ${token2.start}`;
  }
  const err = new Error(message);
  err["pos"] = token2 && token2.start;
  return err;
}
function abbreviation(abbr, options = {}) {
  const scanner = tokenScanner$1(abbr);
  const result = statements(scanner, options);
  if (readable$1(scanner)) {
    throw error$2(scanner, "Unexpected character");
  }
  return result;
}
function statements(scanner, options) {
  const result = {
    type: "TokenGroup",
    elements: []
  };
  let ctx = result;
  let node;
  const stack = [];
  while (readable$1(scanner)) {
    if (node = element$2(scanner, options) || group(scanner, options)) {
      ctx.elements.push(node);
      if (consume$2(scanner, isChildOperator)) {
        stack.push(ctx);
        ctx = node;
      } else if (consume$2(scanner, isSiblingOperator$1)) {
        continue;
      } else if (consume$2(scanner, isClimbOperator)) {
        do {
          if (stack.length) {
            ctx = stack.pop();
          }
        } while (consume$2(scanner, isClimbOperator));
      }
    } else {
      break;
    }
  }
  return result;
}
function group(scanner, options) {
  if (consume$2(scanner, isGroupStart)) {
    const result = statements(scanner, options);
    const token2 = next(scanner);
    if (isBracket$2(token2, "group", false)) {
      result.repeat = repeater(scanner);
    }
    return result;
  }
}
function element$2(scanner, options) {
  let attr;
  const elem = {
    type: "TokenElement",
    name: void 0,
    attributes: void 0,
    value: void 0,
    repeat: void 0,
    selfClose: false,
    elements: []
  };
  if (elementName(scanner, options)) {
    elem.name = slice(scanner);
  }
  while (readable$1(scanner)) {
    scanner.start = scanner.pos;
    if (!elem.repeat && !isEmpty(elem) && consume$2(scanner, isRepeater)) {
      elem.repeat = scanner.tokens[scanner.pos - 1];
    } else if (!elem.value && text(scanner)) {
      elem.value = getText(scanner);
    } else if (attr = shortAttribute(scanner, "id", options) || shortAttribute(scanner, "class", options) || attributeSet(scanner)) {
      if (!elem.attributes) {
        elem.attributes = Array.isArray(attr) ? attr.slice() : [attr];
      } else {
        elem.attributes = elem.attributes.concat(attr);
      }
    } else {
      if (!isEmpty(elem) && consume$2(scanner, isCloseOperator)) {
        elem.selfClose = true;
        if (!elem.repeat && consume$2(scanner, isRepeater)) {
          elem.repeat = scanner.tokens[scanner.pos - 1];
        }
      }
      break;
    }
  }
  return !isEmpty(elem) ? elem : void 0;
}
function attributeSet(scanner) {
  if (consume$2(scanner, isAttributeSetStart)) {
    const attributes = [];
    let attr;
    while (readable$1(scanner)) {
      if (attr = attribute(scanner)) {
        attributes.push(attr);
      } else if (consume$2(scanner, isAttributeSetEnd)) {
        break;
      } else if (!consume$2(scanner, isWhiteSpace$2)) {
        throw error$2(scanner, `Unexpected "${peek$3(scanner).type}" token`);
      }
    }
    return attributes;
  }
}
function shortAttribute(scanner, type, options) {
  if (isOperator$2(peek$3(scanner), type)) {
    scanner.pos++;
    const attr = {
      name: [createLiteral$1(type)]
    };
    if (options.jsx && text(scanner)) {
      attr.value = getText(scanner);
      attr.expression = true;
    } else {
      attr.value = literal$2(scanner) ? slice(scanner) : void 0;
    }
    return attr;
  }
}
function attribute(scanner) {
  if (quoted(scanner)) {
    return {
      value: slice(scanner)
    };
  }
  if (literal$2(scanner, true)) {
    return {
      name: slice(scanner),
      value: consume$2(scanner, isEquals) && (quoted(scanner) || literal$2(scanner, true)) ? slice(scanner) : void 0
    };
  }
}
function repeater(scanner) {
  return isRepeater(peek$3(scanner)) ? scanner.tokens[scanner.pos++] : void 0;
}
function quoted(scanner) {
  const start = scanner.pos;
  const quote2 = peek$3(scanner);
  if (isQuote$2(quote2)) {
    scanner.pos++;
    while (readable$1(scanner)) {
      if (isQuote$2(next(scanner), quote2.single)) {
        scanner.start = start;
        return true;
      }
    }
    throw error$2(scanner, "Unclosed quote", quote2);
  }
  return false;
}
function literal$2(scanner, allowBrackets) {
  const start = scanner.pos;
  const brackets = {
    attribute: 0,
    expression: 0,
    group: 0
  };
  while (readable$1(scanner)) {
    const token2 = peek$3(scanner);
    if (brackets.expression) {
      if (isBracket$2(token2, "expression")) {
        brackets[token2.context] += token2.open ? 1 : -1;
      }
    } else if (isQuote$2(token2) || isOperator$2(token2) || isWhiteSpace$2(token2) || isRepeater(token2)) {
      break;
    } else if (isBracket$2(token2)) {
      if (!allowBrackets) {
        break;
      }
      if (token2.open) {
        brackets[token2.context]++;
      } else if (!brackets[token2.context]) {
        break;
      } else {
        brackets[token2.context]--;
      }
    }
    scanner.pos++;
  }
  if (start !== scanner.pos) {
    scanner.start = start;
    return true;
  }
  return false;
}
function elementName(scanner, options) {
  const start = scanner.pos;
  if (options.jsx && consume$2(scanner, isCapitalizedLiteral)) {
    while (readable$1(scanner)) {
      const { pos } = scanner;
      if (!consume$2(scanner, isClassNameOperator) || !consume$2(scanner, isCapitalizedLiteral)) {
        scanner.pos = pos;
        break;
      }
    }
  }
  while (readable$1(scanner) && consume$2(scanner, isElementName)) {
  }
  if (scanner.pos !== start) {
    scanner.start = start;
    return true;
  }
  return false;
}
function text(scanner) {
  const start = scanner.pos;
  if (consume$2(scanner, isTextStart)) {
    let brackets = 0;
    while (readable$1(scanner)) {
      const token2 = next(scanner);
      if (isBracket$2(token2, "expression")) {
        if (token2.open) {
          brackets++;
        } else if (!brackets) {
          break;
        } else {
          brackets--;
        }
      }
    }
    scanner.start = start;
    return true;
  }
  return false;
}
function getText(scanner) {
  let from = scanner.start;
  let to = scanner.pos;
  if (isBracket$2(scanner.tokens[from], "expression", true)) {
    from++;
  }
  if (isBracket$2(scanner.tokens[to - 1], "expression", false)) {
    to--;
  }
  return slice(scanner, from, to);
}
function isBracket$2(token2, context, isOpen) {
  return Boolean(token2 && token2.type === "Bracket" && (!context || token2.context === context) && (isOpen == null || token2.open === isOpen));
}
function isOperator$2(token2, type) {
  return Boolean(token2 && token2.type === "Operator" && (!type || token2.operator === type));
}
function isQuote$2(token2, isSingle) {
  return Boolean(token2 && token2.type === "Quote" && (isSingle == null || token2.single === isSingle));
}
function isWhiteSpace$2(token2) {
  return Boolean(token2 && token2.type === "WhiteSpace");
}
function isEquals(token2) {
  return isOperator$2(token2, "equal");
}
function isRepeater(token2) {
  return Boolean(token2 && token2.type === "Repeater");
}
function isLiteral$2(token2) {
  return token2.type === "Literal";
}
function isCapitalizedLiteral(token2) {
  if (isLiteral$2(token2)) {
    const ch = token2.value.charCodeAt(0);
    return ch >= 65 && ch <= 90;
  }
  return false;
}
function isElementName(token2) {
  return token2.type === "Literal" || token2.type === "RepeaterNumber" || token2.type === "RepeaterPlaceholder";
}
function isClassNameOperator(token2) {
  return isOperator$2(token2, "class");
}
function isAttributeSetStart(token2) {
  return isBracket$2(token2, "attribute", true);
}
function isAttributeSetEnd(token2) {
  return isBracket$2(token2, "attribute", false);
}
function isTextStart(token2) {
  return isBracket$2(token2, "expression", true);
}
function isGroupStart(token2) {
  return isBracket$2(token2, "group", true);
}
function createLiteral$1(value) {
  return { type: "Literal", value };
}
function isEmpty(elem) {
  return !elem.name && !elem.value && !elem.attributes;
}
function isChildOperator(token2) {
  return isOperator$2(token2, "child");
}
function isSiblingOperator$1(token2) {
  return isOperator$2(token2, "sibling");
}
function isClimbOperator(token2) {
  return isOperator$2(token2, "climb");
}
function isCloseOperator(token2) {
  return isOperator$2(token2, "close");
}
function escaped(scanner) {
  if (scanner.eat(92)) {
    scanner.start = scanner.pos;
    if (!scanner.eof()) {
      scanner.pos++;
    }
    return true;
  }
  return false;
}
function tokenize$1(source) {
  const scanner = new Scanner(source);
  const result = [];
  const ctx = {
    group: 0,
    attribute: 0,
    expression: 0,
    quote: 0
  };
  let ch = 0;
  let token2;
  while (!scanner.eof()) {
    ch = scanner.peek();
    token2 = getToken$1(scanner, ctx);
    if (token2) {
      result.push(token2);
      if (token2.type === "Quote") {
        ctx.quote = ch === ctx.quote ? 0 : ch;
      } else if (token2.type === "Bracket") {
        ctx[token2.context] += token2.open ? 1 : -1;
      }
    } else {
      throw scanner.error("Unexpected character");
    }
  }
  return result;
}
function getToken$1(scanner, ctx) {
  return field$3(scanner, ctx) || repeaterPlaceholder(scanner) || repeaterNumber(scanner) || repeater$1(scanner) || whiteSpace$1(scanner) || literal$1$1(scanner, ctx) || operator$1(scanner) || quote(scanner) || bracket$1(scanner);
}
function literal$1$1(scanner, ctx) {
  const start = scanner.pos;
  let value = "";
  while (!scanner.eof()) {
    if (escaped(scanner)) {
      value += scanner.current();
      continue;
    }
    const ch = scanner.peek();
    if (ch === ctx.quote || ch === 36 || isAllowedOperator(ch, ctx)) {
      break;
    }
    if (ctx.expression && ch === 125) {
      break;
    }
    if (!ctx.quote && !ctx.expression) {
      if (!ctx.attribute && !isElementName$1(ch)) {
        break;
      }
      if (isAllowedSpace(ch, ctx) || isAllowedRepeater(ch, ctx) || isQuote$3(ch) || bracketType(ch)) {
        break;
      }
    }
    value += scanner.string[scanner.pos++];
  }
  if (start !== scanner.pos) {
    scanner.start = start;
    return {
      type: "Literal",
      value,
      start,
      end: scanner.pos
    };
  }
}
function whiteSpace$1(scanner) {
  const start = scanner.pos;
  if (scanner.eatWhile(isSpace$1)) {
    return {
      type: "WhiteSpace",
      start,
      end: scanner.pos,
      value: scanner.substring(start, scanner.pos)
    };
  }
}
function quote(scanner) {
  const ch = scanner.peek();
  if (isQuote$3(ch)) {
    return {
      type: "Quote",
      single: ch === 39,
      start: scanner.pos++,
      end: scanner.pos
    };
  }
}
function bracket$1(scanner) {
  const ch = scanner.peek();
  const context = bracketType(ch);
  if (context) {
    return {
      type: "Bracket",
      open: isOpenBracket$2(ch),
      context,
      start: scanner.pos++,
      end: scanner.pos
    };
  }
}
function operator$1(scanner) {
  const op = operatorType$1(scanner.peek());
  if (op) {
    return {
      type: "Operator",
      operator: op,
      start: scanner.pos++,
      end: scanner.pos
    };
  }
}
function repeater$1(scanner) {
  const start = scanner.pos;
  if (scanner.eat(42)) {
    scanner.start = scanner.pos;
    let count = 1;
    let implicit = false;
    if (scanner.eatWhile(isNumber$2)) {
      count = Number(scanner.current());
    } else {
      implicit = true;
    }
    return {
      type: "Repeater",
      count,
      value: 0,
      implicit,
      start,
      end: scanner.pos
    };
  }
}
function repeaterPlaceholder(scanner) {
  const start = scanner.pos;
  if (scanner.eat(36) && scanner.eat(35)) {
    return {
      type: "RepeaterPlaceholder",
      value: void 0,
      start,
      end: scanner.pos
    };
  }
  scanner.pos = start;
}
function repeaterNumber(scanner) {
  const start = scanner.pos;
  if (scanner.eatWhile(36)) {
    const size = scanner.pos - start;
    let reverse = false;
    let base = 1;
    let parent = 0;
    if (scanner.eat(64)) {
      while (scanner.eat(94)) {
        parent++;
      }
      reverse = scanner.eat(45);
      scanner.start = scanner.pos;
      if (scanner.eatWhile(isNumber$2)) {
        base = Number(scanner.current());
      }
    }
    scanner.start = start;
    return {
      type: "RepeaterNumber",
      size,
      reverse,
      base,
      parent,
      start,
      end: scanner.pos
    };
  }
}
function field$3(scanner, ctx) {
  const start = scanner.pos;
  if ((ctx.expression || ctx.attribute) && scanner.eat(36) && scanner.eat(123)) {
    scanner.start = scanner.pos;
    let index;
    let name = "";
    if (scanner.eatWhile(isNumber$2)) {
      index = Number(scanner.current());
      name = scanner.eat(58) ? consumePlaceholder$2(scanner) : "";
    } else if (isAlpha$1(scanner.peek())) {
      name = consumePlaceholder$2(scanner);
    }
    if (scanner.eat(125)) {
      return {
        type: "Field",
        index,
        name,
        start,
        end: scanner.pos
      };
    }
    throw scanner.error("Expecting }");
  }
  scanner.pos = start;
}
function consumePlaceholder$2(stream) {
  const stack = [];
  stream.start = stream.pos;
  while (!stream.eof()) {
    if (stream.eat(123)) {
      stack.push(stream.pos);
    } else if (stream.eat(125)) {
      if (!stack.length) {
        stream.pos--;
        break;
      }
      stack.pop();
    } else {
      stream.pos++;
    }
  }
  if (stack.length) {
    stream.pos = stack.pop();
    throw stream.error(`Expecting }`);
  }
  return stream.current();
}
function isAllowedOperator(ch, ctx) {
  const op = operatorType$1(ch);
  if (!op || ctx.quote || ctx.expression) {
    return false;
  }
  return !ctx.attribute || op === "equal";
}
function isAllowedSpace(ch, ctx) {
  return isSpace$1(ch) && !ctx.expression;
}
function isAllowedRepeater(ch, ctx) {
  return ch === 42 && !ctx.attribute && !ctx.expression;
}
function bracketType(ch) {
  if (ch === 40 || ch === 41) {
    return "group";
  }
  if (ch === 91 || ch === 93) {
    return "attribute";
  }
  if (ch === 123 || ch === 125) {
    return "expression";
  }
}
function operatorType$1(ch) {
  return ch === 62 && "child" || ch === 43 && "sibling" || ch === 94 && "climb" || ch === 46 && "class" || ch === 35 && "id" || ch === 47 && "close" || ch === 61 && "equal" || void 0;
}
function isOpenBracket$2(ch) {
  return ch === 123 || ch === 91 || ch === 40;
}
function isElementName$1(ch) {
  return isAlphaNumericWord(ch) || ch === 45 || ch === 58 || ch === 33;
}
const operators = {
  child: ">",
  class: ".",
  climb: "^",
  id: "#",
  equal: "=",
  close: "/",
  sibling: "+"
};
const tokenVisitor = {
  Literal(token2) {
    return token2.value;
  },
  Quote(token2) {
    return token2.single ? "'" : '"';
  },
  Bracket(token2) {
    if (token2.context === "attribute") {
      return token2.open ? "[" : "]";
    } else if (token2.context === "expression") {
      return token2.open ? "{" : "}";
    } else {
      return token2.open ? "(" : "}";
    }
  },
  Operator(token2) {
    return operators[token2.operator];
  },
  Field(token2, state) {
    if (token2.index != null) {
      return token2.name ? `\${${token2.index}:${token2.name}}` : `\${${token2.index}`;
    } else if (token2.name) {
      return state.getVariable(token2.name);
    }
    return "";
  },
  RepeaterPlaceholder(token2, state) {
    let repeater2;
    for (let i = state.repeaters.length - 1; i >= 0; i--) {
      if (state.repeaters[i].implicit) {
        repeater2 = state.repeaters[i];
        break;
      }
    }
    state.inserted = true;
    return state.getText(repeater2 && repeater2.value);
  },
  RepeaterNumber(token2, state) {
    let value = 1;
    const lastIx = state.repeaters.length - 1;
    const repeater2 = state.repeaters[lastIx];
    if (repeater2) {
      value = token2.reverse ? token2.base + repeater2.count - repeater2.value - 1 : token2.base + repeater2.value;
      if (token2.parent) {
        const parentIx = Math.max(0, lastIx - token2.parent);
        if (parentIx !== lastIx) {
          const parentRepeater = state.repeaters[parentIx];
          value += repeater2.count * parentRepeater.value;
        }
      }
    }
    let result = String(value);
    while (result.length < token2.size) {
      result = "0" + result;
    }
    return result;
  },
  WhiteSpace(token2) {
    return token2.value;
  }
};
function stringify$1(token2, state) {
  if (!tokenVisitor[token2.type]) {
    throw new Error(`Unknown token ${token2.type}`);
  }
  return tokenVisitor[token2.type](token2, state);
}
const urlRegex = /^((https?:|ftp:|file:)?\/\/|(www|ftp)\.)[^ ]*$/;
const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,5}$/;
function convert(abbr, options = {}) {
  let textInserted = false;
  let cleanText;
  if (options.text) {
    if (Array.isArray(options.text)) {
      cleanText = options.text.filter((s) => s.trim());
    } else {
      cleanText = options.text;
    }
  }
  const result = {
    type: "Abbreviation",
    children: convertGroup(abbr, {
      inserted: false,
      repeaters: [],
      text: options.text,
      cleanText,
      repeatGuard: options.maxRepeat || Number.POSITIVE_INFINITY,
      getText(pos) {
        var _a;
        textInserted = true;
        let value;
        if (Array.isArray(options.text)) {
          if (pos !== void 0 && pos >= 0 && pos < cleanText.length) {
            return cleanText[pos];
          }
          value = pos !== void 0 ? options.text[pos] : options.text.join("\n");
        } else {
          value = (_a = options.text) !== null && _a !== void 0 ? _a : "";
        }
        return value;
      },
      getVariable(name) {
        const varValue = options.variables && options.variables[name];
        return varValue != null ? varValue : name;
      }
    })
  };
  if (options.text != null && !textInserted) {
    const deepest = deepestNode(last$2(result.children));
    if (deepest) {
      const text2 = Array.isArray(options.text) ? options.text.join("\n") : options.text;
      insertText(deepest, text2);
      if (deepest.name === "a" && options.href) {
        insertHref(deepest, text2);
      }
    }
  }
  return result;
}
function convertStatement(node, state) {
  let result = [];
  if (node.repeat) {
    const original = node.repeat;
    const repeat = Object.assign({}, original);
    repeat.count = repeat.implicit && Array.isArray(state.text) ? state.cleanText.length : repeat.count || 1;
    let items;
    state.repeaters.push(repeat);
    for (let i = 0; i < repeat.count; i++) {
      repeat.value = i;
      node.repeat = repeat;
      items = isGroup(node) ? convertGroup(node, state) : convertElement(node, state);
      if (repeat.implicit && !state.inserted) {
        const target = last$2(items);
        const deepest = target && deepestNode(target);
        if (deepest) {
          insertText(deepest, state.getText(repeat.value));
        }
      }
      result = result.concat(items);
      if (--state.repeatGuard <= 0) {
        break;
      }
    }
    state.repeaters.pop();
    node.repeat = original;
    if (repeat.implicit) {
      state.inserted = true;
    }
  } else {
    result = result.concat(isGroup(node) ? convertGroup(node, state) : convertElement(node, state));
  }
  return result;
}
function convertElement(node, state) {
  let children = [];
  const elem = {
    type: "AbbreviationNode",
    name: node.name && stringifyName(node.name, state),
    value: node.value && stringifyValue$1(node.value, state),
    attributes: void 0,
    children,
    repeat: node.repeat && Object.assign({}, node.repeat),
    selfClosing: node.selfClose
  };
  let result = [elem];
  for (const child of node.elements) {
    children = children.concat(convertStatement(child, state));
  }
  if (node.attributes) {
    elem.attributes = [];
    for (const attr of node.attributes) {
      elem.attributes.push(convertAttribute(attr, state));
    }
  }
  if (!elem.name && !elem.attributes && elem.value && !elem.value.some(isField$1)) {
    result = result.concat(children);
  } else {
    elem.children = children;
  }
  return result;
}
function convertGroup(node, state) {
  let result = [];
  for (const child of node.elements) {
    result = result.concat(convertStatement(child, state));
  }
  if (node.repeat) {
    result = attachRepeater(result, node.repeat);
  }
  return result;
}
function convertAttribute(node, state) {
  let implied = false;
  let isBoolean = false;
  let valueType = node.expression ? "expression" : "raw";
  let value;
  const name = node.name && stringifyName(node.name, state);
  if (name && name[0] === "!") {
    implied = true;
  }
  if (name && name[name.length - 1] === ".") {
    isBoolean = true;
  }
  if (node.value) {
    const tokens = node.value.slice();
    if (isQuote$2(tokens[0])) {
      const quote2 = tokens.shift();
      if (tokens.length && last$2(tokens).type === quote2.type) {
        tokens.pop();
      }
      valueType = quote2.single ? "singleQuote" : "doubleQuote";
    } else if (isBracket$2(tokens[0], "expression", true)) {
      valueType = "expression";
      tokens.shift();
      if (isBracket$2(last$2(tokens), "expression", false)) {
        tokens.pop();
      }
    }
    value = stringifyValue$1(tokens, state);
  }
  return {
    name: isBoolean || implied ? name.slice(implied ? 1 : 0, isBoolean ? -1 : void 0) : name,
    value,
    boolean: isBoolean,
    implied,
    valueType
  };
}
function stringifyName(tokens, state) {
  let str = "";
  for (let i = 0; i < tokens.length; i++) {
    str += stringify$1(tokens[i], state);
  }
  return str;
}
function stringifyValue$1(tokens, state) {
  const result = [];
  let str = "";
  for (let i = 0, token2; i < tokens.length; i++) {
    token2 = tokens[i];
    if (isField$1(token2)) {
      if (str) {
        result.push(str);
        str = "";
      }
      result.push(token2);
    } else {
      str += stringify$1(token2, state);
    }
  }
  if (str) {
    result.push(str);
  }
  return result;
}
function isGroup(node) {
  return node.type === "TokenGroup";
}
function isField$1(token2) {
  return typeof token2 === "object" && token2.type === "Field" && token2.index != null;
}
function last$2(arr) {
  return arr[arr.length - 1];
}
function deepestNode(node) {
  return node.children.length ? deepestNode(last$2(node.children)) : node;
}
function insertText(node, text2) {
  if (node.value) {
    const lastToken = last$2(node.value);
    if (typeof lastToken === "string") {
      node.value[node.value.length - 1] += text2;
    } else {
      node.value.push(text2);
    }
  } else {
    node.value = [text2];
  }
}
function insertHref(node, text2) {
  var _a;
  let href = "";
  if (urlRegex.test(text2)) {
    href = text2;
    if (!/\w+:/.test(href) && !href.startsWith("//")) {
      href = `http://${href}`;
    }
  } else if (emailRegex.test(text2)) {
    href = `mailto:${text2}`;
  }
  const hrefAttribute = (_a = node.attributes) === null || _a === void 0 ? void 0 : _a.find((attr) => attr.name === "href");
  if (!hrefAttribute) {
    if (!node.attributes) {
      node.attributes = [];
    }
    node.attributes.push({ name: "href", value: [href], valueType: "doubleQuote" });
  } else if (!hrefAttribute.value) {
    hrefAttribute.value = [href];
  }
}
function attachRepeater(items, repeater2) {
  for (const item of items) {
    if (!item.repeat) {
      item.repeat = Object.assign({}, repeater2);
    }
  }
  return items;
}
function parseAbbreviation(abbr, options) {
  try {
    const tokens = typeof abbr === "string" ? tokenize$1(abbr) : abbr;
    return convert(abbreviation(tokens, options), options);
  } catch (err) {
    if (err instanceof ScannerError && typeof abbr === "string") {
      err.message += `
${abbr}
${"-".repeat(err.pos)}^`;
    }
    throw err;
  }
}
function tokenize(abbr, isValue2) {
  let brackets = 0;
  let token2;
  const scanner = new Scanner(abbr);
  const tokens = [];
  while (!scanner.eof()) {
    token2 = getToken(scanner, brackets === 0 && !isValue2);
    if (!token2) {
      throw scanner.error("Unexpected character");
    }
    if (token2.type === "Bracket") {
      if (!brackets && token2.open) {
        mergeTokens(scanner, tokens);
      }
      brackets += token2.open ? 1 : -1;
      if (brackets < 0) {
        throw scanner.error("Unexpected bracket", token2.start);
      }
    }
    tokens.push(token2);
    if (shouldConsumeDashAfter(token2) && (token2 = operator(scanner))) {
      tokens.push(token2);
    }
  }
  return tokens;
}
function getToken(scanner, short) {
  return field$2(scanner) || numberValue(scanner) || colorValue(scanner) || stringValue(scanner) || bracket(scanner) || operator(scanner) || whiteSpace(scanner) || literal$1(scanner, short);
}
function field$2(scanner) {
  const start = scanner.pos;
  if (scanner.eat(36) && scanner.eat(123)) {
    scanner.start = scanner.pos;
    let index;
    let name = "";
    if (scanner.eatWhile(isNumber$2)) {
      index = Number(scanner.current());
      name = scanner.eat(58) ? consumePlaceholder$1(scanner) : "";
    } else if (isAlpha$1(scanner.peek())) {
      name = consumePlaceholder$1(scanner);
    }
    if (scanner.eat(125)) {
      return {
        type: "Field",
        index,
        name,
        start,
        end: scanner.pos
      };
    }
    throw scanner.error("Expecting }");
  }
  scanner.pos = start;
}
function consumePlaceholder$1(stream) {
  const stack = [];
  stream.start = stream.pos;
  while (!stream.eof()) {
    if (stream.eat(123)) {
      stack.push(stream.pos);
    } else if (stream.eat(125)) {
      if (!stack.length) {
        stream.pos--;
        break;
      }
      stack.pop();
    } else {
      stream.pos++;
    }
  }
  if (stack.length) {
    stream.pos = stack.pop();
    throw stream.error(`Expecting }`);
  }
  return stream.current();
}
function literal$1(scanner, short) {
  const start = scanner.pos;
  if (scanner.eat(isIdentPrefix)) {
    scanner.eatWhile(start ? isKeyword : isLiteral);
  } else if (scanner.eat(isAlphaWord)) {
    scanner.eatWhile(short ? isLiteral : isKeyword);
  } else {
    scanner.eat(46);
    scanner.eatWhile(isLiteral);
  }
  if (start !== scanner.pos) {
    scanner.start = start;
    return createLiteral(scanner, scanner.start = start);
  }
}
function createLiteral(scanner, start = scanner.start, end = scanner.pos) {
  return {
    type: "Literal",
    value: scanner.substring(start, end),
    start,
    end
  };
}
function numberValue(scanner) {
  const start = scanner.pos;
  if (consumeNumber$1(scanner)) {
    scanner.start = start;
    const rawValue = scanner.current();
    scanner.start = scanner.pos;
    scanner.eat(37) || scanner.eatWhile(isAlphaWord);
    return {
      type: "NumberValue",
      value: Number(rawValue),
      rawValue,
      unit: scanner.current(),
      start,
      end: scanner.pos
    };
  }
}
function stringValue(scanner) {
  const ch = scanner.peek();
  const start = scanner.pos;
  let finished = false;
  if (isQuote$3(ch)) {
    scanner.pos++;
    while (!scanner.eof()) {
      if (scanner.eat(ch)) {
        finished = true;
        break;
      } else {
        scanner.pos++;
      }
    }
    scanner.start = start;
    return {
      type: "StringValue",
      value: scanner.substring(start + 1, scanner.pos - (finished ? 1 : 0)),
      quote: ch === 39 ? "single" : "double",
      start,
      end: scanner.pos
    };
  }
}
function colorValue(scanner) {
  const start = scanner.pos;
  if (scanner.eat(35)) {
    const valueStart = scanner.pos;
    let color2 = "";
    let alpha = "";
    if (scanner.eatWhile(isHex)) {
      color2 = scanner.substring(valueStart, scanner.pos);
      alpha = colorAlpha(scanner);
    } else if (scanner.eat(116)) {
      color2 = "0";
      alpha = colorAlpha(scanner) || "0";
    } else {
      alpha = colorAlpha(scanner);
    }
    if (color2 || alpha || scanner.eof()) {
      const { r, g, b, a } = parseColor(color2, alpha);
      return {
        type: "ColorValue",
        r,
        g,
        b,
        a,
        raw: scanner.substring(start + 1, scanner.pos),
        start,
        end: scanner.pos
      };
    } else {
      return createLiteral(scanner, start);
    }
  }
  scanner.pos = start;
}
function colorAlpha(scanner) {
  const start = scanner.pos;
  if (scanner.eat(46)) {
    scanner.start = start;
    if (scanner.eatWhile(isNumber$2)) {
      return scanner.current();
    }
    return "1";
  }
  return "";
}
function whiteSpace(scanner) {
  const start = scanner.pos;
  if (scanner.eatWhile(isSpace$1)) {
    return {
      type: "WhiteSpace",
      start,
      end: scanner.pos
    };
  }
}
function bracket(scanner) {
  const ch = scanner.peek();
  if (isBracket(ch)) {
    return {
      type: "Bracket",
      open: ch === 40,
      start: scanner.pos++,
      end: scanner.pos
    };
  }
}
function operator(scanner) {
  const op = operatorType(scanner.peek());
  if (op) {
    return {
      type: "Operator",
      operator: op,
      start: scanner.pos++,
      end: scanner.pos
    };
  }
}
function consumeNumber$1(stream) {
  const start = stream.pos;
  stream.eat(45);
  const afterNegative = stream.pos;
  const hasDecimal = stream.eatWhile(isNumber$2);
  const prevPos = stream.pos;
  if (stream.eat(46)) {
    const hasFloat = stream.eatWhile(isNumber$2);
    if (!hasDecimal && !hasFloat) {
      stream.pos = prevPos;
    }
  }
  if (stream.pos === afterNegative) {
    stream.pos = start;
  }
  return stream.pos !== start;
}
function isIdentPrefix(code2) {
  return code2 === 64 || code2 === 36;
}
function operatorType(ch) {
  return ch === 43 && "+" || ch === 33 && "!" || ch === 44 && "," || ch === 58 && ":" || ch === 45 && "-" || void 0;
}
function isHex(code2) {
  return isNumber$2(code2) || isAlpha$1(code2, 65, 70);
}
function isKeyword(code2) {
  return isAlphaNumericWord(code2) || code2 === 45;
}
function isBracket(code2) {
  return code2 === 40 || code2 === 41;
}
function isLiteral(code2) {
  return isAlphaWord(code2) || code2 === 37 || code2 === 47;
}
function parseColor(value, alpha) {
  let r = "0";
  let g = "0";
  let b = "0";
  let a = Number(alpha != null && alpha !== "" ? alpha : 1);
  if (value === "t") {
    a = 0;
  } else {
    switch (value.length) {
      case 0:
        break;
      case 1:
        r = g = b = value + value;
        break;
      case 2:
        r = g = b = value;
        break;
      case 3:
        r = value[0] + value[0];
        g = value[1] + value[1];
        b = value[2] + value[2];
        break;
      default:
        value += value;
        r = value.slice(0, 2);
        g = value.slice(2, 4);
        b = value.slice(4, 6);
    }
  }
  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16),
    a
  };
}
function shouldConsumeDashAfter(token2) {
  return token2.type === "ColorValue" || token2.type === "NumberValue" && !token2.unit;
}
function mergeTokens(scanner, tokens) {
  let start = 0;
  let end = 0;
  while (tokens.length) {
    const token2 = last$1(tokens);
    if (token2.type === "Literal" || token2.type === "NumberValue") {
      start = token2.start;
      if (!end) {
        end = token2.end;
      }
      tokens.pop();
    } else {
      break;
    }
  }
  if (start !== end) {
    tokens.push(createLiteral(scanner, start, end));
  }
}
function last$1(arr) {
  return arr[arr.length - 1];
}
function tokenScanner(tokens) {
  return {
    tokens,
    start: 0,
    pos: 0,
    size: tokens.length
  };
}
function peek$2(scanner) {
  return scanner.tokens[scanner.pos];
}
function readable(scanner) {
  return scanner.pos < scanner.size;
}
function consume$1(scanner, test) {
  if (test(peek$2(scanner))) {
    scanner.pos++;
    return true;
  }
  return false;
}
function error$1(scanner, message, token2 = peek$2(scanner)) {
  if (token2 && token2.start != null) {
    message += ` at ${token2.start}`;
  }
  const err = new Error(message);
  err["pos"] = token2 && token2.start;
  return err;
}
function parser(tokens, options = {}) {
  const scanner = tokenScanner(tokens);
  const result = [];
  let property2;
  while (readable(scanner)) {
    if (property2 = consumeProperty(scanner, options)) {
      result.push(property2);
    } else if (!consume$1(scanner, isSiblingOperator)) {
      throw error$1(scanner, "Unexpected token");
    }
  }
  return result;
}
function consumeProperty(scanner, options) {
  let name;
  let important = false;
  let valueFragment;
  const value = [];
  const token2 = peek$2(scanner);
  const valueMode = !!options.value;
  if (!valueMode && isLiteral$1(token2) && !isFunctionStart(scanner)) {
    scanner.pos++;
    name = token2.value;
    consume$1(scanner, isValueDelimiter);
  }
  if (valueMode) {
    consume$1(scanner, isWhiteSpace$1);
  }
  while (readable(scanner)) {
    if (consume$1(scanner, isImportant)) {
      important = true;
    } else if (valueFragment = consumeValue(scanner, valueMode)) {
      value.push(valueFragment);
    } else if (!consume$1(scanner, isFragmentDelimiter)) {
      break;
    }
  }
  if (name || value.length || important) {
    return { name, value, important };
  }
}
function consumeValue(scanner, inArgument) {
  const result = [];
  let token2;
  let args;
  while (readable(scanner)) {
    token2 = peek$2(scanner);
    if (isValue(token2)) {
      scanner.pos++;
      if (isLiteral$1(token2) && (args = consumeArguments(scanner))) {
        result.push({
          type: "FunctionCall",
          name: token2.value,
          arguments: args
        });
      } else {
        result.push(token2);
      }
    } else if (isValueDelimiter(token2) || inArgument && isWhiteSpace$1(token2)) {
      scanner.pos++;
    } else {
      break;
    }
  }
  return result.length ? { type: "CSSValue", value: result } : void 0;
}
function consumeArguments(scanner) {
  const start = scanner.pos;
  if (consume$1(scanner, isOpenBracket$1)) {
    const args = [];
    let value;
    while (readable(scanner) && !consume$1(scanner, isCloseBracket$1)) {
      if (value = consumeValue(scanner, true)) {
        args.push(value);
      } else if (!consume$1(scanner, isWhiteSpace$1) && !consume$1(scanner, isArgumentDelimiter)) {
        throw error$1(scanner, "Unexpected token");
      }
    }
    scanner.start = start;
    return args;
  }
}
function isLiteral$1(token2) {
  return token2 && token2.type === "Literal";
}
function isBracket$1(token2, open) {
  return token2 && token2.type === "Bracket" && (open == null || token2.open === open);
}
function isOpenBracket$1(token2) {
  return isBracket$1(token2, true);
}
function isCloseBracket$1(token2) {
  return isBracket$1(token2, false);
}
function isWhiteSpace$1(token2) {
  return token2 && token2.type === "WhiteSpace";
}
function isOperator$1(token2, operator2) {
  return token2 && token2.type === "Operator" && (!operator2 || token2.operator === operator2);
}
function isSiblingOperator(token2) {
  return isOperator$1(token2, "+");
}
function isArgumentDelimiter(token2) {
  return isOperator$1(token2, ",");
}
function isFragmentDelimiter(token2) {
  return isArgumentDelimiter(token2);
}
function isImportant(token2) {
  return isOperator$1(token2, "!");
}
function isValue(token2) {
  return token2.type === "StringValue" || token2.type === "ColorValue" || token2.type === "NumberValue" || token2.type === "Literal" || token2.type === "Field";
}
function isValueDelimiter(token2) {
  return isOperator$1(token2, ":") || isOperator$1(token2, "-");
}
function isFunctionStart(scanner) {
  const t1 = scanner.tokens[scanner.pos];
  const t2 = scanner.tokens[scanner.pos + 1];
  return t1 && t2 && isLiteral$1(t1) && t2.type === "Bracket";
}
function parse$2(abbr, options) {
  try {
    const tokens = typeof abbr === "string" ? tokenize(abbr, options && options.value) : abbr;
    return parser(tokens, options);
  } catch (err) {
    if (err instanceof ScannerError && typeof abbr === "string") {
      err.message += `
${abbr}
${"-".repeat(err.pos)}^`;
    }
    throw err;
  }
}
function mergeAttributes(node, config2) {
  if (!node.attributes) {
    return;
  }
  const attributes = [];
  const lookup = {};
  for (const attr of node.attributes) {
    if (attr.name) {
      const attrName2 = attr.name;
      if (attrName2 in lookup) {
        const prev2 = lookup[attrName2];
        if (attrName2 === "class") {
          prev2.value = mergeValue(prev2.value, attr.value, " ");
        } else {
          mergeDeclarations(prev2, attr, config2);
        }
      } else {
        attributes.push(lookup[attrName2] = Object.assign({}, attr));
      }
    } else {
      attributes.push(attr);
    }
  }
  node.attributes = attributes;
}
function mergeValue(prev2, next2, glue) {
  if (prev2 && next2) {
    if (prev2.length && glue) {
      append(prev2, glue);
    }
    for (const t of next2) {
      append(prev2, t);
    }
    return prev2;
  }
  const result = prev2 || next2;
  return result && result.slice();
}
function mergeDeclarations(dest, src, config2) {
  dest.name = src.name;
  if (!config2.options["output.reverseAttributes"]) {
    dest.value = src.value;
  }
  if (!dest.implied) {
    dest.implied = src.implied;
  }
  if (!dest.boolean) {
    dest.boolean = src.boolean;
  }
  if (dest.valueType !== "expression") {
    dest.valueType = src.valueType;
  }
  return dest;
}
function append(tokens, value) {
  const lastIx = tokens.length - 1;
  if (typeof tokens[lastIx] === "string" && typeof value === "string") {
    tokens[lastIx] += value;
  } else {
    tokens.push(value);
  }
}
function walk(node, fn, state) {
  const ancestors = [node];
  const callback = (ctx) => {
    fn(ctx, ancestors, state);
    ancestors.push(ctx);
    ctx.children.forEach(callback);
    ancestors.pop();
  };
  node.children.forEach(callback);
}
function findDeepest(node) {
  let parent;
  while (node.children.length) {
    parent = node;
    node = node.children[node.children.length - 1];
  }
  return { parent, node };
}
function isNode(node) {
  return node.type === "AbbreviationNode";
}
function resolveSnippets(abbr, config2) {
  const stack = [];
  const reversed = config2.options["output.reverseAttributes"];
  const resolve = (child) => {
    const snippet2 = child.name && config2.snippets[child.name];
    if (!snippet2 || stack.includes(snippet2)) {
      return null;
    }
    const snippetAbbr = parseAbbreviation(snippet2, config2);
    stack.push(snippet2);
    walkResolve(snippetAbbr, resolve);
    stack.pop();
    for (const topNode of snippetAbbr.children) {
      if (child.attributes) {
        const from = topNode.attributes || [];
        const to = child.attributes || [];
        topNode.attributes = reversed ? to.concat(from) : from.concat(to);
      }
      mergeNodes(child, topNode);
    }
    return snippetAbbr;
  };
  walkResolve(abbr, resolve);
  return abbr;
}
function walkResolve(node, resolve, config2) {
  let children = [];
  for (const child of node.children) {
    const resolved = resolve(child);
    if (resolved) {
      children = children.concat(resolved.children);
      const deepest = findDeepest(resolved);
      if (isNode(deepest.node)) {
        deepest.node.children = deepest.node.children.concat(walkResolve(child, resolve));
      }
    } else {
      children.push(child);
      child.children = walkResolve(child, resolve);
    }
  }
  return node.children = children;
}
function mergeNodes(from, to) {
  if (from.selfClosing) {
    to.selfClosing = true;
  }
  if (from.value != null) {
    to.value = from.value;
  }
  if (from.repeat) {
    to.repeat = from.repeat;
  }
}
function createOutputStream(options, level = 0) {
  return {
    options,
    value: "",
    level,
    offset: 0,
    line: 0,
    column: 0
  };
}
function push(stream, text2) {
  const processText = stream.options["output.text"];
  _push(stream, processText(text2, stream.offset, stream.line, stream.column));
}
function pushString(stream, value) {
  const lines = splitByLines(value);
  for (let i = 0, il = lines.length - 1; i <= il; i++) {
    push(stream, lines[i]);
    if (i !== il) {
      pushNewline(stream, true);
    }
  }
}
function pushNewline(stream, indent) {
  const baseIndent = stream.options["output.baseIndent"];
  const newline = stream.options["output.newline"];
  push(stream, newline + baseIndent);
  stream.line++;
  stream.column = baseIndent.length;
  if (indent) {
    pushIndent(stream, indent === true ? stream.level : indent);
  }
}
function pushIndent(stream, size = stream.level) {
  const indent = stream.options["output.indent"];
  push(stream, indent.repeat(Math.max(size, 0)));
}
function pushField(stream, index, placeholder) {
  const field2 = stream.options["output.field"];
  _push(stream, field2(index, placeholder, stream.offset, stream.line, stream.column));
}
function tagName(name, config2) {
  return strCase(name, config2.options["output.tagCase"]);
}
function attrName(name, config2) {
  return strCase(name, config2.options["output.attributeCase"]);
}
function attrQuote(attr, config2, isOpen) {
  if (attr.valueType === "expression") {
    return isOpen ? "{" : "}";
  }
  return config2.options["output.attributeQuotes"] === "single" ? "'" : '"';
}
function isBooleanAttribute(attr, config2) {
  return attr.boolean || config2.options["output.booleanAttributes"].includes((attr.name || "").toLowerCase());
}
function selfClose(config2) {
  switch (config2.options["output.selfClosingStyle"]) {
    case "xhtml":
      return " /";
    case "xml":
      return "/";
    default:
      return "";
  }
}
function isInline(node, config2) {
  if (typeof node === "string") {
    return config2.options.inlineElements.includes(node.toLowerCase());
  }
  return node.name ? isInline(node.name, config2) : Boolean(node.value && !node.attributes);
}
function splitByLines(text2) {
  return text2.split(/\r\n|\r|\n/g);
}
function _push(stream, text2) {
  stream.value += text2;
  stream.offset += text2.length;
  stream.column += text2.length;
}
function strCase(str, type) {
  if (type) {
    return type === "upper" ? str.toUpperCase() : str.toLowerCase();
  }
  return str;
}
const elementMap = {
  p: "span",
  ul: "li",
  ol: "li",
  table: "tr",
  tr: "td",
  tbody: "tr",
  thead: "tr",
  tfoot: "tr",
  colgroup: "col",
  select: "option",
  optgroup: "option",
  audio: "source",
  video: "source",
  object: "param",
  map: "area"
};
function implicitTag(node, ancestors, config2) {
  if (!node.name && node.attributes) {
    resolveImplicitTag(node, ancestors, config2);
  }
}
function resolveImplicitTag(node, ancestors, config2) {
  const parent = getParentElement(ancestors);
  const contextName = config2.context ? config2.context.name : "";
  const parentName = lowercase(parent ? parent.name : contextName);
  node.name = elementMap[parentName] || (isInline(parentName, config2) ? "span" : "div");
}
function lowercase(str) {
  return (str || "").toLowerCase();
}
function getParentElement(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const elem = ancestors[i];
    if (isNode(elem)) {
      return elem;
    }
  }
}
var latin = {
  "common": ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipisicing", "elit"],
  "words": [
    "exercitationem",
    "perferendis",
    "perspiciatis",
    "laborum",
    "eveniet",
    "sunt",
    "iure",
    "nam",
    "nobis",
    "eum",
    "cum",
    "officiis",
    "excepturi",
    "odio",
    "consectetur",
    "quasi",
    "aut",
    "quisquam",
    "vel",
    "eligendi",
    "itaque",
    "non",
    "odit",
    "tempore",
    "quaerat",
    "dignissimos",
    "facilis",
    "neque",
    "nihil",
    "expedita",
    "vitae",
    "vero",
    "ipsum",
    "nisi",
    "animi",
    "cumque",
    "pariatur",
    "velit",
    "modi",
    "natus",
    "iusto",
    "eaque",
    "sequi",
    "illo",
    "sed",
    "ex",
    "et",
    "voluptatibus",
    "tempora",
    "veritatis",
    "ratione",
    "assumenda",
    "incidunt",
    "nostrum",
    "placeat",
    "aliquid",
    "fuga",
    "provident",
    "praesentium",
    "rem",
    "necessitatibus",
    "suscipit",
    "adipisci",
    "quidem",
    "possimus",
    "voluptas",
    "debitis",
    "sint",
    "accusantium",
    "unde",
    "sapiente",
    "voluptate",
    "qui",
    "aspernatur",
    "laudantium",
    "soluta",
    "amet",
    "quo",
    "aliquam",
    "saepe",
    "culpa",
    "libero",
    "ipsa",
    "dicta",
    "reiciendis",
    "nesciunt",
    "doloribus",
    "autem",
    "impedit",
    "minima",
    "maiores",
    "repudiandae",
    "ipsam",
    "obcaecati",
    "ullam",
    "enim",
    "totam",
    "delectus",
    "ducimus",
    "quis",
    "voluptates",
    "dolores",
    "molestiae",
    "harum",
    "dolorem",
    "quia",
    "voluptatem",
    "molestias",
    "magni",
    "distinctio",
    "omnis",
    "illum",
    "dolorum",
    "voluptatum",
    "ea",
    "quas",
    "quam",
    "corporis",
    "quae",
    "blanditiis",
    "atque",
    "deserunt",
    "laboriosam",
    "earum",
    "consequuntur",
    "hic",
    "cupiditate",
    "quibusdam",
    "accusamus",
    "ut",
    "rerum",
    "error",
    "minus",
    "eius",
    "ab",
    "ad",
    "nemo",
    "fugit",
    "officia",
    "at",
    "in",
    "id",
    "quos",
    "reprehenderit",
    "numquam",
    "iste",
    "fugiat",
    "sit",
    "inventore",
    "beatae",
    "repellendus",
    "magnam",
    "recusandae",
    "quod",
    "explicabo",
    "doloremque",
    "aperiam",
    "consequatur",
    "asperiores",
    "commodi",
    "optio",
    "dolor",
    "labore",
    "temporibus",
    "repellat",
    "veniam",
    "architecto",
    "est",
    "esse",
    "mollitia",
    "nulla",
    "a",
    "similique",
    "eos",
    "alias",
    "dolore",
    "tenetur",
    "deleniti",
    "porro",
    "facere",
    "maxime",
    "corrupti"
  ]
};
var ru = {
  "common": ["\u0434\u0430\u043B\u0435\u043A\u043E-\u0434\u0430\u043B\u0435\u043A\u043E", "\u0437\u0430", "\u0441\u043B\u043E\u0432\u0435\u0441\u043D\u044B\u043C\u0438", "\u0433\u043E\u0440\u0430\u043C\u0438", "\u0432 \u0441\u0442\u0440\u0430\u043D\u0435", "\u0433\u043B\u0430\u0441\u043D\u044B\u0445", "\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u044B\u0445", "\u0436\u0438\u0432\u0443\u0442", "\u0440\u044B\u0431\u043D\u044B\u0435", "\u0442\u0435\u043A\u0441\u0442\u044B"],
  "words": [
    "\u0432\u0434\u0430\u043B\u0438",
    "\u043E\u0442 \u0432\u0441\u0435\u0445",
    "\u043E\u043D\u0438",
    "\u0431\u0443\u043A\u0432\u0435\u043D\u043D\u044B\u0445",
    "\u0434\u043E\u043C\u0430\u0445",
    "\u043D\u0430 \u0431\u0435\u0440\u0435\u0433\u0443",
    "\u0441\u0435\u043C\u0430\u043D\u0442\u0438\u043A\u0430",
    "\u0431\u043E\u043B\u044C\u0448\u043E\u0433\u043E",
    "\u044F\u0437\u044B\u043A\u043E\u0432\u043E\u0433\u043E",
    "\u043E\u043A\u0435\u0430\u043D\u0430",
    "\u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0439",
    "\u0440\u0443\u0447\u0435\u0435\u043A",
    "\u0434\u0430\u043B\u044C",
    "\u0436\u0443\u0440\u0447\u0438\u0442",
    "\u043F\u043E \u0432\u0441\u0435\u0439",
    "\u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442",
    "\u0435\u0435",
    "\u0432\u0441\u0435\u043C\u0438",
    "\u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u044B\u043C\u0438",
    "\u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438",
    "\u044D\u0442\u0430",
    "\u043F\u0430\u0440\u0430\u0434\u0438\u0433\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F",
    "\u0441\u0442\u0440\u0430\u043D\u0430",
    "\u043A\u043E\u0442\u043E\u0440\u043E\u0439",
    "\u0436\u0430\u0440\u0435\u043D\u043D\u044B\u0435",
    "\u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
    "\u0437\u0430\u043B\u0435\u0442\u0430\u044E\u0442",
    "\u043F\u0440\u044F\u043C\u043E",
    "\u0440\u043E\u0442",
    "\u0434\u0430\u0436\u0435",
    "\u0432\u0441\u0435\u043C\u043E\u0433\u0443\u0449\u0430\u044F",
    "\u043F\u0443\u043D\u043A\u0442\u0443\u0430\u0446\u0438\u044F",
    "\u043D\u0435",
    "\u0438\u043C\u0435\u0435\u0442",
    "\u0432\u043B\u0430\u0441\u0442\u0438",
    "\u043D\u0430\u0434",
    "\u0440\u044B\u0431\u043D\u044B\u043C\u0438",
    "\u0442\u0435\u043A\u0441\u0442\u0430\u043C\u0438",
    "\u0432\u0435\u0434\u0443\u0449\u0438\u043C\u0438",
    "\u0431\u0435\u0437\u043E\u0440\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u043D\u044B\u0439",
    "\u043E\u0431\u0440\u0430\u0437",
    "\u0436\u0438\u0437\u043D\u0438",
    "\u043E\u0434\u043D\u0430\u0436\u0434\u044B",
    "\u043E\u0434\u043D\u0430",
    "\u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0430\u044F",
    "\u0441\u0442\u0440\u043E\u0447\u043A\u0430",
    "\u0440\u044B\u0431\u043D\u043E\u0433\u043E",
    "\u0442\u0435\u043A\u0441\u0442\u0430",
    "\u0438\u043C\u0435\u043D\u0438",
    "lorem",
    "ipsum",
    "\u0440\u0435\u0448\u0438\u043B\u0430",
    "\u0432\u044B\u0439\u0442\u0438",
    "\u0431\u043E\u043B\u044C\u0448\u043E\u0439",
    "\u043C\u0438\u0440",
    "\u0433\u0440\u0430\u043C\u043C\u0430\u0442\u0438\u043A\u0438",
    "\u0432\u0435\u043B\u0438\u043A\u0438\u0439",
    "\u043E\u043A\u0441\u043C\u043E\u043A\u0441",
    "\u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0430\u043B",
    "\u043E",
    "\u0437\u043B\u044B\u0445",
    "\u0437\u0430\u043F\u044F\u0442\u044B\u0445",
    "\u0434\u0438\u043A\u0438\u0445",
    "\u0437\u043D\u0430\u043A\u0430\u0445",
    "\u0432\u043E\u043F\u0440\u043E\u0441\u0430",
    "\u043A\u043E\u0432\u0430\u0440\u043D\u044B\u0445",
    "\u0442\u043E\u0447\u043A\u0430\u0445",
    "\u0437\u0430\u043F\u044F\u0442\u043E\u0439",
    "\u043D\u043E",
    "\u0442\u0435\u043A\u0441\u0442",
    "\u0434\u0430\u043B",
    "\u0441\u0431\u0438\u0442\u044C",
    "\u0441\u0435\u0431\u044F",
    "\u0442\u043E\u043B\u043A\u0443",
    "\u043E\u043D",
    "\u0441\u043E\u0431\u0440\u0430\u043B",
    "\u0441\u0435\u043C\u044C",
    "\u0441\u0432\u043E\u0438\u0445",
    "\u0437\u0430\u0433\u043B\u0430\u0432\u043D\u044B\u0445",
    "\u0431\u0443\u043A\u0432",
    "\u043F\u043E\u0434\u043F\u043E\u044F\u0441\u0430\u043B",
    "\u0438\u043D\u0438\u0446\u0438\u0430\u043B",
    "\u0437\u0430",
    "\u043F\u043E\u044F\u0441",
    "\u043F\u0443\u0441\u0442\u0438\u043B\u0441\u044F",
    "\u0434\u043E\u0440\u043E\u0433\u0443",
    "\u0432\u0437\u043E\u0431\u0440\u0430\u0432\u0448\u0438\u0441\u044C",
    "\u043F\u0435\u0440\u0432\u0443\u044E",
    "\u0432\u0435\u0440\u0448\u0438\u043D\u0443",
    "\u043A\u0443\u0440\u0441\u0438\u0432\u043D\u044B\u0445",
    "\u0433\u043E\u0440",
    "\u0431\u0440\u043E\u0441\u0438\u043B",
    "\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439",
    "\u0432\u0437\u0433\u043B\u044F\u0434",
    "\u043D\u0430\u0437\u0430\u0434",
    "\u0441\u0438\u043B\u0443\u044D\u0442",
    "\u0441\u0432\u043E\u0435\u0433\u043E",
    "\u0440\u043E\u0434\u043D\u043E\u0433\u043E",
    "\u0433\u043E\u0440\u043E\u0434\u0430",
    "\u0431\u0443\u043A\u0432\u043E\u0433\u0440\u0430\u0434",
    "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
    "\u0434\u0435\u0440\u0435\u0432\u043D\u0438",
    "\u0430\u043B\u0444\u0430\u0432\u0438\u0442",
    "\u043F\u043E\u0434\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
    "\u0441\u0432\u043E\u0435\u0433\u043E",
    "\u043F\u0435\u0440\u0435\u0443\u043B\u043A\u0430",
    "\u0433\u0440\u0443\u0441\u0442\u043D\u044B\u0439",
    "\u0440\u0435\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    "\u0432\u043E\u043F\u0440\u043E\u0441",
    "\u0441\u043A\u0430\u0442\u0438\u043B\u0441\u044F",
    "\u0435\u0433\u043E",
    "\u0449\u0435\u043A\u0435",
    "\u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043B",
    "\u0441\u0432\u043E\u0439",
    "\u043F\u0443\u0442\u044C",
    "\u0434\u043E\u0440\u043E\u0433\u0435",
    "\u0432\u0441\u0442\u0440\u0435\u0442\u0438\u043B",
    "\u0440\u0443\u043A\u043E\u043F\u0438\u0441\u044C",
    "\u043E\u043D\u0430",
    "\u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0434\u0438\u043B\u0430",
    "\u043C\u043E\u0435\u0439",
    "\u0432\u0441\u0435",
    "\u043F\u0435\u0440\u0435\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F",
    "\u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E",
    "\u0440\u0430\u0437",
    "\u0435\u0434\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435",
    "\u0447\u0442\u043E",
    "\u043C\u0435\u043D\u044F",
    "\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C",
    "\u044D\u0442\u043E",
    "\u043F\u0440\u0438\u0441\u0442\u0430\u0432\u043A\u0430",
    "\u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0441\u044F",
    "\u0442\u044B",
    "\u043B\u0443\u0447\u0448\u0435",
    "\u0441\u0432\u043E\u044E",
    "\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u0443\u044E",
    "\u0441\u0442\u0440\u0430\u043D\u0443",
    "\u043F\u043E\u0441\u043B\u0443\u0448\u0430\u0432\u0448\u0438\u0441\u044C",
    "\u0440\u0443\u043A\u043E\u043F\u0438\u0441\u0438",
    "\u043D\u0430\u0448",
    "\u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043B",
    "\u0441\u0432\u043E\u0439",
    "\u043F\u0443\u0442\u044C",
    "\u0432\u0441\u043A\u043E\u0440\u0435",
    "\u0435\u043C\u0443",
    "\u043F\u043E\u0432\u0441\u0442\u0440\u0435\u0447\u0430\u043B\u0441\u044F",
    "\u043A\u043E\u0432\u0430\u0440\u043D\u044B\u0439",
    "\u0441\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043B\u044C",
    "\u0440\u0435\u043A\u043B\u0430\u043C\u043D\u044B\u0445",
    "\u0442\u0435\u043A\u0441\u0442\u043E\u0432",
    "\u043D\u0430\u043F\u043E\u0438\u0432\u0448\u0438\u0439",
    "\u044F\u0437\u044B\u043A\u043E\u043C",
    "\u0440\u0435\u0447\u044C\u044E",
    "\u0437\u0430\u043C\u0430\u043D\u0438\u0432\u0448\u0438\u0439",
    "\u0441\u0432\u043E\u0435",
    "\u0430\u0433\u0435\u043D\u0442\u0441\u0442\u0432\u043E",
    "\u043A\u043E\u0442\u043E\u0440\u043E\u0435",
    "\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u043E",
    "\u0441\u043D\u043E\u0432\u0430",
    "\u0441\u043D\u043E\u0432\u0430",
    "\u0441\u0432\u043E\u0438\u0445",
    "\u043F\u0440\u043E\u0435\u043A\u0442\u0430\u0445",
    "\u0435\u0441\u043B\u0438",
    "\u043F\u0435\u0440\u0435\u043F\u0438\u0441\u0430\u043B\u0438",
    "\u0442\u043E",
    "\u0436\u0438\u0432\u0435\u0442",
    "\u0442\u0430\u043C",
    "\u0434\u043E",
    "\u0441\u0438\u0445",
    "\u043F\u043E\u0440"
  ]
};
var sp = {
  "common": ["mujer", "uno", "dolor", "m\xE1s", "de", "poder", "mismo", "si"],
  "words": [
    "ejercicio",
    "preferencia",
    "perspicacia",
    "laboral",
    "pa\xF1o",
    "suntuoso",
    "molde",
    "namibia",
    "planeador",
    "mirar",
    "dem\xE1s",
    "oficinista",
    "excepci\xF3n",
    "odio",
    "consecuencia",
    "casi",
    "auto",
    "chicharra",
    "velo",
    "elixir",
    "ataque",
    "no",
    "odio",
    "temporal",
    "cu\xF3rum",
    "dign\xEDsimo",
    "facilismo",
    "letra",
    "nihilista",
    "expedici\xF3n",
    "alma",
    "alveolar",
    "aparte",
    "le\xF3n",
    "animal",
    "como",
    "paria",
    "belleza",
    "modo",
    "natividad",
    "justo",
    "ataque",
    "s\xE9quito",
    "pillo",
    "sed",
    "ex",
    "y",
    "voluminoso",
    "temporalidad",
    "verdades",
    "racional",
    "asunci\xF3n",
    "incidente",
    "marejada",
    "placenta",
    "amanecer",
    "fuga",
    "previsor",
    "presentaci\xF3n",
    "lejos",
    "necesariamente",
    "sospechoso",
    "adiposidad",
    "quind\xEDo",
    "p\xF3cima",
    "voluble",
    "d\xE9bito",
    "sinti\xF3",
    "accesorio",
    "falda",
    "sapiencia",
    "volutas",
    "queso",
    "permacultura",
    "laudo",
    "soluciones",
    "entero",
    "pan",
    "litro",
    "tonelada",
    "culpa",
    "libertario",
    "mosca",
    "dictado",
    "reincidente",
    "nascimiento",
    "dolor",
    "escolar",
    "impedimento",
    "m\xEDnima",
    "mayores",
    "repugnante",
    "dulce",
    "obcecado",
    "monta\xF1a",
    "enigma",
    "total",
    "delet\xE9reo",
    "d\xE9cima",
    "c\xE1bala",
    "fotograf\xEDa",
    "dolores",
    "molesto",
    "olvido",
    "paciencia",
    "resiliencia",
    "voluntad",
    "molestias",
    "magn\xEDfico",
    "distinci\xF3n",
    "ovni",
    "marejada",
    "cerro",
    "torre",
    "y",
    "abogada",
    "manantial",
    "corporal",
    "agua",
    "crep\xFAsculo",
    "ataque",
    "desierto",
    "laboriosamente",
    "angustia",
    "afortunado",
    "alma",
    "encefalograma",
    "materialidad",
    "cosas",
    "o",
    "renuncia",
    "error",
    "menos",
    "conejo",
    "abad\xEDa",
    "analfabeto",
    "remo",
    "fugacidad",
    "oficio",
    "en",
    "alm\xE1cigo",
    "vos",
    "pan",
    "represi\xF3n",
    "n\xFAmeros",
    "triste",
    "refugiado",
    "trote",
    "inventor",
    "corchea",
    "repelente",
    "magma",
    "recusado",
    "patr\xF3n",
    "expl\xEDcito",
    "paloma",
    "s\xEDndrome",
    "inmune",
    "autoinmune",
    "comodidad",
    "ley",
    "vietnamita",
    "demonio",
    "tasmania",
    "repeler",
    "ap\xE9ndice",
    "arquitecto",
    "columna",
    "yugo",
    "computador",
    "mula",
    "a",
    "prop\xF3sito",
    "fantas\xEDa",
    "alias",
    "rayo",
    "tenedor",
    "deleznable",
    "ventana",
    "cara",
    "anemia",
    "corrupto"
  ]
};
const vocabularies = { ru, sp, latin };
const reLorem = /^lorem([a-z]*)(\d*)(-\d*)?$/i;
function lorem(node, ancestors, config2) {
  let m;
  if (node.name && (m = node.name.match(reLorem))) {
    const db = vocabularies[m[1]] || vocabularies.latin;
    const minWordCount = m[2] ? Math.max(1, Number(m[2])) : 30;
    const maxWordCount = m[3] ? Math.max(minWordCount, Number(m[3].slice(1))) : minWordCount;
    const wordCount = rand(minWordCount, maxWordCount);
    const repeat = node.repeat || findRepeater(ancestors);
    node.name = node.attributes = void 0;
    node.value = [paragraph(db, wordCount, !repeat || repeat.value === 0)];
    if (node.repeat && ancestors.length > 1) {
      resolveImplicitTag(node, ancestors, config2);
    }
  }
}
function rand(from, to) {
  return Math.floor(Math.random() * (to - from) + from);
}
function sample(arr, count) {
  const len = arr.length;
  const iterations = Math.min(len, count);
  const result = [];
  while (result.length < iterations) {
    const str = arr[rand(0, len)];
    if (!result.includes(str)) {
      result.push(str);
    }
  }
  return result;
}
function choice(val) {
  return val[rand(0, val.length - 1)];
}
function sentence(words, end) {
  if (words.length) {
    words = [capitalize(words[0])].concat(words.slice(1));
  }
  return words.join(" ") + (end || choice("?!..."));
}
function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}
function insertCommas(words) {
  if (words.length < 2) {
    return words;
  }
  words = words.slice();
  const len = words.length;
  const hasComma = /,$/;
  let totalCommas = 0;
  if (len > 3 && len <= 6) {
    totalCommas = rand(0, 1);
  } else if (len > 6 && len <= 12) {
    totalCommas = rand(0, 2);
  } else {
    totalCommas = rand(1, 4);
  }
  for (let i = 0, pos; i < totalCommas; i++) {
    pos = rand(0, len - 2);
    if (!hasComma.test(words[pos])) {
      words[pos] += ",";
    }
  }
  return words;
}
function paragraph(dict, wordCount, startWithCommon) {
  const result = [];
  let totalWords = 0;
  let words;
  if (startWithCommon && dict.common) {
    words = dict.common.slice(0, wordCount);
    totalWords += words.length;
    result.push(sentence(insertCommas(words), "."));
  }
  while (totalWords < wordCount) {
    words = sample(dict.words, Math.min(rand(2, 30), wordCount - totalWords));
    totalWords += words.length;
    result.push(sentence(insertCommas(words)));
  }
  return result.join(" ");
}
function findRepeater(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const element2 = ancestors[i];
    if (element2.type === "AbbreviationNode" && element2.repeat) {
      return element2.repeat;
    }
  }
}
function jsx(node) {
  if (node.attributes) {
    node.attributes.forEach(rename);
  }
}
function rename(attr) {
  if (attr.name === "class") {
    attr.name = "className";
  } else if (attr.name === "for") {
    attr.name = "htmlFor";
  }
}
function xsl(node) {
  if (matchesName(node.name) && node.attributes && (node.children.length || node.value)) {
    node.attributes = node.attributes.filter(isAllowed);
  }
}
function isAllowed(attr) {
  return attr.name !== "select";
}
function matchesName(name) {
  return name === "xsl:variable" || name === "xsl:with-param";
}
const reElement = /^(-+)([a-z0-9]+[a-z0-9-]*)/i;
const reModifier = /^(_+)([a-z0-9]+[a-z0-9-_]*)/i;
const blockCandidates1 = (className) => /^[a-z]\-/i.test(className);
const blockCandidates2 = (className) => /^[a-z]/i.test(className);
function bem(node, ancestors, config2) {
  expandClassNames(node);
  expandShortNotation(node, ancestors, config2);
}
function expandClassNames(node) {
  const data = getBEMData(node);
  const classNames = [];
  for (const cl of data.classNames) {
    const ix = cl.indexOf("_");
    if (ix > 0 && !cl.startsWith("-")) {
      classNames.push(cl.slice(0, ix));
      classNames.push(cl.slice(ix));
    } else {
      classNames.push(cl);
    }
  }
  if (classNames.length) {
    data.classNames = classNames.filter(uniqueClass);
    data.block = findBlockName(data.classNames);
    updateClass(node, data.classNames.join(" "));
  }
}
function expandShortNotation(node, ancestors, config2) {
  const data = getBEMData(node);
  const classNames = [];
  const { options } = config2;
  const path = ancestors.slice(1).concat(node);
  for (let cl of data.classNames) {
    let prefix = "";
    let m;
    const originalClass = cl;
    if (m = cl.match(reElement)) {
      prefix = getBlockName(path, m[1].length, config2.context) + options["bem.element"] + m[2];
      classNames.push(prefix);
      cl = cl.slice(m[0].length);
    }
    if (m = cl.match(reModifier)) {
      if (!prefix) {
        prefix = getBlockName(path, m[1].length);
        classNames.push(prefix);
      }
      classNames.push(`${prefix}${options["bem.modifier"]}${m[2]}`);
      cl = cl.slice(m[0].length);
    }
    if (cl === originalClass) {
      classNames.push(originalClass);
    }
  }
  const arrClassNames = classNames.filter(uniqueClass);
  if (arrClassNames.length) {
    updateClass(node, arrClassNames.join(" "));
  }
}
function getBEMData(node) {
  if (!node._bem) {
    let classValue = "";
    if (node.attributes) {
      for (const attr of node.attributes) {
        if (attr.name === "class" && attr.value) {
          classValue = stringifyValue(attr.value);
          break;
        }
      }
    }
    node._bem = parseBEM(classValue);
  }
  return node._bem;
}
function getBEMDataFromContext(context) {
  if (!context._bem) {
    context._bem = parseBEM(context.attributes && context.attributes.class || "");
  }
  return context._bem;
}
function parseBEM(classValue) {
  const classNames = classValue ? classValue.split(/\s+/) : [];
  return {
    classNames,
    block: findBlockName(classNames)
  };
}
function getBlockName(ancestors, depth = 0, context) {
  const maxParentIx = 0;
  let parentIx = Math.max(ancestors.length - depth, maxParentIx);
  do {
    const parent = ancestors[parentIx];
    if (parent) {
      const data = getBEMData(parent);
      if (data.block) {
        return data.block;
      }
    }
  } while (maxParentIx < parentIx--);
  if (context) {
    const data = getBEMDataFromContext(context);
    if (data.block) {
      return data.block;
    }
  }
  return "";
}
function findBlockName(classNames) {
  return find(classNames, blockCandidates1) || find(classNames, blockCandidates2) || void 0;
}
function find(classNames, filter) {
  for (const cl of classNames) {
    if (reElement.test(cl) || reModifier.test(cl)) {
      break;
    }
    if (filter(cl)) {
      return cl;
    }
  }
}
function updateClass(node, value) {
  for (const attr of node.attributes) {
    if (attr.name === "class") {
      attr.value = [value];
      break;
    }
  }
}
function stringifyValue(value) {
  let result = "";
  for (const t of value) {
    result += typeof t === "string" ? t : t.name;
  }
  return result;
}
function uniqueClass(item, ix, arr) {
  return !!item && arr.indexOf(item) === ix;
}
function walk$1(abbr, visitor, state) {
  const callback = (ctx, index, items) => {
    const { parent, current } = state;
    state.parent = current;
    state.current = ctx;
    visitor(ctx, index, items, state, next2);
    state.current = current;
    state.parent = parent;
  };
  const next2 = (node, index, items) => {
    state.ancestors.push(state.current);
    callback(node, index, items);
    state.ancestors.pop();
  };
  abbr.children.forEach(callback);
}
function createWalkState(config2) {
  return {
    current: null,
    parent: void 0,
    ancestors: [],
    config: config2,
    field: 1,
    out: createOutputStream(config2.options)
  };
}
const caret = [{ type: "Field", index: 0, name: "" }];
function isSnippet(node) {
  return node ? !node.name && !node.attributes : false;
}
function isInlineElement(node, config2) {
  return node ? isInline(node, config2) : false;
}
function isField(token2) {
  return typeof token2 === "object" && token2.type === "Field";
}
function pushTokens(tokens, state) {
  const { out } = state;
  let largestIndex = -1;
  for (const t of tokens) {
    if (typeof t === "string") {
      pushString(out, t);
    } else {
      pushField(out, state.field + t.index, t.name);
      if (t.index > largestIndex) {
        largestIndex = t.index;
      }
    }
  }
  if (largestIndex !== -1) {
    state.field += largestIndex + 1;
  }
}
function splitByLines$1(tokens) {
  const result = [];
  let line = [];
  for (const t of tokens) {
    if (typeof t === "string") {
      const lines = t.split(/\r\n?|\n/g);
      line.push(lines.shift() || "");
      while (lines.length) {
        result.push(line);
        line = [lines.shift() || ""];
      }
    } else {
      line.push(t);
    }
  }
  line.length && result.push(line);
  return result;
}
function shouldOutputAttribute(attr) {
  return !attr.implied || attr.valueType !== "raw" || !!attr.value && attr.value.length > 0;
}
function template(text2) {
  const tokens = [];
  const scanner = { pos: 0, text: text2 };
  let placeholder;
  let offset = scanner.pos;
  let pos = scanner.pos;
  while (scanner.pos < scanner.text.length) {
    pos = scanner.pos;
    if (placeholder = consumePlaceholder(scanner)) {
      if (offset !== scanner.pos) {
        tokens.push(text2.slice(offset, pos));
      }
      tokens.push(placeholder);
      offset = scanner.pos;
    } else {
      scanner.pos++;
    }
  }
  if (offset !== scanner.pos) {
    tokens.push(text2.slice(offset));
  }
  return tokens;
}
function consumePlaceholder(scanner) {
  if (peek(scanner) === 91) {
    const start = ++scanner.pos;
    let namePos = start;
    let afterPos = start;
    let stack = 1;
    while (scanner.pos < scanner.text.length) {
      const code2 = peek(scanner);
      if (isTokenStart(code2)) {
        namePos = scanner.pos;
        while (isToken(peek(scanner))) {
          scanner.pos++;
        }
        afterPos = scanner.pos;
      } else {
        if (code2 === 91) {
          stack++;
        } else if (code2 === 93) {
          if (--stack === 0) {
            return {
              before: scanner.text.slice(start, namePos),
              after: scanner.text.slice(afterPos, scanner.pos++),
              name: scanner.text.slice(namePos, afterPos)
            };
          }
        }
        scanner.pos++;
      }
    }
  }
}
function peek(scanner, pos = scanner.pos) {
  return scanner.text.charCodeAt(pos);
}
function isTokenStart(code2) {
  return code2 >= 65 && code2 <= 90;
}
function isToken(code2) {
  return isTokenStart(code2) || code2 > 47 && code2 < 58 || code2 === 95 || code2 === 45;
}
function createCommentState(config2) {
  const { options } = config2;
  return {
    enabled: options["comment.enabled"],
    trigger: options["comment.trigger"],
    before: options["comment.before"] ? template(options["comment.before"]) : void 0,
    after: options["comment.after"] ? template(options["comment.after"]) : void 0
  };
}
function commentNodeBefore(node, state) {
  if (shouldComment(node, state) && state.comment.before) {
    output(node, state.comment.before, state);
  }
}
function commentNodeAfter(node, state) {
  if (shouldComment(node, state) && state.comment.after) {
    output(node, state.comment.after, state);
  }
}
function shouldComment(node, state) {
  const { comment } = state;
  if (!comment.enabled || !comment.trigger || !node.name || !node.attributes) {
    return false;
  }
  for (const attr of node.attributes) {
    if (attr.name && comment.trigger.includes(attr.name)) {
      return true;
    }
  }
  return false;
}
function output(node, tokens, state) {
  const attrs = {};
  const { out } = state;
  for (const attr of node.attributes) {
    if (attr.name && attr.value) {
      attrs[attr.name.toUpperCase()] = attr.value;
    }
  }
  for (const token2 of tokens) {
    if (typeof token2 === "string") {
      pushString(out, token2);
    } else if (attrs[token2.name]) {
      pushString(out, token2.before);
      pushTokens(attrs[token2.name], state);
      pushString(out, token2.after);
    }
  }
}
const htmlTagRegex = /^<([\w\-:]+)[\s>]/;
function html(abbr, config2) {
  const state = createWalkState(config2);
  state.comment = createCommentState(config2);
  walk$1(abbr, element, state);
  return state.out.value;
}
function element(node, index, items, state, next2) {
  const { out, config: config2 } = state;
  const format = shouldFormat(node, index, items, state);
  const level = getIndent(state);
  out.level += level;
  format && pushNewline(out, true);
  if (node.name) {
    const name = tagName(node.name, config2);
    commentNodeBefore(node, state);
    pushString(out, `<${name}`);
    if (node.attributes) {
      for (const attr of node.attributes) {
        if (shouldOutputAttribute(attr)) {
          pushAttribute(attr, state);
        }
      }
    }
    if (node.selfClosing && !node.children.length && !node.value) {
      pushString(out, `${selfClose(config2)}>`);
    } else {
      pushString(out, ">");
      if (!pushSnippet(node, state, next2)) {
        if (node.value) {
          const innerFormat = node.value.some(hasNewline) || startsWithBlockTag(node.value, config2);
          innerFormat && pushNewline(state.out, ++out.level);
          pushTokens(node.value, state);
          innerFormat && pushNewline(state.out, --out.level);
        }
        node.children.forEach(next2);
        if (!node.value && !node.children.length) {
          const innerFormat = config2.options["output.formatLeafNode"] || config2.options["output.formatForce"].includes(node.name);
          innerFormat && pushNewline(state.out, ++out.level);
          pushTokens(caret, state);
          innerFormat && pushNewline(state.out, --out.level);
        }
      }
      pushString(out, `</${name}>`);
      commentNodeAfter(node, state);
    }
  } else if (!pushSnippet(node, state, next2) && node.value) {
    pushTokens(node.value, state);
    node.children.forEach(next2);
  }
  if (format && index === items.length - 1 && state.parent) {
    const offset = isSnippet(state.parent) ? 0 : 1;
    pushNewline(out, out.level - offset);
  }
  out.level -= level;
}
function pushAttribute(attr, state) {
  const { out, config: config2 } = state;
  if (attr.name) {
    const name = attrName(attr.name, config2);
    const lQuote = attrQuote(attr, config2, true);
    const rQuote = attrQuote(attr, config2);
    let value = attr.value;
    if (isBooleanAttribute(attr, config2) && !value) {
      if (!config2.options["output.compactBoolean"]) {
        value = [name];
      }
    } else if (!value) {
      value = caret;
    }
    pushString(out, " " + name);
    if (value) {
      pushString(out, "=" + lQuote);
      pushTokens(value, state);
      pushString(out, rQuote);
    } else if (config2.options["output.selfClosingStyle"] !== "html") {
      pushString(out, "=" + lQuote + rQuote);
    }
  }
}
function pushSnippet(node, state, next2) {
  if (node.value && node.children.length) {
    const fieldIx = node.value.findIndex(isField);
    if (fieldIx !== -1) {
      pushTokens(node.value.slice(0, fieldIx), state);
      const line = state.out.line;
      let pos = fieldIx + 1;
      node.children.forEach(next2);
      if (state.out.line !== line && typeof node.value[pos] === "string") {
        pushString(state.out, node.value[pos++].trimLeft());
      }
      pushTokens(node.value.slice(pos), state);
      return true;
    }
  }
  return false;
}
function shouldFormat(node, index, items, state) {
  const { config: config2, parent } = state;
  if (!config2.options["output.format"]) {
    return false;
  }
  if (index === 0 && !parent) {
    return false;
  }
  if (parent && isSnippet(parent) && items.length === 1) {
    return false;
  }
  if (isSnippet(node)) {
    const format = isSnippet(items[index - 1]) || isSnippet(items[index + 1]) || node.value.some(hasNewline) || node.value.some(isField) && node.children.length;
    if (format) {
      return true;
    }
  }
  if (isInline(node, config2)) {
    if (index === 0) {
      for (let i = 0; i < items.length; i++) {
        if (!isInline(items[i], config2)) {
          return true;
        }
      }
    } else if (!isInline(items[index - 1], config2)) {
      return true;
    }
    if (config2.options["output.inlineBreak"]) {
      let adjacentInline = 1;
      let before = index;
      let after = index;
      while (isInlineElement(items[--before], config2)) {
        adjacentInline++;
      }
      while (isInlineElement(items[++after], config2)) {
        adjacentInline++;
      }
      if (adjacentInline >= config2.options["output.inlineBreak"]) {
        return true;
      }
    }
    for (let i = 0, il = node.children.length; i < il; i++) {
      if (shouldFormat(node.children[i], i, node.children, state)) {
        return true;
      }
    }
    return false;
  }
  return true;
}
function getIndent(state) {
  const { config: config2, parent } = state;
  if (!parent || isSnippet(parent) || parent.name && config2.options["output.formatSkip"].includes(parent.name)) {
    return 0;
  }
  return 1;
}
function hasNewline(value) {
  return typeof value === "string" && /\r|\n/.test(value);
}
function startsWithBlockTag(value, config2) {
  if (value.length && typeof value[0] === "string") {
    const matches = htmlTagRegex.exec(value[0]);
    if ((matches === null || matches === void 0 ? void 0 : matches.length) && !config2.options["inlineElements"].includes(matches[1].toLowerCase())) {
      return true;
    }
  }
  return false;
}
function indentFormat(abbr, config2, options) {
  const state = createWalkState(config2);
  state.options = options || {};
  walk$1(abbr, element$1, state);
  return state.out.value;
}
function element$1(node, index, items, state, next2) {
  const { out, options } = state;
  const { primary, secondary } = collectAttributes(node);
  const level = state.parent ? 1 : 0;
  out.level += level;
  if (shouldFormat$1(node, index, items, state)) {
    pushNewline(out, true);
  }
  if (node.name && (node.name !== "div" || !primary.length)) {
    pushString(out, (options.beforeName || "") + node.name + (options.afterName || ""));
  }
  pushPrimaryAttributes(primary, state);
  pushSecondaryAttributes(secondary.filter(shouldOutputAttribute), state);
  if (node.selfClosing && !node.value && !node.children.length) {
    if (state.options.selfClose) {
      pushString(out, state.options.selfClose);
    }
  } else {
    pushValue(node, state);
    node.children.forEach(next2);
  }
  out.level -= level;
}
function collectAttributes(node) {
  const primary = [];
  const secondary = [];
  if (node.attributes) {
    for (const attr of node.attributes) {
      if (isPrimaryAttribute(attr)) {
        primary.push(attr);
      } else {
        secondary.push(attr);
      }
    }
  }
  return { primary, secondary };
}
function pushPrimaryAttributes(attrs, state) {
  for (const attr of attrs) {
    if (attr.value) {
      if (attr.name === "class") {
        pushString(state.out, ".");
        const tokens = attr.value.map((t) => typeof t === "string" ? t.replace(/\s+/g, ".") : t);
        pushTokens(tokens, state);
      } else {
        pushString(state.out, "#");
        pushTokens(attr.value, state);
      }
    }
  }
}
function pushSecondaryAttributes(attrs, state) {
  if (attrs.length) {
    const { out, config: config2, options } = state;
    options.beforeAttribute && pushString(out, options.beforeAttribute);
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      pushString(out, attrName(attr.name || "", config2));
      if (isBooleanAttribute(attr, config2) && !attr.value) {
        if (!config2.options["output.compactBoolean"] && options.booleanValue) {
          pushString(out, "=" + options.booleanValue);
        }
      } else {
        pushString(out, "=" + attrQuote(attr, config2, true));
        pushTokens(attr.value || caret, state);
        pushString(out, attrQuote(attr, config2));
      }
      if (i !== attrs.length - 1 && options.glueAttribute) {
        pushString(out, options.glueAttribute);
      }
    }
    options.afterAttribute && pushString(out, options.afterAttribute);
  }
}
function pushValue(node, state) {
  if (!node.value && node.children.length) {
    return;
  }
  const value = node.value || caret;
  const lines = splitByLines$1(value);
  const { out, options } = state;
  if (lines.length === 1) {
    if (node.name || node.attributes) {
      push(out, " ");
    }
    pushTokens(value, state);
  } else {
    const lineLengths = [];
    let maxLength = 0;
    for (const line of lines) {
      const len = valueLength(line);
      lineLengths.push(len);
      if (len > maxLength) {
        maxLength = len;
      }
    }
    out.level++;
    for (let i = 0; i < lines.length; i++) {
      pushNewline(out, true);
      options.beforeTextLine && push(out, options.beforeTextLine);
      pushTokens(lines[i], state);
      if (options.afterTextLine) {
        push(out, " ".repeat(maxLength - lineLengths[i]));
        push(out, options.afterTextLine);
      }
    }
    out.level--;
  }
}
function isPrimaryAttribute(attr) {
  return attr.name === "class" || attr.name === "id";
}
function valueLength(tokens) {
  let len = 0;
  for (const token2 of tokens) {
    len += typeof token2 === "string" ? token2.length : token2.name.length;
  }
  return len;
}
function shouldFormat$1(node, index, items, state) {
  if (!state.parent && index === 0) {
    return false;
  }
  return !isSnippet(node);
}
function haml(abbr, config2) {
  return indentFormat(abbr, config2, {
    beforeName: "%",
    beforeAttribute: "(",
    afterAttribute: ")",
    glueAttribute: " ",
    afterTextLine: " |",
    booleanValue: "true",
    selfClose: "/"
  });
}
function slim(abbr, config2) {
  return indentFormat(abbr, config2, {
    beforeAttribute: " ",
    glueAttribute: " ",
    beforeTextLine: "| ",
    selfClose: "/"
  });
}
function pug(abbr, config2) {
  return indentFormat(abbr, config2, {
    beforeAttribute: "(",
    afterAttribute: ")",
    glueAttribute: ", ",
    beforeTextLine: "| ",
    selfClose: config2.options["output.selfClosingStyle"] === "xml" ? "/" : ""
  });
}
const formatters = { html, haml, slim, pug };
function parse$1(abbr, config2) {
  let oldTextValue;
  if (typeof abbr === "string") {
    let parseOpt = config2;
    if (config2.options["jsx.enabled"]) {
      parseOpt = Object.assign(Object.assign({}, parseOpt), { jsx: true });
    }
    if (config2.options["markup.href"]) {
      parseOpt = Object.assign(Object.assign({}, parseOpt), { href: true });
    }
    abbr = parseAbbreviation(abbr, parseOpt);
    oldTextValue = config2.text;
    config2.text = void 0;
  }
  abbr = resolveSnippets(abbr, config2);
  walk(abbr, transform, config2);
  config2.text = oldTextValue !== null && oldTextValue !== void 0 ? oldTextValue : config2.text;
  return abbr;
}
function stringify(abbr, config2) {
  const formatter = formatters[config2.syntax] || html;
  return formatter(abbr, config2);
}
function transform(node, ancestors, config2) {
  implicitTag(node, ancestors, config2);
  mergeAttributes(node, config2);
  lorem(node, ancestors, config2);
  if (config2.syntax === "xsl") {
    xsl(node);
  }
  if (config2.options["jsx.enabled"]) {
    jsx(node);
  }
  if (config2.options["bem.enabled"]) {
    bem(node, ancestors, config2);
  }
}
const reProperty = /^([a-z-]+)(?:\s*:\s*([^\n\r;]+?);*)?$/;
const opt = { value: true };
function createSnippet(key, value) {
  const m = value.match(reProperty);
  if (m) {
    const keywords = {};
    const parsed = m[2] ? m[2].split("|").map(parseValue) : [];
    for (const item of parsed) {
      for (const cssVal of item) {
        collectKeywords(cssVal, keywords);
      }
    }
    return {
      type: "Property",
      key,
      property: m[1],
      value: parsed,
      keywords,
      dependencies: []
    };
  }
  return { type: "Raw", key, value };
}
function nest(snippets) {
  snippets = snippets.slice().sort(snippetsSort);
  const stack = [];
  let prev2;
  for (const cur2 of snippets.filter(isProperty)) {
    while (stack.length) {
      prev2 = stack[stack.length - 1];
      if (cur2.property.startsWith(prev2.property) && cur2.property.charCodeAt(prev2.property.length) === 45) {
        prev2.dependencies.push(cur2);
        stack.push(cur2);
        break;
      }
      stack.pop();
    }
    if (!stack.length) {
      stack.push(cur2);
    }
  }
  return snippets;
}
function snippetsSort(a, b) {
  if (a.key === b.key) {
    return 0;
  }
  return a.key < b.key ? -1 : 1;
}
function parseValue(value) {
  return parse$2(value.trim(), opt)[0].value;
}
function isProperty(snippet2) {
  return snippet2.type === "Property";
}
function collectKeywords(cssVal, dest) {
  for (const v of cssVal.value) {
    if (v.type === "Literal") {
      dest[v.value] = v;
    } else if (v.type === "FunctionCall") {
      dest[v.name] = v;
    } else if (v.type === "Field") {
      const value = v.name.trim();
      if (value) {
        dest[value] = { type: "Literal", value };
      }
    }
  }
}
function scoreMatch(str1, str2, partialMatch = false) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  if (str1 === str2) {
    return 1;
  }
  if (!str1 || !str2 || str1.charCodeAt(0) !== str2.charCodeAt(0)) {
    return 0;
  }
  const str1Len = str1.length;
  const str2Len = str2.length;
  if (!partialMatch && str1Len > str2Len) {
    return 0;
  }
  const minLength = Math.min(str1Len, str2Len);
  const maxLength = Math.max(str1Len, str2Len);
  let i = 1;
  let j = 1;
  let score = maxLength;
  let ch1 = 0;
  let ch2 = 0;
  let found = false;
  let acronym = false;
  while (i < str1Len) {
    ch1 = str1.charCodeAt(i);
    found = false;
    acronym = false;
    while (j < str2Len) {
      ch2 = str2.charCodeAt(j);
      if (ch1 === ch2) {
        found = true;
        score += maxLength - (acronym ? i : j);
        break;
      }
      acronym = ch2 === 45;
      j++;
    }
    if (!found) {
      if (!partialMatch) {
        return 0;
      }
      break;
    }
    i++;
  }
  const matchRatio = i / maxLength;
  const delta = maxLength - minLength;
  const maxScore = sum(maxLength) - sum(delta);
  return score * matchRatio / maxScore;
}
function sum(n) {
  return n * (n + 1) / 2;
}
function color(token2, shortHex) {
  if (!token2.r && !token2.g && !token2.b && !token2.a) {
    return "transparent";
  } else if (token2.a === 1) {
    return asHex(token2, shortHex);
  }
  return asRGB(token2);
}
function asHex(token2, short) {
  const fn = short && isShortHex(token2.r) && isShortHex(token2.g) && isShortHex(token2.b) ? toShortHex : toHex;
  return "#" + fn(token2.r) + fn(token2.g) + fn(token2.b);
}
function asRGB(token2) {
  const values = [token2.r, token2.g, token2.b];
  if (token2.a !== 1) {
    values.push(frac(token2.a, 8));
  }
  return `${values.length === 3 ? "rgb" : "rgba"}(${values.join(", ")})`;
}
function frac(num, digits = 4) {
  return num.toFixed(digits).replace(/\.?0+$/, "");
}
function isShortHex(hex) {
  return !(hex % 17);
}
function toShortHex(num) {
  return (num >> 4).toString(16);
}
function toHex(num) {
  return pad(num.toString(16), 2);
}
function pad(value, len) {
  while (value.length < len) {
    value = "0" + value;
  }
  return value;
}
function css(abbr, config2) {
  var _a;
  const out = createOutputStream(config2.options);
  const format = config2.options["output.format"];
  if (((_a = config2.context) === null || _a === void 0 ? void 0 : _a.name) === "@@section") {
    abbr = abbr.filter((node) => node.snippet);
  }
  for (let i = 0; i < abbr.length; i++) {
    if (format && i !== 0) {
      pushNewline(out, true);
    }
    property(abbr[i], out, config2);
  }
  return out.value;
}
function property(node, out, config2) {
  const isJSON = config2.options["stylesheet.json"];
  if (node.name) {
    const name = isJSON ? toCamelCase(node.name) : node.name;
    pushString(out, name + config2.options["stylesheet.between"]);
    if (node.value.length) {
      propertyValue(node, out, config2);
    } else {
      pushField(out, 0, "");
    }
    if (isJSON) {
      push(out, ",");
    } else {
      outputImportant(node, out, true);
      push(out, config2.options["stylesheet.after"]);
    }
  } else {
    for (const cssVal of node.value) {
      for (const v of cssVal.value) {
        outputToken(v, out, config2);
      }
    }
    outputImportant(node, out, node.value.length > 0);
  }
}
function propertyValue(node, out, config2) {
  const isJSON = config2.options["stylesheet.json"];
  const num = isJSON ? getSingleNumeric(node) : null;
  if (num && (!num.unit || num.unit === "px")) {
    push(out, String(num.value));
  } else {
    const quote2 = getQuote(config2);
    isJSON && push(out, quote2);
    for (let i = 0; i < node.value.length; i++) {
      if (i !== 0) {
        push(out, ", ");
      }
      outputValue(node.value[i], out, config2);
    }
    isJSON && push(out, quote2);
  }
}
function outputImportant(node, out, separator) {
  if (node.important) {
    if (separator) {
      push(out, " ");
    }
    push(out, "!important");
  }
}
function outputValue(value, out, config2) {
  for (let i = 0, prevEnd = -1; i < value.value.length; i++) {
    const token2 = value.value[i];
    if (i !== 0 && (token2.type !== "Field" || token2.start !== prevEnd)) {
      push(out, " ");
    }
    outputToken(token2, out, config2);
    prevEnd = token2["end"];
  }
}
function outputToken(token2, out, config2) {
  if (token2.type === "ColorValue") {
    push(out, color(token2, config2.options["stylesheet.shortHex"]));
  } else if (token2.type === "Literal") {
    pushString(out, token2.value);
  } else if (token2.type === "NumberValue") {
    pushString(out, frac(token2.value, 4) + token2.unit);
  } else if (token2.type === "StringValue") {
    const quote2 = token2.quote === "double" ? '"' : "'";
    pushString(out, quote2 + token2.value + quote2);
  } else if (token2.type === "Field") {
    pushField(out, token2.index, token2.name);
  } else if (token2.type === "FunctionCall") {
    push(out, token2.name + "(");
    for (let i = 0; i < token2.arguments.length; i++) {
      if (i) {
        push(out, ", ");
      }
      outputValue(token2.arguments[i], out, config2);
    }
    push(out, ")");
  }
}
function getSingleNumeric(node) {
  if (node.value.length === 1) {
    const cssVal = node.value[0];
    if (cssVal.value.length === 1 && cssVal.value[0].type === "NumberValue") {
      return cssVal.value[0];
    }
  }
}
function toCamelCase(str) {
  return str.replace(/\-(\w)/g, (_, letter) => letter.toUpperCase());
}
function getQuote(config2) {
  return config2.options["stylesheet.jsonDoubleQuotes"] ? '"' : "'";
}
const gradientName = "lg";
function parse$1$1(abbr, config2) {
  var _a;
  const snippets = ((_a = config2.cache) === null || _a === void 0 ? void 0 : _a.stylesheetSnippets) || convertSnippets(config2.snippets);
  if (config2.cache) {
    config2.cache.stylesheetSnippets = snippets;
  }
  if (typeof abbr === "string") {
    abbr = parse$2(abbr, { value: isValueScope(config2) });
  }
  const filteredSnippets = getSnippetsForScope(snippets, config2);
  for (const node of abbr) {
    resolveNode(node, filteredSnippets, config2);
  }
  return abbr;
}
function convertSnippets(snippets) {
  const result = [];
  for (const key of Object.keys(snippets)) {
    result.push(createSnippet(key, snippets[key]));
  }
  return nest(result);
}
function resolveNode(node, snippets, config2) {
  if (!resolveGradient(node, config2)) {
    const score = config2.options["stylesheet.fuzzySearchMinScore"];
    if (isValueScope(config2)) {
      const propName = config2.context.name;
      const snippet2 = snippets.find((s) => s.type === "Property" && s.property === propName);
      resolveValueKeywords(node, config2, snippet2, score);
      node.snippet = snippet2;
    } else if (node.name) {
      const snippet2 = findBestMatch(node.name, snippets, score, true);
      node.snippet = snippet2;
      if (snippet2) {
        if (snippet2.type === "Property") {
          resolveAsProperty(node, snippet2, config2);
        } else {
          resolveAsSnippet(node, snippet2);
        }
      }
    }
  }
  if (node.name || config2.context) {
    resolveNumericValue(node, config2);
  }
  return node;
}
function resolveGradient(node, config2) {
  let gradientFn = null;
  const cssVal = node.value.length === 1 ? node.value[0] : null;
  if (cssVal && cssVal.value.length === 1) {
    const v = cssVal.value[0];
    if (v.type === "FunctionCall" && v.name === gradientName) {
      gradientFn = v;
    }
  }
  if (gradientFn || node.name === gradientName) {
    if (!gradientFn) {
      gradientFn = {
        type: "FunctionCall",
        name: "linear-gradient",
        arguments: [cssValue(field$1(0, ""))]
      };
    } else {
      gradientFn = Object.assign(Object.assign({}, gradientFn), { name: "linear-gradient" });
    }
    if (!config2.context) {
      node.name = "background-image";
    }
    node.value = [cssValue(gradientFn)];
    return true;
  }
  return false;
}
function resolveAsProperty(node, snippet2, config2) {
  const abbr = node.name;
  const inlineValue = getUnmatchedPart(abbr, snippet2.key);
  if (inlineValue) {
    if (node.value.length) {
      return node;
    }
    const kw = resolveKeyword(inlineValue, config2, snippet2);
    if (!kw) {
      return node;
    }
    node.value.push(cssValue(kw));
  }
  node.name = snippet2.property;
  if (node.value.length) {
    resolveValueKeywords(node, config2, snippet2);
  } else if (snippet2.value.length) {
    const defaultValue = snippet2.value[0];
    node.value = snippet2.value.length === 1 || defaultValue.some(hasField) ? defaultValue : defaultValue.map((n) => wrapWithField(n, config2));
  }
  return node;
}
function resolveValueKeywords(node, config2, snippet2, minScore) {
  for (const cssVal of node.value) {
    const value = [];
    for (const token2 of cssVal.value) {
      if (token2.type === "Literal") {
        value.push(resolveKeyword(token2.value, config2, snippet2, minScore) || token2);
      } else if (token2.type === "FunctionCall") {
        const match = resolveKeyword(token2.name, config2, snippet2, minScore);
        if (match && match.type === "FunctionCall") {
          value.push(Object.assign(Object.assign({}, match), { arguments: token2.arguments.concat(match.arguments.slice(token2.arguments.length)) }));
        } else {
          value.push(token2);
        }
      } else {
        value.push(token2);
      }
    }
    cssVal.value = value;
  }
}
function resolveAsSnippet(node, snippet2) {
  let offset = 0;
  let m;
  const reField = /\$\{(\d+)(:[^}]+)?\}/g;
  const inputValue = node.value[0];
  const outputValue2 = [];
  while (m = reField.exec(snippet2.value)) {
    if (offset !== m.index) {
      outputValue2.push(literal(snippet2.value.slice(offset, m.index)));
    }
    offset = m.index + m[0].length;
    if (inputValue && inputValue.value.length) {
      outputValue2.push(inputValue.value.shift());
    } else {
      outputValue2.push(field$1(Number(m[1]), m[2] ? m[2].slice(1) : ""));
    }
  }
  const tail = snippet2.value.slice(offset);
  if (tail) {
    outputValue2.push(literal(tail));
  }
  node.name = void 0;
  node.value = [cssValue(...outputValue2)];
  return node;
}
function findBestMatch(abbr, items, minScore = 0, partialMatch = false) {
  let matchedItem = null;
  let maxScore = 0;
  for (const item of items) {
    const score = scoreMatch(abbr, getScoringPart(item), partialMatch);
    if (score === 1) {
      return item;
    }
    if (score && score >= maxScore) {
      maxScore = score;
      matchedItem = item;
    }
  }
  return maxScore >= minScore ? matchedItem : null;
}
function getScoringPart(item) {
  return typeof item === "string" ? item : item.key;
}
function getUnmatchedPart(abbr, str) {
  for (let i = 0, lastPos = 0; i < abbr.length; i++) {
    lastPos = str.indexOf(abbr[i], lastPos);
    if (lastPos === -1) {
      return abbr.slice(i);
    }
    lastPos++;
  }
  return "";
}
function resolveKeyword(kw, config2, snippet2, minScore) {
  let ref;
  if (snippet2) {
    if (ref = findBestMatch(kw, Object.keys(snippet2.keywords), minScore)) {
      return snippet2.keywords[ref];
    }
    for (const dep of snippet2.dependencies) {
      if (ref = findBestMatch(kw, Object.keys(dep.keywords), minScore)) {
        return dep.keywords[ref];
      }
    }
  }
  if (ref = findBestMatch(kw, config2.options["stylesheet.keywords"], minScore)) {
    return literal(ref);
  }
  return null;
}
function resolveNumericValue(node, config2) {
  const aliases = config2.options["stylesheet.unitAliases"];
  const unitless = config2.options["stylesheet.unitless"];
  for (const v of node.value) {
    for (const t of v.value) {
      if (t.type === "NumberValue") {
        if (t.unit) {
          t.unit = aliases[t.unit] || t.unit;
        } else if (t.value !== 0 && !unitless.includes(node.name)) {
          t.unit = t.rawValue.includes(".") ? config2.options["stylesheet.floatUnit"] : config2.options["stylesheet.intUnit"];
        }
      }
    }
  }
}
function cssValue(...args) {
  return {
    type: "CSSValue",
    value: args
  };
}
function literal(value) {
  return { type: "Literal", value };
}
function field$1(index, name) {
  return { type: "Field", index, name };
}
function hasField(value) {
  for (const v of value.value) {
    if (v.type === "Field" || v.type === "FunctionCall" && v.arguments.some(hasField)) {
      return true;
    }
  }
  return false;
}
function wrapWithField(node, config2, state = { index: 1 }) {
  let value = [];
  for (const v of node.value) {
    switch (v.type) {
      case "ColorValue":
        value.push(field$1(state.index++, color(v, config2.options["stylesheet.shortHex"])));
        break;
      case "Literal":
        value.push(field$1(state.index++, v.value));
        break;
      case "NumberValue":
        value.push(field$1(state.index++, `${v.value}${v.unit}`));
        break;
      case "StringValue":
        const q = v.quote === "single" ? "'" : '"';
        value.push(field$1(state.index++, q + v.value + q));
        break;
      case "FunctionCall":
        value.push(field$1(state.index++, v.name), literal("("));
        for (let i = 0, il = v.arguments.length; i < il; i++) {
          value = value.concat(wrapWithField(v.arguments[i], config2, state).value);
          if (i !== il - 1) {
            value.push(literal(", "));
          }
        }
        value.push(literal(")"));
        break;
      default:
        value.push(v);
    }
  }
  return Object.assign(Object.assign({}, node), { value });
}
function isValueScope(config2) {
  if (config2.context) {
    return config2.context.name === "@@value" || !config2.context.name.startsWith("@@");
  }
  return false;
}
function getSnippetsForScope(snippets, config2) {
  if (config2.context) {
    if (config2.context.name === "@@section") {
      return snippets.filter((s) => s.type === "Raw");
    }
    if (config2.context.name === "@@property") {
      return snippets.filter((s) => s.type === "Property");
    }
  }
  return snippets;
}
var markupSnippets = {
  "a": "a[href]",
  "a:blank": "a[href='http://${0}' target='_blank' rel='noopener noreferrer']",
  "a:link": "a[href='http://${0}']",
  "a:mail": "a[href='mailto:${0}']",
  "a:tel": "a[href='tel:+${0}']",
  "abbr": "abbr[title]",
  "acr|acronym": "acronym[title]",
  "base": "base[href]/",
  "basefont": "basefont/",
  "br": "br/",
  "frame": "frame/",
  "hr": "hr/",
  "bdo": "bdo[dir]",
  "bdo:r": "bdo[dir=rtl]",
  "bdo:l": "bdo[dir=ltr]",
  "col": "col/",
  "link": "link[rel=stylesheet href]/",
  "link:css": "link[href='${1:style}.css']",
  "link:print": "link[href='${1:print}.css' media=print]",
  "link:favicon": "link[rel='shortcut icon' type=image/x-icon href='${1:favicon.ico}']",
  "link:mf|link:manifest": "link[rel='manifest' href='${1:manifest.json}']",
  "link:touch": "link[rel=apple-touch-icon href='${1:favicon.png}']",
  "link:rss": "link[rel=alternate type=application/rss+xml title=RSS href='${1:rss.xml}']",
  "link:atom": "link[rel=alternate type=application/atom+xml title=Atom href='${1:atom.xml}']",
  "link:im|link:import": "link[rel=import href='${1:component}.html']",
  "meta": "meta/",
  "meta:utf": "meta[http-equiv=Content-Type content='text/html;charset=UTF-8']",
  "meta:vp": "meta[name=viewport content='width=${1:device-width}, initial-scale=${2:1.0}']",
  "meta:compat": "meta[http-equiv=X-UA-Compatible content='${1:IE=7}']",
  "meta:edge": "meta:compat[content='${1:ie=edge}']",
  "meta:redirect": "meta[http-equiv=refresh content='0; url=${1:http://example.com}']",
  "meta:kw": "meta[name=keywords content]",
  "meta:desc": "meta[name=description content]",
  "style": "style",
  "script": "script",
  "script:src": "script[src]",
  "img": "img[src alt]/",
  "img:s|img:srcset": "img[srcset src alt]",
  "img:z|img:sizes": "img[sizes srcset src alt]",
  "picture": "picture",
  "src|source": "source/",
  "src:sc|source:src": "source[src type]",
  "src:s|source:srcset": "source[srcset]",
  "src:t|source:type": "source[srcset type='${1:image/}']",
  "src:z|source:sizes": "source[sizes srcset]",
  "src:m|source:media": "source[media='(${1:min-width: })' srcset]",
  "src:mt|source:media:type": "source:media[type='${2:image/}']",
  "src:mz|source:media:sizes": "source:media[sizes srcset]",
  "src:zt|source:sizes:type": "source[sizes srcset type='${1:image/}']",
  "iframe": "iframe[src frameborder=0]",
  "embed": "embed[src type]/",
  "object": "object[data type]",
  "param": "param[name value]/",
  "map": "map[name]",
  "area": "area[shape coords href alt]/",
  "area:d": "area[shape=default]",
  "area:c": "area[shape=circle]",
  "area:r": "area[shape=rect]",
  "area:p": "area[shape=poly]",
  "form": "form[action]",
  "form:get": "form[method=get]",
  "form:post": "form[method=post]",
  "label": "label[for]",
  "input": "input[type=${1:text}]/",
  "inp": "input[name=${1} id=${1}]",
  "input:h|input:hidden": "input[type=hidden name]",
  "input:t|input:text": "inp[type=text]",
  "input:search": "inp[type=search]",
  "input:email": "inp[type=email]",
  "input:url": "inp[type=url]",
  "input:p|input:password": "inp[type=password]",
  "input:datetime": "inp[type=datetime]",
  "input:date": "inp[type=date]",
  "input:datetime-local": "inp[type=datetime-local]",
  "input:month": "inp[type=month]",
  "input:week": "inp[type=week]",
  "input:time": "inp[type=time]",
  "input:tel": "inp[type=tel]",
  "input:number": "inp[type=number]",
  "input:color": "inp[type=color]",
  "input:c|input:checkbox": "inp[type=checkbox]",
  "input:r|input:radio": "inp[type=radio]",
  "input:range": "inp[type=range]",
  "input:f|input:file": "inp[type=file]",
  "input:s|input:submit": "input[type=submit value]",
  "input:i|input:image": "input[type=image src alt]",
  "input:b|input:btn|input:button": "input[type=button value]",
  "input:reset": "input:button[type=reset]",
  "isindex": "isindex/",
  "select": "select[name=${1} id=${1}]",
  "select:d|select:disabled": "select[disabled.]",
  "opt|option": "option[value]",
  "textarea": "textarea[name=${1} id=${1} cols=${2:30} rows=${3:10}]",
  "marquee": "marquee[behavior direction]",
  "menu:c|menu:context": "menu[type=context]",
  "menu:t|menu:toolbar": "menu[type=toolbar]",
  "video": "video[src]",
  "audio": "audio[src]",
  "html:xml": "html[xmlns=http://www.w3.org/1999/xhtml]",
  "keygen": "keygen/",
  "command": "command/",
  "btn:s|button:s|button:submit": "button[type=submit]",
  "btn:r|button:r|button:reset": "button[type=reset]",
  "btn:d|button:d|button:disabled": "button[disabled.]",
  "fst:d|fset:d|fieldset:d|fieldset:disabled": "fieldset[disabled.]",
  "bq": "blockquote",
  "fig": "figure",
  "figc": "figcaption",
  "pic": "picture",
  "ifr": "iframe",
  "emb": "embed",
  "obj": "object",
  "cap": "caption",
  "colg": "colgroup",
  "fst": "fieldset",
  "btn": "button",
  "optg": "optgroup",
  "tarea": "textarea",
  "leg": "legend",
  "sect": "section",
  "art": "article",
  "hdr": "header",
  "ftr": "footer",
  "adr": "address",
  "dlg": "dialog",
  "str": "strong",
  "prog": "progress",
  "mn": "main",
  "tem": "template",
  "fset": "fieldset",
  "datag": "datagrid",
  "datal": "datalist",
  "kg": "keygen",
  "out": "output",
  "det": "details",
  "sum": "summary",
  "cmd": "command",
  "ri:d|ri:dpr": "img:s",
  "ri:v|ri:viewport": "img:z",
  "ri:a|ri:art": "pic>src:m+img",
  "ri:t|ri:type": "pic>src:t+img",
  "!!!": "{<!DOCTYPE html>}",
  "doc": "html[lang=${lang}]>(head>meta[charset=${charset}]+meta[http-equiv='X-UA-Compatible'][content='IE=edge']+meta:vp+title{${1:Document}})+body",
  "!|html:5": "!!!+doc",
  "c": "{<!-- ${0} -->}",
  "cc:ie": "{<!--[if IE]>${0}<![endif]-->}",
  "cc:noie": "{<!--[if !IE]><!-->${0}<!--<![endif]-->}"
};
var stylesheetSnippets = {
  "@f": "@font-face {\n	font-family: ${1};\n	src: url(${2});\n}",
  "@ff": "@font-face {\n	font-family: '${1:FontName}';\n	src: url('${2:FileName}.eot');\n	src: url('${2:FileName}.eot?#iefix') format('embedded-opentype'),\n		 url('${2:FileName}.woff') format('woff'),\n		 url('${2:FileName}.ttf') format('truetype'),\n		 url('${2:FileName}.svg#${1:FontName}') format('svg');\n	font-style: ${3:normal};\n	font-weight: ${4:normal};\n}",
  "@i|@import": "@import url(${0});",
  "@kf": "@keyframes ${1:identifier} {\n	${2}\n}",
  "@m|@media": "@media ${1:screen} {\n	${0}\n}",
  "ac": "align-content:start|end|flex-start|flex-end|center|space-between|space-around|stretch|space-evenly",
  "ai": "align-items:start|end|flex-start|flex-end|center|baseline|stretch",
  "anim": "animation:${1:name} ${2:duration} ${3:timing-function} ${4:delay} ${5:iteration-count} ${6:direction} ${7:fill-mode}",
  "animdel": "animation-delay:time",
  "animdir": "animation-direction:normal|reverse|alternate|alternate-reverse",
  "animdur": "animation-duration:${1:0}s",
  "animfm": "animation-fill-mode:both|forwards|backwards",
  "animic": "animation-iteration-count:1|infinite",
  "animn": "animation-name",
  "animps": "animation-play-state:running|paused",
  "animtf": "animation-timing-function:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier(${1:0.1}, ${2:0.7}, ${3:1.0}, ${3:0.1})",
  "ap": "appearance:none",
  "as": "align-self:start|end|auto|flex-start|flex-end|center|baseline|stretch",
  "b": "bottom",
  "bd": "border:${1:1px} ${2:solid} ${3:#000}",
  "bdb": "border-bottom:${1:1px} ${2:solid} ${3:#000}",
  "bdbc": "border-bottom-color:${1:#000}",
  "bdbi": "border-bottom-image:url(${0})",
  "bdbk": "border-break:close",
  "bdbli": "border-bottom-left-image:url(${0})|continue",
  "bdblrs": "border-bottom-left-radius",
  "bdbri": "border-bottom-right-image:url(${0})|continue",
  "bdbrrs": "border-bottom-right-radius",
  "bdbs": "border-bottom-style",
  "bdbw": "border-bottom-width",
  "bdc": "border-color:${1:#000}",
  "bdci": "border-corner-image:url(${0})|continue",
  "bdcl": "border-collapse:collapse|separate",
  "bdf": "border-fit:repeat|clip|scale|stretch|overwrite|overflow|space",
  "bdi": "border-image:url(${0})",
  "bdl": "border-left:${1:1px} ${2:solid} ${3:#000}",
  "bdlc": "border-left-color:${1:#000}",
  "bdlen": "border-length",
  "bdli": "border-left-image:url(${0})",
  "bdls": "border-left-style",
  "bdlw": "border-left-width",
  "bdr": "border-right:${1:1px} ${2:solid} ${3:#000}",
  "bdrc": "border-right-color:${1:#000}",
  "bdri": "border-right-image:url(${0})",
  "bdrs": "border-radius",
  "bdrst": "border-right-style",
  "bdrw": "border-right-width",
  "bds": "border-style:none|hidden|dotted|dashed|solid|double|dot-dash|dot-dot-dash|wave|groove|ridge|inset|outset",
  "bdsp": "border-spacing",
  "bdt": "border-top:${1:1px} ${2:solid} ${3:#000}",
  "bdtc": "border-top-color:${1:#000}",
  "bdti": "border-top-image:url(${0})",
  "bdtli": "border-top-left-image:url(${0})|continue",
  "bdtlrs": "border-top-left-radius",
  "bdtri": "border-top-right-image:url(${0})|continue",
  "bdtrrs": "border-top-right-radius",
  "bdts": "border-top-style",
  "bdtw": "border-top-width",
  "bdw": "border-width",
  "bfv": "backface-visibility:hidden|visible",
  "bg": "background:${1:#000}",
  "bga": "background-attachment:fixed|scroll",
  "bgbk": "background-break:bounding-box|each-box|continuous",
  "bgc": "background-color:#${1:fff}",
  "bgcp": "background-clip:padding-box|border-box|content-box|no-clip",
  "bgi": "background-image:url(${0})",
  "bgo": "background-origin:padding-box|border-box|content-box",
  "bgp": "background-position:${1:0} ${2:0}",
  "bgpx": "background-position-x",
  "bgpy": "background-position-y",
  "bgr": "background-repeat:no-repeat|repeat-x|repeat-y|space|round",
  "bgsz": "background-size:contain|cover",
  "bxsh": "box-shadow:${1:inset }${2:hoff} ${3:voff} ${4:blur} ${5:#000}|none",
  "bxsz": "box-sizing:border-box|content-box|border-box",
  "c": "color:${1:#000}",
  "cr": "color:rgb(${1:0}, ${2:0}, ${3:0})",
  "cra": "color:rgba(${1:0}, ${2:0}, ${3:0}, ${4:.5})",
  "cl": "clear:both|left|right|none",
  "cm": "/* ${0} */",
  "cnt": "content:'${0}'|normal|open-quote|no-open-quote|close-quote|no-close-quote|attr(${0})|counter(${0})|counters(${0})",
  "coi": "counter-increment",
  "colm": "columns",
  "colmc": "column-count",
  "colmf": "column-fill",
  "colmg": "column-gap",
  "colmr": "column-rule",
  "colmrc": "column-rule-color",
  "colmrs": "column-rule-style",
  "colmrw": "column-rule-width",
  "colms": "column-span",
  "colmw": "column-width",
  "cor": "counter-reset",
  "cp": "clip:auto|rect(${1:top} ${2:right} ${3:bottom} ${4:left})",
  "cps": "caption-side:top|bottom",
  "cur": "cursor:pointer|auto|default|crosshair|hand|help|move|pointer|text",
  "d": "display:block|none|flex|inline-flex|inline|inline-block|grid|inline-grid|subgrid|list-item|run-in|compact|table|inline-table|table-caption|table-column|table-column-group|table-header-group|table-footer-group|table-row|table-row-group|table-cell|ruby|ruby-base|ruby-base-group|ruby-text|ruby-text-group",
  "ec": "empty-cells:show|hide",
  "f": "font:${1:1em} ${2:sans-serif}",
  "fd": "font-display:auto|block|swap|fallback|optional",
  "fef": "font-effect:none|engrave|emboss|outline",
  "fem": "font-emphasize",
  "femp": "font-emphasize-position:before|after",
  "fems": "font-emphasize-style:none|accent|dot|circle|disc",
  "ff": "font-family:serif|sans-serif|cursive|fantasy|monospace",
  "fft": 'font-family:"Times New Roman", Times, Baskerville, Georgia, serif',
  "ffa": 'font-family:Arial, "Helvetica Neue", Helvetica, sans-serif',
  "ffv": "font-family:Verdana, Geneva, sans-serif",
  "fl": "float:left|right|none",
  "fs": "font-style:italic|normal|oblique",
  "fsm": "font-smoothing:antialiased|subpixel-antialiased|none",
  "fst": "font-stretch:normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
  "fv": "font-variant:normal|small-caps",
  "fvs": "font-variation-settings:normal|inherit|initial|unset",
  "fw": "font-weight:normal|bold|bolder|lighter",
  "fx": "flex",
  "fxb": "flex-basis:fill|max-content|min-content|fit-content|content",
  "fxd": "flex-direction:row|row-reverse|column|column-reverse",
  "fxf": "flex-flow",
  "fxg": "flex-grow",
  "fxsh": "flex-shrink",
  "fxw": "flex-wrap:nowrap|wrap|wrap-reverse",
  "fsz": "font-size",
  "fsza": "font-size-adjust",
  "gtc": "grid-template-columns:repeat(${0})|minmax()",
  "gtr": "grid-template-rows:repeat(${0})|minmax()",
  "gta": "grid-template-areas",
  "gt": "grid-template",
  "gg": "grid-gap",
  "gcg": "grid-column-gap",
  "grg": "grid-row-gap",
  "gac": "grid-auto-columns:auto|minmax()",
  "gar": "grid-auto-rows:auto|minmax()",
  "gaf": "grid-auto-flow:row|column|dense|inherit|initial|unset",
  "gd": "grid",
  "gc": "grid-column",
  "gcs": "grid-column-start",
  "gce": "grid-column-end",
  "gr": "grid-row",
  "grs": "grid-row-start",
  "gre": "grid-row-end",
  "ga": "grid-area",
  "h": "height",
  "jc": "justify-content:start|end|stretch|flex-start|flex-end|center|space-between|space-around|space-evenly",
  "ji": "justify-items:start|end|center|stretch",
  "js": "justify-self:start|end|center|stretch",
  "l": "left",
  "lg": "background-image:linear-gradient(${1})",
  "lh": "line-height",
  "lis": "list-style",
  "lisi": "list-style-image",
  "lisp": "list-style-position:inside|outside",
  "list": "list-style-type:disc|circle|square|decimal|decimal-leading-zero|lower-roman|upper-roman",
  "lts": "letter-spacing:normal",
  "m": "margin",
  "mah": "max-height",
  "mar": "max-resolution",
  "maw": "max-width",
  "mb": "margin-bottom",
  "mih": "min-height",
  "mir": "min-resolution",
  "miw": "min-width",
  "ml": "margin-left",
  "mr": "margin-right",
  "mt": "margin-top",
  "ol": "outline",
  "olc": "outline-color:${1:#000}|invert",
  "olo": "outline-offset",
  "ols": "outline-style:none|dotted|dashed|solid|double|groove|ridge|inset|outset",
  "olw": "outline-width|thin|medium|thick",
  "op|opa": "opacity",
  "ord": "order",
  "ori": "orientation:landscape|portrait",
  "orp": "orphans",
  "ov": "overflow:hidden|visible|hidden|scroll|auto",
  "ovs": "overflow-style:scrollbar|auto|scrollbar|panner|move|marquee",
  "ovx": "overflow-x:hidden|visible|hidden|scroll|auto",
  "ovy": "overflow-y:hidden|visible|hidden|scroll|auto",
  "p": "padding",
  "pb": "padding-bottom",
  "pgba": "page-break-after:auto|always|left|right",
  "pgbb": "page-break-before:auto|always|left|right",
  "pgbi": "page-break-inside:auto|avoid",
  "pl": "padding-left",
  "pos": "position:relative|absolute|relative|fixed|static",
  "pr": "padding-right",
  "pt": "padding-top",
  "q": "quotes",
  "qen": "quotes:'\\201C' '\\201D' '\\2018' '\\2019'",
  "qru": "quotes:'\\00AB' '\\00BB' '\\201E' '\\201C'",
  "r": "right",
  "rsz": "resize:none|both|horizontal|vertical",
  "t": "top",
  "ta": "text-align:left|center|right|justify",
  "tal": "text-align-last:left|center|right",
  "tbl": "table-layout:fixed",
  "td": "text-decoration:none|underline|overline|line-through",
  "te": "text-emphasis:none|accent|dot|circle|disc|before|after",
  "th": "text-height:auto|font-size|text-size|max-size",
  "ti": "text-indent",
  "tj": "text-justify:auto|inter-word|inter-ideograph|inter-cluster|distribute|kashida|tibetan",
  "to": "text-outline:${1:0} ${2:0} ${3:#000}",
  "tov": "text-overflow:ellipsis|clip",
  "tr": "text-replace",
  "trf": "transform:${1}|skewX(${1:angle})|skewY(${1:angle})|scale(${1:x}, ${2:y})|scaleX(${1:x})|scaleY(${1:y})|scaleZ(${1:z})|scale3d(${1:x}, ${2:y}, ${3:z})|rotate(${1:angle})|rotateX(${1:angle})|rotateY(${1:angle})|rotateZ(${1:angle})|translate(${1:x}, ${2:y})|translateX(${1:x})|translateY(${1:y})|translateZ(${1:z})|translate3d(${1:tx}, ${2:ty}, ${3:tz})",
  "trfo": "transform-origin",
  "trfs": "transform-style:preserve-3d",
  "trs": "transition:${1:prop} ${2:time}",
  "trsde": "transition-delay:${1:time}",
  "trsdu": "transition-duration:${1:time}",
  "trsp": "transition-property:${1:prop}",
  "trstf": "transition-timing-function:${1:fn}",
  "tsh": "text-shadow:${1:hoff} ${2:voff} ${3:blur} ${4:#000}",
  "tt": "text-transform:uppercase|lowercase|capitalize|none",
  "tw": "text-wrap:none|normal|unrestricted|suppress",
  "us": "user-select:none",
  "v": "visibility:hidden|visible|collapse",
  "va": "vertical-align:top|super|text-top|middle|baseline|bottom|text-bottom|sub",
  "w": "width",
  "whs": "white-space:nowrap|pre|pre-wrap|pre-line|normal",
  "whsc": "white-space-collapse:normal|keep-all|loose|break-strict|break-all",
  "wid": "widows",
  "wm": "writing-mode:lr-tb|lr-tb|lr-bt|rl-tb|rl-bt|tb-rl|tb-lr|bt-lr|bt-rl",
  "wob": "word-break:normal|keep-all|break-all",
  "wos": "word-spacing",
  "wow": "word-wrap:none|unrestricted|suppress|break-word|normal",
  "z": "z-index",
  "zom": "zoom:1"
};
var xslSnippets = {
  "tm|tmatch": "xsl:template[match mode]",
  "tn|tname": "xsl:template[name]",
  "call": "xsl:call-template[name]",
  "ap": "xsl:apply-templates[select mode]",
  "api": "xsl:apply-imports",
  "imp": "xsl:import[href]",
  "inc": "xsl:include[href]",
  "ch": "xsl:choose",
  "wh|xsl:when": "xsl:when[test]",
  "ot": "xsl:otherwise",
  "if": "xsl:if[test]",
  "par": "xsl:param[name]",
  "pare": "xsl:param[name select]",
  "var": "xsl:variable[name]",
  "vare": "xsl:variable[name select]",
  "wp": "xsl:with-param[name select]",
  "key": "xsl:key[name match use]",
  "elem": "xsl:element[name]",
  "attr": "xsl:attribute[name]",
  "attrs": "xsl:attribute-set[name]",
  "cp": "xsl:copy[select]",
  "co": "xsl:copy-of[select]",
  "val": "xsl:value-of[select]",
  "for|each": "xsl:for-each[select]",
  "tex": "xsl:text",
  "com": "xsl:comment",
  "msg": "xsl:message[terminate=no]",
  "fall": "xsl:fallback",
  "num": "xsl:number[value]",
  "nam": "namespace-alias[stylesheet-prefix result-prefix]",
  "pres": "xsl:preserve-space[elements]",
  "strip": "xsl:strip-space[elements]",
  "proc": "xsl:processing-instruction[name]",
  "sort": "xsl:sort[select order]",
  "choose": "xsl:choose>xsl:when+xsl:otherwise",
  "xsl": "!!!+xsl:stylesheet[version=1.0 xmlns:xsl=http://www.w3.org/1999/XSL/Transform]>{\n|}",
  "!!!": '{<?xml version="1.0" encoding="UTF-8"?>}'
};
var pugSnippets = {
  "!!!": "{doctype html}"
};
var variables = {
  "lang": "en",
  "locale": "en-US",
  "charset": "UTF-8",
  "indentation": "	",
  "newline": "\n"
};
const defaultSyntaxes = {
  markup: "html",
  stylesheet: "css"
};
const defaultOptions$1 = {
  "inlineElements": [
    "a",
    "abbr",
    "acronym",
    "applet",
    "b",
    "basefont",
    "bdo",
    "big",
    "br",
    "button",
    "cite",
    "code",
    "del",
    "dfn",
    "em",
    "font",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "map",
    "object",
    "q",
    "s",
    "samp",
    "select",
    "small",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "textarea",
    "tt",
    "u",
    "var"
  ],
  "output.indent": "	",
  "output.baseIndent": "",
  "output.newline": "\n",
  "output.tagCase": "",
  "output.attributeCase": "",
  "output.attributeQuotes": "double",
  "output.format": true,
  "output.formatLeafNode": false,
  "output.formatSkip": ["html"],
  "output.formatForce": ["body"],
  "output.inlineBreak": 3,
  "output.compactBoolean": false,
  "output.booleanAttributes": [
    "contenteditable",
    "seamless",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "defer",
    "disabled",
    "formnovalidate",
    "hidden",
    "ismap",
    "loop",
    "multiple",
    "muted",
    "novalidate",
    "readonly",
    "required",
    "reversed",
    "selected",
    "typemustmatch"
  ],
  "output.reverseAttributes": false,
  "output.selfClosingStyle": "html",
  "output.field": (index, placeholder) => placeholder,
  "output.text": (text2) => text2,
  "markup.href": true,
  "comment.enabled": false,
  "comment.trigger": ["id", "class"],
  "comment.before": "",
  "comment.after": "\n<!-- /[#ID][.CLASS] -->",
  "bem.enabled": false,
  "bem.element": "__",
  "bem.modifier": "_",
  "jsx.enabled": false,
  "stylesheet.keywords": ["auto", "inherit", "unset", "none"],
  "stylesheet.unitless": ["z-index", "line-height", "opacity", "font-weight", "zoom", "flex", "flex-grow", "flex-shrink"],
  "stylesheet.shortHex": true,
  "stylesheet.between": ": ",
  "stylesheet.after": ";",
  "stylesheet.intUnit": "px",
  "stylesheet.floatUnit": "em",
  "stylesheet.unitAliases": { e: "em", p: "%", x: "ex", r: "rem" },
  "stylesheet.json": false,
  "stylesheet.jsonDoubleQuotes": false,
  "stylesheet.fuzzySearchMinScore": 0
};
const defaultConfig$1 = {
  type: "markup",
  syntax: "html",
  variables,
  snippets: {},
  options: defaultOptions$1
};
const syntaxConfig = {
  markup: {
    snippets: parseSnippets(markupSnippets)
  },
  xhtml: {
    options: {
      "output.selfClosingStyle": "xhtml"
    }
  },
  xml: {
    options: {
      "output.selfClosingStyle": "xml"
    }
  },
  xsl: {
    snippets: parseSnippets(xslSnippets),
    options: {
      "output.selfClosingStyle": "xml"
    }
  },
  jsx: {
    options: {
      "jsx.enabled": true
    }
  },
  pug: {
    snippets: parseSnippets(pugSnippets)
  },
  stylesheet: {
    snippets: parseSnippets(stylesheetSnippets)
  },
  sass: {
    options: {
      "stylesheet.after": ""
    }
  },
  stylus: {
    options: {
      "stylesheet.between": " ",
      "stylesheet.after": ""
    }
  }
};
function parseSnippets(snippets) {
  const result = {};
  Object.keys(snippets).forEach((k) => {
    for (const name of k.split("|")) {
      result[name] = snippets[k];
    }
  });
  return result;
}
function resolveConfig(config2 = {}, globals = {}) {
  const type = config2.type || "markup";
  const syntax = config2.syntax || defaultSyntaxes[type];
  return Object.assign(Object.assign(Object.assign({}, defaultConfig$1), config2), {
    type,
    syntax,
    variables: mergedData(type, syntax, "variables", config2, globals),
    snippets: mergedData(type, syntax, "snippets", config2, globals),
    options: mergedData(type, syntax, "options", config2, globals)
  });
}
function mergedData(type, syntax, key, config2, globals = {}) {
  const typeDefaults = syntaxConfig[type];
  const typeOverride = globals[type];
  const syntaxDefaults = syntaxConfig[syntax];
  const syntaxOverride = globals[syntax];
  return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, defaultConfig$1[key]), typeDefaults && typeDefaults[key]), syntaxDefaults && syntaxDefaults[key]), typeOverride && typeOverride[key]), syntaxOverride && syntaxOverride[key]), config2[key]);
}
function backwardScanner(text2, start = 0) {
  return { text: text2, start, pos: text2.length };
}
function sol(scanner) {
  return scanner.pos === scanner.start;
}
function peek$1(scanner, offset = 0) {
  return scanner.text.charCodeAt(scanner.pos - 1 + offset);
}
function previous(scanner) {
  if (!sol(scanner)) {
    return scanner.text.charCodeAt(--scanner.pos);
  }
}
function consume(scanner, match) {
  if (sol(scanner)) {
    return false;
  }
  const ok = typeof match === "function" ? match(peek$1(scanner)) : match === peek$1(scanner);
  if (ok) {
    scanner.pos--;
  }
  return !!ok;
}
function consumeWhile(scanner, match) {
  const start = scanner.pos;
  while (consume(scanner, match)) {
  }
  return scanner.pos < start;
}
function isQuote$1(c) {
  return c === 39 || c === 34;
}
function consumeQuoted(scanner) {
  const start = scanner.pos;
  const quote2 = previous(scanner);
  if (isQuote$1(quote2)) {
    while (!sol(scanner)) {
      if (previous(scanner) === quote2 && peek$1(scanner) !== 92) {
        return true;
      }
    }
  }
  scanner.pos = start;
  return false;
}
const bracePairs = {
  [91]: 93,
  [40]: 41,
  [123]: 125
};
function isHtml(scanner) {
  const start = scanner.pos;
  if (!consume(scanner, 62)) {
    return false;
  }
  let ok = false;
  consume(scanner, 47);
  while (!sol(scanner)) {
    consumeWhile(scanner, isWhiteSpace);
    if (consumeIdent(scanner)) {
      if (consume(scanner, 47)) {
        ok = consume(scanner, 60);
        break;
      } else if (consume(scanner, 60)) {
        ok = true;
        break;
      } else if (consume(scanner, isWhiteSpace)) {
        continue;
      } else if (consume(scanner, 61)) {
        if (consumeIdent(scanner)) {
          continue;
        }
        break;
      } else if (consumeAttributeWithUnquotedValue(scanner)) {
        ok = true;
        break;
      }
      break;
    }
    if (consumeAttribute(scanner)) {
      continue;
    }
    break;
  }
  scanner.pos = start;
  return ok;
}
function consumeAttribute(scanner) {
  return consumeAttributeWithQuotedValue(scanner) || consumeAttributeWithUnquotedValue(scanner);
}
function consumeAttributeWithQuotedValue(scanner) {
  const start = scanner.pos;
  if (consumeQuoted(scanner) && consume(scanner, 61) && consumeIdent(scanner)) {
    return true;
  }
  scanner.pos = start;
  return false;
}
function consumeAttributeWithUnquotedValue(scanner) {
  const start = scanner.pos;
  const stack = [];
  while (!sol(scanner)) {
    const ch = peek$1(scanner);
    if (isCloseBracket(ch)) {
      stack.push(ch);
    } else if (isOpenBracket(ch)) {
      if (stack.pop() !== bracePairs[ch]) {
        break;
      }
    } else if (!isUnquotedValue(ch)) {
      break;
    }
    scanner.pos--;
  }
  if (start !== scanner.pos && consume(scanner, 61) && consumeIdent(scanner)) {
    return true;
  }
  scanner.pos = start;
  return false;
}
function consumeIdent(scanner) {
  return consumeWhile(scanner, isIdent);
}
function isIdent(ch) {
  return ch === 58 || ch === 45 || isAlpha(ch) || isNumber$1(ch);
}
function isAlpha(ch) {
  ch &= ~32;
  return ch >= 65 && ch <= 90;
}
function isNumber$1(ch) {
  return ch > 47 && ch < 58;
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isUnquotedValue(ch) {
  return !isNaN(ch) && ch !== 61 && !isWhiteSpace(ch) && !isQuote$1(ch);
}
function isOpenBracket(ch) {
  return ch === 123 || ch === 40 || ch === 91;
}
function isCloseBracket(ch) {
  return ch === 125 || ch === 41 || ch === 93;
}
const code = (ch) => ch.charCodeAt(0);
const specialChars = "#.*:$-_!@%^+>/".split("").map(code);
const defaultOptions$1$1 = {
  type: "markup",
  lookAhead: true,
  prefix: ""
};
function extractAbbreviation(line, pos = line.length, options = {}) {
  const opt2 = Object.assign(Object.assign({}, defaultOptions$1$1), options);
  pos = Math.min(line.length, Math.max(0, pos == null ? line.length : pos));
  if (opt2.lookAhead) {
    pos = offsetPastAutoClosed(line, pos, opt2);
  }
  let ch;
  const start = getStartOffset(line, pos, opt2.prefix || "");
  if (start === -1) {
    return void 0;
  }
  const scanner = backwardScanner(line, start);
  scanner.pos = pos;
  const stack = [];
  while (!sol(scanner)) {
    ch = peek$1(scanner);
    if (stack.includes(125)) {
      if (ch === 125) {
        stack.push(ch);
        scanner.pos--;
        continue;
      }
      if (ch !== 123) {
        scanner.pos--;
        continue;
      }
    }
    if (isCloseBrace(ch, opt2.type)) {
      stack.push(ch);
    } else if (isOpenBrace(ch, opt2.type)) {
      if (stack.pop() !== bracePairs[ch]) {
        break;
      }
    } else if (stack.includes(93) || stack.includes(125)) {
      scanner.pos--;
      continue;
    } else if (isHtml(scanner) || !isAbbreviation(ch)) {
      break;
    }
    scanner.pos--;
  }
  if (!stack.length && scanner.pos !== pos) {
    const abbreviation2 = line.slice(scanner.pos, pos).replace(/^[*+>^]+/, "");
    return {
      abbreviation: abbreviation2,
      location: pos - abbreviation2.length,
      start: options.prefix ? start - options.prefix.length : pos - abbreviation2.length,
      end: pos
    };
  }
}
function offsetPastAutoClosed(line, pos, options) {
  if (isQuote$1(line.charCodeAt(pos))) {
    pos++;
  }
  while (isCloseBrace(line.charCodeAt(pos), options.type)) {
    pos++;
  }
  return pos;
}
function getStartOffset(line, pos, prefix) {
  if (!prefix) {
    return 0;
  }
  const scanner = backwardScanner(line);
  const compiledPrefix = prefix.split("").map(code);
  scanner.pos = pos;
  let result;
  while (!sol(scanner)) {
    if (consumePair(scanner, 93, 91) || consumePair(scanner, 125, 123)) {
      continue;
    }
    result = scanner.pos;
    if (consumeArray(scanner, compiledPrefix)) {
      return result;
    }
    scanner.pos--;
  }
  return -1;
}
function consumePair(scanner, close, open) {
  const start = scanner.pos;
  if (consume(scanner, close)) {
    while (!sol(scanner)) {
      if (consume(scanner, open)) {
        return true;
      }
      scanner.pos--;
    }
  }
  scanner.pos = start;
  return false;
}
function consumeArray(scanner, arr) {
  const start = scanner.pos;
  let consumed = false;
  for (let i = arr.length - 1; i >= 0 && !sol(scanner); i--) {
    if (!consume(scanner, arr[i])) {
      break;
    }
    consumed = i === 0;
  }
  if (!consumed) {
    scanner.pos = start;
  }
  return consumed;
}
function isAbbreviation(ch) {
  return ch > 64 && ch < 91 || ch > 96 && ch < 123 || ch > 47 && ch < 58 || specialChars.includes(ch);
}
function isOpenBrace(ch, syntax) {
  return ch === 40 || syntax === "markup" && (ch === 91 || ch === 123);
}
function isCloseBrace(ch, syntax) {
  return ch === 41 || syntax === "markup" && (ch === 93 || ch === 125);
}
function expandAbbreviation$1(abbr, config2) {
  const resolvedConfig = resolveConfig(config2);
  return resolvedConfig.type === "stylesheet" ? stylesheet(abbr, resolvedConfig) : markup(abbr, resolvedConfig);
}
function markup(abbr, config2) {
  return stringify(parse$1(abbr, config2), config2);
}
function stylesheet(abbr, config2) {
  return css(parse$1$1(abbr, config2), config2);
}
const tabStopStart = String.fromCodePoint(65520);
const tabStopEnd = String.fromCodePoint(65521);
function narrowToNonSpace(state, range) {
  const text2 = substr(state, range);
  let startOffset = 0;
  let endOffset = text2.length;
  while (startOffset < endOffset && isSpace(text2[startOffset])) {
    startOffset++;
  }
  while (endOffset > startOffset && isSpace(text2[endOffset - 1])) {
    endOffset--;
  }
  return {
    from: range.from + startOffset,
    to: range.from + endOffset
  };
}
function getCaret(state) {
  return state.selection.main.from;
}
function substr(state, range) {
  return state.doc.sliceString(range.from, range.to);
}
function contains(range, pos) {
  return pos >= range.from && pos <= range.to;
}
function fullCSSDeclarationRange(node) {
  var _a;
  return {
    from: node.from,
    to: ((_a = node.nextSibling) == null ? void 0 : _a.name) === ";" ? node.nextSibling.to : node.to
  };
}
function isQuote(ch) {
  return ch === '"' || ch === "'";
}
function getAttributeValueRange(state, node) {
  let { from, to } = node;
  const value = substr(state, node);
  if (isQuote(value[0])) {
    from++;
  }
  if (isQuote(value[value.length - 1])) {
    to--;
  }
  return { from, to };
}
function getTagAttributes(state, node) {
  const result = {};
  for (const attr of node.getChildren("Attribute")) {
    const attrNameNode = attr.getChild("AttributeName");
    if (attrNameNode) {
      const attrName2 = substr(state, attrNameNode);
      const attrValueNode = attr.getChild("AttributeValue");
      result[attrName2] = attrValueNode ? substr(state, getAttributeValueRange(state, attrValueNode)) : null;
    }
  }
  return result;
}
function isSpace(ch) {
  return /^[\s\n\r]+$/.test(ch);
}
function rangesEqual(a, b) {
  return a.from === b.from && a.to === b.to;
}
function rangeContains(a, b) {
  return a.from <= b.from && a.to >= b.to;
}
function rangeEmpty(r) {
  return r.from === r.to;
}
function last(arr) {
  return arr.length > 0 ? arr[arr.length - 1] : void 0;
}
function getSelectionsFromSnippet(snippet2, base = 0) {
  const ranges = [];
  let result = "";
  let sel = null;
  let offset = 0;
  let i = 0;
  let ch;
  while (i < snippet2.length) {
    ch = snippet2.charAt(i++);
    if (ch === tabStopStart || ch === tabStopEnd) {
      result += snippet2.slice(offset, i - 1);
      offset = i;
      if (ch === tabStopStart) {
        sel = {
          from: base + result.length,
          to: base + result.length
        };
        ranges.push(sel);
      } else if (sel) {
        sel = null;
      }
    }
  }
  if (!ranges.length) {
    ranges.push({
      from: snippet2.length + base,
      to: snippet2.length + base
    });
  }
  return {
    ranges,
    snippet: result + snippet2.slice(offset)
  };
}
const nodeToHTMLType = {
  OpenTag: "open",
  CloseTag: "close",
  SelfClosingTag: "selfClose"
};
function getContext(state, pos) {
  if (cssLanguage.isActiveAt(state, pos)) {
    return getCSSContext(state, pos);
  }
  if (htmlLanguage.isActiveAt(state, pos)) {
    return getHTMLContext(state, pos);
  }
  return;
}
function getCSSContext(state, pos, embedded) {
  const result = {
    type: "css",
    ancestors: [],
    current: null,
    inline: false,
    embedded
  };
  const tree = syntaxTree(state).resolveInner(pos, -1);
  const stack = [];
  for (let node = tree; node; node = node.parent) {
    if (node.name === "RuleSet") {
      const sel = getSelectorRange(node);
      stack.push({
        name: substr(state, sel),
        type: "selector",
        range: node
      });
    } else if (node.name === "Declaration") {
      const { name, value } = getPropertyRanges(node);
      if (value && contains(value, pos)) {
        stack.push({
          name: substr(state, value),
          type: "propertyValue",
          range: value
        });
      }
      if (name) {
        stack.push({
          name: substr(state, name),
          type: "propertyName",
          range: name
        });
      }
    }
  }
  const tip = stack.shift();
  if (tip) {
    const range = tip.type === "selector" ? { from: tip.range.from, to: tip.range.from + tip.name.length } : tip.range;
    if (contains(range, pos)) {
      result.current = tip;
      tip.range = range;
    } else {
      stack.unshift(tip);
    }
  }
  result.ancestors = stack.reverse();
  return result;
}
function getHTMLContext(state, pos) {
  const result = {
    type: "html",
    ancestors: [],
    current: null
  };
  const tree = syntaxTree(state).resolveInner(pos);
  for (let node = tree; node; node = node ? node.parent : null) {
    if (node.name in nodeToHTMLType) {
      const m = getContextMatchFromTag(state, node);
      if (m) {
        result.current = __spreadProps(__spreadValues({}, m), {
          type: nodeToHTMLType[node.name]
        });
        node = node.parent;
      }
    } else if (node.name === "Element") {
      const child = node.getChild("OpenTag");
      if (child) {
        const m = getContextMatchFromTag(state, child);
        if (m) {
          result.ancestors.push(m);
        }
      }
    }
  }
  result.ancestors.reverse();
  detectCSSContextFromHTML(state, pos, result);
  return result;
}
function detectCSSContextFromHTML(state, pos, ctx) {
  var _a;
  if (((_a = ctx.current) == null ? void 0 : _a.type) === "open") {
    let node = syntaxTree(state).resolve(ctx.current.range.from, 1);
    while (node && node.name !== "OpenTag") {
      node = node.parent;
    }
    if (node) {
      for (const attr of node.getChildren("Attribute")) {
        if (attr.from > pos) {
          break;
        }
        if (contains(attr, pos) && getAttributeName(state, attr)) {
          const attrValue = attr.getChild("AttributeValue");
          if (attrValue) {
            const cleanValueRange = getAttributeValueRange(state, attrValue);
            if (contains(cleanValueRange, pos)) {
              ctx.css = getInlineCSSContext(substr(state, cleanValueRange), pos - cleanValueRange.from, cleanValueRange.from);
            }
          }
        }
      }
    }
  }
}
function getContextMatchFromTag(state, node) {
  const tagName2 = node.getChild("TagName");
  if (tagName2) {
    return {
      name: substr(state, tagName2).toLowerCase(),
      range: node
    };
  }
}
function getSelectorRange(node) {
  let from = node.from;
  let to = from;
  for (let child = node.firstChild; child && child.name !== "Block"; child = child.nextSibling) {
    to = child.to;
  }
  return { from, to };
}
function getPropertyRanges(node) {
  let name;
  let value;
  let ptr = node.firstChild;
  if ((ptr == null ? void 0 : ptr.name) === "PropertyName") {
    name = ptr;
    ptr = ptr.nextSibling;
    if ((ptr == null ? void 0 : ptr.name) === ":") {
      ptr = ptr.nextSibling;
    }
    if (ptr) {
      value = {
        from: ptr.from,
        to: node.lastChild.to
      };
    }
  }
  return { name, value };
}
function getAttributeName(state, node) {
  const name = node.getChild("AttributeName");
  return name ? substr(state, name).toLowerCase() : "";
}
function getInlineCSSContext(code2, pos, base = 0) {
  const result = {
    type: "css",
    ancestors: [],
    current: null,
    inline: true,
    embedded: {
      from: pos + base,
      to: pos + base + code2.length
    }
  };
  const props = parseInlineProps(code2, pos);
  for (const prop of props) {
    if (prop.value && contains(prop.value, pos)) {
      result.current = {
        name: code2.substring(prop.value.from, prop.value.to).trim(),
        type: "propertyValue",
        range: {
          from: base + prop.value.from,
          to: base + prop.value.to
        }
      };
      result.ancestors.push({
        name: code2.substring(prop.name.from, prop.name.to).trim(),
        type: "propertyName",
        range: {
          from: base + prop.name.from,
          to: base + prop.value.to
        }
      });
      break;
    } else if (contains(prop.name, pos)) {
      const end = prop.value ? prop.value.to : prop.name.to;
      result.current = {
        name: code2.substring(prop.name.from, prop.name.to).trim(),
        type: "propertyName",
        range: {
          from: base + prop.name.from,
          to: base + end
        }
      };
      break;
    }
  }
  return result;
}
function parseInlineProps(code2, limit = code2.length) {
  var _a;
  const space = " 	\n\r";
  const propList = [];
  let prop;
  for (let i = 0; i < code2.length; i++) {
    const ch = code2[i];
    if (prop) {
      if (prop.value) {
        if (prop.value.from !== -1) {
          prop.value.to = i;
        }
      } else {
        prop.name.to = i;
      }
    }
    if (ch === ";") {
      prop = void 0;
      if (i > limit) {
        break;
      }
    } else if (ch === ":") {
      if (prop && !prop.value) {
        prop.value = { from: -1, to: -1 };
      }
    } else {
      if (prop) {
        if (((_a = prop.value) == null ? void 0 : _a.from) === -1 && !space.includes(ch)) {
          prop.value.from = prop.value.to = i;
        }
      } else if (!space.includes(ch)) {
        prop = {
          name: { from: i, to: i }
        };
        propList.push(prop);
      }
    }
  }
  if (prop) {
    if (prop.value) {
      prop.value.to++;
    } else {
      prop.name.to++;
    }
  }
  return propList;
}
const xmlSyntaxes = ["xml", "xsl", "jsx"];
const htmlSyntaxes = ["html", "htmlmixed", "vue"];
const cssSyntaxes = ["css", "scss", "less"];
const jsxSyntaxes = ["jsx", "tsx"];
const stylesheetSyntaxes = ["sass", "sss", "stylus", "postcss"].concat(cssSyntaxes);
function syntaxInfo(state, ctx) {
  let syntax = docSyntax(state);
  let inline;
  let context = typeof ctx === "number" ? getContext(state, ctx) : ctx;
  if ((context == null ? void 0 : context.type) === "html" && context.css) {
    inline = true;
    syntax = "css";
    context = context.css;
  } else if ((context == null ? void 0 : context.type) === "css") {
    syntax = "css";
  }
  return {
    type: getSyntaxType(syntax),
    syntax,
    inline,
    context
  };
}
function docSyntax(state) {
  const topLang = state.facet(language);
  if (topLang === cssLanguage) {
    return "css";
  }
  if (topLang === htmlLanguage) {
    return "html";
  }
  return "";
}
function getSyntaxType(syntax) {
  return syntax && stylesheetSyntaxes.includes(syntax) ? "stylesheet" : "markup";
}
function isXML(syntax) {
  return syntax ? xmlSyntaxes.includes(syntax) : false;
}
function isHTML(syntax) {
  return syntax ? htmlSyntaxes.includes(syntax) || isXML(syntax) : false;
}
function isCSS(syntax) {
  return syntax ? cssSyntaxes.includes(syntax) : false;
}
function isJSX(syntax) {
  return syntax ? jsxSyntaxes.includes(syntax) : false;
}
function getMarkupAbbreviationContext(state, ctx) {
  const parent = last(ctx.ancestors);
  if (parent) {
    let node = syntaxTree(state).resolve(parent.range.from, 1);
    while (node && node.name !== "OpenTag") {
      node = node.parent;
    }
    return {
      name: parent.name,
      attributes: node ? getTagAttributes(state, node) : {}
    };
  }
  return;
}
function getStylesheetAbbreviationContext(ctx) {
  if (ctx.inline) {
    return { name: "@@property" };
  }
  const parent = last(ctx.ancestors);
  let scope = "@@global";
  if (ctx.current) {
    if (ctx.current.type === "propertyValue" && parent) {
      scope = parent.name;
    } else if ((ctx.current.type === "selector" || ctx.current.type === "propertyName") && !parent) {
      scope = "@@section";
    }
  }
  return {
    name: scope
  };
}
const defaultConfig = {
  mark: true,
  preview: true,
  autoRenameTags: true,
  markTagPairs: true,
  previewOpenTag: false,
  attributeQuotes: "double",
  markupStyle: "html",
  comments: false,
  commentsTemplate: "<!-- /[#ID][.CLASS] -->",
  bem: false
};
function getEmmetConfig(opt2) {
  return __spreadValues(__spreadValues({}, defaultConfig), opt2);
}
function getOutputOptions(state, inline) {
  const syntax = docSyntax(state) || "html";
  const config2 = getEmmetConfig();
  const opt2 = {
    "output.field": field,
    "output.indent": "	",
    "output.format": !inline,
    "output.attributeQuotes": config2.attributeQuotes,
    "stylesheet.shortHex": config2.shortHex
  };
  if (syntax === "html") {
    opt2["output.selfClosingStyle"] = config2.markupStyle;
    opt2["output.compactBoolean"] = config2.markupStyle === "html";
  }
  if (isHTML(syntax)) {
    if (config2.comments) {
      opt2["comment.enabled"] = true;
      if (config2.commentsTemplate) {
        opt2["comment.after"] = config2.commentsTemplate;
      }
    }
    opt2["bem.enabled"] = config2.bem;
  }
  return opt2;
}
function field(index, placeholder) {
  return placeholder ? `\${${index}:${placeholder}}` : `\${${index}}`;
}
function lineIndent(line) {
  const indent = line.text.match(/^\s+/);
  return indent ? indent[0] : "";
}
let cache = {};
function expand(abbr, config2) {
  let opt2 = { cache };
  const outputOpt = {
    "output.field": field
  };
  if (config2) {
    Object.assign(opt2, config2);
    if (config2.options) {
      Object.assign(outputOpt, config2.options);
    }
  }
  opt2.options = outputOpt;
  const pluginConfig = getEmmetConfig();
  if (pluginConfig.config) {
    opt2 = resolveConfig(opt2, pluginConfig.config);
  }
  return expandAbbreviation$1(abbr, opt2);
}
function extract$1(code2, pos, type = "markup", options) {
  return extractAbbreviation(code2, pos, __spreadValues({
    lookAhead: type !== "stylesheet",
    type
  }, options));
}
function getTagContext(state, pos) {
  let element2 = syntaxTree(state).resolve(pos, 1);
  while (element2 && element2.name !== "Element") {
    element2 = element2.parent;
  }
  if (element2) {
    const selfClose2 = element2.getChild("SelfClosingTag");
    if (selfClose2) {
      return {
        name: getTagName(state, selfClose2),
        attributes: getTagAttributes(state, selfClose2),
        open: selfClose2
      };
    }
    const openTag = element2.getChild("OpenTag");
    if (openTag) {
      const closeTag = element2.getChild("CloseTag");
      const ctx = {
        name: getTagName(state, openTag),
        attributes: getTagAttributes(state, openTag),
        open: openTag
      };
      if (closeTag) {
        ctx.close = closeTag;
      }
      return ctx;
    }
  }
  return;
}
function getTagName(state, node) {
  const tagName2 = node.getChild("TagName");
  return tagName2 ? substr(state, tagName2) : "";
}
function getOptions(state, pos) {
  const info = syntaxInfo(state, pos);
  const { context } = info;
  const config2 = {
    type: info.type,
    syntax: info.syntax || "html",
    options: getOutputOptions(state, info.inline)
  };
  if (context) {
    if (context.type === "html" && context.ancestors.length) {
      config2.context = getMarkupAbbreviationContext(state, context);
    } else if (context.type === "css") {
      config2.context = getStylesheetAbbreviationContext(context);
    }
  }
  return config2;
}
class AbbreviationPreviewWidget extends WidgetType {
  constructor(value, syntax, options) {
    super();
    this.value = value;
    this.syntax = syntax;
    this.options = options;
  }
  eq(other) {
    return other.value === this.value && other.syntax === this.syntax;
  }
  updateDOM(_dom) {
    if (_dom.view) {
      const tr = _dom.view.state.update({
        changes: {
          from: 0,
          to: _dom.view.state.doc.length,
          insert: this.value
        }
      });
      _dom.view.dispatch(tr);
      return true;
    }
    return false;
  }
  toDOM() {
    const elem = document.createElement("div");
    elem.className = "emmet-preview";
    if (this.syntax === "error") {
      elem.classList.add("emmet-preview_error");
    }
    elem.view = new EditorView({
      state: EditorState.create({
        doc: this.value,
        extensions: [
          // syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          this.syntax === "css" ? css$1() : html$1(),
          this.getExtensions()
        ]
      }),
      parent: elem
    });
    return elem;
  }
  getExtensions() {
    let ext = this.syntax === "css" ? css$1 : html$1;
    if (this.options && this.syntax in this.options) {
      ext = this.options[this.syntax];
    }
    return ext();
  }
}
const config = Facet.define({
  combine(value) {
    const baseConfig = {
      preview: {}
    };
    const { preview } = baseConfig;
    for (const item of value) {
      Object.assign(baseConfig, item);
      if (item.preview) {
        Object.assign(preview, item.preview);
        baseConfig.preview = preview;
      }
    }
    return baseConfig;
  }
});
const JSX_PREFIX = "<";
const trackerMark = Decoration.mark({ class: "emmet-tracker" });
const resetTracker = StateEffect.define();
const forceTracker = StateEffect.define();
const enterAbbreviationMode = ({ state, dispatch }) => {
  const tr = state.update({
    effects: [forceTracker.of(null)]
  });
  dispatch(tr);
  return true;
};
const trackerField = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(resetTracker)) {
        return null;
      }
      if (effect.is(forceTracker)) {
        const sel = tr.newSelection.main;
        const config2 = getActivationContext(tr.state, sel.from);
        if (config2) {
          return createTracker(tr.state, sel, {
            forced: true,
            config: config2
          });
        }
      }
    }
    if (!tr.docChanged) {
      return value;
    }
    return handleUpdate(tr.state, value, tr);
  }
});
const abbreviationTracker = ViewPlugin.fromClass(class {
  constructor() {
    __publicField(this, "decorations");
    this.decorations = Decoration.none;
  }
  update(update) {
    const { state } = update;
    const tracker2 = state.field(trackerField);
    const decors = [];
    if (tracker2) {
      const { range } = tracker2;
      const options = state.facet(config);
      if (!rangeEmpty(range) && !tracker2.inactive) {
        decors.push(trackerMark.range(range.from, range.to));
      }
      if (tracker2.type === "abbreviation" && (!tracker2.simple || tracker2.forced) && tracker2.abbreviation && contains(range, getCaret(state))) {
        const preview = Decoration.widget({
          widget: new AbbreviationPreviewWidget(tracker2.preview, tracker2.config.syntax || "html", options.preview),
          side: 1
        });
        decors.push(preview.range(range.from));
      } else if (tracker2.type === "error" && tracker2.forced) {
        const errMessage = `\u2191
${tracker2.error.message}`;
        const preview = Decoration.widget({
          widget: new AbbreviationPreviewWidget(errMessage, "error", options.preview),
          side: 1
        });
        decors.push(preview.range(range.from + tracker2.error.pos));
      }
      this.decorations = Decoration.set(decors, true);
    } else {
      this.decorations = Decoration.none;
    }
  }
}, {
  decorations: (v) => v.decorations
});
const tabKeyHandler = ({ state, dispatch }) => {
  const tracker2 = state.field(trackerField, false);
  if (tracker2 && !tracker2.inactive && contains(tracker2.range, getCaret(state))) {
    const { from, to } = tracker2.range;
    const expanded = expand(tracker2.abbreviation, tracker2.config);
    const fn = snippet(expanded);
    fn({ state, dispatch }, { label: "expand" }, from, to);
    return true;
  }
  return false;
};
const escKeyHandler = ({ state, dispatch }) => {
  const tracker2 = state.field(trackerField, false);
  if (tracker2) {
    dispatch({
      effects: resetTracker.of(null)
    });
    return true;
  }
  return false;
};
const trackerTheme = EditorView.baseTheme({
  ".emmet-tracker": {
    textDecoration: "underline 1px green"
  },
  ".emmet-preview": {
    position: "absolute",
    boxShadow: "2px 2px 10px rgba(0, 0, 0, 0.3)",
    borderRadius: "3px",
    background: "#fff",
    display: "inline-block",
    marginLeft: "-5px",
    marginTop: "1.6em",
    fontSize: "0.8em"
  },
  ".emmet-preview_error": {
    color: "red"
  }
});
function tracker(options) {
  return [
    trackerField,
    abbreviationTracker,
    trackerTheme,
    options ? config.of(options) : [],
    keymap.of([{
      key: "Tab",
      run: tabKeyHandler
    }, {
      key: "Escape",
      run: escKeyHandler
    }])
  ];
}
function typingAbbreviation(state, pos, input) {
  if (input.length !== 1) {
    return null;
  }
  const line = state.doc.lineAt(pos);
  const prefix = line.text.substring(Math.max(0, pos - line.from - 1), pos - line.from);
  if (!canStartStarting(prefix, input, getSyntaxFromPos(state, pos))) {
    return null;
  }
  const config2 = getActivationContext(state, pos);
  if (!config2) {
    return null;
  }
  if (config2.type === "stylesheet" && !canStartStarting(prefix, input, "css")) {
    return null;
  }
  const syntax = config2.syntax || "html";
  let from = pos;
  let to = pos + input.length;
  let offset = 0;
  if (isJSX(syntax) && prefix === JSX_PREFIX) {
    offset = JSX_PREFIX.length;
    from -= offset;
  }
  return createTracker(state, { from, to }, { config: config2 });
}
function getActivationContext(state, pos) {
  if (cssLanguage.isActiveAt(state, pos)) {
    return getCSSActivationContext(state, pos, "css", getCSSContext(state, pos));
  }
  const syntax = docSyntax(state);
  if (isHTML(syntax)) {
    const ctx = getHTMLContext(state, pos);
    if (ctx.css) {
      return getCSSActivationContext(state, pos, "css", ctx.css);
    }
    if (!ctx.current) {
      return {
        syntax,
        type: "markup",
        context: getMarkupAbbreviationContext(state, ctx),
        options: getOutputOptions(state)
      };
    }
  } else {
    return {
      syntax,
      type: getSyntaxType(syntax),
      options: getOutputOptions(state)
    };
  }
  return void 0;
}
function getCSSActivationContext(state, pos, syntax, ctx) {
  const allowedContext = !ctx.current || ctx.current.type === "propertyName" || ctx.current.type === "propertyValue" || isTypingBeforeSelector(state, pos, ctx);
  if (allowedContext) {
    return {
      syntax,
      type: "stylesheet",
      context: getStylesheetAbbreviationContext(ctx),
      options: getOutputOptions(state, ctx.inline)
    };
  }
  return;
}
function isTypingBeforeSelector(state, pos, { current }) {
  if ((current == null ? void 0 : current.type) === "selector" && current.range.from === pos - 1) {
    const line = state.doc.lineAt(current.range.from);
    return line.text.trim().length === 1;
  }
  return false;
}
function isValidPrefix(prefix, syntax) {
  if (isJSX(syntax)) {
    return prefix === JSX_PREFIX;
  }
  if (isCSS(syntax)) {
    return prefix === "" || /^[\s>;"\']$/.test(prefix);
  }
  return prefix === "" || /^[\s>;"\']$/.test(prefix);
}
function isValidAbbreviationStart(input, syntax) {
  if (isJSX(syntax)) {
    return /^[a-zA-Z.#\[\(]$/.test(input);
  }
  if (isCSS(syntax)) {
    return /^[a-zA-Z!@]$/.test(input);
  }
  return /^[a-zA-Z.#!@\[\(]$/.test(input);
}
function createTracker(state, range, params) {
  if (range.from > range.to) {
    return null;
  }
  let abbreviation2 = substr(state, range);
  const { config: config2, forced } = params;
  if (params.offset) {
    abbreviation2 = abbreviation2.slice(params.offset);
  }
  if (!abbreviation2 && !forced || hasInvalidChars(abbreviation2)) {
    return null;
  }
  const base = {
    abbreviation: abbreviation2,
    range,
    config: config2,
    forced: !!forced,
    inactive: false,
    offset: params.offset || 0
  };
  try {
    let parsedAbbr;
    let simple = false;
    if (config2.type === "stylesheet") {
      parsedAbbr = parse$2(abbreviation2);
    } else {
      parsedAbbr = parseAbbreviation(abbreviation2, {
        jsx: config2.syntax === "jsx"
      });
      simple = isSimpleMarkupAbbreviation(parsedAbbr);
    }
    const previewConfig = createPreviewConfig(config2);
    return __spreadProps(__spreadValues({}, base), {
      type: "abbreviation",
      simple,
      preview: expand(parsedAbbr, previewConfig)
    });
  } catch (error2) {
    return base.forced ? __spreadProps(__spreadValues({}, base), {
      type: "error",
      error: error2
    }) : null;
  }
}
function hasInvalidChars(abbreviation2) {
  return /[\r\n]/.test(abbreviation2);
}
function isSimpleMarkupAbbreviation(abbr) {
  if (abbr.children.length === 1 && !abbr.children[0].children.length) {
    const first = abbr.children[0];
    return !first.name || /^[a-z]/i.test(first.name);
  }
  return !abbr.children.length;
}
function createPreviewConfig(config2) {
  return __spreadProps(__spreadValues({}, config2), {
    options: __spreadProps(__spreadValues({}, config2.options), {
      "output.field": previewField,
      "output.indent": "  ",
      "output.baseIndent": ""
    })
  });
}
function previewField(_, placeholder) {
  return placeholder;
}
function handleUpdate(state, tracker2, update) {
  if (hasSnippet(state)) {
    return null;
  }
  if (!tracker2 || tracker2.inactive) {
    update.changes.iterChanges((_fromA, _toA, fromB, _toB, text2) => {
      if (text2.length) {
        tracker2 = typingAbbreviation(state, fromB, text2.toString()) || tracker2;
      }
    });
    if (!tracker2 || !tracker2.inactive) {
      return tracker2;
    }
  }
  update.changes.iterChanges((fromA, toA, fromB, toB, text2) => {
    if (!tracker2) {
      return;
    }
    const { range } = tracker2;
    if (!contains(range, fromA)) {
      if (!tracker2.inactive) {
        tracker2 = null;
      }
    } else if (contains(range, fromB)) {
      const removed = toA - fromA;
      const inserted = toB - fromA;
      const to = range.to + inserted - removed;
      if (to <= range.from || hasInvalidChars(text2.toString())) {
        tracker2 = null;
      } else {
        const abbrRange = tracker2.inactive ? range : { from: range.from, to };
        const nextTracker = createTracker(state, abbrRange, {
          config: tracker2.config,
          forced: tracker2.forced
        });
        if (!nextTracker) {
          tracker2 = __spreadProps(__spreadValues({}, tracker2), { inactive: true });
        } else {
          tracker2 = nextTracker;
        }
      }
    }
  });
  return tracker2;
}
function getSyntaxFromPos(state, pos) {
  if (cssLanguage.isActiveAt(state, pos)) {
    return "css";
  }
  if (htmlLanguage.isActiveAt(state, pos)) {
    return "html";
  }
  return "";
}
function canStartStarting(prefix, input, syntax) {
  return isValidPrefix(prefix, syntax) && isValidAbbreviationStart(input, syntax);
}
function hasSnippet(state) {
  if (Array.isArray(state.values)) {
    return state.values.some((item) => {
      var _a;
      return item && ((_a = item.constructor) == null ? void 0 : _a.name) === "ActiveSnippet";
    });
  }
  return false;
}
const expandAbbreviation = ({ state, dispatch }) => {
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.anchor);
  const options = getOptions(state, sel.anchor);
  const abbr = extract$1(line.text, sel.anchor - line.from, getSyntaxType(options.syntax));
  if (abbr) {
    const start = line.from + abbr.start;
    const expanded = expand(abbr.abbreviation, getActivationContext(state, start) || options);
    const fn = snippet(expanded);
    fn({ state, dispatch }, { label: "expand" }, start, line.from + abbr.end);
    return true;
  }
  return false;
};
const balanceOutward = ({ state, dispatch }) => {
  const nextSel = [];
  let hasMatch = false;
  for (const sel of state.selection.ranges) {
    const ranges = getOutwardRanges(state, sel.from);
    if (ranges) {
      hasMatch = true;
      const targetRange = ranges.find((r) => rangeContains(r, sel) && !rangesEqual(r, sel)) || sel;
      nextSel.push(EditorSelection.range(targetRange.from, targetRange.to));
    } else {
      nextSel.push(sel);
    }
  }
  if (hasMatch) {
    const tr = state.update({
      selection: EditorSelection.create(nextSel)
    });
    dispatch(tr);
    return true;
  }
  return false;
};
const balanceInward = ({ state, dispatch }) => {
  const nextSel = [];
  let hasMatch = false;
  for (const sel of state.selection.ranges) {
    const ranges = getInwardRanges(state, sel.from);
    if (ranges) {
      hasMatch = true;
      let ix = ranges.findIndex((r) => rangesEqual(sel, r));
      let targetRange = sel;
      if (ix < ranges.length - 1) {
        targetRange = ranges[ix + 1];
      } else if (ix !== -1) {
        targetRange = ranges.slice(ix).find((r) => rangeContains(r, sel)) || sel;
      }
      nextSel.push(EditorSelection.range(targetRange.from, targetRange.to));
    } else {
      nextSel.push(sel);
    }
  }
  if (hasMatch) {
    const tr = state.update({
      selection: EditorSelection.create(nextSel)
    });
    dispatch(tr);
    return true;
  }
  return false;
};
function getOutwardRanges(state, pos) {
  if (cssLanguage.isActiveAt(state, pos)) {
    return getCSSOutwardRanges(state, pos);
  }
  if (htmlLanguage.isActiveAt(state, pos)) {
    return getHTMLOutwardRanges(state, pos);
  }
  return;
}
function getInwardRanges(state, pos) {
  if (cssLanguage.isActiveAt(state, pos)) {
    return getCSSInwardRanges(state, pos);
  }
  if (htmlLanguage.isActiveAt(state, pos)) {
    return getHTMLInwardRanges(state, pos);
  }
  return;
}
function getHTMLOutwardRanges(state, pos) {
  const result = [];
  const tree = syntaxTree(state).resolveInner(pos, -1);
  for (let node = tree; node; node = node.parent) {
    if (node.name === "Element") {
      pushHTMLRanges(node, result);
    }
  }
  return compactRanges(result, false);
}
function getHTMLInwardRanges(state, pos) {
  const result = [];
  let node = syntaxTree(state).resolveInner(pos, 1);
  while (node && node.name !== "Element") {
    node = node.parent;
  }
  while (node) {
    pushHTMLRanges(node, result);
    node = node.getChild("Element");
  }
  return compactRanges(result, true);
}
function getCSSOutwardRanges(state, pos) {
  const result = [];
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (node) {
    pushCSSRanges(state, node, pos, result);
    node = node.parent;
  }
  return compactRanges(result, false);
}
function getCSSInwardRanges(state, pos) {
  const result = [];
  const knownNodes = ["Block", "RuleSet", "Declaration"];
  let node = syntaxTree(state).resolveInner(pos, 1);
  while (node && !knownNodes.includes(node.name)) {
    node = node.parent;
  }
  while (node) {
    pushCSSRanges(state, node, pos, result);
    node = getChildOfType(node, knownNodes);
  }
  return result;
}
function pushHTMLRanges(node, ranges) {
  const selfClose2 = node.getChild("SelfClosingTag");
  if (selfClose2) {
    ranges.push(selfClose2);
  } else {
    const open = node.getChild("OpenTag");
    if (open) {
      const close = node.getChild("CloseTag");
      if (close) {
        ranges.push({ from: open.to, to: close.from });
        ranges.push({ from: open.from, to: close.to });
      } else {
        ranges.push(open);
      }
    }
  }
}
function pushCSSRanges(state, node, pos, ranges) {
  if (node.name === "Block") {
    ranges.push(narrowToNonSpace(state, {
      from: node.from + 1,
      to: node.to - 1
    }));
  } else if (node.name === "RuleSet") {
    ranges.push(node);
  } else if (node.name === "Declaration") {
    const { name, value } = getPropertyRanges(node);
    if (value && contains(value, pos)) {
      ranges.push(value);
    }
    if (name && contains(name, pos)) {
      ranges.push(name);
    }
    ranges.push(fullCSSDeclarationRange(node));
  }
}
function compactRanges(ranges, inward) {
  const result = [];
  ranges = [...ranges].sort(inward ? (a, b) => a.from - b.from || b.to - a.to : (a, b) => b.from - a.from || a.to - b.to);
  for (const range of ranges) {
    const prev2 = last(result);
    if (!prev2 || prev2.from !== range.from || prev2.to !== range.to) {
      result.push(range);
    }
  }
  return result;
}
function getChildOfType(node, types) {
  const cur2 = node.cursor();
  if (cur2.firstChild()) {
    for (; ; ) {
      for (const t of types) {
        if (cur2.node.name === t) {
          return cur2.node;
        }
      }
      if (!cur2.nextSibling()) {
        break;
      }
    }
  }
  return null;
}
const htmlComment = ["<!--", "-->"];
const cssComment = ["/*", "*/"];
const toggleComment = ({ state, dispatch }) => {
  let changes = [];
  for (const sel of state.selection.ranges) {
    if (cssLanguage.isActiveAt(state, sel.from)) {
      changes = changes.concat(toggleCSSComment(state, sel.from));
    } else if (htmlLanguage.isActiveAt(state, sel.from)) {
      changes = changes.concat(toggleHTMLComment(state, sel.from));
    }
  }
  if (!changes.length) {
    return false;
  }
  const tr = state.update({ changes });
  dispatch(tr);
  return true;
};
function toggleHTMLComment(state, pos) {
  let result = [];
  const ctx = getContextOfType(state, pos, ["Element", "Comment"]);
  if (ctx) {
    console.log("got context", ctx);
    if (ctx.name === "Comment") {
      result = result.concat(stripComment(state, ctx, htmlComment));
    } else {
      result = result.concat(addComment(state, ctx, htmlComment, htmlLanguage));
    }
  }
  return result;
}
function toggleCSSComment(state, pos) {
  let result = [];
  const ctx = getContextOfType(state, pos, ["RuleSet", "Declaration", "Comment"]);
  if (ctx) {
    if (ctx.name === "Comment") {
      result = result.concat(stripComment(state, ctx, cssComment));
    } else {
      result = result.concat(addComment(state, ctx, cssComment, cssLanguage));
    }
  }
  return result;
}
function getContextOfType(state, pos, types) {
  const names = new Set(types);
  let node = syntaxTree(state).resolve(pos, 1);
  while (node) {
    if (names.has(node.name)) {
      return node;
    }
    node = node.parent;
  }
  return;
}
function stripComment(state, node, comment) {
  const innerRange = narrowToNonSpace(state, {
    from: node.from + comment[0].length,
    to: node.to - comment[1].length
  });
  return [
    { from: node.from, to: innerRange.from },
    { from: innerRange.to, to: node.to }
  ];
}
function addComment(state, node, comment, lang) {
  var _a;
  let { to } = node;
  if (node.name === "Declaration" && ((_a = node.nextSibling) == null ? void 0 : _a.name) === ";") {
    to = node.nextSibling.to;
  }
  let result = [
    { from: node.from, insert: comment[0] + " " },
    { from: to, insert: " " + comment[1] }
  ];
  result = result.concat(stripChildComments(state, node, comment, lang));
  if (node.name === "RuleSet") {
    const block = node.getChild("Block");
    if (block) {
      result = result.concat(stripChildComments(state, block, comment, lang));
    }
  }
  return result;
}
function stripChildComments(state, node, comment, lang) {
  let result = [];
  for (const child of node.getChildren("Comment")) {
    if (lang.isActiveAt(state, child.from)) {
      result = result.concat(stripComment(state, child, comment));
    }
  }
  return result;
}
const nullary = token("null", 0);
function parse(expr) {
  const scanner = typeof expr === "string" ? new Scanner(expr) : expr;
  let ch;
  let priority = 0;
  let expected = 1 | 4 | 16;
  const tokens = [];
  while (!scanner.eof()) {
    scanner.eatWhile(isWhiteSpace$3);
    scanner.start = scanner.pos;
    if (consumeNumber(scanner)) {
      if ((expected & 1) === 0) {
        error("Unexpected number", scanner);
      }
      tokens.push(number(scanner.current()));
      expected = 2 | 8;
    } else if (isOperator(scanner.peek())) {
      ch = scanner.next();
      if (isSign(ch) && expected & 16) {
        if (isNegativeSign(ch)) {
          tokens.push(op1(ch, priority));
        }
        expected = 1 | 4 | 16;
      } else {
        if ((expected & 2) === 0) {
          error("Unexpected operator", scanner);
        }
        tokens.push(op2(ch, priority));
        expected = 1 | 4 | 16;
      }
    } else if (scanner.eat(40)) {
      if ((expected & 4) === 0) {
        error('Unexpected "("', scanner);
      }
      priority += 10;
      expected = 1 | 4 | 16 | 32;
    } else if (scanner.eat(41)) {
      priority -= 10;
      if (expected & 32) {
        tokens.push(nullary);
      } else if ((expected & 8) === 0) {
        error('Unexpected ")"', scanner);
      }
      expected = 2 | 8 | 4;
    } else {
      error("Unknown character", scanner);
    }
  }
  if (priority < 0 || priority >= 10) {
    error('Unmatched "()"', scanner);
  }
  const result = orderTokens(tokens);
  if (result === null) {
    error("Parity", scanner);
  }
  return result;
}
function consumeNumber(scanner) {
  const start = scanner.pos;
  if (scanner.eat(46) && scanner.eatWhile(isNumber$2)) {
    return true;
  }
  if (scanner.eatWhile(isNumber$2) && (!scanner.eat(46) || scanner.eatWhile(isNumber$2))) {
    return true;
  }
  scanner.pos = start;
  return false;
}
function orderTokens(tokens) {
  const operators2 = [];
  const operands = [];
  let nOperators = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "num") {
      operands.push(t);
    } else {
      nOperators += t.type === "op1" ? 1 : 2;
      while (operators2.length) {
        if (t.priority <= operators2[operators2.length - 1].priority) {
          operands.push(operators2.pop());
        } else {
          break;
        }
      }
      operators2.push(t);
    }
  }
  return nOperators + 1 === operands.length + operators2.length ? operands.concat(operators2.reverse()) : null;
}
function number(value, priority) {
  return token("num", parseFloat(value), priority);
}
function op1(value, priority = 0) {
  if (value === 45) {
    priority += 2;
  }
  return token("op1", value, priority);
}
function op2(value, priority = 0) {
  if (value === 42) {
    priority += 1;
  } else if (value === 47 || value === 92) {
    priority += 2;
  }
  return token("op2", value, priority);
}
function error(name, scanner) {
  if (scanner) {
    name += ` at column ${scanner.pos} of expression`;
  }
  throw new Error(name);
}
function isSign(ch) {
  return isPositiveSign(ch) || isNegativeSign(ch);
}
function isPositiveSign(ch) {
  return ch === 43;
}
function isNegativeSign(ch) {
  return ch === 45;
}
function isOperator(ch) {
  return ch === 43 || ch === 45 || ch === 42 || ch === 47 || ch === 92;
}
function token(type, value, priority = 0) {
  return { type, value, priority };
}
const defaultOptions = {
  lookAhead: true,
  whitespace: true
};
function extract(text2, pos = text2.length, options) {
  const opt2 = Object.assign(Object.assign({}, defaultOptions), options);
  const scanner = { text: text2, pos };
  let ch;
  if (opt2.lookAhead && cur(scanner) === 41) {
    scanner.pos++;
    const len = text2.length;
    while (scanner.pos < len) {
      ch = cur(scanner);
      if (ch !== 41 && !(opt2.whitespace && isSpace$1(ch))) {
        break;
      }
      scanner.pos++;
    }
  }
  const end = scanner.pos;
  let braces = 0;
  while (scanner.pos >= 0) {
    if (number$1(scanner)) {
      continue;
    }
    ch = prev(scanner);
    if (ch === 41) {
      braces++;
    } else if (ch === 40) {
      if (!braces) {
        break;
      }
      braces--;
    } else if (!(opt2.whitespace && isSpace$1(ch) || isSign(ch) || isOperator(ch))) {
      break;
    }
    scanner.pos--;
  }
  if (scanner.pos !== end && !braces) {
    while (isSpace$1(cur(scanner))) {
      scanner.pos++;
    }
    return [scanner.pos, end];
  }
  return null;
}
function number$1(scanner) {
  if (isNumber$2(prev(scanner))) {
    scanner.pos--;
    let dot = false;
    let ch;
    while (scanner.pos >= 0) {
      ch = prev(scanner);
      if (ch === 46) {
        if (dot) {
          break;
        }
        dot = true;
      } else if (!isNumber$2(ch)) {
        break;
      }
      scanner.pos--;
    }
    return true;
  }
  return false;
}
function prev(scanner) {
  return scanner.text.charCodeAt(scanner.pos - 1);
}
function cur(scanner) {
  return scanner.text.charCodeAt(scanner.pos);
}
const ops1 = {
  [45]: (num) => -num
};
const ops2 = {
  [43]: (a, b) => a + b,
  [45]: (a, b) => a - b,
  [42]: (a, b) => a * b,
  [47]: (a, b) => a / b,
  [92]: (a, b) => Math.floor(a / b)
};
function evaluate(expr) {
  if (!Array.isArray(expr)) {
    expr = parse(expr);
  }
  if (!expr || !expr.length) {
    return null;
  }
  const nStack = [];
  let n1;
  let n2;
  let f;
  for (let i = 0, il = expr.length; i < il; i++) {
    const token2 = expr[i];
    if (token2.type === "num") {
      nStack.push(token2.value);
    } else if (token2.type === "op2") {
      n2 = nStack.pop();
      n1 = nStack.pop();
      f = ops2[token2.value];
      nStack.push(f(n1, n2));
    } else if (token2.type === "op1") {
      n1 = nStack.pop();
      f = ops1[token2.value];
      nStack.push(f(n1));
    } else {
      throw new Error("Invalid expression");
    }
  }
  if (nStack.length > 1) {
    throw new Error("Invalid Expression (parity)");
  }
  return nStack[0];
}
const evaluateMath = ({ state, dispatch }) => {
  const changes = [];
  const nextSel = [];
  for (const sel of state.selection.ranges) {
    let { from, to } = sel;
    if (from === to) {
      const line = state.doc.lineAt(sel.from);
      const expr = extract(line.text, sel.from - line.from);
      if (expr) {
        from = expr[0] + line.from;
        to = expr[1] + line.from;
      }
    }
    if (from !== to) {
      try {
        const result = evaluate(state.doc.sliceString(from, to));
        if (result !== null) {
          const insert = result.toFixed(4).replace(/\.?0+$/, "");
          changes.push({ from, to, insert });
          nextSel.push(EditorSelection.range(from + insert.length, from + insert.length));
        }
      } catch (err) {
        nextSel.push(sel);
        console.error(err);
      }
    }
  }
  if (changes.length) {
    const tr = state.update({
      changes,
      selection: EditorSelection.create(nextSel)
    });
    dispatch(tr);
    return true;
  }
  return false;
};
const goToNextEditPoint = ({ state, dispatch }) => {
  const tr = state.update({
    selection: getNextSel(state, 1)
  });
  dispatch(tr);
  return true;
};
const goToPreviousEditPoint = ({ state, dispatch }) => {
  const tr = state.update({
    selection: getNextSel(state, -1)
  });
  dispatch(tr);
  return true;
};
function getNextSel(state, inc) {
  const nextSel = [];
  for (const sel of state.selection.ranges) {
    const nextPos = findNewEditPoint(state, sel.from + inc, inc);
    if (nextPos != null) {
      nextSel.push(EditorSelection.cursor(nextPos));
    } else {
      nextSel.push(sel);
    }
  }
  return EditorSelection.create(nextSel);
}
function findNewEditPoint(state, pos, inc) {
  const doc = state.doc.toString();
  const docSize = doc.length;
  let curPos = pos;
  while (curPos < docSize && curPos >= 0) {
    curPos += inc;
    const cur2 = doc[curPos];
    const next2 = doc[curPos + 1];
    const prev2 = doc[curPos - 1];
    if (isQuote(cur2) && next2 === cur2 && prev2 === "=") {
      return curPos + 1;
    }
    if (cur2 === "<" && prev2 === ">") {
      return curPos;
    }
    if (isNewLine(cur2)) {
      const line = state.doc.lineAt(curPos + inc);
      if (!line.length || isSpace(line.text)) {
        return line.from + line.text.length;
      }
    }
  }
  return;
}
function isNewLine(ch) {
  return ch === "\r" || ch === "\n";
}
const goToTagPair = ({ state, dispatch }) => {
  const nextRanges = [];
  let found = false;
  for (const sel of state.selection.ranges) {
    const pos = sel.from;
    let nextSel = sel;
    if (htmlLanguage.isActiveAt(state, pos)) {
      const ctx = getTagContext(state, pos);
      if (ctx && ctx.open && ctx.close) {
        found = true;
        const { open, close } = ctx;
        const nextPos = open.from <= pos && pos < open.to ? close.from : open.from;
        nextSel = EditorSelection.cursor(nextPos);
      }
    }
    nextRanges.push(nextSel);
  }
  if (found) {
    const tr = state.update({
      selection: EditorSelection.create(nextRanges)
    });
    dispatch(tr);
    return true;
  }
  return false;
};
const incrementNumber1 = (target) => incDecNumber(target, 1);
const decrementNumber1 = (target) => incDecNumber(target, -1);
const incrementNumber01 = (target) => incDecNumber(target, 0.1);
const decrementNumber01 = (target) => incDecNumber(target, -0.1);
const incrementNumber10 = (target) => incDecNumber(target, 10);
const decrementNumber10 = (target) => incDecNumber(target, -10);
function incDecNumber({ state, dispatch }, delta) {
  const specs = [];
  for (const sel of state.selection.ranges) {
    let { from, to } = sel;
    if (from === to) {
      const line = state.doc.lineAt(from);
      const numRange = extractNumber(line.text, from - line.from);
      if (numRange) {
        from = line.from + numRange[0];
        to = line.from + numRange[1];
      }
    }
    if (from !== to) {
      let value = updateNumber(state.doc.sliceString(from, to), delta);
      specs.push({
        changes: { from, to, insert: value },
        selection: EditorSelection.range(from, from + value.length)
      });
    } else {
      specs.push({ selection: sel });
    }
  }
  if (specs.some((s) => s.changes)) {
    const tr = state.update(...specs);
    dispatch(tr);
    return true;
  }
  return false;
}
function extractNumber(text2, pos) {
  let hasDot = false;
  let end = pos;
  let start = pos;
  let ch;
  const len = text2.length;
  while (end < len) {
    ch = text2.charCodeAt(end);
    if (isDot(ch)) {
      if (hasDot) {
        break;
      }
      hasDot = true;
    } else if (!isNumber(ch)) {
      break;
    }
    end++;
  }
  while (start >= 0) {
    ch = text2.charCodeAt(start - 1);
    if (isDot(ch)) {
      if (hasDot) {
        break;
      }
      hasDot = true;
    } else if (!isNumber(ch)) {
      break;
    }
    start--;
  }
  if (start > 0 && text2[start - 1] === "-") {
    start--;
  }
  if (start !== end) {
    return [start, end];
  }
  return;
}
function updateNumber(num, delta, precision = 3) {
  const value = parseFloat(num) + delta;
  if (isNaN(value)) {
    return num;
  }
  const neg = value < 0;
  let result = Math.abs(value).toFixed(precision);
  result = result.replace(/\.?0+$/, "");
  if ((num[0] === "." || num.startsWith("-.")) && result[0] === "0") {
    result = result.slice(1);
  }
  return (neg ? "-" : "") + result;
}
function isDot(ch) {
  return ch === 46;
}
function isNumber(code2) {
  return code2 > 47 && code2 < 58;
}
const removeTag = ({ state, dispatch }) => {
  const specs = [];
  for (const sel of state.selection.ranges) {
    const tag = getTagContext(state, sel.from);
    if (tag) {
      specs.push(removeTagSpec(state, tag));
    } else {
      specs.push({ selection: sel });
    }
  }
  if (specs.some((t) => t.changes)) {
    const tr = state.update(...specs);
    dispatch(tr);
    return true;
  }
  return false;
};
function removeTagSpec(state, { open, close }) {
  const changes = [];
  if (close) {
    const innerRange = narrowToNonSpace(state, { from: open.to, to: close.from });
    if (!rangeEmpty(innerRange)) {
      changes.push({ from: open.from, to: innerRange.from });
      const lineStart = state.doc.lineAt(open.from);
      const lineEnd = state.doc.lineAt(close.to);
      if (lineStart.number !== lineEnd.number) {
        let lineNum = lineStart.number + 2;
        const baseIndent = getLineIndent(state, open.from);
        const innerIndent = getLineIndent(state, innerRange.from);
        while (lineNum <= lineEnd.number) {
          const line = state.doc.line(lineNum);
          if (isSpace(line.text.slice(0, innerIndent.length))) {
            changes.push({
              from: line.from,
              to: line.from + innerIndent.length,
              insert: baseIndent
            });
          }
          lineNum++;
        }
      }
      changes.push({ from: innerRange.to, to: close.to });
    } else {
      changes.push({ from: open.from, to: close.to });
    }
  } else {
    changes.push(open);
  }
  return { changes };
}
function getLineIndent(state, pos) {
  return lineIndent(state.doc.lineAt(pos));
}
const selectNextItem = (target) => selectItemCommand(target, false);
const selectPreviousItem = (target) => selectItemCommand(target, true);
const htmlParents = /* @__PURE__ */ new Set(["OpenTag", "CloseTag", "SelfClosingTag"]);
const cssEnter = /* @__PURE__ */ new Set(["Block", "RuleSet", "StyleSheet"]);
const cssParents = /* @__PURE__ */ new Set(["RuleSet", "Block", "StyleSheet", "Declaration"]);
function selectItemCommand({ state, dispatch }, reverse) {
  let handled = false;
  const selections = [];
  for (const sel of state.selection.ranges) {
    const range = cssLanguage.isActiveAt(state, sel.from) ? getCSSRange(state, sel, reverse) : getHTMLRange(state, sel, reverse);
    if (range) {
      handled = true;
      selections.push(EditorSelection.range(range.from, range.to));
    } else {
      selections.push(sel);
    }
  }
  if (handled) {
    const tr = state.update({
      selection: EditorSelection.create(selections)
    });
    dispatch(tr);
    return true;
  }
  return false;
}
function getHTMLRange(state, sel, reverse) {
  const node = getStartHTMLNode(state, sel);
  const cursor = node.cursor();
  do {
    if (cursor.name === "OpenTag" || cursor.name === "SelfClosingTag") {
      const ranges = getHTMLCandidates(state, cursor.node);
      const range = findRange(sel, ranges, reverse);
      if (range) {
        return range;
      }
    }
  } while (moveHTMLCursor(cursor, reverse));
  return;
}
function getCSSRange(state, sel, reverse) {
  const node = getStartCSSNode(state, sel);
  const cursor = node.cursor();
  do {
    const ranges = getCSSCandidates(state, cursor.node);
    const range = findRange(sel, ranges, reverse);
    if (range) {
      return range;
    }
  } while (moveCSSCursor(cursor, reverse));
  return;
}
function moveHTMLCursor(cursor, reverse) {
  const enter = cursor.name === "Element";
  return reverse ? cursor.prev(enter) : cursor.next(enter);
}
function moveCSSCursor(cursor, reverse) {
  const enter = cssEnter.has(cursor.name);
  return reverse ? cursor.prev(enter) : cursor.next(enter);
}
function getStartHTMLNode(state, sel) {
  let node = syntaxTree(state).resolveInner(sel.to, 1);
  let ctx = node;
  while (ctx) {
    if (htmlParents.has(ctx.name)) {
      return ctx;
    }
    ctx = ctx.parent;
  }
  return node;
}
function getStartCSSNode(state, sel) {
  let node = syntaxTree(state).resolveInner(sel.to, 1);
  let ctx = node.parent;
  while (ctx) {
    if (cssParents.has(ctx.name)) {
      return ctx;
    }
    ctx = ctx.parent;
  }
  return node;
}
function getHTMLCandidates(state, node) {
  let result = [];
  let child = node.firstChild;
  while (child) {
    if (child.name === "TagName") {
      result.push(child);
    } else if (child.name === "Attribute") {
      result.push(child);
      const attrName2 = child.getChild("AttributeName");
      const attrValue = attrValueRange(state, child);
      if (attrName2 && attrValue) {
        result.push(attrName2, attrValue);
        if (substr(state, attrName2).toLowerCase() === "class") {
          result = result.concat(tokenList(substr(state, attrValue)));
        }
      }
    }
    child = child.nextSibling;
  }
  return result;
}
function getCSSCandidates(state, node) {
  let result = [];
  if (node.name === "RuleSet") {
    const selector = getSelectorRange(node);
    result.push(selector);
    const block = node.getChild("Block");
    if (block) {
      for (const child of block.getChildren("Declaration")) {
        result = result.concat(getCSSCandidates(state, child));
      }
    }
  } else if (node.name === "Declaration") {
    result.push(fullCSSDeclarationRange(node));
    const { name, value } = getPropertyRanges(node);
    name && result.push(name);
    value && result.push(value);
  }
  return result;
}
function attrValueRange(state, attr) {
  const value = attr.getChild("AttributeValue");
  if (value) {
    let { from, to } = value;
    const valueStr = substr(state, value);
    if (isQuote(valueStr[0])) {
      from++;
      if (valueStr[0] === valueStr[valueStr.length - 1]) {
        to--;
      }
    }
    if (from !== to) {
      return { from, to };
    }
  }
  return;
}
function tokenList(value, offset = 0) {
  const ranges = [];
  const len = value.length;
  let pos = 0;
  let start = 0;
  let end = len;
  while (pos < len) {
    end = pos;
    const ch = value.charAt(pos++);
    if (isSpace(ch)) {
      if (start !== end) {
        ranges.push({
          from: offset + start,
          to: offset + end
        });
      }
      while (isSpace(value.charAt(pos))) {
        pos++;
      }
      start = pos;
    }
  }
  if (start !== pos) {
    ranges.push({
      from: offset + start,
      to: offset + pos
    });
  }
  return ranges;
}
function findRange(sel, ranges, reverse = false) {
  if (reverse) {
    ranges = ranges.slice().reverse();
  }
  let needNext = false;
  let candidate;
  for (const r of ranges) {
    if (needNext) {
      return r;
    }
    if (r.from === sel.from && r.to === sel.to) {
      needNext = true;
    } else if (!candidate && (rangeContains(r, sel) || reverse && r.from <= sel.from || !reverse && r.from >= sel.from)) {
      candidate = r;
    }
  }
  return !needNext ? candidate : void 0;
}
const splitJoinTag = ({ state, dispatch }) => {
  const changes = [];
  for (const sel of state.selection.ranges) {
    const tag = getTagContext(state, sel.from);
    if (tag) {
      const { open, close } = tag;
      if (close) {
        let closing = isSpace(getChar(state, open.to - 2)) ? "/" : " /";
        changes.push({
          from: open.to - 1,
          to: close.to,
          insert: `${closing}>`
        });
      } else {
        let insert = `</${tag.name}>`;
        let from = open.to;
        let to = open.to;
        if (getChar(state, open.to - 2) === "/") {
          from -= 2;
          if (isSpace(getChar(state, from - 1))) {
            from--;
          }
          insert = ">" + insert;
        }
        changes.push({ from, to, insert });
      }
    }
  }
  if (changes.length) {
    const tr = state.update({ changes });
    dispatch(tr);
    return true;
  }
  return false;
};
function getChar(state, pos) {
  return state.doc.sliceString(pos, pos + 1);
}
const updateAbbreviation = StateEffect.define();
const wrapAbbreviationField = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateAbbreviation)) {
        value = effect.value;
      }
    }
    return value;
  }
});
const wrapTheme = EditorView.baseTheme({
  ".emmet-wrap-with-abbreviation": {
    position: "absolute",
    top: 0,
    zIndex: 2,
    width: "100%"
  },
  ".emmet-wrap-with-abbreviation__content": {
    background: "#fff",
    margin: "0 auto",
    padding: "5px",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "30em",
    borderBottomLeftRadius: "5px",
    borderBottomRightRadius: "5px",
    boxShadow: "0 3px 10px rgba(0, 0, 0, 0.3)"
  },
  ".emmet-wrap-with-abbreviation__content input": {
    width: "100%",
    boxSizing: "border-box"
  }
});
const enterWrapWithAbbreviation = ({ state, dispatch }) => {
  const abbr = state.field(wrapAbbreviationField);
  if (abbr === null) {
    const sel = state.selection.main;
    const context = getTagContext(state, sel.from);
    const wrapRange = getWrapRange(state, sel, context);
    const options = getOptions(state, wrapRange.from);
    options.text = getContent(state, wrapRange);
    const tr = state.update({
      effects: [updateAbbreviation.of({
        abbreviation: "",
        range: wrapRange,
        options,
        context
      })]
    });
    dispatch(tr);
    return true;
  }
  return false;
};
const wrapWithAbbreviationPlugin = ViewPlugin.fromClass(class WrapWithAbbreviationViewPlugin {
  constructor() {
    __publicField(this, "widget", null);
    __publicField(this, "input", null);
  }
  update(update) {
    const { state, view } = update;
    const abbr = state.field(wrapAbbreviationField);
    if (abbr) {
      if (!this.widget) {
        this.createInputPanel(view);
      }
      this.updateAbbreviation(abbr.abbreviation);
    } else if (this.widget) {
      this.disposeWidget();
      view.focus();
    }
  }
  createInputPanel(view) {
    const widget = document.createElement("div");
    widget.className = "emmet-wrap-with-abbreviation";
    const content = document.createElement("div");
    content.className = "emmet-wrap-with-abbreviation__content";
    const input = document.createElement("input");
    input.placeholder = "Enter abbreviation";
    let updated = false;
    const undoUpdate = () => {
      if (updated) {
        // undo(view);
        updated = false;
      }
    };
    input.addEventListener("input", () => {
      const abbr = view.state.field(wrapAbbreviationField);
      if (abbr) {
        const nextAbbreviation = input.value;
        undoUpdate();
        const nextAbbr = __spreadProps(__spreadValues({}, abbr), {
          abbreviation: nextAbbreviation
        });
        if (nextAbbr.abbreviation) {
          updated = true;
          const { from, to } = nextAbbr.range;
          const expanded = expand(nextAbbr.abbreviation, nextAbbr.options);
          const { ranges, snippet: snippet2 } = getSelectionsFromSnippet(expanded, from);
          const nextSel = ranges[0];
          view.dispatch({
            effects: [updateAbbreviation.of(nextAbbr)],
            changes: [{
              from,
              to,
              insert: snippet2
            }],
            selection: {
              head: nextSel.from,
              anchor: nextSel.to
            }
          });
        } else {
          view.dispatch({
            effects: [updateAbbreviation.of(nextAbbr)]
          });
        }
      }
    });
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape" || evt.key === "Enter") {
        if (evt.key === "Escape") {
          undoUpdate();
        }
        evt.preventDefault();
        view.dispatch({
          effects: [updateAbbreviation.of(null)]
        });
      }
    });
    content.append(input);
    widget.append(content);
    view.dom.append(widget);
    this.widget = widget;
    this.input = input;
    input.focus();
  }
  updateAbbreviation(value) {
    if (this.input && this.input.value !== value) {
      this.input.value = value;
    }
  }
  disposeWidget() {
    if (this.widget) {
      this.widget.remove();
      this.widget = this.input = null;
    }
  }
});
function wrapWithAbbreviation(key = "Ctrl-w") {
  return [
    wrapAbbreviationField,
    wrapWithAbbreviationPlugin,
    wrapTheme,
    keymap.of([{
      key,
      run: enterWrapWithAbbreviation
    }])
  ];
}
function getWrapRange(editor, range, context) {
  if (rangeEmpty(range) && context) {
    const { open, close } = context;
    const pos = range.from;
    if (inRange(open, pos) || close && inRange(close, pos)) {
      return {
        from: open.from,
        to: close ? close.to : open.to
      };
    }
    if (close) {
      return narrowToNonSpace(editor, { from: open.to, to: close.from });
    }
  }
  return range;
}
function inRange(range, pt) {
  return range.from < pt && pt < range.to;
}
function getContent(state, range) {
  const baseIndent = lineIndent(state.doc.lineAt(range.from));
  const srcLines = substr(state, range).split("\n");
  const destLines = srcLines.map((line) => {
    return line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line;
  });
  return destLines;
}
export { tracker as abbreviationTracker, balanceInward, balanceOutward, decrementNumber01, decrementNumber1, decrementNumber10, enterAbbreviationMode, evaluateMath, expandAbbreviation, goToNextEditPoint, goToPreviousEditPoint, goToTagPair, incrementNumber01, incrementNumber1, incrementNumber10, removeTag, selectNextItem, selectPreviousItem, splitJoinTag, toggleComment, wrapWithAbbreviation };