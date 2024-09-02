const fs = require('fs/promises');
const { DateTime } = require('luxon');
const path = require('path');
const exif = require('fast-exif');
const formatDate = require('./FormatDate');
const getDateFromPhoto = require('./GetDateFromPhoto');
const iptc = require('node-iptc');

// const photosPath = path.join(__dirname, '..', 'src', '_photos', 'PC170809.jpg');
const postsPath = path.join(__dirname, '..', 'src', '_posts');

// node-exif-photos.js is currently passing a file, not the path - need to debug
async function getPhotoData(filePath) {
    try {
        // Read file data asynchronously
        let fileData = await fs.readFile(filePath);

        // Get IPTC data directly from buffer
        let iptcData = iptc(fileData);
        if (iptcData.keywords) {
            iptcData = {
                ...iptcData,
                tags: iptcData.keywords
            };
        }

        // Get formatted date name from the photo
        let newName = await getDateFromPhoto(filePath);
        newName = await formatDate(newName);

        // Get EXIF data
        let exifData = await exif.read(filePath);
        exifData = {
            image_path: newName + path.extname(filePath),
            ...exifData,
            ...iptcData
        };
        return exifData;
    } catch (error) {
        console.error('Error processing photo data:', error);
    }
}

// call the extraction function and then process it
async function processPhoto(file) {
  try {
    const photoMetadata = await getPhotoData(file);
    
    // Extract the data we need from the photo metadata JSON
    const cameraMake = photoMetadata.image.Make;
    const cameraModel = photoMetadata.image.Model;
    const dateCreated = photoMetadata.exif.DateTimeOriginal;
    const ISO = photoMetadata.exif.ISO;
    const shutterSpeed = 1/(photoMetadata.exif.ExposureTime);
    const fNumber = photoMetadata.exif.FNumber;
    const lensModel = photoMetadata.exif.LensModel;
    const imagePath = photoMetadata.image_path;

    const dateTime = DateTime.fromJSDate(dateCreated);
    
    // Check if the date is valid
    if (!dateTime.isValid) {
      console.error(`Error: Invalid date for file ${file}. Skipping this file.`);
      return; // Exit the function early
    }
    
    // Format the date (assuming YYYYMMDD format)
    let postDate = dateTime.toFormat('yyyy-MM-dd');
    let postName = dateTime.toFormat('yyyy-MM-dd-HHmmss');
    let dateURL = dateTime.toFormat('dd-LL-yyyy-mmssms');

    // Get pixel dimensions - maybe leave out later
    const pixelXDimension = photoMetadata.exif.PixelXDimension;
    const pixelYDimension = photoMetadata.exif.PixelYDimension;

    // Create the markdown content with front matter
    const content = `---
title: ""
date: ${postDate}
date_url: "${dateURL}"
camera_make: "${cameraMake}"
camera_model: "${cameraModel}"
lens_model: "${lensModel}"
iso: "${ISO}"
fnumber: "${fNumber}"
shutter_speed: "${shutterSpeed}"
image_path: "${imagePath}"
pixel_x_dimension: ${pixelXDimension || ''}
pixel_y_dimension: ${pixelYDimension || ''}
---

This post features an image taken with an ${cameraModel}.`;

    // Write the file to the Eleventy _posts directory
    postName = `${postName}.md`

    fs.writeFile(path.join(postsPath, postName), content, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Markdown file created successfully!');
      }
    });
  } catch (error) {
    console.error('Failed to process photo:', error);
  }
}

module.exports = processPhoto;