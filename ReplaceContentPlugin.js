/* TODO
 * Bring in console chalk to liven up the console messages for the success casses and warnings
 * We should probably put in handlings so its only outputting css and js? Or should we have it be configurable?
 */

const path = require('path');
const fs = require('fs');
const validate = require('schema-utils');
const pluginSchema = require('./optionsSchema.json');


class ReplaceContentPlugin {
  constructor(options = {}) {

    validate(pluginSchema, options, { name: "ReplaceContentPlugin" });

    this.options = options;
  };

  apply(compiler) {
    compiler.hooks.emit.tap(
      'ReplaceContentPlugin',
      compilation => {

        compilation.chunks.forEach(chunk => {

          let ENTRY_FILE = /\w+\.js/;
          let targetPath;

          // check if an overrides object was passed in. If so and there is also an override defined for the
          // current output chunk then establish the targetPath with the appropriate override.
          if (this.options.overrides && this.options.overrides[chunk.name]) {
            let overrides = this.options.overrides[chunk.name];
            if (overrides.absolutePath) {
              targetPath = overrides.absolutePath;
            }
            else if (overrides.relativePath) {
              targetPath = path.join(__dirname, overrides.relativePath);
            } else {
              targetPath = chunk.entryModule.resource.replace(ENTRY_FILE, `${overrides.file}`);
            }
          }
          // If there was no override for the current chunk, then establish the targetPath to the index.aspx
          // file that is at the directory given when defining the entrypoint for that chunk in the config.
          else {
            let defaultFile = this.options.defaultWriteFile ? this.options.defaultWriteFile : 'index.aspx';
            targetPath = chunk.entryModule.resource.replace(ENTRY_FILE, defaultFile);
          }

          // get array of all previous builds in output dir
          const previousBuilds = fs.readdirSync(compilation.options.output.path);

          // Iterate through all of the output chunks (there will be one for every entry point defined);
          for (let i = 0; i < chunk.files.length; i++) {
            let file = chunk.files[i];

            // pull out the extension from the file built in that chunk - Only css and js by default.
            let extension = file.match(new RegExp(/\.(css|js)$/))[1];

            // Get the file contents from the targetPath
            const originalFileContents = fs.readFileSync(targetPath, 'utf8');

            // default regex will find the first place in the original file contents that has the filename-[(optional)HASH-]bundle.fileExtension.
            // This way it will replace exisitng bundles that already have a hash on them as well as bundle references which do not yet have a hash.
            const patternToMatch = this.options.matchPattern ?
              new RegExp(`${chunk.name}${this.options.matchPattern}\.${extension}`) :
              new RegExp(`${chunk.name}-?[\\d*|\\w*]*?-bundle\.${extension}`);

            // gives back an array where the first match from the file is at index 0 or null if none were found
            const matched = originalFileContents.match(patternToMatch);

            // file already exists in build dir and the generated file has already been written to the
            // target file. This will happen on subsequent rebuilds when a file webpack is looking at hasnt changed
            // so the hash remains the same and has already been written to a file.
            if (previousBuilds.includes(file) && (matched && matched[0] === file)) {
              if (this.options.logSkipped) {
                console.log(
                  '\n---------------------------------------------------------',
                  '\n SKIPPING INJECTION',
                  '\n File:', file,
                  '\n already exists in the output dir and has previously been injected into:',
                  '\n', targetPath,
                  '\n---------------------------------------------------------',
                );
              }
              // continue with loop, avoid rewriting to file
              continue;
            };

            if (matched) {
              if (this.options.logInjection) {
                // spacing is for console formating
                console.log(
                  '\n---------------------------------------------------------',
                  '\n INJECTING',
                  '\n     Replacing:', matched[0],
                  '\n With new file:', file,
                  '\n            In:', targetPath,
                  '\n---------------------------------------------------------',
                );
              };

              //replace original text with newly generated file name.
              const newContents = originalFileContents.replace(matched[0], file);

              // write new file to disk
              fs.writeFileSync(targetPath, newContents);

            } else {
              if (this.options.logWarnings) {
                console.warn(
                  '\n---------------------------------------------------------',
                  '\n WARNING: Missing Pattern',
                  `\n The pattern ${patternToMatch} was not found in the target file.`,
                  '\n  The generated file:', file,
                  '\n  was not written to the target file:', targetPath,
                  '\n---------------------------------------------------------'
                );
              }
            }
          }
        })
      }
    );
  }
}

module.exports = ReplaceContentPlugin;