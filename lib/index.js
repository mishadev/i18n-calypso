/**
 * External dependencies
 */
import logger from 'debug'
import Jed from 'jed'
import moment from 'moment-timezone'
import { EventEmitter } from 'events'
import LRU from 'lru'
import assign from 'lodash.assign'

import FormatNumber from './FormatNumber'

const debug = logger( 'i18n-dreamhost' )

const decimal_point_translation_key = 'number_format_decimals';
const thousands_sep_translation_key = 'number_format_thousands_sep';

class I18N {
    constructor () {
        this.defaultLocaleSlug = 'en'
        this.state = {
            numberFormatSettings: {},
            jed: undefined,
            locale: undefined,
            localeSlug: undefined,
            translations: LRU({ max: 100 })
        };
        this.translateHooks = [];
        this.observer = new EventEmitter();
        this.observer.setMaxListeners(0);

        this.throwErrors = false;

        // default configuration
        this.configure();
        this.moment = moment;
    }

/* Public */

    /**
     * Formats numbers using locale settings and/or passed options
     * @param  {String|Number|Int} number to format (required)
     * @param  {Int|object} options Number of decimal places or options object (optional)
     * @return {string}         Formatted number as string
     **/
    numberFormat ( number ) {
        const options = arguments[ 1 ] || {},
        decimals = ( typeof options === 'number' ) ?
            options : options.decimals || 0,
        decPoint = options.decPoint || this.state.numberFormatSettings.decimal_point || '.',
        thousandsSep = options.thousandsSep || this.state.numberFormatSettings.thousands_sep || ',';

        return FormatNumber( number, decimals, decPoint, thousandsSep );
    }

    configure ( options ) {
        assign( this, options || {} );
        this.setLocale();
    }

    setLocale ( localeData ) {
        var localeSlug;

        // if localeData is not given, assumes default locale
        if ( ! localeData || ! localeData[ '' ].localeSlug ) {
            localeData = { '': { localeSlug: this.defaultLocaleSlug } }
        }

        localeSlug = localeData[ '' ].localeSlug;

        // Don't change if same locale as current, except for default locale
        if ( localeSlug !== this.defaultLocaleSlug && localeSlug === this.state.localeSlug ) {
            return;
        }

        this.state.localeSlug = localeSlug;
        this.state.locale = localeData;

        this.state.jed = new Jed( {
            locale_data: {
                messages: localeData
            }
        } );

        moment.locale( localeSlug );

        // Updates numberFormat preferences with settings from translations
        this.state.numberFormatSettings.decimal_point = this._getTranslationFromJed(
                this.state.jed,
                this._normalizeTranslateArguments( [ decimal_point_translation_key ] )
                );
        this.state.numberFormatSettings.thousands_sep = this._getTranslationFromJed(
                this.state.jed,
                this._normalizeTranslateArguments( [ thousands_sep_translation_key ] )
                );

        // If translation isn't set, define defaults.
        if ( this.state.numberFormatSettings.decimal_point === decimal_point_translation_key ) {
            this.state.numberFormatSettings.decimal_point = '.';
        }

        if ( this.state.numberFormatSettings.thousands_sep === thousands_sep_translation_key ) {
            this.state.numberFormatSettings.thousands_sep = ',';
        }

        this.state.translations.clear();
        this.observer.emit( 'change' );
    }

    getLocale () {
        return this.state.locale;
    }

    /**
     * Get the current locale slug.
     * @returns {string} The string representing the currently loaded locale
     **/
    getLocaleSlug () {
        return this.state.localeSlug;
    }

    /**
     * Adds new translations to the locale data, overwriting any existing translations with a matching key
     **/
    addTranslations ( localeData ) {
        for ( var prop in localeData ) {
            if ( prop !== '' ) {
                this.state.jed.options.locale_data.messages[prop] = localeData[prop];
            }
        }

        this.state.translations.clear();
        this.observer.emit( 'change' );
    }

    /**
     * Exposes single translation method, which is converted into its respective Jed method.
     * See sibling README
     * @param  {string} original  - the string to translate
     * @param  {string} plural  - the plural string to translate (if applicable), original used as singular
     * @param  {object} options - properties describing translation requirements for given text
     * @return {string|React-components} translated text or an object containing React children that can be inserted into a parent component
     */
    translate () {
        var options, translation, sprintfArgs, errorMethod, optionsString, cacheable;

        options = this._normalizeTranslateArguments( arguments );

        cacheable = ! options.components;

        if ( cacheable ) {
            optionsString = JSON.stringify( options );

            translation = this.state.translations.get( optionsString );
            if ( translation ) {
                return translation;
            }
        }

        translation = this._getTranslationFromJed( this.state.jed, options );
        // handle any string substitution
        if ( options.args ) {
            sprintfArgs = ( Array.isArray( options.args ) ) ? options.args.slice( 0 ) : [ options.args ];
            sprintfArgs.unshift( translation );
            try {
                translation = Jed.sprintf.apply( Jed, sprintfArgs );
            } catch ( error ) {
                if ( typeof error !== 'string' ) {
                    this._error( error )
                } else {
                    this._error( 'i18n sprintf error:', printfArgs )
                }
            }
        }

        // run any necessary hooks
        this.translateHooks.forEach( function( hook ) {
            translation = hook( translation, options );
        } );

        if ( cacheable ) {
            this.state.translations.set( optionsString, translation );
        }

        return translation;
    }

    /**
     * Causes i18n to re-render all translations.
     *
     * This can be necessary if an extension makes changes that i18n is unaware of
     * and needs those changes manifested immediately (e.g. adding an important
     * translation hook, or modifying the behaviour of an existing hook).
     *
     * If at all possible, react components should try to use the more local
     * updateTranslation() function inherited from the mixin.
     */
    reRenderTranslations () {
        debug( 'Re-rendering all translations due to external request' );
        this.state.translations.clear();
        this.observer.emit( 'change' );
    }

    registerTranslateHook ( callback ) {
        this.translateHooks.push( callback );
    }

/* Private */

    _error () {
        const errorMethod = this.throwErrors ? 'error' : 'warn';
        if ('undefined' !== typeof window
            && window.console
            && 'function' !== typeof window.console[ errorMethod ]
        ) {
            window.console[ errorMethod ].apply( window.console, arguments );
        }
    }

    /**
     * Takes translate options object and coerces to a Jed request to retrieve translation
     * @param  {object} jed     - jed data object
     * @param  {object} options - object describing translation
     * @return {string}         - the returned translation from Jed
     */
    _getTranslationFromJed( jed, options ) {
        var jedMethod = 'gettext',
        jedArgs;

        if ( options.context ) {
            jedMethod = 'p' + jedMethod;
        }

        if ( typeof options.original === 'string' && typeof options.plural === 'string' ) {
            jedMethod = 'n' + jedMethod;
        }

        jedArgs = this._getJedArgs( jedMethod, options );

        return jed[ jedMethod ].apply( jed, jedArgs );
    }

    /**
     * Coerce the possible arguments and normalize to a single object
     * @param  {arguments} args - arguments passed in from `translate()`
     * @return {object}         - a single object describing translation needs
     */
    _normalizeTranslateArguments ( args ) {
        var original = args[ 0 ],
        options = {},
        i;

        // warn about older deprecated syntax
        if ( typeof original !== 'string' || args.length > 3 || ( args.length > 2 && typeof args[ 1 ] === 'object' && typeof args[ 2 ] === 'object' ) ) {
            this._error( 'Deprecated Invocation: `translate()` accepts ( string, [string], [object] ). These arguments passed:', this._simpleArguments( args ), '. See https://github.com/mishadev/i18n-dreamhost#translate-method' );
        }
        if ( args.length === 2 && typeof original === 'string' && typeof args[ 1 ] === 'string' ) {
            this._error( 'Invalid Invocation: `translate()` requires an options object for plural translations, but passed:', this._simpleArguments( args ) );
        }

        // options could be in position 0, 1, or 2
        // sending options as the first object is deprecated and will raise a warning
        for ( i = 0; i < args.length; i++ ) {
            if ( typeof args[ i ] === 'object' ) {
                options = args[ i ];
            }
        }

        // `original` can be passed as first parameter or as part of the options object
        // though passing original as part of the options is a deprecated approach and will be removed
        if ( typeof original === 'string' ) {
            options.original = original;
        } else if ( typeof options.original === 'object' ) {
            options.plural = options.original.plural;
            options.count = options.original.count;
            options.original = options.original.single;
        }
        if ( typeof args[ 1 ] === 'string' ) {
            options.plural = args[ 1 ];
        }

        if ( typeof options.original === 'undefined' ) {
            throw new Error( 'Translate called without a `string` value as first argument.' );
        }

        return options;
    }

    // turns Function.arguments into an array
    _simpleArguments ( args ) {
        return Array.prototype.slice.call( args );
    }

    /**
     * Pull the right set of arguments for the Jed method
     * @param  {string} jedMethod Name of jed gettext-style method. [See docs](http://slexaxton.github.io/Jed/)
     * @param  {[object]} props     properties passed into `translate()` method
     * @return {[array]}           array of properties to pass into gettext-style method
     */
    _getJedArgs ( jedMethod, props ) {
        var argsByMethod = {
            gettext: [ props.original ],
            ngettext: [ props.original, props.plural, props.count ],
            npgettext: [ props.context, props.original, props.plural, props.count ],
            pgettext: [ props.context, props.original ]
        };
        return argsByMethod[ jedMethod ] || [];
    }
}

export default I18N
