// This solution was found here https://github.com/webpack/webpack/issues/86#issuecomment-135526500
// I suspect dealing with the same problem which we are here.
//config.output.filename = "[name]-[hash]-bundle.js"; // In dev's config, it's "bundle.js"
// To rewrite stuff like `bundle.js` to `bundle-[hash].js` in files that refer to it, I tried and
// didn't like the following plugin: https://github.com/ampedandwired/html-webpack-plugin
// for 2 reasons:
//    1. because it didn't work with HMR dev mode...
//    2. because it's centered around HTML files but I also change other files...
// I hope we can soon find something standard instead of the following hand-coding.


/* what do we need to do?
 * for every asset emmited, we need to write that asset into it's appropriate place in the index.aspx page
 * we are given a filename
 * How do we determin which index.aspx page we need to inject that file into?
 * we can pass options into a plugin, which will then be run?
 * Could we pass a hashmap in of the files and locations we want to be written to?
 *
 * On done we are given all of the assets... Maybe we shoudl try that hook
*/

/* TODO
 * Bring in console chalk to liven up the console messages for the success casses and warnings
 * Bring in Webpack option schema validation for the options object.
 * Push this code out to github or gitlab.
 * We should probably put in handlings so its only outpitting css and js? Or should we have it be configurable?
 */

const path = require('path');
const fs = require('fs');

class ReplaceContentPlugin {
  constructor(options = {}) {
    this.options = options;
  };

  /*
   * Schema:
    example useage : new CustomPlugin({ logOutput: false,
                                        overrides: {
                                          login: { file: 'LoginPage.master' },
                                          packages: { relativePath: '../books/apps/assets/masters/AppPage.master' },
                                          menu: { absolutePath: path.join(__dirname, '../', 'books/apps/assets/masters/MenuPage.master') }
                                        }
    })
   options {
         logOutput: Bool --> log the output for each file
         overrides: {
            login: {
            absolutePath: The absolute path to the file that needs to be writen to.
            relativePath: path to the file that needs to be written to relative to the package.json where the webpack script is being run from.
            file: the name of the file to write to if it is already in the same directory as the entry point. Default is to write to index.aspx.
          }
        }
}
   */


  // Define `apply` as its prototype method which is supplied with compiler as its argument
  apply(compiler) {
    // Specify the event hook to attach to
    compiler.hooks.emit.tap(
      'ReplaceContentPlugin',
      compilation => {
        /*
        file--> packages-93dc09feae405e0e43de-bundle.js
        dirname--> C:\CSM\branches\CSMBooks-3.6.0-NewBuild\Website\webpack
        options --> { [name] : `/books/${folder}/${appName}`}
        */

        compilation.chunks.forEach(chunk => {
          //console.log('chunk.entryModule.resource ---->', chunk.entryModule.resource);
          let RE = /\w+\.js/,
            targetPath;

          // if there is an override defined for the current output chunk then establish the targetPath
          // with the appropriate override.
          if (this.options.overrides[chunk.name]) {
            let overrides = this.options.overrides[chunk.name];
            if (overrides.absolutePath) {
              targetPath = overrides.absolutePath;
            }
            else if (overrides.relativePath) {
              targetPath = path.join(__dirname, overrides.relativePath);
            } else {
              targetPath = chunk.entryModule.resource.replace(RE, `${overrides.file}`);
            }
          }
          // If there was no override for the current chunk, then establish the targetPath to the index.aspx
          // file that is at the directory given when defining the entrypoint for that chunk in the config.
          else {
            targetPath = chunk.entryModule.resource.replace(RE, 'index.aspx');
          }

          // get array of all previous builds
          const previousBuilds = fs.readdirSync(path.join(__dirname, '../books/build'));

          // Iterate through all of the output chunks (there will be one for every entry point defined);
          for (let i = 0; i < chunk.files.length; i++) {
            let file = chunk.files[i];

            // file already exists in build dir
            if (previousBuilds.includes(file)) {
              continue;
            };

            // pull out the extension from the file built in that chunk - Only css and js by default.
            let extension = file.match(new RegExp(/\.(css|js)$/))[1];

            // Get the file contents from the targetPath
            const originalFileContents = fs.readFileSync(targetPath, 'utf8');

            // this regex will find the first place in the original file contents that has the filename-[(optional)HASH-]bundle.fileExtension.
            // This way it will replace exisitng bundles that already have a hash on them as well as bundle references which do not yet have a hash.
            const originalFileName = new RegExp(`${chunk.name}-?[\\d*|\\w*]*?-bundle\.${extension}`);

            // gives back an array where the first match from the file is at index 0 or null if none were found
            const matched = originalFileContents.match(originalFileName);

            if (matched) {

              if (this.options.logOutput) {
                // spacing is for console formating
                console.log(
                  '\n---------------------------------------------------------',
                  '\n    Replacing:', matched[0],
                  '\nWith new file:', file,
                  '\n           In:', targetPath,
                  '\n---------------------------------------------------------',
                  '\n'
                );
              };

              //replace original text with newly generated file name.
              const newContents = originalFileContents.replace(matched[0], file);

              // write new file to disk
              fs.writeFileSync(targetPath, newContents);

            } else {
              console.warn('Warning: No matches found!',
                '\n  Generated file:', file,
                '\n  was not written to the target path:', targetPath);
            }
          }
        })
      }
    );
  }
}

module.exports = ReplaceContentPlugin;