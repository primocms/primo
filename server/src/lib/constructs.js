import { get } from 'svelte/store';

export const User = (user = {
  id: null,
  uid: null,
  username: null,
  email: null,
  verified: false,
  githubUsername: null,
  githubID: null,
  hosts: null,
  signedIn: false,
  role: null,
  admin: false
}) => ({
  id: user.id,
  uid: user.uid,
  username: user.username,
  email: user.email,
  verified: user.verified,
  type: user.type || 'email',
  githubUsername: user.githubUsername,
  githubID: user.githubID,
  role: user.role,
  admin: user.admin
})


