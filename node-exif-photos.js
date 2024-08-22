const fs = require("fs-extra");
const getDateFromPhoto = require("./utils/GetDateFromPhoto");
const formatDate = require("./utils/FormatDate");

// DB for list of processed assets
const db = require("./db.json"); // create a `db.json` file that contains {}
if (!db.photos) db.photos = []; // initialize an array, if you want db.photos to be an array
const save = () => fs.writeFile("./db.json", JSON.stringify(db), () => {});
// remember to also run save() every time you make a change to the db object

let uuidArray = [];
let timestampArray = [];
let files = [];

const optimisePhoto = require("./utils/OptimisePhoto");
const writeExifFile = require("./utils/WriteExifFile");
const fetch = require("node-fetch");
const url = require("url");
const util = require("util");
const streamPipeline = util.promisify(require("stream").pipeline);
let filePath = "src/_exifdata/temp.jpg";

const OPTIONS = {
  widths: [520, 960],
  // input_photos_dir: "src/_photos",
  output_photos_dir: "src/photos"
};

// Pull IDs out of the db as an array. We'll match these against assets that we're pulling next.
function readStorage() {
  for (let i = 0; i < db.photos.length; i++) {
    let photo = db.photos[i];
    // console.log(photo);
    uuidArray.push(photo.uuid);
    timestampArray.push(photo.date);
  } 
}

// Using @Potch's .glitch-assets function, return uploaded photos as an object.
let assets;
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
  assets = Object.values(obj);
  if (!includeDeleted) {
    assets = assets.filter(asset => !asset.deleted);
  }
  return assets;
}

// This function should iterate through each entry in the assets object
// If it exists in the JSON storage (and therefore in src/_exifdata as a .md), move on.
// If the file is new, add it to our var=files array, then add it to our JSON storage.
// If the file already exists, but has a different date, add it to var=files array for reprocessing.
// Reprocessed files should likely also have their .md deleted
async function checkStorage() {
  // Iterate through our assets, accessing each entry as a singular asset
  for (let i = 0; i < assets.length; i++) {
    var asset = assets[i];

    if (uuidArray.includes(asset.uuid) && timestampArray.includes(asset.date)) {
      // console.log(asset.name + " was already uploaded and optimized.");
    }

    // If the file already exists, but has a different date, add it to var=files array for reprocessing.
    // Delete associated files (the MD and generated jpg versions)
    else {
      console.log(
        asset.name + " doesn't exist yet, was deleted, or was updated."
      );

      // Should we pull this or any other functions out of this file to make it more clear what's happening?
      async function download() {
        const response = await fetch(asset.url);
        if (!response.ok)
          throw new Error(`unexpected response ${response.statusText}`);
        await streamPipeline(response.body, fs.createWriteStream(filePath));
      }

      await download();
      console.log(
        "Downloaded " +
          asset.name +
          " to temp directory. Clearing any old versions."
      );

      // Determine name of files based on EXIF
      let newName = await getDateFromPhoto(filePath);
      newName = await formatDate(newName);

      console.log("New file name is " + newName);

      // Attempt to delete existing data.
      function deleteFiles(newName, widths, outputDir) {
        let postPath = "src/_exifdata/" + newName + ".md";
        fs.existsSync(postPath, function(exists) {
          if (exists) {
            // fs.unlinkSync(postPath);
            console.log("Deleted: " + postPath);
          } else {
            console.log("Nope!");
          }
        });

        // Delete any matching images in our cache - iterate through our files + widths
        widths.map(width => {
          fs.existsSync(
            `${outputDir}/w${width}/${newName}` + newName.extname,
            function(exists) {
              if (exists) {
                fs.unlinkSync(`${outputDir}/w${width}/${newName}` + newName.extname);
                console.log(
                  `Deleted: ${outputDir}/w${width}/${newName}` + newName.extname
                );
              } else {
                console.log(`Nope to w${width}/${newName}!`);
              }
            }
          );

          fs.existsSync(`${outputDir}/blur/${newName}`, function(exists) {
            if (exists) {
              fs.unlinkSync(`${outputDir}/blur/${newName}` + newName.extname);
              console.log(
                `Generated: ${outputDir}/blur/${newName}` + newName.extname
              );
            } else {
              console.log(`No blur version of ${newName}`);
            }
          });
        });
      }

      await deleteFiles(newName, OPTIONS.widths, OPTIONS.output_photos_dir);
      
      // If the photo wasn't deleted from assets, process for the collection
      if (asset.deleted != true) {
        // 2. run the optimisePhoto function on filePath
        await optimisePhoto(
          filePath,
          OPTIONS.widths,
          OPTIONS.output_photos_dir
        );
        console.log("Optimized versions of " + asset.name + " created");
        // 3. run the writeExifFile function on filePath
        // Writes a file with JSON frontmatter exposing the exif data
        await writeExifFile(filePath, OPTIONS.input_photos_dir);
        await writeExifFile(filePath);
        console.log("Exif data for " + asset.name + " written");
      }

      // Save the asset to the DB now that we've processed it
      await db.photos.push(asset);
      await save();
      
      // Clean up the temp file
      await fs
        .remove(filePath)
        .then(() => {
          console.log(filePath + " file removed.");
        })
        .catch(err => {
          console.error(err);
        });
    
    }
  }
}

readStorage();
getAssets();
checkStorage();
