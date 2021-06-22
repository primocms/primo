import expandAbbreviation, { extract as extractAbbreviation, UserConfig, AbbreviationContext, ExtractedAbbreviation, Options, ExtractOptions, resolveConfig, MarkupAbbreviation, StylesheetAbbreviation, SyntaxType } from 'emmet';
import match, { balancedInward, balancedOutward } from '@emmetio/html-matcher';
import { balancedInward as cssBalancedInward, balancedOutward as cssBalancedOutward } from '@emmetio/css-matcher';
import { selectItemCSS, selectItemHTML, TextRange } from '@emmetio/action-utils';
import evaluate, { extract as extractMath, ExtractOptions as MathExtractOptions } from '@emmetio/math-expression';
import { isXML, syntaxInfo, getMarkupAbbreviationContext, getStylesheetAbbreviationContext } from './syntax';
import { getContent, isQuotedString } from './utils';
import getEmmetConfig from './config';
import getOutputOptions, { field } from './output';

/**
 * Cache for storing internal Emmet data.
 * TODO reset whenever user settings are changed
 */
let cache = {};

export const JSX_PREFIX = '<';

/**
 * Expands given abbreviation into code snippet
 */
export function expand(abbr: string | MarkupAbbreviation | StylesheetAbbreviation, config?: UserConfig) {
    let opt: UserConfig = { cache };
    const outputOpt: Partial<Options> = {
        'output.field': field(),
        'output.format': !config || !config['inline'],
    };

    if (config) {
        Object.assign(opt, config);
        if (config.options) {
            Object.assign(outputOpt, config.options);
        }
    }

    opt.options = outputOpt;

    return expandAbbreviation(abbr as string, opt);
}