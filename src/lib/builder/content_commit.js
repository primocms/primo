/** Observe a detached autosave through its UI; manager.commit still rejects for callers.
 * @param {Promise<unknown>} commit
 * @param {{onSaved: () => void, onError: (error: unknown) => void}} callbacks
 */
export function observeContentCommit(commit, {onSaved, onError}) {
 return commit.then(() => onSaved(), error => onError(error))
}
