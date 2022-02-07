const { app, autoUpdater, dialog } = require('electron')

const isDev = require('electron-is-dev');
const checkInternetConnected = require('check-internet-connected');

if (!isDev) {
  // Check for updates
  const url = `https://update.electronjs.org/primo-af/primo/${process.platform}/${app.getVersion()}`
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

require('./src/index.cjs')