# Replace Content Plugin
This Plugin was written in order to be able to inject newly generated webpack assest into specific
places within an index.aspx page.

There seems to have been other dealing with this issue yet I found no obvious open source solutions. I gained a few clues from [this github post](https://github.com/webpack/webpack/issues/86#issuecomment-135526500)

[html-webpack-plugin]https://github.com/ampedandwired/html-webpack-plugin is a very popular plugin for doing similar things to this one, however it isnt nearly as flexible and it will only write to html files. Aspx files dont have the same structure as html files so the above plugin wouldnt work.

# Install
TODO --> update how to install this package

# Useage

*Folder Structure*
**Project**
  *src
    *app1
      *app1.js
      *index.aspx
    *app2
      *app2.js
      *app2.master
    *app3
      *app3.js
    *sampleDir
      *randomName1.extChoice
  *dist
    *build

---

`app1/index.aspx`

> <%@ Page Language="C#" AutoEventWireup="false" Inherits="path" MasterPageFile="~/> path %>
>
> <script runat="server" type="text/C#">
> ...
> </script>
> <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
>   <!-- We need css bundles here -->
>   <link rel="stylesheet" href="/dist/build/app1-bundle.css">
> </asp:Content>
>
> <asp:Content ID="Content2" ContentPlaceHolderID="appBody" runat="server">
> ...
> </asp:Content>
>
> <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
>   <!-- We need js bundles here -->
>   <script type="text/javascript" src="/dist/build/app1-bundle.js"></script>
> </asp:Content>

---

`app2.master`

><%@ Master Language="C#" AutoEventWireup="true" Inherits="some.namespace" %>
>
> <script runat="server" type="text/C#">
> ...
> </script>
> <asp:Content ID="Content1" ContentPlaceHolderID="appHead" runat="server">
<!-- We need css bundles here -->
>   <link rel="stylesheet" href="/dist/build/app2-bundle.css">
> </asp:Content>
>
> <asp:Content ID="Content2" ContentPlaceHolderID="appBody" runat="server">
> ...
> </asp:Content>
>
> <asp:Content ID="Content3" ContentPlaceHolderID="appBodyEnd" runat="server">
>   <!-- We need js bundles here -->
>   <script type="text/javascript" src="/dist/build/app2-bundle.js"></script>
> </asp:Content>

---

`*randomName1.extChoice`

> <!-- example file for illustration-->
> I am within app3.js
> <!-- app3-bundle.aspx -->

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
  filename: "[name]-[contenthash]-bundle.js"
},
plugins: [
    new MiniCssExtractPlugin({ filename: { filename: "[name]-[contenthash]-bundle.css" } }),
    new ReplaceContentPlugin({
      logSkipped: true,
      logWarnings: true,
      logInjection: true,
      // matchPattern: 'string to be matched within [name][ your pattern ].[js|css]',
      // defaultWriteFile: chcange this if you dont want to write to index.aspx by default
      overrides: {
        app2: { file: 'app2.master' },
        app3: { relativePath: './src/sampleDir/randomName1.extChoice' }
      }
    })
  ]
```

---

There are 3 output chunks after running here.
1. app1
2. app2
3. app3

`app1`'s output chunk gets written to the index.aspx file within the app1 directory. This is the default behavior and no overrides needed to be passed in for it.

`src/app1/index.aspx`
>...
>   <!-- We need css bundles here -->
>   <link rel="stylesheet" href="/dist/build/app1-8ffe29d58b95d211d686-bundle.css">
>...
>   <!-- We need js bundles here -->
>   <script type="text/javascript" src="/dist/build/app1-8ffe29d58b95d211d686-bundle.js"></script>


`app2`'s output gets written to the app2.master file within the app2 directory. We has to override the file to look for within that application's directory.

`src/app2/app2.master`

> ...
<!-- We need css bundles here -->
>   <link rel="stylesheet" href="/dist/build/app2-8ffe29d58b95d211d686-bundle.css">
> ...
>   <!-- We need js bundles here -->
>   <script type="text/javascript" src="/dist/build/app2-8ffe29d58b95d211d686-bundle.js"></script>
> ...


`app3`'s output gets written to src/sampleDir/randomName1.extChoice. We passed a relative path into the overrides object for the app3 entry because the target output file doesn't exist with the directory of `app3`'s entry point.

`src/sampleDir/randomName1.extChoice`

> <!-- example file for illustration-->
> I am within app3.js
> <!-- app3-bundle.aspx -->
> app3-8ffe29d58b95d211d686-bundle.js

Note the following:
app3.js had no `-bundle` so it didnt match.
Comment had a .aspx extension so no match.
See the `matchPattern` option below.

The overrides option for this plugin also accepts an `absolutePath` property which you can see in the `optionsSchema.json`.

`matchPattern` option allows you to pass in a string which will be combined into a Regular Expression
in between `chunk.name`YOUR_PATTERN`.`chunk file extension`.
By default it looks for `[chunk name]-[OPTIONAL HASH-]bundle.[fileExt]`.

`defaultWriteFile` allows you to specify what default file to write to within the directory of that chunks entry point file. Default is index.aspx.
