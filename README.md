# Inject Chunks Webpack Plugin
This Plugin was written in order to be able to inject newly generated webpack assest into specific
places within an index.aspx page.

There seems to have been other dealing with this issue yet I found no obvious open source solutions. I gained a few clues from [this github post](https://github.com/webpack/webpack/issues/86#issuecomment-135526500)

[html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin) is a very popular plugin for doing similar things to this one, however it isnt nearly as flexible and it will only write to html files. Aspx files dont have the same structure as html files so the above plugin wouldnt work.

# Install
This package is not registered in npm, so for now:
`npm install --save https://github.com/pckessel/InjectChunksWebpackPlugin`
That will pull down all of the latest changes from the master branch. If you want to install from a specific commit,
find the commit hash and install same as above but with #specific-commit-hash appended to the end of the path.

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
|   | - sampleDir
|      | - randomName1.extChoice
|
| - dist
|   | - build
```

---

`app1/index.aspx`
```js
 <%@ Page Language="C#" AutoEventWireup="false" Inherits="path" MasterPageFile="~/> path %>

 <script runat="server" type="text/C#">
 ...
 </script>
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
   <!-- We need css bundles here -->`
   <link rel="stylesheet" href="/dist/build/app1.bundle.css">
 </asp:Content>

 <asp:Content ID="Content2" ContentPlaceHolderID="appBody" runat="server">
 ...
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- We need js bundles here -->
   <script type="text/javascript" src="/dist/build/app1.bundle.js"></script>
 </asp:Content>
```
---

`app2.master`
```js
<%@ Master Language="C#" AutoEventWireup="true" Inherits="some.namespace" %>

 <script runat="server" type="text/C#">
 ...
 </script>
 <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
 <!-- We need css bundles here -->
   <link rel="stylesheet" href="/dist/build/app2.bundle.css">
 </asp:Content>

 <asp:Content ID="Content2" ContentPlaceHolderID="appBody" runat="server">
 ...
 </asp:Content>

 <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
   <!-- We need js bundles here -->
   <script type="text/javascript" src="/dist/build/app2.bundle.js"></script>
 </asp:Content>
```

---

`randomName1.extChoice`
```js
<!-- example file for illustration-->
<!-- I am some text within app3.js-->
<!-- app3.bundle.aspx -->
<!-- "app3.bundle.js" -->
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
  filename: "[name].bundle.[contenthash].js"
},
plugins: [
    new MiniCssExtractPlugin({ filename: { filename: "[name].bundle.[contenthash].css" } }),
    new InjectChunksWebpackPlugin({
      // patternToMatch: 'string to be matched within [name][ your pattern ].[js|css]',
      // defaultWriteFile: chcange this if you dont want to write to index.aspx by default
      chunkOverrides: {
        app2: { file: 'app2.master' },
        app3: { path: './src/sampleDir/randomName1.extChoice' }
      }
    })
  ]
```

---

As you can see, from the webpack config's entry points, there will be 3 output chunks after running here.
1. app1
2. app2
3. app3

We did not pass in any separate chunkOverrides to the plugin for `app1`, therefore it's output chunk gets written to the index.aspx file within the app1 directory if a match is found within it. This is the default behavior.

`src/app1/index.aspx`
```js
...
   <!-- We need css bundles here -->
   <link rel="stylesheet" href="/dist/build/app1.bundle.8ffe29d58b95d211d686.css">
...
   <!-- We need js bundles here -->
   <script type="text/javascript" src="/dist/build/app1.bundle.8ffe29d58b95d211d686.js"></script>
```

We wanted to write the newly generated bundle for app2 into its `app2.master` file within the `app2` directory. In order to do this, we simply passed in an override for app2 and specified the file. Passing in the file property works because the target file (app2.master) existed within the same directory as the entry file for app2.

`src/app2/app2.master`
```js
 ...
<!-- We need css bundles here -->
   <link rel="stylesheet" href="/dist/build/app2.bundle.8ffe29d58b95d211d686.css">
 ...
   <!-- We need js bundles here -->
   <script type="text/javascript" src="/dist/build/app2.bundle.8ffe29d58b95d211d686.js"></script>
 ...
```

`app3`'s output gets written to src/sampleDir/randomName1.extChoice. We passed path into the chunkOverrides object for the app3 entry because the target output file doesn't exist with the directory of `app3`'s entry point. The path property should be an absolute path to the file which you wish to write to.

`src/sampleDir/randomName1.extChoice`
```js
 <!-- example file for illustration -->
 <!-- I am some text within app3.js -->
 <!-- app3-bundle.aspx -->
 <!-- "app3.bundle.8ffe29d58b95d211d686.js" -->
```

Note the following:
line 2's app3.js does not have a `.bundle` in the string so it didnt match the regular expression.
The comment below has .aspx as its extension, so again, no match.
The last line had the correct pattern so it was matched and replaced by the newly generated asset.
See the `patternToMatch` option below for further configurations.

`patternToMatch` option allows you to pass in a string which will be combined into a Regular Expression
in between `chunk.name` YOUR_PATTERN `.` `chunk file extension`.
By default it looks for `[chunk name].bundle[.OPTIONAL HASH].[fileExt]`.

`defaultWriteFile` allows you to specify what default file to write to within the directory of that chunks entry point file. Default is index.aspx.
