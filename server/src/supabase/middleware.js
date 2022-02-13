// import firebase from '../firebase/index.js'
// const functions = firebase.functions()

// if (window.location.hostname === 'localhost') {
//   functions.useFunctionsEmulator('http://localhost:5001')
// }

// export async function checkIfUsernameAvailable(username) {
//   const {data:available} = await functions.httpsCallable('checkIfUsernameAvailable')({ username })
//   return available
// }

// export async function acceptSiteInvitation({ password, uid, owner, url }) {
//   const {data} = await functions.httpsCallable('acceptSiteInvitation')({ password, uid, owner, url })
//   return data
// }

// export async function getGithubAuthToken(code) {
//   const {data} = await functions.httpsCallable('getGithubAuthToken')(code)
//   const urlSearchParams = new URLSearchParams(data);
//   const params = Object.fromEntries(urlSearchParams.entries());
//   return params.access_token
// }