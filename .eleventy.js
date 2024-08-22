const {
    DateTime
} = require("luxon");

const inspect = require("util").inspect;

module.exports = function (eleventyConfig) {
    // Folders to copy to build dir (See. 1.1)
    eleventyConfig.addPassthroughCopy("src/photos");
    eleventyConfig.addPassthroughCopy("src/css");

    // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    eleventyConfig.addFilter('htmlDateString', (dateObj) => {
        return DateTime.fromJSDate(new Date(dateObj), {
            zone: 'utc'
        }).toFormat('dd/LL/yyyy');
    });

    eleventyConfig.addFilter('dateUrl', (dateObj) => {
        return DateTime.fromJSDate(new Date(dateObj), {
            zone: 'utc'
        }).toFormat('dd-LL-yyyy-mmssms');
    });

    eleventyConfig.addFilter("readableDate", dateObj => {
        return DateTime.fromJSDate(new Date(dateObj), {
            zone: 'utc'
        }).toLocaleString(DateTime.DATE_HUGE);;
    });
  
    eleventyConfig.addFilter("debug", (content) => `<pre>${inspect(content)}</pre>`);

    eleventyConfig.addCollection("exifPhotos", function (collection) {
        return collection.getFilteredByGlob("src/_exifdata/*.md").sort(function (a, b) {
          return new Date(b.data.exif.DateTimeOriginal) - new Date(a.data.exif.DateTimeOriginal);
        });
    });

    eleventyConfig.addCollection("tagList", function (collection) {
        let tagSet = new Set();
        collection.getAll().forEach(function (item) {
            if ("tags" in item.data) {
                let tags = item.data.tags;

                tags = tags.filter(function (item) {
                    switch (item) {
                        // this list should match the `filter` list in tags.njk
                        case "all":
                        case "nav":
                        case "post":
                        case "posts":
                            return false;
                    }

                    return true;
                });

                for (const tag of tags) {
                    tagSet.add(tag);
                }
            }
        });

        // returning an array in addCollection works in Eleventy 0.5.3
        return [...tagSet];
    });

    // Browsersync Overrides
    eleventyConfig.setBrowserSyncConfig({
        callbacks: {
            //       ready: function (err, browserSync) {
            //         const content_404 = fs.readFileSync('_site/404.html');

            //         browserSync.addMiddleware("*", (req, res) => {
            //           // Provides the 404 content without redirect.
            //           res.write(content_404);
            //           res.end();
            //         });
            //       },
        },
        ui: false,
        ghostMode: false
    });

    return {
        dir: {
            input: "src/",
            output: "build",
            includes: "_includes"
        },
        templateFormats: ["html", "md", "njk", "yml"],
        htmlTemplateEngine: "njk",

        // 1.1 Enable eleventy to pass dirs specified above
        passthroughFileCopy: true
    };
};
