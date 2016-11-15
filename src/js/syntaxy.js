/**
 * Syntaxy JS.
 * A flexible syntax highlighter for web pages.
 *
 * @author   Rainner Lins <rainnerlins@gmail.com>
 * @github   https://github.com/rainner/syntaxy-js
 * @license  MIT
 */
(function( factory )
{
    if( typeof define === 'function' && define.amd ){
        define( [], factory );
    }
    else if( typeof exports === 'object' ){
        module.exports = factory;
    }
    else if( window ){
        window.Syntaxy = factory( window.jQuery || null );
    }

})(function( jQuery )
{
    /**
     * String trimming polyfills
     */
    if( typeof String.prototype.ltrim !== 'function' )
    {
        String.prototype.ltrim = function(){
            return this.replace( /^[\s\uFEFF\xA0]+/g, '' );
        };
    }
    if( typeof String.prototype.rtrim !== 'function' )
    {
        String.prototype.rtrim = function(){
            return this.replace( /[\s\uFEFF\xA0]+$/g, '' );
        };
    }
    if( typeof String.prototype.trim !== 'function' )
    {
        String.prototype.trim = function(){
            return this.replace( /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '' );
        };
    }

    /**
     * Use Syntaxy with jQuery, if available
     */
    if( jQuery && jQuery.fn && !jQuery.fn.syntaxy )
    {
        jQuery.fn.syntaxy = function( options )
        {
            return this.each( function()
            {
                var syntaxy = new Syntaxy( this, options );
                syntaxy.render();
            });
        };
    }

    /**
     * Syntaxy class
     * @param {Object} target  : Code container element
     * @param {Object} options : Custom options
     */
    var Syntaxy = function( target, options )
    {
        this.target  = null;
        this.reglist = {};
        this.code    = '';
        this.error   = '';
        this.options = {
            tagOpen     : '«', // special tag open delimeter
            tagSplit    : '≈', // special tag split delimeter
            tagClose    : '»', // special tag close delimeter
            tagName     : 'span', // final markup tag name
            classPrefix : 'stx-', // syntaxy css class prefix
            codeTitle   : 'Source code', // title to show on code box header
            codeType    : '', // default syntax type to be used
            minHeight   : '100px', // min height of syntax scroll container
            maxHeight   : '600px', // max height of syntax scroll container
            isInline    : false, // if rendering inline code containers
            wordWrap    : false, // wrap long lines
            startLine   : 1, // line to statrt counting from
            debugLines  : '', // comma separated line numbers to debug (flash)
        };
        this.setTarget( target );
        this.setOptions( options );
        this.factory();
    };

    /**
     * Syntaxy prototype
     * @type {Object}
     */
    Syntaxy.prototype = {
        constructor: Syntaxy,

        /**
         * Set target element
         * @param  {Object} target : DOM element
         * @return {Object}        : Self
         */
        setTarget: function( target )
        {
            if( typeof target === 'object' )
            {
                this.target = target;
                this.setCode( target.innerHTML || '' );
                this.setOptions({
                    // options from tag attributes
                    codeTitle   : this.toString( target.getAttribute( 'data-title' ), this.options.codeTitle ).trim(),
                    codeType    : this.toString( target.getAttribute( 'data-type' ), this.options.codeType ).trim(),
                    minHeight   : this.toString( target.getAttribute( 'data-min-height' ), this.options.minHeight ).trim(),
                    maxHeight   : this.toString( target.getAttribute( 'data-max-height' ), this.options.maxHeight ).trim(),
                    isInline    : this.toBoolean( target.getAttribute( 'data-inline' ), this.options.isInline ),
                    wordWrap    : this.toBoolean( target.getAttribute( 'data-wrap' ), this.options.wordWrap ),
                    startLine   : this.toNumeric( target.getAttribute( 'data-start' ), this.options.startLine ),
                    debugLines  : this.toString( target.getAttribute( 'data-debug' ), this.options.debugLines ).trim(),
                });
            }
            return this;
        },

        /**
         * Merge custom options
         * @param  {Object} options : Options object literal
         * @return {Object}         : Self
         */
        setOptions: function( options )
        {
            if( typeof options === 'object' )
            {
                for( var key in options )
                {
                    if( options.hasOwnProperty( key ) )
                    {
                        this.options[ key ] = options[ key ];
                    }
                }
            }
            return this;
        },

        /**
         * Set and filter source code
         * @param  {String} code : Code to be highlighted
         * @return {Object}      : Self
         */
        setCode: function( code )
        {
            this.code = ( ( typeof code === 'string' ) ? code : '' )
            .replace( /&amp;/g, '&' )
            .replace( /&lt;/g, '<' )
            .replace( /&gt;/g, '>' )
            .replace( /&nbsp;|\u00a0/gi, ' ' )
            .replace( /\t/g, '    ' )
            .replace( /[\r]+/g, '' )
            .replace( /^[\n]+/, '' )
            .replace( /[\s\t\n\uFEFF\xA0]+$/, '' );
            return this;
        },

        /**
         * Processes the code to be highlighted and builds final HTML tags
         * @return {String} : Processed code, original code, or fallback message.
         */
        processCode: function()
        {
            this.error = '';
            var code   = '';

            if( !this.code )
            {
                this.error = 'This container does not have any code to be highlighted.';
                code = '// No code available.'; // fallback
            }
            else if( !this.options.codeType )
            {
                this.error = 'The syntax type for this container has not been specified.';
                code = this.getCode( true ); // unprocessed
            }
            else if( !this.hasFilter( this.options.codeType ) )
            {
                this.error = 'The syntax type specified ('+ this.options.codeType +') could not be found.';
                code = this.getCode( true ); // unprocessed
            }
            else // try to process filters and catch any errors
            {
                try
                {
                    code = this
                    .applyFilter( this.options.codeType, this.code )
                    .replace( /</g, '&lt;' )
                    .replace( new RegExp( this.options.tagClose, 'g' ), '</'+this.options.tagName+'>' )
                    .replace( new RegExp( this.options.tagOpen+'([A-Z]+)'+this.options.tagSplit, 'g' ), function( m, clss ){
                        return '<'+this.options.tagName+' class="'+this.toClass( clss )+'">';
                    }.bind( this ) );
                }
                catch( e )
                {
                    var ename  = String( e.name || 'ScriptError' ),
                        einfo  = String( e.description || e.message || 'There has been a script error' ),
                        efile  = String( e.file || e.fileName || 'n/a' ),
                        eline  = String( e.line || e.number || e.lineNumber || 'n/a' );

                    this.error = ename +': '+ einfo +' - on file ('+ efile +'), line '+ eline +'.';
                    code = this.getCode( true ); // unprocessed
                }
            }
            return code;
        },

        /**
         * Returns the original added source code
         * @return {String} code : Original code string
         */
        getCode: function( esc )
        {
            if( esc === true )
            {
                return this.code.replace( /</g, '&lt;' );
            }
            return this.code;
        },

        /**
         * Checks if there's a erro string saved locally
         * @return {Boolean}
         */
        hasError: function()
        {
            return ( this.error ) ? true : false;
        },

        /**
         * Get the local error string
         * @return {String} : Last error string
         */
        getError: function()
        {
            return this.error;
        },

        /**
         * Add a regex filter to the list
         * @param  {String}   name   : Name of the filter to be added
         * @param  {Function} filter : Function to filter source code and apply regex replaces
         * @return {Object}          : Self
         */
        addFilter: function( name, filter )
        {
            name = this.toString( name, '' ).replace( /[^\w]+/g, '' );

            if( name && typeof filter === 'function' )
            {
                this.reglist[ name ] = filter;
            }
            return this;
        },

        /**
         * Checks if a filter has been added by mame
         * @param  {String}  name : Name of the filter to be checked
         * @return {Boolean}
         */
        hasFilter: function( name )
        {
            if( this.reglist.hasOwnProperty( name ) )
            {
                return true;
            }
            return false;
        },

        /**
         * Get the callback for a added regex filter
         * @param  {String}   name : Name of the filter to be added to the list
         * @return {Function}      : Regex filter function
         */
        getFilter: function( name )
        {
            if( this.reglist.hasOwnProperty( name ) )
            {
                return this.reglist[ name ];
            }
            return function( code ){ return code };
        },

        /**
         * Filter code using an added named regex filter
         * @param  {String}  name : Name of the filter to be added to the list
         * @param  {String}  code : Code string to be filtered
         * @return {String}       : Filtered code string
         */
        applyFilter: function( name, code )
        {
            var filter = this.getFilter( name ).bind( this );
            return filter( code );
        },

        /**
         * Wraps regex filter match (code) in special tag to be highlighted
         * @param  {String}  clss      : Syntax CSS class name to use
         * @param  {String}  code      : The code to be wrapped
         * @param  {Boolean} strip     : Strip other tags from given code match
         * @param  {Boolean} multiline : Split code match and process each line separately
         * @return {String}            : Wrapped code in special tags and class name
         */
        wrapClass: function( clss, code, strip, multiline )
        {
            code = this.toString( code, '' );

            if( strip === true )
            {
                code = code.replace( new RegExp( this.options.tagOpen +'([A-Z]+)'+ this.options.tagSplit, 'g' ), '' );
                code = code.replace( new RegExp( this.options.tagClose, 'g' ), '' );
            }
            if( multiline === true )
            {
                var output = [];

                code.split( "\n" ).forEach( function( line ){
                    line = line.replace( /^([\s]*)(.*?)([\s]*)$/, function( m, left, middle, right ){
                        output.push( left + this.toTag( clss, middle ) + right );
                    }.bind( this ) );
                }.bind( this ) );

                return output.join( "\n" );
            }
            return this.toTag( clss, code );
        },

        /**
         * Wrapper for building tag className using optional prefix
         * @param  {String} name : Syntax color css class name
         * @return {String}      : Final class name
         */
        toClass: function( clss )
        {
            clss = this.toString( clss, '' ).toLowerCase();
            return this.options.classPrefix + clss;
        },

        /**
         * Wrap a given code in special tags for a given class name
         * @param  {String}  name : Syntax color css class name
         * @param  {String}  code : Code string to be wrapped
         * @return {String}       : Wrapped code tag
         */
        toTag: function( clss, code )
        {
            clss = this.toString( clss, '' ).toUpperCase();
            code = this.toString( code, '' );
            return this.options.tagOpen + clss + this.options.tagSplit + code + this.options.tagClose;
        },

        /**
         * Returns a string for a value, or default value
         * @param  {*} val  : Given value
         * @param  {*} def  : Default value
         * @return {String} : String value
         */
        toString: function( val, def )
        {
            val = String( val || '' );
            def = String( def || '' );
            return ( val || def );
        },

        /**
         * Returns a number for a value, or default value
         * @param  {*} val   : Given value
         * @param  {*} def   : Default value
         * @return {Numeric} : Number/Float value
         */
        toNumeric: function( val, def )
        {
            val = ( /^(\-|\+){0,1}[0-9\.]+$/.test( val ) ) ? val : 0;
            def = ( /^(\-|\+){0,1}[0-9\.]+$/.test( def ) ) ? def : 0;
            return ( val || def );
        },

        /**
         * Returns a boolean for a value, or default value
         * @param  {*} val   : Given value
         * @param  {*} def   : Default value
         * @return {Boolean} : True or False
         */
        toBoolean: function( val, def )
        {
            def = ( typeof def === 'boolean' ) ? def : false;
            return ( /^(1|on|true|active|enabled?|Y)$/i.test( val ) ) ? true : def;
        },

        /**
         * Remove uneeded spaces from the left of a single line
         * @param  {String} line    : Single line to outdent
         * @param  {Number} outdent : Number of spaces to remove
         * @return {String}         : Outdented line
         */
        lineOutdent: function( line, outdent )
        {
            line    = ( line || '' );
            outdent = parseInt( outdent || 0 );
            if( line.trim() === '' ) return '&nbsp;';
            if( outdent > 0 ) return line.replace( new RegExp( '^\\s{'+outdent+'}' ), '' );
            return line;
        },

        /**
         * Resolve CSS class name for a single line
         * @param  {Number} num   : Line number
         * @param  {Array}  debug : List of line numbers in an array
         * @return {String}       : Class name
         */
        lineClass: function( num, debug )
        {
            var tone = ( num % 2 ) ? 'lighter' : 'darker',
                clss = ( debug.indexOf( String( num ) ) !== -1 ) ? 'flash' : tone;
            return this.options.classPrefix + clss;
        },

        /**
         * Toggles a class name for an element
         * @param  {Object} el   : Target element
         * @param  {String} clss : Class name to toggle
         * @return {Object}      : Self
         */
        toggleClass: function( el, clss )
        {
            if( typeof el === 'object' && typeof clss === 'string' )
            {
                if( el.classList && el.classList.toggle )
                {
                    el.classList.toggle( clss );
                }
                else if( Array.prototype.indexOf )
                {
                    var list  = String( el.className || "" ).trim().replace( /\s+/g, " " ).split( " " ),
                        index = list.indexOf( clss );

                    if( index >= 0 ){ list.splice( index, 1 ); }
                    else{ list.push( clss ); }
                    el.className = list.join( " " );
                }
            }
            return this;
        },

        /**
         * Render final highlighted code
         * return {Object} : Self
         */
        render: function()
        {
            if( this.target )
            {
                // try to process/highlight the code
                var code = this.processCode(),
                    c    = this.toClass.bind( this );

                // reset target container
                this.target.style['margin'] = '0';
                this.target.style['padding'] = '0';
                this.target.style['border'] = '0';
                this.target.style['text-align'] = 'left';

                // if showing highlighted code inline
                if( this.options.isInline === true )
                {
                    this.target.style['display'] = 'inline-block';
                    this.target.innerHTML = '<span class="'+ c('wrap-inline') +'">' + code + '</span>';
                }
                else // or, if rendering a pre-style code container
                {
                    var leftSpaces  = code.search( /\S|$/ ) || 0,
                        singleLines = code.split( "\n" ),
                        totalLines  = 0,
                        numLines    = singleLines.length,
                        debugLines  = this.options.debugLines.split( "," ),
                        startLine   = this.options.startLine,
                        wrapClass   = this.options.wordWrap ? 'wordwrap' : 'nowrap',
                        heightStyle = '',
                        errorText   = '',
                        lineRows    = '';

                    // build each individual line
                    for( var i=0; i < numLines; i++ )
                    {
                        var lineCode  = this.lineOutdent( singleLines[ i ], leftSpaces ),
                            lineClass = this.lineClass( startLine, debugLines );

                        lineRows += '' +
                        '<div class="'+ c('line-wrap') +' '+ lineClass +'" data-line="'+ startLine +'">' +
                            '<div class="'+ c('line-code') +' '+ c( wrapClass ) +'">' + lineCode + '</div>' +
                        '</div>';

                        startLine++;
                        totalLines++;
                    }

                    // resolve height restrictions for code scroller
                    if( this.options.minHeight ) heightStyle += 'min-height: '+ this.options.minHeight + '; ';
                    if( this.options.maxHeight ) heightStyle += 'max-height: '+ this.options.maxHeight + '; ';
                    if( this.error ) errorText = '!!!';

                    // add markup to container
                    this.target.style['display'] = 'block';
                    this.target.innerHTML = '' +
                    '<div class="'+ c('wrap') +'">' +
                        '<div class="'+ c('header') +' '+ c('clear') +'">' +
                            '<div class="'+ c('left') +' '+ c('text') +'">'+ this.options.codeTitle +'</div>' +
                            '<div class="'+ c('right') +' '+ c('text') +'">' +
                                '<button class="'+ c('error-btn') +' '+ c('important') +'" type="button" title="Process error">'+ errorText +'</button> ' +
                                '<button class="'+ c('toggle-btn') +' '+ c('text') +'" type="button" title="Toggle line numbers">☀</button> ' +
                                '<span>' + totalLines + ' '+ ( totalLines === 1 ? 'line' : 'lines' ) +'</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="'+ c('scroller') +'" style="'+ heightStyle +'">' +
                            lineRows +
                        '</div>' +
                    '</div>';

                    // bind error btn
                    if( this.error )
                    {
                        this.target.querySelector( '.'+c('error-btn') ).addEventListener( 'click', function( e ){
                            alert( this.error );
                        }.bind( this ) );
                    }
                    // bind toggle btn
                    this.target.querySelector( '.'+c('toggle-btn') ).addEventListener( 'click', function( e ){
                        var scroller = this.target.querySelector( '.'+c('scroller') );
                        this.toggleClass( scroller, c('nonums') );
                    }.bind( this ) );
                }
            }
        },

        /**
         * Factory default list of regex filters to use for highlighting code
         * @return void
         */
        factory: function()
        {
            this.reglist = {

                // syntax doctype tags
                doctypes: function( code )
                {
                    code = code.replace( /(<!DOCTYPE[\w\W]+?>)/g, this.wrapClass( 'doctype', '$1' ) ); // DOCTYPE
                    code = code.replace( /(<\?xml[\w\W]+?>)/g, this.wrapClass( 'doctype', '$1' ) ); // xml
                    code = code.replace( /(<(\?|\%)(php|\=)?)/gi, this.wrapClass( 'doctype', '$1' ) ); // <?php, <?=, <%=
                    code = code.replace( /((\%|\?)>)/g, this.wrapClass( 'doctype', '$1' ) ); // ?>, %>
                    code = code.replace( /(\#\!\/.*)/g, this.wrapClass( 'doctype', '$1' ) ); // #!/...
                    return code;
                },

                // constants and other common globals
                constants: function( code )
                {
                    code = code.replace( /(?=.*[A-Z])(\$?(\b(?![\d\#\'\"]+)([A-Z0-9\_]{2,})\b))(?![\:\'\"\(])/g, this.wrapClass( 'global', '$1' ) ); // constants
                    code = code.replace( /(?=.*[\w]+)([\_]{2}[\w]+)/g, this.wrapClass( 'global', '$1' ) ); // __constants, reserved
                    return code;
                },

                // full camelcase class names
                classes: function( code )
                {
                    code = code.replace( /(?=.*[a-z])\b(([A-Z]+[a-z0-9]+)+)/g, this.wrapClass( 'class', '$1' ) );
                    return code;
                },

                // named functions
                functions: function( code )
                {
                    code = code.replace( /(^|\b[\w\-\!\*]+)(\s*\()/g, this.wrapClass( 'function', '$1' ) +'$2' );
                    return code;
                },

                // numbers and hexadecimal values
                numbers: function( code )
                {
                    code = code.replace( /([^\w\-]+)([+-]?(\.?\d)+)(?![\w\'\"])/g, '$1'+ this.wrapClass( 'numeric', '$2') );
                    code = code.replace( /(0x[a-fA-F0-9]+)/g, this.wrapClass( 'numeric', '$1' ) );
                    return code;
                },

                // common operator symbols in combination
                operators: function( code )
                {
                    code = code.replace( /([\&|\*|\+|\-|\.|\:|\/]{1}\=)(?![\n])/g, this.wrapClass( 'operator', '$1' ) ); // assign *=, +=
                    code = code.replace( /([\<|\>|\!|\=]{1}[\=]{1,2})(?![\n])/g, this.wrapClass( 'operator', '$1' ) ); // compare ==, >=, !==
                    code = code.replace( /([\<|\>|\+|\-]{2,3})(?![\n])/g, this.wrapClass( 'operator', '$1' ) ); // modify ++, --, >>
                    code = code.replace( /([\&|\|]{2})(?![\n])/g, this.wrapClass( 'operator', '$1' ) ); // and/or &&, ||
                    code = code.replace( /(([\-|\=]{1}>)|(<[\-|\=]{1}))(?![\n])/g, this.wrapClass( 'operator', '$1' ) ); // arrows ->, <-
                    code = code.replace( /([\s]+)\B([\<|\>|\&|\=|\%|\?|\:|\*|\+|\-|\^|\~|\/|\|]{1})(?=[\s]+)/g, '$1'+ this.wrapClass( 'operator', '$2' ) ); // single
                    return code;
                },

                // reserved keywords for most languages
                keywords: function( code )
                {
                    var clss, words = "" +
                    "var,let,const,static,public,private,protected,function,abstract,interface,return,yield,declare,then,if,else(if)?,els?if," +
                    "foreach,while,switch,throws?,catch,finally,try,do,as,in,true,false,null,void,class,package,extends?,implements?,namespace," +
                    "use,new,imports?,exports?,includes?(_once)?,requires?(_once)?,define,ifndef,with,super,from,continue,break,delete,case," +
                    "global,instanceof,typeof,typedef,NaN,window,document,screen,top,module,goto,volatile,transient,char,parent,def,del,for," +
                    "fi,except,is,exit,auto,not,or,xor,and,pass,print_?(f|r)?,echo,raise,enum,register,union,endif,endfor,endforeach,endwhile," +
                    "lambda,long,int,float,double,bool,boolean,short,unsigned,signed,undefined,string,number,any,constructor,self,this,async,await," +
                    "byte,checked,decimal,delegate,descending,dynamic,event,fixed,group,implicit,internal,into,lock,object,out,override,orderby," +
                    "params,partial,readonly,ref,sbyte,sealed,stackalloc,select,uint,ulong,extern,inline,sizeof,struct,debugger,eval,get,set," +
                    "Infinity,caller,die,dump,last,local,my,next,no,our,redo,sub,undef,unless,until,wantarray,all,extends,isnt,final,exposing," +
                    "loop,of,off,on,throw,when,yes,exec,nonlocal,done,esac,using,assert,arguments,base,by,template,default,native,end";

                    words.split( "," ).forEach( function( word ){
                        clss = 'keyword';
                        clss = ( /^(import|export|include|require|use|using|from|define|ifndef)/.test( word ) ) ? 'import' : clss;
                        clss = ( /^(instanceof|typeof|typedef|and|xor|or|is|in|as)$/.test( word ) ) ? 'operator' : clss;
                        clss = ( /^(window|document|screen|module|global|arguments|parent|self|this)$/.test( word ) ) ? 'class' : clss;
                        code = code.replace( new RegExp( "(^|[^\\.|\\>|\\-|\\$|\\#|\\/])\\b("+word+")\\b", 'g' ), function( m, m1, m2 ){
                            return m1 + this.wrapClass( clss, m2, true );
                        }.bind( this ) );
                    }.bind( this ) );
                    return code;
                },

                // object keys
                keys: function( code )
                {
                    code = code.replace( /([\w\-]+)(([\s]+)?\:)(?=[\s]+)/g, this.wrapClass( 'key', '$1' )+'$2' )
                    return code;
                },

                // markup syntax tags
                tags: function( code )
                {
                    return code.replace( /(<[^\!\?\%\#\=]\/?[^>]*>)/gi, function( m, tag ){
                        var clss = 'tag';
                        clss = ( /^<\/?(style|link|script)/i.test( tag ) ) ? 'hook' : clss;
                        clss = ( /^<\/?(table|thead|tbody|tfoot|th|tr|td|tf|dd|dt|dl|colgroup|col|caption)/i.test( tag ) ) ? 'table' : clss;
                        clss = ( /^<\/?(form|fieldset|legend|label|optgroup|option|select|input|textarea|button|datalist|keygen|meter|output)/i.test( tag ) ) ? 'form' : clss;
                        clss = ( /^<\/?(img|canvas|audio|video|source|track|svg)/i.test( tag ) ) ? 'media' : clss;
                        clss = ( /^<\/?(i?frame|object|embed)/i.test( tag ) ) ? 'embed' : clss;
                        return this.wrapClass( clss, tag, true, true );
                    }.bind( this ) );
                },

                // comment blocks and single-line comments
                comments: function( code )
                {
                    // multi-line comments
                    code = code.replace( /(\/\*[\s\S]*?\*\/)/g, function( m, cmt ){
                        return this.wrapClass( 'comment', cmt, true, true );
                    }.bind( this ) );

                    // parse slash based single-line commnets without matching urls (http://...)
                    code = code.replace( /(^|[^\:])(\/\/.*)/g, function( m, left, cmt ){
                        return left + this.wrapClass( 'comment', cmt, true );
                    }.bind( this ) );

                    // parse dash and pound based single-line commnets, but only if followed by a space
                    code = code.replace( /((\#+[\ ]+.*)|(\#+[\n]+))/g, function( m, cmt ){
                        return this.wrapClass( 'comment', cmt, true );
                    }.bind( this ) );

                    return code;
                },

                // string blocks
                strings: function( code )
                {
                    code = code.replace( /([\'|\"|\`]{3}[\s\S]*?[\'|\"|\`]{3})/g, function( m, str ){
                        return this.wrapClass( 'string', str, true, true ); // multiline blocks
                    }.bind( this ) );

                    code = code.replace( /((?:\'[^\'\n]*(?:\\.[^\'\n]*)*\'))/g, function( m, str ){
                        return this.wrapClass( 'string', str, true ); // 'single quotes'
                    }.bind( this ) );

                    code = code.replace( /((?:\"[^\"\n]*(?:\\.[^\"\n]*)*\"))/g, function( m, str ){
                        return this.wrapClass( 'string', str, true ); // "double quotes"
                    }.bind( this ) );

                    code = code.replace( /((?:\`[^\`\n]*(?:\\.[^\`\n]*)*\`))/g, function( m, str ){
                        return this.wrapClass( 'string', str, true ); // `backticks`
                    }.bind( this ) );

                    return code;
                },

                // markup-like syntax
                markup: function( code )
                {
                    code = code.replace( /(<style[^>]*>)([^<]*)(<\/style>)/g, function( m, open, code, close ){
                        return open + this.applyFilter( 'style', code ) + close; // nested css
                    }.bind( this ) );

                    code = code.replace( /(?!.*src\=)(<script[^>]*>)([^<]*)(<\/script>)/g, function( m, open, code, close ){
                        return open + this.applyFilter( 'default', code ) + close; // nested js
                    }.bind( this ) );

                    code = code.replace( /(<\?php|<\?=?|<\%\=?)([\w\W]+?)(\?>|\%>)/g, function( m, open, code, close ){
                        return open + this.applyFilter( 'default', code ) + close; // nested php
                    }.bind( this ) );

                    code = code.replace( /(<!--[\s\S]*?-->)/g, function( m, cmt ){
                        return this.wrapClass( 'comment', cmt, true, true ); // multi-line comments
                    }.bind( this ) );

                    code = code.replace( /(<!\[CDATA\[[\s\S]*?\]\]>)/g, function( m, cmt ){
                        return this.wrapClass( 'comment', cmt, true, true ); // multi-line cdata
                    }.bind( this ) );

                    code = this.applyFilter( 'doctypes', code );
                    code = this.applyFilter( 'tags', code );
                    code = this.applyFilter( 'strings', code );
                    return code;
                },

                // css, less, sass, syntax
                style: function( code )
                {
                    code = code.replace( /([^\{\}\s\;][^\{\}\;]*?)(?=\s*\{)/gi, function( m, sl ){
                        return this.wrapClass( 'keyword', sl, false, true ); // multi-line selectors
                    }.bind( this ) );

                    code = code.replace( /(\@[\w\-]+)/g, this.wrapClass( 'import', '$1' ) );
                    code = code.replace( /([\(|\:]\s*)(\#[a-fA-F0-9]+)/g, '$1'+ this.wrapClass( 'value', '$2' ) ); // hex color
                    code = code.replace( /([\(|\:]\s*)([\w\s\-]+)(?=[\;\s\n])/g, '$1'+ this.wrapClass( 'value', '$2' ) ); // common value
                    code = code.replace( /(\$[\w\-]+)(?=[\;\,\s\n])/g, this.wrapClass( 'global', '$1' ) ); // variables
                    code = code.replace( /(\![a-z]+)(?=[\;\s\n])/gi, this.wrapClass( 'important', '$1' ) ); // important
                    code = code.replace( /([^\w\#])([\+\-]?((\.?\d+)+)(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?)/g, '$1'+ this.wrapClass( 'numeric', '$2' ) );

                    code = this.applyFilter( 'keys', code );
                    code = this.applyFilter( 'functions', code );
                    code = this.applyFilter( 'strings', code );
                    code = this.applyFilter( 'comments', code );
                    return code;
                },

                // command-line/terminal syntax
                terminal: function( code )
                {
                    code = code.replace( /(^|[^\:])(\/\/\s+.*)/g, function( m, left, cmt ){
                        return left + this.wrapClass( 'comment', cmt, true );
                    }.bind( this ) );

                    code = code.replace( /(\$|\#)(\s+)([\w\-]+)/g, function( m, user, space, prog ){
                        return this.wrapClass( 'important', user ) + space + this.wrapClass( 'class', prog );
                    }.bind( this ) );

                    code = this.applyFilter( 'strings', code );
                    return code;
                },

                // shell script syntax
                shell: function( code )
                {
                    code = this.applyFilter( 'constants', code );
                    code = this.applyFilter( 'doctypes', code );
                    code = this.applyFilter( 'functions', code );
                    code = this.applyFilter( 'numbers', code );
                    code = this.applyFilter( 'keywords', code );
                    code = this.applyFilter( 'operators', code );
                    code = this.applyFilter( 'strings', code );

                    code = code.replace( /([^\$\!\{\[\\])(\#+(?![\!]).*)/g, function( m, left, cmt ){
                        return left + this.wrapClass( 'comment', cmt, true );
                    }.bind( this ) );

                    return code;
                },

                // JS object literal key/value pairs syntax
                object: function( code )
                {
                    code = this.applyFilter( 'constants', code );
                    code = this.applyFilter( 'classes', code );
                    code = this.applyFilter( 'functions', code );
                    code = this.applyFilter( 'numbers', code );
                    code = this.applyFilter( 'keywords', code );
                    code = this.applyFilter( 'keys', code );
                    code = this.applyFilter( 'strings', code );
                    code = this.applyFilter( 'comments', code );
                    return code;
                },

                // JSON string key/value pairs syntax
                json: function( code )
                {
                    code = this.applyFilter( 'strings', code );
                    code = this.applyFilter( 'comments', code );
                    return code;
                },

                // slq-like syntax highlighting
                sql: function( code )
                {
                    code = this.applyFilter( 'constants', code );
                    code = this.applyFilter( 'functions', code );
                    code = this.applyFilter( 'numbers', code );
                    code = this.applyFilter( 'operators', code );
                    code = this.applyFilter( 'strings', code );
                    code = this.applyFilter( 'comments', code );

                    code = code.replace( /(\-\-.*)/gi, function( m, cmt ){
                        return this.wrapClass( 'comment', cmt, true );
                    }.bind( this ) );

                    return code;
                },

                // default syntax highlighting for most languages
                default: function( code )
                {
                    code = this.applyFilter( 'constants', code );
                    code = this.applyFilter( 'doctypes', code );
                    code = this.applyFilter( 'classes', code );
                    code = this.applyFilter( 'functions', code );
                    code = this.applyFilter( 'numbers', code );
                    code = this.applyFilter( 'keywords', code );
                    code = this.applyFilter( 'operators', code );
                    code = this.applyFilter( 'strings', code );
                    code = this.applyFilter( 'comments', code );
                    return code;
                },

                // ...
            };
        },
    };
    return Syntaxy;
});

