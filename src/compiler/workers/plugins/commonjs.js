import { parse } from 'acorn';
import { walk } from 'estree-walker';

const require = `function require(id) {
	if (id in __repl_lookup) return __repl_lookup[id];
	throw new Error(\`Cannot require modules dynamically (\${id})\`);
}`;

/** @type {import('@rollup/browser').Plugin} */
export default {
	name: 'commonjs',

	transform: (code, id) => {
		// console.log('commonjs', code, id)
		let transformed_code = code;
		if (/\b(require|module|exports)\b/.test(code)) {
			transformed_code = fix_imports_and_exports(transformed_code);
		}

		if (/process\.env\.NODE_ENV/.test(code)) {
			transformed_code = replace_env(transformed_code);
		}

		return transformed_code;
	}
};

function replace_env(code) {
	try {
		const replaced = code.replace(/process\.env\.NODE_ENV/g, JSON.stringify('production'));
		return replaced;
	} catch (e) {
		console.log('error replacing env', e, code);
		return code;
	}
}

function fix_imports_and_exports(code) {
	try {
		const ast = parse(code, {
			// for some reason this hangs for some code if you use 'latest'. change with caution
			ecmaVersion: 'latest'
		});

		/** @type {string[]}  */
		const requires = [];

		// @ts-ignore
		walk(ast, {
			enter: (node) => {
				// @ts-ignore
				if (node.type === 'CallExpression' && node.callee.name === 'require') {
					if (node.arguments.length !== 1) return;
					const arg = node.arguments[0];
					if (arg.type !== 'Literal' || typeof arg.value !== 'string') return;

					requires.push(arg.value);
				}
			}
		});

		const imports = requires.map((id, i) => `import __repl_${i} from '${id}';`).join('\n');
		const lookup = `const __repl_lookup = { ${requires
			.map((id, i) => `'${id}': __repl_${i}`)
			.join(', ')} };`;
		const exports = ((code) => {
			const exportPattern = /exports\.(\w+) = (\w+);/g;
			let match;
			let exportVars = [];

			// Find all matching exports patterns
			while ((match = exportPattern.exec(code)) !== null) {
				const exportedName = match[1];
				const variableName = match[2];

				// Include both the exported name and the variable name
				const exportVar =
					exportedName === variableName ? variableName : `${variableName} as ${exportedName}`;
				exportVars.push(exportVar);
			}

			if (exportVars.length > 0) {
				return 'export { ' + exportVars.join(', ') + ' };';
			}

			return '';
		})(code);

		const transformed = [
			imports,
			lookup,
			require,
			`const exports = {}; const module = { exports };`,
			code,
			exports,
			`export default module.exports;`
		].join('\n\n');

		// console.log({ code, transformed, exports })

		return transformed;
	} catch (err) {
		return code;
	}
}
