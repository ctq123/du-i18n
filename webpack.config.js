const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

/**
 * @type {import('webpack').Configuration}
 */
module.exports = (env, options) => {
  const isProd = options.mode === 'production';
  return {
    target: 'node',
    mode: 'none',
    entry: {
      app: path.join(__dirname, 'src/app', 'index.tsx'),
      extension: path.join(__dirname, 'src', 'extension.ts')
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.less'],
    },
    externals: {
      vscode: 'commonjs vscode',
    },
    devtool: 'nosources-source-map',
    optimization: {
      minimize: isProd,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: '/node_modules/',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.less?$/,
          use: ['style-loader', 'css-loader', 'less-loader'],
        },
      ],
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2'
    },
    optimization: {
      minimizer: [new TerserPlugin({
        parallel: true,
      })],
    },
    plugins: [
      new CleanWebpackPlugin(),
    ]
  }
};
