const path = require('path');
const fs = require('fs');
const validate = require('schema-utils');
const pluginSchema = require('./optionsSchema.json');


class InjectChunksWebpackPlugin {
  constructor(options = {}) {
    validate(pluginSchema, options, { name: "InjectChunksWebpackPlugin" });
    this.options = options;
    this.chunkOverrides = options.chunkOverrides ? options.chunkOverrides : null;
    this.defaultWriteFile = options.defaultWriteFile ? options.defaultWriteFile : 'index.aspx';
  };

  apply(compiler) {
    compiler.hooks.emit.tap('InjectChunksWebpackPlugin', compilation => {

        // get array of all previous builds in output dir
        const previousBuilds = fs.readdirSync(compilation.options.output.path);

        // https://webpack.js.org/api/logging or source code --> node_modules\webpack\lib\logging\Logger.js
        const Logger = compilation.getLogger('InjectChunksWebpackPlugin');

        // RegEx to get the entry_file.js to be replaced
        const FILE = /\w+\.js/;
        let targetPath;

        compilation.chunks.forEach(chunk => {

          // check if an chunkOverrides object was passed in. If so and there is also an override defined for the
          // current output chunk then establish the targetPath with the appropriate override.
          if (this.chunkOverrides && this.chunkOverrides[chunk.name]) {
            let chunkOverride = this.chunkOverrides[chunk.name];
            if (chunkOverride.absolutePath) {
              targetPath = chunkOverride.absolutePath;

            } else if (chunkOverride.relativePath) {
              targetPath = path.join(__dirname, chunkOverride.relativePath);

            } else {
              // replace chunk entry module file with the passed in chunkOverrides file.
              targetPath = chunk.entryModule.resource.replace(FILE, `${chunkOverride.file}`);
            }

          } else {
          // No chunkOverrides for this chunk means target write file exists in same dir as the entry module.
            targetPath = chunk.entryModule.resource.replace(FILE, this.defaultWriteFile);
          }

          // Iterate through all of the output chunks (there will be one for every entry point defined);
          for (let i = 0; i < chunk.files.length; i++) {
            let file = chunk.files[i];

            // pull out the extension from the file built in that chunk - Only css and js by default.
            let extension = file.match(new RegExp(/\.(css|js)$/))[1];

            // Get the file contents from the targetPath
            const originalFileContents = fs.readFileSync(targetPath, 'utf8');

            // default regex will find the first place in the original file contents that has the filename-[(optional)HASH-]bundle.ext.
            // This way it will replace exisitng bundles that already have a hash on them as well as bundle references which do not yet have a hash.
            const patternToMatch = this.options.patternToMatch ?
            new RegExp(`${chunk.name}${this.options.patternToMatch}\.${extension}`) :
            new RegExp(`${chunk.name}\.bundle\.?[\\d*|\\w*]*?\.${extension}`);
              // new RegExp(`${chunk.name}${this.options.patternToMatch}\.${extension}`) :
              // new RegExp(`${chunk.name}-?[\\d*|\\w*]*?-bundle\.${extension}`);

            // gives back an array where the first match from the file is at index 0 or null if none were found
            const matched = originalFileContents.match(patternToMatch);

            // If file already exists in build dir and the generated file has already been written to the
            // target file. This will happen on subsequent rebuilds when a file webpack is looking at hasnt changed
            // so the hash remains the same and has already been written to a file.
            if (previousBuilds.includes(file) && (matched && matched[0] === file)) {
              Logger.log(`SKIPPING INJECTION: ${file}\nalready exists in the output dir and has previously been injected into:\n${targetPath}\n`);
              // continue with loop, avoid rewriting to file
              continue;
            };

            // match found and new file is unique --> inject filepath
            if (matched) {
              //replace original text with newly generated file name.
              const newContents = originalFileContents.replace(matched[0], file);

              // write new file to disk
              fs.writeFileSync(targetPath, newContents);

              Logger.info(`INJECTION: Replaced: ${matched[0]}\nWith the new file: ${file}\nIn: ${targetPath}\n`)
            } else {
              Logger.warn(
                `WARNING: The pattern ${patternToMatch} was not found in the file:\n${targetPath}\nThe generated file: ${file} was not injected to the target file.\n`
              );
            }
          }
        })
      }
    );
  };
};

module.exports = InjectChunksWebpackPlugin;