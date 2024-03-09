import postcss from 'postcss'
import postcssNested from 'postcss-nested'
import autoprefixer from 'autoprefixer'

export default async function (css) {
	if (!css) {
		return
	}

	let final = ''
	try {
		// Process the CSS
		const result = await postcss([
			postcssNested, // to process nested css rules
			autoprefixer // to add vendor prefixes
		]).process(css, { from: undefined }) // 'from' option is set to undefined because the source is unknown in a cloud function
		final = result.css
	} catch (error) {
		console.error('Error processing CSS:', error)
	}
	return final
}
