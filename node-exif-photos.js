const fs = require('fs-extra');
const glob = require("fast-glob");
const path = require('path');

const optimisePhoto = require("./utils/OptimisePhoto");
const frontMatter = require("./utils/FrontMatter");

(async function () {
  const OPTIONS = {
    widths: [520, 960],
    input_photos_dir: "src/_photos",
    output_photos_dir: "src/photos",
    output_posts_dir: "src/_posts"
  };

  var files = await glob([
    `${OPTIONS.input_photos_dir}/*.{jpg,jpeg,JPG,JPEG}`,
  ]);

  // Re-write the file to enable a collection
    // Define the content for _posts.json
    const postsJsonContent = {
      layout: "layouts/photo.njk",
      permalink: "photo/{{ date_url }}/index.html"
    };
  
    // Write the _posts.json file
    const postsJsonPath = path.join(OPTIONS.output_posts_dir, '_posts.json');
    fs.writeJson(postsJsonPath, postsJsonContent, err => {
      if (err) return console.error(err)
      console.log('Wrote _posts.json file.')
    });

  files.forEach(async (file) => {
    // Creates optimised versions for each item in OPTIONS.widths, always creates a 20px wide blur
    // These are available in the same folder w{width} eg. /w320/dd_LL_yyyy_hhmmss.jpg
    await optimisePhoto(file, OPTIONS.widths, OPTIONS.output_photos_dir);

    // Writes a file with JSON frontmatter exposing the exif data
    await frontMatter(file, OPTIONS.output_posts_dir);
  })
})();