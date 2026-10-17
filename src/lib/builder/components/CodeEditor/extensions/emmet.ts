import { abbreviationTracker, expandAbbreviation, EmmetKnownSyntax } from '@emmetio/codemirror6-plugin'

export function emmetExtension(syntax: keyof typeof EmmetKnownSyntax = 'html') {
	return abbreviationTracker({
		syntax: EmmetKnownSyntax[syntax] // Specify document syntax (html, css, jsx, etc.)
	})
}

export { expandAbbreviation }
