# Primo Desktop

Run primo on your Desktop

## How it works

All your sites get saved as .json files. You can set the directory they get saved to from within the app. 

## Running

1. `npm install`
1. `npm run start`

### Linking 

Running this repo locally will let you modify the electron wrapper around Primo, but not the editor itself. To do that, you'll need to: 
1. Clone [primo](https://github.com/primo-af/primo)
1. `cd primo` 
1. `npm install`
1. `npm link`
1. From `primo-desktop`, run `npm link @primo-app/primo` 
1. `npm run start`

This will make it so changes in either directory will be registered by vite. 

## Building 

1. `npm run build`
1. `npm run make` for Mac (binary at `out/primo-darwin-x64/primo.app`)
1. `npm run make-windows` for Windows (binary at `primo-win32-x64/primo.exe`)