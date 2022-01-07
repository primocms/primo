const { app, BrowserWindow, ipcMain, shell, autoUpdater, dialog } = require('electron');
const path = require('path');
const serve = require('electron-serve');
const isDev = require('electron-is-dev');
const checkInternetConnected = require('check-internet-connected');

if (!isDev) {
  // Check for updates
  const server = 'https://update.electronjs.org'
  const url = `${server}/primo-af/primo-desktop/${process.platform}/${app.getVersion()}`
  autoUpdater.setFeedURL({ url })
  setInterval(() => {
    const config = {
      timeout: 5000, //timeout connecting to each try (default 5000)
      retries: 3,//number of retries to do before failing (default 5)
      domain: 'primo.af'//the domain to check DNS record of
    }
  
    checkInternetConnected(config)
      .then(() => {
        autoUpdater.checkForUpdates()    
      }).catch((err) => {
        console.log("No connection", err);
      });

  }, 60000)

  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail: 'A new version has been downloaded. Restart the application to apply the updates.'
    }

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', e => {
    console.log(e)
    dialog.showMessageBox({
      title: 'Error here',
      message: e.message
    })
    console.error('There was a problem updating the application')
    console.error(e)
  })
}


const isMac = (process.platform === "darwin")

// Live Reload
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
  awaitWriteFinish: true
});

const serveURL = serve({ directory: "build" });

let win
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
      nativeWindowOpen: true
    },
    show: false
  });

  win.once('ready-to-show', () => {
    win.show()
  })

  // and load the index.html of the app.
  const isDev = !app.isPackaged
  const port = process.env.PORT || 3333
  if (isDev) {
    loadVitePage(port)
  } else serveURL(win);


  // open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });

  function loadVitePage(port) {
    win.loadURL(`http://localhost:${port}`).catch((err) => {
      console.log('VITE NOT READY, WILL TRY AGAIN IN 1000ms', port)
      setTimeout(() => {
        // do it again as the vite build can take a bit longer the first time
        loadVitePage(port)
      }, 1000)
    })
  }
};

app.whenReady().then(createWindow)


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
app.on("web-contents-created", (...[/* event */, webContents]) => {
  webContents.on("context-menu", (event, click) => {
    event.preventDefault();
    win.webContents.inspectElement(click.x, click.y)
  }, false);
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

const fs = require('fs-extra')
const Store = require('electron-store');
const store = new Store();

let savePath = store.get('config.savePath') || app.getPath('userData') + '/sites'
let hosts = store.get('config.hosts') || []
let serverConfig = store.get('config.serverConfig') || {
  url: '',
  token: ''
}

// create sites directory if non-existant
fs.ensureDirSync(savePath)

// Save/Load Data
ipcMain.on('load-data', (event, directory) => {
  const files = fs.readdirSync(savePath)
  const sites = []
  files.forEach(file => {
    const data = fs.readJsonSync(`${directory}/${file}`, { throws: false })
    if (data) sites.push(data)
  })
  event.returnValue = sites
})

ipcMain.on('save-data', (event, sites) => {
  sites.forEach(site => {
    fs.writeJsonSync(`${savePath}/${site.id}.json`, site, { throws: false, spaces: '\t' })
  })
  event.returnValue = true
})

ipcMain.on('delete-site', (event, site) => {
  fs.unlinkSync(`${savePath}/${site}.json`)
  event.returnValue = true
})

// SAVE DIRECTORY
ipcMain.on('set-save-directory', async (event, arg) => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  if (!res.canceled) {
    savePath = res.filePaths[0]
    store.set('config.savePath', savePath);
  }
  event.reply('get-save-directory', res)
})

ipcMain.on('current-save-directory', async (event, arg) => {
  event.returnValue = savePath
})

// HOSTS
ipcMain.on('set-hosts', async (event, arg) => {
  hosts = arg
  store.set('config.hosts', arg);
  event.returnValue = true
})

ipcMain.on('get-hosts', async (event) => {
  event.returnValue = hosts
})

// SERVER
ipcMain.on('set-server-config', async (event, arg) => {
  serverConfig = arg
  store.set('config.serverConfig', arg);
  event.returnValue = true
})

ipcMain.on('get-server-config', async (event) => {
  event.returnValue = serverConfig
})

// POSTCSS
const postcss = require('postcss')
const nested = require('postcss-nested')
const autoprefixer = require('autoprefixer')
ipcMain.handle('process-css', async (event, data) => {
  const res = await postcss([
    autoprefixer(),
    nested()
  ]).process(data, { from: undefined }).catch(e => {
    return {
      error: e.message
    }
  })
  const processed = {
    css: res.css,
    error: res.error
  }
  return processed
})