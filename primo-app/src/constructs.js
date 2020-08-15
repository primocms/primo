import { get } from 'svelte/store';
import { tailwindConfig } from '../../const'

export const Preferences = (settings = {}) => ({
  globalStyles: settings.globalStyles || { uncompiled: '', compiled: '', tailwindConfig },
  javascript: settings.javascript || ''
})

export const TbButton = (title, attr, icon, key = null, action = null, fn = () => {}, buttonStyles = '') => ({
  title,
  attr, 
  icon,
  key,
  action,
  onclick: fn,
  buttonStyles
});

export const User = (user = {
  uid: null,
  email: null,
  verified: false,
  githubUsername: null,
  githubToken: null,
  role: null,
  signedIn: false,
  canEditPage: false
  // domains: []
}) => ({
  uid: user.uid,
  email: user.email,
  verified: user.verified,
  type: user.type || 'email',
  githubUsername: user.githubUsername,
  githubToken: user.githubToken,
  role: user.role,
  signedIn: user.signedIn,
  canEditPage: user.canEditPage
  // domains
})

