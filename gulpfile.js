/**
 * Dependencies
 */
var PKG        = require( './package.json' ),
    gulp       = require( 'gulp' ),
    plumber    = require( 'gulp-plumber' ),
    sass       = require( 'gulp-sass' ),
    replace    = require( 'gulp-replace' ),
    prefix     = require( 'gulp-autoprefixer' ),
    cleancss   = require( 'gulp-clean-css' ),
    uglify     = require( 'gulp-uglify' ),
    rename     = require( 'gulp-rename' ),
    header     = require( 'gulp-header' ),
    watch      = require( 'gulp-watch' );

/**
 * Header text to be added to output build files
 */
var getHeader = function()
{
    return [
        "/*!",
        " * @Date: Compiled " + new Date() + ".",
        " * @Description: "   + String( PKG.description || 'No description' ),
        " * @Author: "        + String( PKG.author.name || PKG.author || 'No author' ) + " ("+String( PKG.author.email || PKG.email || 'no-email' )+")",
        " * @Version: "       + String( PKG.version || 'No version' ),
        " * @License: "       + String( PKG.license || 'No license' ),
        " */"
    ].join( "\n" ) + "\r\n";
};

/**
 * Send errors to console
 */
var toConsole = function( error )
{
    error && console.log( error );
    this.emit && this.emit( 'end' );
}

/**
 * Used by rename() to build named css theme files
 */
var renameCss = function( path )
{
    path.basename = path.basename.replace( 'theme', 'syntaxy' );
    path.extname  = ".min.css";
}

/**
 * Build CSS file
 */
gulp.task( 'build_css', function()
{
    var input = './src/scss/theme.*.scss',
        path  = './dist/css/';

    return gulp.src( input )
    .pipe( plumber( { errorHandler: toConsole } ) )
    .pipe( sass().on( 'error', toConsole ) )
    .pipe( prefix( { browsers: ['last 2 versions', '> 1%', 'opera 12.1', 'bb 10', 'android 4'] } ) )
    .pipe( cleancss( { advanced: false, keepBreaks: false, keepSpecialComments: false } ) )
    .pipe( replace( /[\t\r\n]+/g, '' ) )
    .pipe( header( getHeader() ) )
    .pipe( rename( renameCss ) )
    .pipe( gulp.dest( path ) );
});

/**
 * Build JS file
 */
gulp.task( 'build_js', function()
{
    var input = './src/js/syntaxy.js',
        path  = './dist/js/';

    return gulp.src( input )
    .pipe( plumber( { errorHandler: toConsole } ) )
    .pipe( uglify( { preserveComments: false } ).on( 'error', toConsole ) )
    .pipe( replace( /[\t\r\n]+/g, '' ) )
    .pipe( header( getHeader() ) )
    .pipe( rename( { suffix: '.min' } ) )
    .pipe( gulp.dest( path ) )
});

/**
 * Watch files
 */
gulp.task( 'watch', function()
{
    var files = ['./src/scss/*.scss', './src/js/*.js'];
    gulp.watch( files, ['build'] );
});

/**
 * Build all files
 */
gulp.task( 'build', ['build_css','build_js'] );
gulp.task( 'default', ['build','watch'] );
