import axios from '$lib/libraries/axios';

export async function pushSite({ token, repo, files, activeSha = null }) {
	console.log('Pushing site', token, repo);
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github.v3+json',
	};
	const tree = await createTree();
	const commit = await createCommit(tree.sha);
	const final = await pushCommit(commit.sha);
	return final.object.sha;

	async function createTree() {
		const bundle = files.map(file => ({
			path: file.file,
			content: file.data,
			type: 'blob',
			mode: '100644',
		}));
		const { data } = await axios.post(
			`https://api.github.com/repos/${repo}/git/trees`,
			{
				tree: bundle,
				base_tree: activeSha,
			},
			{ headers }
		);
		return data;
	}

	async function createCommit(tree) {
		const { data } = await axios.post(
			`https://api.github.com/repos/${repo}/git/commits`,
			{
				message: 'Update site',
				tree,
				...(activeSha ? { parents: [activeSha] } : {}),
			},
			{ headers }
		);
		return data;
	}

	async function pushCommit(commitSha) {
		const { data } = await axios.patch(
			`https://api.github.com/repos/${repo}/git/refs/heads/main`,
			{
				sha: commitSha,
				force: true,
			},
			{ headers }
		);
		return data;
	}
}

let counter = 0;
export async function createRepo({ token, name }) {
	const headers = { Authorization: `Bearer ${token}` };
	const { data } = await axios
		.post(
			`https://api.github.com/user/repos`,
			{
				name: name + (counter ? `-${counter}` : ''),
				auto_init: true,
			},
			{ headers }
		)
		.catch(e => ({ data: null }));

	// if repo already exists, try again by adding a -1, -2, -3 etc to the end
	if (data) return data;
	else {
		counter++;
		return await createRepo({ token, name }).catch(e => ({ data: null }));
	}
}
