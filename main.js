const path = require('path');
require('icloud-windows-base').run({
  appName: 'iCloud Notes',
  protocol: 'icloud-notes',
  icloudUrl: 'https://www.icloud.com/notes',
  splashPath: path.join(__dirname, 'splash.html'),
  iconPath: path.join(__dirname, 'icon.png')
});
