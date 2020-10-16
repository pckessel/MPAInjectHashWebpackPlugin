Here is a webpack config which would produce the files that these specs are built for:

```js
module.exports = {
  entry: {
    app: path.join(__dirname, 'client/reactClient/src/index.js'),
    login: path.join(__dirname, 'client/reactClient/src/pages/login/index.js'),
    logout: path.join(__dirname, 'client/reactClient/src/pages/logout/index.js')
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.[contentHash].js',
  },
  module: {
    ...
  },
  plugins : [
    ...
    new MPAInjectHashPlugin({
      defaultWriteFile: 'index.html',
      publicPath: '/dist/',
      targets: {
        app: { path: path.join(__dirname, 'main.aspx') },
        login: { file: 'login.aspx' },
      },
    }),
    ...
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: { 
          chunks: 'all',
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors'
        }
      }
    },
  }
}
```

Specs:

### PATTERN TO MATCH
Removed the functionality to pass in a pattern to be matched in the file.
Would like to add in this feature, but will need to figure out how to search 
for different file types with the passed in string. Will need to enforce some kind of
css and js convention. 
Doesnt seem worth it.


### NON SPECIFIED TARGETS - DEFAULT WRITE FILE
If there is a chunk defined in the entry points, 
but not specified in the targets, 
It will attempt to write the generated output file(s) for that chunk to either,
1) the specified defaultWriteFile or
2) the index.aspx
at the path specified in the entrypoint for that chunk.
Lets take the `logout` chunk specified above. We have no chunkTargets for logout.
We also dont have a defaultWriteFile specified in the options. 
In this case, the plugin would try and write the output files to the path specified in
the `logout` entry point, but replace the index.js with index.aspx.
Concretely, logout.bundle.p927yrdhl.js would attempt to be injected into (previously resolved path)/client/reactClient/src/pages/logout/index.aspx';

### TARGETS
If there is an entrydefined on targets, the key needs to be the same as the key definied in the webpack.config.entry.
The value object of that key can have either a `path` key or a `file` key. 
The `path` key needs to be an absolute path to the file which you'd like the generated assets to be written to.
The `file` key can be a string file name where that file name is expected to exist in the same directory as the entry file.
In the example above, targets['login'] specifies a file. In that case, we would try and write to the path at
(previously resolved path)/client/reactClient/src/pages/login/login.aspx'

### Optimizations
(see this)[https://webpack.js.org/guides/code-splitting/#splitchunksplugin] for info on splitting code optimizations and 
(See this)[https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-2] for the exact config
(Also works for dynamic imports)[https://reactjs.org/docs/code-splitting.html]
