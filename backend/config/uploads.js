const path = require('path');

// Where uploaded student photos are written.
//
// Defaults to a folder inside the project, which is right for local development.
// On a hosted environment the container filesystem is usually ephemeral — it is
// rebuilt from the image on every deploy or restart — so anything written here at
// runtime is lost, leaving photoUrl values in the database pointing at files that
// no longer exist. Attaching a persistent disk and setting UPLOADS_DIR to its mount
// path keeps the photos across restarts without any code change.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

module.exports = { UPLOADS_DIR };
