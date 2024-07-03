const path = require('path');
const slsw = require('serverless-webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');


const isLocal = slsw.lib.webpack.isLocal;

module.exports = {
	mode: isLocal ? 'development' : 'production',
	entry: slsw.lib.entries,
	devtool: 'source-map',
	resolve: {
		extensions: ['.js', '.jsx', '.mjs', '.json', '.ts', '.tsx'],
	},
	output: {
		libraryTarget: 'commonjs2',
		path: path.join(__dirname, '.webpack'),
		filename: '[name].js',
	},
	target: 'node',
	cache: {
		type: 'filesystem',
		allowCollectingMemory: true,
		cacheDirectory: path.resolve('.webpackCache'),
	},
	optimization: {
		usedExports: true,
		minimize: true,
		minimizer: [new TerserPlugin()],
	},
	module: {
		rules: [
			{
				// Include ts, tsx, js, and jsx files.
				test: /\.(ts|js)x?$/,
				exclude: /node_modules/,
				use: ['ts-loader'],
			},
		],
	},
	plugins: [
		new ForkTsCheckerWebpackPlugin({
			typescript: {
				configFile: path.join(__dirname, 'tsconfig.json'),
			},
		}),
	],
};
