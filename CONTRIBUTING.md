# Contributing

Contributions to Primo are very welcome. You can start by submitting a PR to address any of the [open issues](https://github.com/primocms/primo/issues), but for the sake of keeping the codebase simple and aligned towards the project's mission, we ask that you first start a discussion before attempting to contribute any new features. You can do this by starting a discussion in the [Forum](https://forum.primo.so), [Github Discussions](https://github.com/primocms/primo/discussions), or the [Discord](https://discord.gg/vzSFTS9). Or, if you'd like to contribute to the project but don't know where to start, feel free to fill out the [contributor form](https://primocms.org/contributions).

## Running locally

1. Clone the main Primo repo 
```
git clone https://github.com/primocms/primo.git
```
2. Clone the builder repo
```
git clone https://github.com/primocms/builder
```
3. Link the builder to Primo 
```
cd builder
npm link
npm install
npm run package-watch
```
4. Run Primo
```
cd ../primo
npm install 
npm link @primocms/builder
npm run dev
```
5. Open your browser to http://localhost:5173

If you have any issues setting this up, it's probably *not* just you, so feel free to pop into any of the discussion spaces linked above for some help. 
