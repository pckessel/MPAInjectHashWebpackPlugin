const fs = require('fs');
const validate = require('schema-utils');
const pluginSchema = require('./optionsSchema.json');

class MPAInjectHashWebpackPlugin {
  constructor(options = {}) {
    validate(pluginSchema, options, { name: "MPAInjectHashWebpackPlugin" });
    this.targets = options.targets || {};
    this.defaultWriteFile = options.defaultWriteFile || 'index.aspx';
    this.publicPath = options.publicPath || null;
    this.CONSTANTS = { css: 'CSS', js: 'JS' };
  };

  generateTag(fileType, relPath, file) {
    const scriptTemplate = `<script type="text/javascript" src=\"${relPath}${file}\"></script>`;
    const linkTemplate = `<link rel="Stylesheet" href=\"${relPath}${file}\" />`
    return fileType === 'css' ? linkTemplate : scriptTemplate;
  }

  apply(compiler) {
    compiler.hooks.emit.tap('MPAInjectHashWebpackPlugin', compilation => {

      // https://webpack.js.org/api/logging or source code --> node_modules\webpack\lib\logging\Logger.js
      const Logger = compilation.getLogger('MPAInjectHashWebpackPlugin');

      // this is the "entry" config from the webpack config 
      const configEntries = compilation.options.entry;

      if(!this.publicPath) {
        this.publicPath = compilation.options.output.publicPath || '/';
      } 

      // RegEx to get the entryFile.js to be replaced
      const FILE = /\w+\.js/;

      // List of the entry points defined in the webpackconfig. EntryPoint is a Webpack internal class. webpack/lib/Entrypoint.js
      for (let [name, EntryPoint] of compilation.entrypoints) {

        /****************** Establish the writeable target for current entryPoint **********/
        // default target write file assumed to exists in same directory as the entry module.
        let targetPath;

        /* A situation arrises when trying to use Sentry for error reporting where each entry
         * will have two paths (in an array). The path not specified in the config is to the 
         * node_modules/@Sentry/webpack-plugin.We need to ignore this entry because the only 
         * thing which we want to concern ourselves with here is the path specified in the 
         * config's entry so that we can inject the generated bundles properly. */
        if( Array.isArray(configEntries[name]) ) {
          targetPath = configEntries[name].reduce((expectedPath, entryPath) => {
            if(!entryPath.includes('node_modules')){
              expectedPath = entryPath
            }
            return expectedPath;
          }, '');

        } else {
          targetPath = configEntries[name];
        }
        
        /** Once we have a path, the first step is to replace the file in the path with 
         * the default write file to establish a base case */
        targetPath = targetPath.replace(FILE, this.defaultWriteFile);

        /** Next, change the path if we have been specified to from the passed in options */
        if (this.targets[name]) {
          targetPath = this.targets[name].path || 
          configEntries[name].replace(FILE, `${this.targets[name].file}`);
        } 
    
        /* For each chunk associated with the entry point, generate the appropriate html tag for each file,
        * group those tags by file/tag type and join them all together so that they can be inserted as one big chunk */
        const generatedContent = EntryPoint.chunks.reduce( (results, chunk) => {
          // Each chunk will have files that have been generated
          chunk.files.forEach( newFile => {
            const extPattern = new RegExp(/\.(css|js)$/);
            let fileExtension = newFile.match(extPattern) ? newFile.match(extPattern)[1] : null;

            // Return If something other than css or js -- For example source map files.
            //TODO Bring in support for this
            if(!fileExtension){
              Logger.warn(`UnSupported File Extension for ${newFile}`);
              return;
            }
            // create content string of generated tags.
            results[ this.CONSTANTS[fileExtension] ] += `\n  ${this.generateTag(fileExtension, this.publicPath, newFile)}` 
          })
          return results
        },{ 
          // Naming convention used to determin which tags are inserted in the various locations of the taget file.
          [this.CONSTANTS.css]: "", 
          [this.CONSTANTS.js]: "" 
        });

        // Indication for whether we should write file to the FS. Set when reassigning targetFileContent
        let fileContentsHaveChanged = false;

        // Read target file into memory to be processed
        let targetFileContent = fs.readFileSync(targetPath, 'utf8');

        // 'g' flag set so we can search string multiple times
        const generateRegEx = fileType => RegExp(`<!-- INJECT-${fileType} -->`, 'g');

        const contentTypes = [ this.CONSTANTS.css, this.CONSTANTS.js ];
        contentTypes.forEach( contentType => {
          const searchPattern = generateRegEx(contentType)

          // run RegEx once for initial match so we can then grab the lastIndex property of the RegExp object.
          const initialMatch = searchPattern.exec(targetFileContent)

          // If there was no match yet there are files of that type to be written, send warning
          if( !initialMatch && generatedContent[contentType].length > 0 ) {
            Logger.warn(
              `The searchPattern ${searchPattern} was not found in the file:\n` +
              `${targetPath}\n` +
              `The generated ${contentType} files and tags were not injected.`
            );
            return; 
          }

          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
          // lastIndex property tells us where the searchPattern ends so we know what position to start replacing content
          const beginingIndex = searchPattern.lastIndex;

          // run again. The results will have a starting index of the second match so we know where to end replacing content.
          const secondMatch = searchPattern.exec(targetFileContent);

          if(!secondMatch) { 
            Logger.error(
              `Only one ${initialMatch[0]} was found in ${targetPath}\n` +
              `There must be a pair to properly insert content\n` +
              `The generated ${contentType} files and tags were not injected.`
            );
            return;
          };

          // grab a copy of the string of content in between the end of the first matched Pattern and the start of the second matched pattern.
          const replaceableContent = targetFileContent.slice(beginingIndex, secondMatch.index);

          /* Check to ensure the content is not "" prior to running a match. This was added for the case when there
          * would be a tag in the replaceable content, but the newly genertaed content was empty which would cause the
          * match to fail and it would skip, leaving the previous tag in the target file. This would happen if you deleted some
          * files in your source code and webpack no longer produces a bundle which it previously had. */
          if(generatedContent[contentType] && replaceableContent.match(generatedContent[contentType])) {
            Logger.info(`SKIPPING INJECTION in ${targetPath}\nAll of the generated ${contentType} tags already exist:\n${generatedContent[contentType]}`);
            return;
          }

          // get first chunk of text
          // get last chunk of text
          // join first, generated content, and last chunk of text together.
          const firstPartOfFile = targetFileContent.slice(0,beginingIndex);
          const lastPartOfFile = targetFileContent.slice(secondMatch.index);
          const newFileContents = `${firstPartOfFile}${generatedContent[contentType]}\n  ${lastPartOfFile}`; //\n & two spaces for formatting

          targetFileContent = newFileContents;
          fileContentsHaveChanged = true;
          Logger.info(
            `INJECTION In: ${targetPath}\n` +
            `Replaced: ${replaceableContent}\n` +
            `With: ${generatedContent[contentType]}\n`
          );
        });

        if(fileContentsHaveChanged) {
          Logger.log(`Writing to ${targetPath}`);
          fs.writeFileSync(targetPath, targetFileContent);
        }

      };
    });
  };
};

module.exports = MPAInjectHashWebpackPlugin;