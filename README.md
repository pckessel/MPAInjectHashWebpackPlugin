# MPA Inject Hash Webpack Plugin
This Plugin was written in order to be able to inject the name and hash of newly generated webpack assest into specific sections within an index.aspx page,
though it can be configured to inject them into any kind of file read from the file system.

There seems to have been other dealing with this issue yet I found no obvious open source solutions. I gained a few clues from [this github post](https://github.com/webpack/webpack/issues/86#issuecomment-135526500)

[html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin) is a very popular plugin for doing similar things to this one, however it isnt nearly as flexible and it will only write to html files. Aspx files dont have the same structure as html files so the above plugin wouldnt work.

# Install
This package is not registered in npm, so for now:
`npm install --save https://github.com/pckessel/MPAInjectHashWebpackPlugin`
That will pull down all of the latest changes from the master branch. If you want to install from a specific commit,
find the commit hash and install same as above but with #specific-commit-hash appended to the end of the path.

# Magic Comments
a PAIR of either of these tags:
<!-- INJECT-JS -->
or 
<!-- INJECT-CSS -->
explains to the plugin which content needs to be replaced. 
All files generated which your entry chunk needs to have to be able to be able to run properly will be injected into your target file in between the two magic comments. This includes files generated during webpack optimizations like the ones you'll find here:
https://webpack.js.org/guides/caching/#extracting-boilerplate
https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-2

# Usage
Consider a project with the following folder structure:

```js
ProjectDir
| - src
|   | - app1
|   |  | - app1.js
|   |  | - index.aspx
|   |
|   | - app2
|   |  | - app2.js
|   |  | - app2.master
|   |
|   | - app3
|   |   | - app3.js
|   |
|   | - pages
|      | - myPage.txt
|
| - dist
|   | - build
```

---

`app1/index.aspx`
```js
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
   <!-- INJECT-CSS -->
   <link rel="stylesheet" href="/dist/build/app1.bundle.css">
   <!-- INJECT-CSS -->
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- INJECT-JS -->
   <script type="text/javascript" src="/dist/build/app1.bundle.js"></script>
   <!-- INJECT-JS -->
 </asp:Content>
```
---

`app2.master`
```js
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
   <!-- INJECT-CSS -->
   <link rel="stylesheet" href="/dist/build/app2.bundle.css">
   <!-- INJECT-CSS -->
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- INJECT-JS -->
   <script type="text/javascript" src="/dist/build/app2.bundle.js"></script>
   <!-- INJECT-JS -->
 </asp:Content>
```

---

`myPage.txt`
```js
<!-- INJECT-JS -->
<!-- INJECT-JS -->
<!-- Im a useless file simply here for illustration!-->
```
---

`Webpack config`
```js
entry: {
  app1: './src/app1/app1.js',
  app2: './src/app2/app2.js',
  app3: './src/app3/app3.js'
},
output: {
  path: './dist/build',
  filename: "[name].bundle.[contenthash].js",
  publicPath: '/dist/build/'
},
plugins: [
    new MiniCssExtractPlugin({ filename: { filename: "[name].bundle.[contenthash].css" } }),
    new MPAInjectHashWebpackPlugin({
      // defaultWriteFile: change this if you dont want to write to index.aspx by default
      // publicPath: `/can/be/specified/`
      targets: {
        app2: { file: 'app2.master' },
        app3: { path: path.join(__dirname, 'src/pages/myPage.txt') }
      }
    })
  ]
```

---

As you can see, from the webpack config's entry points, there will be 3 output chunks after running here.
1. app1
2. app2
3. app3

We did not pass in any separate targets to the plugin for `app1`, therefore it's output chunk gets written to the index.aspx file within the app1 directory if a match is found within it. This is the default behavior.

`src/app1/index.aspx`
```js
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
   <!-- INJECT-CSS -->
   <link rel="stylesheet" href="/dist/build/app1.bundle.8ffe29d58b95d211d686.css">
   <!-- INJECT-CSS -->
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- INJECT-JS -->
   <script type="text/javascript" src="/dist/build/app1.bundle.8ffe29d58b95d211d686.js"></script>
   <!-- INJECT-JS -->
 </asp:Content>
```

We wanted to write the newly generated bundle for `app2` into its `app2.master` file within the `app2` directory. In order to do this, we simply passed in a 
targets[`app2`] and value for app2 and specified the `file`. Passing in the `file` property works because the target file (app2.master) existed within the same directory as the entry file for app2 specified in your webpack configs `entry`. The `key` name in your entry must match the `key` name in your `targets`.

`src/app2/app2.master`
```js
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
   <!-- INJECT-CSS -->
   <link rel="stylesheet" href="/dist/build/app2.bundle.8ffe29d58b95d211d686.css">
   <!-- INJECT-CSS -->
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- INJECT-JS -->
   <script type="text/javascript" src="/dist/build/app2.bundle.8ffe29d58b95d211d686.js"></script>
   <!-- INJECT-JS -->
 </asp:Content>
```

`app3`'s output gets written to src/pages/myPage.txt. We passed `path` into the `targets` object for the `app3` entry because the target output file doesn't exist with the directory of `app3`'s entry point. The `path` property should be an absolute path to the file which you wish to write to.

`src/pages/myPage.txt`
```js
<!-- INJECT-JS -->
<!-- "app3.bundle.8ffe29d58b95d211d686.js" -->
<!-- INJECT-JS -->
<!-- Im a useless file simply here for illustration!-->
```
## Options
`defaultWriteFile`: allows you to specify what default file to write to within the directory of that chunks entry point file. Default is index.aspx.

`publicPath`: Is the path which will be appended to each file before creating its html tag.
  eg: if the processed file's name is: `app2.bundle.8ffe29d58b95d211d686.js` and your `publicPath` property is `/my/public/dir/` then your tag
  will be <script type="text/javascript" src="/my/public/dir/app2.bundle.8ffe29d58b95d211d686.js"></script>.
  The order of assignment for `publicPath` is as follows:
  1. The specific options.publicPath set when invoking the plugin.
  2. Your webpack config's output.publicPath property if you set it.
  3. `/`
  Here is the pattern which gets validated for your puplic path: `^\/$|\/([\w|\d|\.?\-?_?]+\/)+$`;
  `/987h2f8/hello-world/ilwu___liihfs/ilusfh.oiusfh.lisfhk/` would be valid
  `/kusf/<!*/kwuhflid/` Would not

`targets`: expects its properties to be the same as the properties passed in to your webpack config entry: {}. When specifying a specific target object,
the api allows for only two things.
1). `file`: Is the name of the file only which you'd like to write to. It should exist in the same directory as your entryPoint file. 
2). `path`: Is an absolute path of your target file.

## Loging
If you want to see more logging information output to the terminal when building. Change your webpack config's `stats: { logging: 'log' }`