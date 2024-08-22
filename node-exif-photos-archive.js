const fs = require("fs-extra");
const glob = require("fast-glob");
const optimisePhoto = require("./utils/OptimisePhoto");
const writeExifFile = require("./utils/WriteExifFile");
const fetch = require("node-fetch");
const url = require("url");
const util = require("util");
const streamPipeline = util.promisify(require("stream").pipeline);
let filePath = "src/_exifdata/temp.jpg";

(async function() {
  const OPTIONS = {
    widths: [520, 960],
    // input_photos_dir: "src/_photos",
    output_photos_dir: "src/photos"
  };

  // This step uses Potch's .glitch-assets trick.
  function getAssets(includeDeleted = false) {
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
    let assets = Object.values(obj);
    if (!includeDeleted) {
      assets = assets.filter(asset => !asset.deleted);
    }
    return assets;
  }

  // This maps our assets' urls to an array called Files
  var files = getAssets().map(asset => asset.url);

  // This one works
  // var files = ['https://cdn.glitch.com/b0448aae-c5af-43c6-9c11-8f8a84c571df%2FP5290316.jpg'];

  // Copy the contents _exifdata/_exifdata.json file because we're about to dump the folder's contents and we don't want to lose the file.
  var templateDataFile = fs.readFileSync(
    "src/_exifdata/_exifdata.json",
    "utf8"
  );

  // Empty the _exifdata folder - regenerate files based on current photos tree
  fs.emptyDirSync("src/_exifdata");

  // Re-write the json file to enable a collection
  fs.writeJson(
    "src/_exifdata/_exifdata.json",
    JSON.parse(templateDataFile),
    err => {
      if (err) return console.error(err);
      console.log("Wrote _exifdata.json file.");
    }
  );

  // This is where we process each file in the array.

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    console.log("1. File to extract: ", file);

    async function download() {
      const response = await fetch(file);
      if (!response.ok)
        throw new Error(`unexpected response ${response.statusText}`);
      await streamPipeline(response.body, fs.createWriteStream(filePath));
    }
    await download();

    console.log('2. Downloaded');

    // 2. run the optimisePhoto function on filePath
    await optimisePhoto(filePath, OPTIONS.widths, OPTIONS.output_photos_dir);
    console.log('3. Optimized');
    // 3. run the writeExifFile function on filePath
    // Writes a file with JSON frontmatter exposing the exif data
    // await writeExifFile(filePath, OPTIONS.input_photos_dir);
    await writeExifFile(filePath);
    console.log('4. Exif data written');
    // 4. remove the image file at filePath once all this is done
    await fs
      .remove(filePath)
      .then(() => {
        console.log("5." + filePath + " file removed.");
      })
      .catch(err => {
        console.error(err);
      });
  }

  //   await files.forEach(async file => {
  //     // Creates optimised versions for each item in OPTIONS.widths, always creates a 20px wide blur
  //     // These are available in the same folder w{width} eg. /w320/dd_LL_yyyy_hhmmss.jpg
  //     console.log("1. File to extract: ", file);

  //     // This is the temporary file we wish to create for purposes of analyzing the exif data, because fs can't work on remote URLs.

  //     // 1. download the file using streamPipeline to filePath (via https://github.com/node-fetch/node-fetch/issues/375)
  //     async function download () {
  //       const response = await fetch(file)
  //       // console.log('2. download() response', response);
  //       if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)
  //       await streamPipeline(response.body, fs.createWriteStream(filePath))
  //     }
  //     await download()

  //     // prob don't need -- file = filePath;

  //     // 2. run the optimisePhoto function on filePath
  //     await optimisePhoto(filePath, OPTIONS.widths, OPTIONS.output_photos_dir);

  //     // 3. run the writeExifFile function on filePath
  //      // Writes a file with JSON frontmatter exposing the exif data
  //     // await writeExifFile(filePath, OPTIONS.input_photos_dir);
  //     await writeExifFile(filePath);

  //     // 4. remove the image file at filePath once all this is done
  //     await fs.remove(filePath)
  //       .then(() => {
  //         console.log('3.' + filePath + ' file removed.')
  //       })
  //       .catch(err => {
  //         console.error(err)
  //       })
  // });
})();
