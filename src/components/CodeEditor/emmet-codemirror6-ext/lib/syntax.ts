import { SyntaxType, CSSAbbreviationScope, AbbreviationContext } from 'emmet';
import { attributes } from '@emmetio/html-matcher';
import { CSSContext, HTMLContext, getHTMLContext, getCSSContext } from '@emmetio/action-utils';
import {EditorState} from "@codemirror/state";
import {attributeValue, last} from "./utils"

const xmlSyntaxes = ['xml', 'xsl', 'jsx'];
const htmlSyntaxes = ['html', 'htmlmixed', 'vue'];
const cssSyntaxes = ['css', 'scss', 'less'];
const jsxSyntaxes = ['jsx', 'tsx'];
const markupSyntaxes = ['haml', 'jade', 'pug', 'slim'].concat(htmlSyntaxes, xmlSyntaxes, jsxSyntaxes);
const stylesheetSyntaxes = ['sass', 'sss', 'stylus', 'postcss'].concat(cssSyntaxes);

export interface SyntaxInfo {
    type: SyntaxType;
    syntax?: string;
    inline?: boolean;
    context?: HTMLContext | CSSContext;
}

/**
 * Returns Emmet syntax info for given location in view.
 * Syntax info is an abbreviation type (either 'markup' or 'stylesheet') and syntax
 * name, which is used to apply syntax-specific options for output.
 *
 * By default, if given location doesn’t match any known context, this method
 * returns `null`, but if `fallback` argument is provided, it returns data for
 * given fallback syntax
 */
export function syntaxInfo(syntax: string, state: EditorState, pos: number): SyntaxInfo {
    let inline: boolean | undefined;
    let context: HTMLContext | CSSContext | undefined;
    const content = state.doc.toString();

    if (isHTML(syntax)) {
        context = getHTMLContext(content, pos, {
            xml: isXML(syntax)
        });

        if (context.css) {
            // `pos` is in embedded CSS
            syntax = getEmbeddedStyleSyntax(content, context) || 'css';
            inline = context.css.inline;
            context = context.css;
        }
    } else if (isCSS(syntax)) {
        context = getCSSContext(content, pos);
    }

    return {
        type: getSyntaxType(syntax),
        syntax,
        inline,
        context
    };
}

/**
 * Returns Emmet abbreviation type for given syntax
 */
export function getSyntaxType(syntax?: string): SyntaxType {
    return syntax && stylesheetSyntaxes.includes(syntax) ? 'stylesheet' : 'markup';
}

/**
 * Check if given syntax is XML dialect
 */
export function isXML(syntax?: string): boolean {
    return syntax ? xmlSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is HTML dialect (including XML)
 */
export function isHTML(syntax?: string): boolean {
    return syntax
        ? htmlSyntaxes.includes(syntax) || isXML(syntax)
        : false;
}

/**
 * Check if given syntax name is supported by Emmet
 */
export function isSupported(syntax: string): boolean {
    return syntax
        ? markupSyntaxes.includes(syntax) || stylesheetSyntaxes.includes(syntax)
        : false;
}

/**
 * Check if given syntax is a CSS dialect. Note that it’s not the same as stylesheet
 * syntax: for example, SASS is a stylesheet but not CSS dialect (but SCSS is)
 */
export function isCSS(syntax?: string): boolean {
    return syntax ? cssSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is JSX dialect
 */
export function isJSX(syntax?: string): boolean {
    return syntax ? jsxSyntaxes.includes(syntax) : false;
}

/**
 * Returns embedded stylesheet syntax from given HTML context
 */
export function getEmbeddedStyleSyntax(code: string, ctx: HTMLContext): string | undefined {
    const parent = last(ctx.ancestors);
    if (parent && parent.name === 'style') {
        for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
            if (attr.name === 'type') {
                return attributeValue(attr);
            }
        }
    }
}