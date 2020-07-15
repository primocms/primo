const sirv = require('sirv');
const polka = require('polka');
const compress = require('compression')();

// Init `sirv` handler
const assets = sirv('public', {
  maxAge: 31536000, // 1Y
  immutable: true
});
 
polka()
  .use(compress, assets)
  .listen(3005, err => {
    if (err) throw err;
    console.log(`> Running on localhost:3005`);
  });