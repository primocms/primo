import {writable} from 'svelte/store'

export let options = writable({
  logo: `data:image/svg+xml,%0A%3Csvg width='858' height='472' viewBox='0 0 858 472' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_101_118)'%3E%3Cpath d='M293.093 471.893C282.303 471.893 271.513 467.838 263.386 459.59L12.4183 209.2C4.57123 201.371 0.0871582 190.606 0.0871582 179.562C0.0871582 168.517 4.57123 157.752 12.4183 149.923L146.1 16.5496C162.494 0.192488 189.119 0.192488 205.514 16.5496C221.908 32.9067 221.908 59.4696 205.514 75.8267L101.539 179.562L322.66 400.173C339.055 416.53 339.055 443.093 322.66 459.45C314.392 467.699 303.743 471.753 292.953 471.753L293.093 471.893Z' fill='url(%23paint0_linear_101_118)'/%3E%3Cpath d='M682.086 354.876C671.296 354.876 660.506 350.822 652.379 342.574C635.984 326.216 635.984 299.654 652.379 283.296L756.353 179.562L652.379 75.8267C635.984 59.4696 635.984 32.9067 652.379 16.5496C668.774 0.192489 695.398 0.192489 711.793 16.5496L845.474 149.923C853.321 157.752 857.805 168.517 857.805 179.562C857.805 190.606 853.321 201.371 845.474 209.2L711.793 342.574C703.525 350.822 692.876 354.876 682.086 354.876Z' fill='%2335D994'/%3E%3Cpath d='M293.093 471.893C269.832 471.893 251.055 453.159 251.055 429.951V178.443C251.055 80.4402 330.927 0.751709 429.016 0.751709C527.105 0.751709 607.118 80.4402 607.118 178.443C607.118 276.446 527.245 356.135 429.016 356.135C405.755 356.135 386.978 337.401 386.978 314.193C386.978 290.986 405.755 272.252 429.016 272.252C480.863 272.252 523.042 230.171 523.042 178.443C523.042 126.716 480.863 84.6344 429.016 84.6344C377.169 84.6344 334.991 126.716 334.991 178.443V429.951C334.991 453.159 316.214 471.893 292.953 471.893H293.093Z' fill='%2335D994'/%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear_101_118' x1='79.259' y1='83.2363' x2='388.925' y2='393.617' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%2335D994'/%3E%3Cstop offset='0.16' stop-color='%2332D28E'/%3E%3Cstop offset='0.38' stop-color='%2329BF80'/%3E%3Cstop offset='0.64' stop-color='%231CA169'/%3E%3Cstop offset='0.93' stop-color='%23097649'/%3E%3Cstop offset='0.95' stop-color='%23097548'/%3E%3C/linearGradient%3E%3CclipPath id='clip0_101_118'%3E%3Crect width='857.718' height='471.141' fill='white' transform='translate(0.0871582 0.751709)'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E%0A`
})

export const saving = writable(false)

export const saved = writable(true)

export const showingIDE = writable(false)

export const userRole = writable('developer')

export const showKeyHint = writable(false)

export const loadingSite = writable(false)

export const onMobile = !import.meta.env.SSR ? writable(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) : writable(false)

export const locale = writable('en')

export const highlightedElement = writable(null)

export const hoveredBlock = writable({
  i: 0,
  id: null,
  position: ''
})
