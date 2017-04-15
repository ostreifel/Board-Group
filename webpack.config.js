const webpack = require('webpack');

module.exports = {
    entry: {
        boardGroup: "./js/boardGroup.js",
        boardContext: "./js/boardContext.js",
        bulkBoardContext: "./js/bulkBoardContext.js"
    },
    output: {
        libraryTarget: "amd",
        filename: "[name].js"
    },
    externals: [{
        "q": true,
        "react": true,
        "react-dom": true
    },
        /^TFS\//, // Ignore TFS/* since they are coming from VSTS host 
        /^VSS\//  // Ignore VSS/* since they are coming from VSTS host
    ],
    resolve: {
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
            },
            output: {
                comments: false,
            },
        }),
    ]    
};