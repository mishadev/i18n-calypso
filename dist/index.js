'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _jed = require('jed');

var _jed2 = _interopRequireDefault(_jed);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _events = require('events');

var _lru = require('lru');

var _lru2 = _interopRequireDefault(_lru);

var _lodash = require('lodash.assign');

var _lodash2 = _interopRequireDefault(_lodash);

var _FormatNumber = require('./FormatNumber');

var _FormatNumber2 = _interopRequireDefault(_FormatNumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('i18n-dreamhost');

var decimal_point_translation_key = 'number_format_decimals';
var thousands_sep_translation_key = 'number_format_thousands_sep';

var I18N = function () {
    function I18N() {
        (0, _classCallCheck3.default)(this, I18N);

        this.defaultLocaleSlug = 'en';
        this.state = {
            numberFormatSettings: {},
            jed: undefined,
            locale: undefined,
            localeSlug: undefined,
            translations: (0, _lru2.default)({ max: 100 })
        };
        this.translateHooks = [];
        this.observer = new _events.EventEmitter();
        this.observer.setMaxListeners(0);

        this.throwErrors = false;

        this.configure();
        this.moment = _momentTimezone2.default;
    }

    (0, _createClass3.default)(I18N, [{
        key: 'numberFormat',
        value: function numberFormat(number) {
            var options = arguments[1] || {},
                decimals = typeof options === 'number' ? options : options.decimals || 0,
                decPoint = options.decPoint || this.state.numberFormatSettings.decimal_point || '.',
                thousandsSep = options.thousandsSep || this.state.numberFormatSettings.thousands_sep || ',';

            return (0, _FormatNumber2.default)(number, decimals, decPoint, thousandsSep);
        }
    }, {
        key: 'configure',
        value: function configure(options) {
            (0, _lodash2.default)(this, options || {});
            this.setLocale();
        }
    }, {
        key: 'setLocale',
        value: function setLocale(localeData) {
            var localeSlug;

            if (!localeData || !localeData[''].localeSlug) {
                localeData = { '': { localeSlug: this.defaultLocaleSlug } };
            }

            localeSlug = localeData[''].localeSlug;

            if (localeSlug !== this.defaultLocaleSlug && localeSlug === this.state.localeSlug) {
                return;
            }

            this.state.localeSlug = localeSlug;
            this.state.locale = localeData;

            this.state.jed = new _jed2.default({
                locale_data: {
                    messages: localeData
                }
            });

            _momentTimezone2.default.locale(localeSlug);

            this.state.numberFormatSettings.decimal_point = this._getTranslationFromJed(this.state.jed, this._normalizeTranslateArguments([decimal_point_translation_key]));
            this.state.numberFormatSettings.thousands_sep = this._getTranslationFromJed(this.state.jed, this._normalizeTranslateArguments([thousands_sep_translation_key]));

            if (this.state.numberFormatSettings.decimal_point === decimal_point_translation_key) {
                this.state.numberFormatSettings.decimal_point = '.';
            }

            if (this.state.numberFormatSettings.thousands_sep === thousands_sep_translation_key) {
                this.state.numberFormatSettings.thousands_sep = ',';
            }

            this.state.translations.clear();
            this.observer.emit('change');
        }
    }, {
        key: 'getLocale',
        value: function getLocale() {
            return this.state.locale;
        }
    }, {
        key: 'getLocaleSlug',
        value: function getLocaleSlug() {
            return this.state.localeSlug;
        }
    }, {
        key: 'addTranslations',
        value: function addTranslations(localeData) {
            for (var prop in localeData) {
                if (prop !== '') {
                    this.state.jed.options.locale_data.messages[prop] = localeData[prop];
                }
            }

            this.state.translations.clear();
            this.observer.emit('change');
        }
    }, {
        key: 'translate',
        value: function translate() {
            var options, translation, sprintfArgs, errorMethod, optionsString, cacheable;

            options = this._normalizeTranslateArguments(arguments);

            cacheable = !options.components;

            if (cacheable) {
                optionsString = (0, _stringify2.default)(options);

                translation = this.state.translations.get(optionsString);
                if (translation) {
                    return translation;
                }
            }

            translation = this._getTranslationFromJed(this.state.jed, options);

            if (options.args) {
                sprintfArgs = Array.isArray(options.args) ? options.args.slice(0) : [options.args];
                sprintfArgs.unshift(translation);
                try {
                    translation = _jed2.default.sprintf.apply(_jed2.default, sprintfArgs);
                } catch (error) {
                    if (typeof error !== 'string') {
                        this._error(error);
                    } else {
                        this._error('i18n sprintf error:', printfArgs);
                    }
                }
            }

            this.translateHooks.forEach(function (hook) {
                translation = hook(translation, options);
            });

            if (cacheable) {
                this.state.translations.set(optionsString, translation);
            }

            return translation;
        }
    }, {
        key: 'reRenderTranslations',
        value: function reRenderTranslations() {
            debug('Re-rendering all translations due to external request');
            this.state.translations.clear();
            this.observer.emit('change');
        }
    }, {
        key: 'registerTranslateHook',
        value: function registerTranslateHook(callback) {
            this.translateHooks.push(callback);
        }
    }, {
        key: '_error',
        value: function _error() {
            var errorMethod = this.throwErrors ? 'error' : 'warn';
            if ('undefined' !== typeof window && window.console && 'function' !== typeof window.console[errorMethod]) {
                window.console[errorMethod].apply(window.console, arguments);
            }
        }
    }, {
        key: '_getTranslationFromJed',
        value: function _getTranslationFromJed(jed, options) {
            var jedMethod = 'gettext',
                jedArgs;

            if (options.context) {
                jedMethod = 'p' + jedMethod;
            }

            if (typeof options.original === 'string' && typeof options.plural === 'string') {
                jedMethod = 'n' + jedMethod;
            }

            jedArgs = this._getJedArgs(jedMethod, options);

            return jed[jedMethod].apply(jed, jedArgs);
        }
    }, {
        key: '_normalizeTranslateArguments',
        value: function _normalizeTranslateArguments(args) {
            var original = args[0],
                options = {},
                i;

            if (typeof original !== 'string' || args.length > 3 || args.length > 2 && (0, _typeof3.default)(args[1]) === 'object' && (0, _typeof3.default)(args[2]) === 'object') {
                this._error('Deprecated Invocation: `translate()` accepts ( string, [string], [object] ). These arguments passed:', this._simpleArguments(args), '. See https://github.com/mishadev/i18n-dreamhost#translate-method');
            }
            if (args.length === 2 && typeof original === 'string' && typeof args[1] === 'string') {
                this._error('Invalid Invocation: `translate()` requires an options object for plural translations, but passed:', this._simpleArguments(args));
            }

            for (i = 0; i < args.length; i++) {
                if ((0, _typeof3.default)(args[i]) === 'object') {
                    options = args[i];
                }
            }

            if (typeof original === 'string') {
                options.original = original;
            } else if ((0, _typeof3.default)(options.original) === 'object') {
                options.plural = options.original.plural;
                options.count = options.original.count;
                options.original = options.original.single;
            }
            if (typeof args[1] === 'string') {
                options.plural = args[1];
            }

            if (typeof options.original === 'undefined') {
                throw new Error('Translate called without a `string` value as first argument.');
            }

            return options;
        }
    }, {
        key: '_simpleArguments',
        value: function _simpleArguments(args) {
            return Array.prototype.slice.call(args);
        }
    }, {
        key: '_getJedArgs',
        value: function _getJedArgs(jedMethod, props) {
            var argsByMethod = {
                gettext: [props.original],
                ngettext: [props.original, props.plural, props.count],
                npgettext: [props.context, props.original, props.plural, props.count],
                pgettext: [props.context, props.original]
            };
            return argsByMethod[jedMethod] || [];
        }
    }]);
    return I18N;
}();

exports.default = I18N;