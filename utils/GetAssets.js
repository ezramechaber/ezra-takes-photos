const fs = require('fs-extra');
let assets;

// Using @Potch's .glitch-assets function, return uploaded photos as an object.
module.exports = function getAssets(includeDeleted = false) {
  // reflects the history and current start of the project's assets
  let contents = fs.readFileSync("./.glitch-assets").toString("utf8");
  // each line is its own JSON chronological entry
  let lines = contents.split("\n").filter(line => line.trim().length > 0);
  let rows = lines.map(line => JSON.parse(line));
  // reduce the entries into the current state of the assets
  let obj = {};
  rows.forEach(row => {
    let id = row.uuid;
    if (obj[id]) {
      // if the asset already exists, update it
      Object.assign(obj[id], row);
    } else {
      // otherwise, create an entry for the asset
      obj[id] = row;
    }
  });
  // optionally remove deleted entries
  assets = Object.values(obj);
  if (!includeDeleted) {
    assets = assets.filter(asset => !asset.deleted);
  }
  return assets;
}

module.exports.getAssets = assets;