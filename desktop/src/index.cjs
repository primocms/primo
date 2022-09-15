const { app, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

// Electron Update
const isDev = require('electron-is-dev');
const checkInternetConnected = require('check-internet-connected');

autoUpdater.autoDownload = true;

autoUpdater.on('error', error => {
	dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
});

autoUpdater.on('update-available', () => {
	dialog
		.showMessageBox({
			type: 'info',
			title: 'Update available',
			message: 'A new version of Primo is available for download. Download and restart?',
			buttons: ['Okay', 'Later'],
		})
		.then(({ response }) => {
			if (response === 0) {
				autoUpdater.downloadUpdate();
				dialog.showMessageBox({
					title: 'Downloading',
					message: `The update is downloading in the background. When it's ready, you'll be prompted to restart.`,
				});
			}
		});
});

autoUpdater.on('update-not-available', () => {
	dialog.showMessageBox({
		title: 'No Updates Available',
		message: 'You have the latest version of Primo',
	});
});

autoUpdater.on('update-downloaded', downloaded => {
	console.log({ downloaded });
	dialog
		.showMessageBox({
			title: 'New Version Downloaded',
			message: 'The latest version has been downloaded. Primo will restart to apply the update.',
		})
		.then(() => {
			setImmediate(() => autoUpdater.quitAndInstall());
		});
});

// export this to MenuItem click callback
function checkForUpdates() {
	if (isDev) return;
	checkInternetConnected({ domain: 'primo.so' })
		.then(() => {
			autoUpdater.checkForUpdates();
		})
		.catch(err => {
			console.error('No connection', err);
			dialog.showMessageBox({
				title: 'No Connection',
				message: `It looks like you're not connected to the internet. You'll need that to download new versions.`,
			});
		});
}

ipcMain.on('check-for-update', async event => {
	checkForUpdates();
	event.returnValue = null;
});

const { BrowserWindow, shell } = require('electron');
const path = require('path');
const serve = require('electron-serve');

const isMac = process.platform === 'darwin';

// Live Reload
require('electron-reload')(__dirname, {
	electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
	awaitWriteFinish: true,
});

const serveURL = serve({ directory: 'build' });

const port = process.env.PORT || 5173;

let win;
const createWindow = () => {
	// Create the browser window.
	win = new BrowserWindow({
		titleBarStyle: isMac ? 'hidden' : 'default',
		minWidth: 650,
		width: 1200,
		height: 1200,
		webPreferences: {
			preload: `${__dirname}/preload.cjs`,
			enableRemoteModule: true,
			nodeIntegration: true,
			nativeWindowOpen: true,
		},
		show: false,
		acceptFirstMouse: true,
	});

	win.once('ready-to-show', () => {
		win.show();
	});

	// and load the index.html of the app.

	if (isDev) {
		win.webContents.openDevTools();
		loadVitePage(port);
	} else serveURL(win);

	// open external links in browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	function loadVitePage(port) {
		win.loadURL(`http://localhost:${port}`).catch(err => {
			console.log('VITE NOT READY, WILL TRY AGAIN IN 1000ms', port);
			setTimeout(() => {
				// do it again as the vite build can take a bit longer the first time
				loadVitePage(port);
			}, 1000);
		});
	}
};

const createPopup = () => {
	const popup = new BrowserWindow({
		minWidth: 200,
		width: 500,
		height: 900,
		webPreferences: {
			preload: `${__dirname}/preload.cjs`,
			enableRemoteModule: true,
			nodeIntegration: true,
			nativeWindowOpen: true,
		},
		darkTheme: true,
		show: false,
		// transparent: true
	});

	if (isDev) {
		popup.webContents.openDevTools();
		popup.loadURL(`http://localhost:${port}/preview`).catch(err => {
			console.log('Could not load preview', port);
		});
	} else {
		popup.loadURL(`app://-/preview`).catch(err => {
			console.log('Could not load preview', port);
		});
	}

	popup.show();
};

app.whenReady().then(createWindow);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// On right-click, open element in inspector
app.on('web-contents-created', (...[, /* event */ webContents]) => {
	webContents.on('context-menu', (event, click) => {
		event.preventDefault();
		win.webContents.inspectElement(click.x, click.y);
	});
});

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const fs = require('fs-extra');
const Store = require('electron-store');
const store = new Store();

let savePath = store.get('config.savePath') || app.getPath('userData') + '/sites';
let hosts = store.get('config.hosts') || [];
let serverConfig = store.get('config.serverConfig') || {
	url: '',
	token: '',
};
let language = store.get('config.language') || 'en';
let machineID = require('node-machine-id').machineIdSync(true);

ipcMain.on('get-machine-id', async event => {
	event.returnValue = machineID;
});
ipcMain.on('get-language', async event => {
	event.returnValue = language;
});
ipcMain.on('set-language', async (event, arg) => {
	language = arg;
	store.set('config.language', arg);
	event.returnValue = true;
});

// create sites directory if non-existant
fs.ensureDirSync(savePath);

// Create popup
ipcMain.on('create-popup', event => {
	createPopup();
	event.returnValue = true;
});

// Save/Load Data

// Saving: Create directory named after site, contains data.json, config.json, and preview.html

// Loading: Loop through directories

ipcMain.on('load-data', (event, directory) => {
	// convert any existing .json site files to directories
	const all_files = fs.readdirSync(savePath);
	all_files
		.filter(file => {
			const extension = file.slice(file.indexOf('.') + 1); // get file extension
			return extension === 'json';
		})
		.forEach(file => {
			const file_directory = `${savePath}/${file}`;

			const name = file.slice(0, file.indexOf('.'));
			const data = fs.readJsonSync(file_directory, { throws: false });

			const preview_exists = fs.existsSync(`${savePath}/${name}.html`);
			const preview = preview_exists ? fs.readFileSync(`${savePath}/${name}.html`, 'utf8') : '';

			if (data) {
				// write to directory
				const site_directory = `${savePath}/${name}`;
				if (!fs.existsSync(site_directory)) {
					fs.mkdir(site_directory);
					fs.writeJSONSync(`${site_directory}/data.json`, data);
					fs.writeJSONSync(`${site_directory}/config.json`, {});
					fs.writeFileSync(`${site_directory}/preview.html`, preview);

					fs.unlinkSync(`${site_directory}.json`);
					if (preview_exists) fs.unlinkSync(`${site_directory}.html`);
				}
			}
		});

	// retrieve sites from directories
	const updated_files = fs.readdirSync(savePath);
	const directories = updated_files.filter(item => fs.lstatSync(`${directory}/${item}`).isDirectory());
	const sites = directories.map(siteDirectory => ({
		data: fs.readJsonSync(`${directory}/${siteDirectory}/data.json`, { throws: false }),
		config: fs.readJsonSync(`${directory}/${siteDirectory}/config.json`, { throws: false }),
		preview: fs.readFileSync(`${directory}/${siteDirectory}/preview.html`, 'utf8'),
	}));

	event.returnValue = sites;
});

ipcMain.on('set-preview', (event, site) => {
	if (site.preview) {
		fs.writeFileSync(`${savePath}/${site.id}/preview.html`, site.preview);
	}
	event.returnValue = true;
});

ipcMain.on('set-deployment', (event, site) => {
	const config = fs.readJsonSync(`${savePath}/${site.id}/config.json`, { throws: false });
	fs.writeJSONSync(`${savePath}/${site.id}/config.json`, {
		...config,
		deployment: site.deployment,
	});
	event.returnValue = true;
});

// Save site
ipcMain.handle('save-data', async (event, site) => {
	const directory = `${savePath}/${site.id}`;
	if (!fs.existsSync(directory)) fs.mkdir(directory);
	fs.writeJSON(`${directory}/data.json`, site);

	if (!fs.existsSync(`${directory}/config.json`)) fs.writeJSONSync(`${directory}/config.json`, {});

	return true;
});

// Delete site
ipcMain.on('delete-site', (event, site) => {
	fs.unlinkSync(`${savePath}/${site}.json`);
	event.returnValue = true;
});

// Set directory to save sites
ipcMain.on('set-save-directory', async (event, arg) => {
	const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
	if (!res.canceled) {
		savePath = res.filePaths[0];
		store.set('config.savePath', savePath);
	}
	event.reply('get-save-directory', res);
});

ipcMain.on('current-save-directory', async (event, arg) => {
	event.returnValue = savePath;
});

// HOSTS
ipcMain.on('set-hosts', async (event, arg) => {
	hosts = arg;
	store.set('config.hosts', arg);
	event.returnValue = true;
});

ipcMain.on('get-hosts', async event => {
	event.returnValue = hosts;
});

// SERVER
ipcMain.on('set-server-config', async (event, arg) => {
	serverConfig = arg;
	store.set('config.serverConfig', arg);
	event.returnValue = true;
});

ipcMain.on('get-server-config', async event => {
	event.returnValue = serverConfig;
});

// POSTCSS
const postcss = require('postcss');
const nested = require('postcss-nested');
const autoprefixer = require('autoprefixer');
const postcssPresetEnv = require('postcss-preset-env');
ipcMain.handle('process-css', async (event, data) => {
	const res = await postcss([
		postcssPresetEnv({
			stage: 3,
			features: {
				'nesting-rules': false,
			},
		}),
		nested(),
	])
		.process(data, { from: undefined })
		.catch(e => {
			return {
				error: e.message,
			};
		});
	const processed = {
		css: res.css,
		error: res.error,
	};
	return processed;
});

// Svelte
const { compileSvelte } = require('./compile.cjs');
ipcMain.handle('process-svelte', async (event, data) => {
	return await compileSvelte(data);
});
