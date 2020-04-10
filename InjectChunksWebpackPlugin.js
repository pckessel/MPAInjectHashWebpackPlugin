const fs = require('fs');
const validate = require('schema-utils');
const pluginSchema = require('./optionsSchema.json');

class InjectChunksWebpackPlugin {
  constructor(options = {}) {
    validate(pluginSchema, options, { name: "InjectChunksWebpackPlugin" });
    this.options = options;
    this.chunkOverrides = options.chunkOverrides || null;
    this.defaultWriteFile = options.defaultWriteFile || 'index.aspx';
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

      // There will be a chunk for every entry in your webpack confg
      compilation.chunks.forEach(chunk => {

        // Establish targetPath for the writeable file.
        if (this.chunkOverrides && this.chunkOverrides[chunk.name]) {
          let chunkOverride = this.chunkOverrides[chunk.name];
          if (chunkOverride.path) {
            targetPath = chunkOverride.path;
          } else {
            // replace chunk entry module file with the passed in chunkOverrides file.
            targetPath = chunk.entryModule.resource.replace(FILE, `${chunkOverride.file}`);
          };
        } else {
        // No chunkOverrides for this chunk means target write file exists in same dir as the entry module.
          targetPath = chunk.entryModule.resource.replace(FILE, this.defaultWriteFile);
        }

        // Iterate through all of the output chunks (there will be one for every entry point defined);
        chunk.files.forEach( newFile => {

          // pull out the extension from the newFile built in that chunk - Only css and js by default.
          // this will be used to find a correct match in the target file
          let extension = newFile.match(new RegExp(/\.(css|js)$/))[1];

          // default regex will find the first place in the original file contents that has the filename.bundle[.(optional)HASH].ext.
          // This way it will replace exisitng bundles that already have a hash on them as well as bundle references which do not yet have a hash.
          const patternToMatch = this.options.patternToMatch ?
            new RegExp(`${chunk.name}${this.options.patternToMatch}\.${extension}`) :
            new RegExp(`${chunk.name}\.bundle\.?[\\d*|\\w*]*?\.${extension}`);

          const originalFileContents = fs.readFileSync(targetPath, 'utf8');
          // array where the first match is at index 0 or null if none were found
          const matched = originalFileContents.match(patternToMatch);

          // If newFile already exists in output dir and the generated newFile has already been written to the
          // target file. This will happen on subsequent rebuilds when a file webpack is looking at hasnt changed
          // so the hash remains the same and has already been written to the targetfile.
          if (previousBuilds.includes(newFile) && (matched && matched[0] === newFile)) {
            Logger.log(`SKIPPING INJECTION: ${newFile}\nalready exists in the output dir and has previously been injected into:\n${targetPath}\n`);
            // avoid rewriting to file and move on to next file.
            return;
          };

          // match found and newFile is unique --> inject filepath
          if (matched) {
            const newContents = originalFileContents.replace(matched[0], newFile);

            fs.writeFileSync(targetPath, newContents);

            Logger.info(`INJECTION: Replaced: ${matched[0]}\nWith the new file: ${newFile}\nIn: ${targetPath}\n`)
          } else {
            Logger.warn(
              `WARNING: The pattern ${patternToMatch} was not found in the file:\n${targetPath}\nThe generated file: ${newFile} was not injected to the target file.\n`
            );
          }
        })
      })
    });
  };
};

module.exports = InjectChunksWebpackPlugin;