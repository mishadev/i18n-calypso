
/**
 * External dependencies
 */
require('babel-register')();

var assert = require( 'assert' ),
	React = require( 'react' ),
	ReactDomServer = require( 'react-dom/server'),
	useFakeDom = require( 'react-test-env' ).useFakeDom;

/**
 * Internal dependencies
 */
var data = require( './data' ),
	i18n = require( '..' ).default;

/**
 * Pass in a react-generated html string to remove react-specific attributes
 * to make it easier to compare to expected html structure
 * @param  {string} string React-generated html string
 * @return {string}        html with react attributes removed
 */
function stripReactAttributes( string ) {
	return string.replace( /\sdata\-(reactid|react\-checksum)\=\"[^\"]+\"/g, '' );
}

describe( 'I18n', function() {
	useFakeDom();

	before( function() {
		i18n.setLocale( data.locale );
		i18n.moment.locale( 'de' );
	} );

	after( () => {
		i18n.moment.locale( 'en' );
	} );

	describe( 'translate()', function() {
		describe( 'passing a string', function() {
			it( 'should find a simple translation', function() {
				assert.equal( 'translation1', i18n.translate( 'test1' ) );
			} );
			it( 'should fall back to original string if translation is missing', function() {
				assert.equal( 'test2', i18n.translate( 'test2' ) );
			} );
			it( 'should fall back to original if translation isn\'t even null in locale file', function() {
				assert.equal( 'nonexisting-string', i18n.translate( 'nonexisting-string' ) );
			} );
		} );

		describe( 'translate with context', function() {
			it( 'should find a string with context', function() {
				assert.equal( 'translation3', i18n.translate( {
					original: 'test3',
					context: 'thecontext'
				} ) );
			} );
			it( 'should allow original text as options attribute or initial argument', function() {
				assert.equal( 'translation3', i18n.translate( 'test3', {
					context: 'thecontext'
				} ) );
			} );
		} );

		describe( 'translate with comments', function() {
			it( 'should find a string with comment', function() {
				assert.equal( 'translation4', i18n.translate( {
					original: 'test4',
					comment: 'thecomment'
				} ) );
			} );
			it( 'should allow original text as options attribute or initial argument', function() {
				assert.equal( 'translation4', i18n.translate( 'test4', {
					comment: 'thecomment'
				} ) );
			} );
		} );

		describe( 'plural translation', function() {
			it( 'should use the singular form for one item', function() {
				assert.equal( 'plural-test singular translation', i18n.translate( {
					original: {
						single: 'plural-test',
						plural: 'plural-test pl key',
						count: 1
					}
				} ) );
			} );
			it( 'should use the plural form for > one items', function() {
				assert.equal( 'plural-test multiple translation', i18n.translate( {
					original: {
						single: 'plural-test',
						plural: 'plural-test pl key',
						count: 2
					}
				} ) );
			} );
			it( 'should honor the new plural translation syntax (singular test)', function() {
				assert.equal( 'plural-test new syntax translated, single', i18n.translate( 'plural-test new syntax', 'plural-test new syntaxes', {
					count: 1
				} ) );
			} );
			it( 'should honor the new plural translation syntax (plural test)', function() {
				assert.equal( 'plural-test new syntax translated, plural', i18n.translate( 'plural-test new syntax', 'plural-test new syntaxes', {
					count: 2
				} ) );
			} );
		} );

		describe( 'sprintf-style value interpolation', function() {
			it( 'should substitute a string', function() {
				assert.equal( 'foo bar', i18n.translate( 'foo %(test)s',
					{
						args: {
							test: 'bar'
						}
					}
				) );
			} );
			it( 'should substitute a number', function() {
				assert.equal( 'foo 1', i18n.translate( 'foo %(test)d',
					{
						args: {
							test: 1
						}
					}
				) );
			} );
			it( 'should substitute floats', function() {
				assert.equal( 'foo 1.005', i18n.translate( 'foo %(test)f',
					{
						args: {
							test: 1.005
						}
					}
				) );
			} );
			it( 'should allow passing an array of arguments', function() {
				assert.equal( 'test1 test2 test3 test4', i18n.translate( 'test1 %1$s test3 %2$s',
					{
						args: [ 'test2', 'test4' ]
					}
				) );
			} );
			it( 'should allow passing a single argument', function() {
				assert.equal( 'test1 test2 test3', i18n.translate( 'test1 %s test3',
					{
						args: 'test2'
					}
				) );
			} );
		} );

		describe( 'adding new translations', function() {
			it( 'should find a new translation after it has been added', function() {
				i18n.addTranslations( {
					'test-does-not-exist': [
						null,
						'translation3'
					]
				} );

				assert.equal( 'translation3', i18n.translate( 'test-does-not-exist' ) );
			} );
			it( 'should return the new translation if it has been overwritten', function() {
				i18n.addTranslations( {
					'test-will-overwrite': [
						null,
						'not-translation1'
					]
				} );

				assert.equal( 'not-translation1', i18n.translate( 'test-will-overwrite' ) );
			} );
		} );
	} );

	describe( 'moment()', function() {
		describe( 'generating date strings', function() {
			it( 'should know the short weekdays', function() {
				assert.equal( 'Fr', i18n.moment( '2014-07-18' ).format( 'dd' ) );
			} );
			it( 'should use available translations for date format', function() {
				assert.equal( 'Freitag, 18. Juli 2014 21:59', i18n.moment( '2014-07-18T14:59:09-07:00' ).utcOffset( '+00:00' ).format( 'LLLL' ) );
			} );
			it( 'should use available translations for relative time in the past', function() {
				assert.equal( 'vor 3 Stunden', i18n.moment().subtract( 3, 'hours' ).fromNow() );
			} );
			it( 'should use available translations for relative time in the future', function() {
				assert.equal( 'in ein paar Sekunden', i18n.moment().add( 10, 'seconds' ).fromNow() );
			} );
			it( 'should be able to convert dates to any timezone', function() {
				assert.equal( 'Freitag, 18. Juli 2014 14:59', i18n.moment( '2014-07-18T14:59:09-07:00' ).tz( 'America/Los_Angeles' ).format( 'LLLL' ) );
				assert.equal( 'Samstag, 19. Juli 2014 06:59', i18n.moment( '2014-07-18T14:59:09-07:00' ).tz( 'Asia/Tokyo' ).format( 'LLLL' ) );
				assert.equal( 'Freitag, 18. Juli 2014 23:59', i18n.moment( '2014-07-18T14:59:09-07:00' ).tz( 'Europe/Paris' ).format( 'LLLL' ) );
				assert.equal( 'Freitag, 18. Juli 2014 22:59', i18n.moment( '2014-07-18T14:59:09-07:00' ).tz( 'Europe/London' ).format( 'LLLL' ) );
			} );
		} );
	} );

	describe( 'numberFormat()', function() {
		describe( 'default numberFormat', function() {
			it( 'should truncate decimals', function() {
				assert.equal( '150', i18n.numberFormat( 150.15 ) );
			} );
			it( 'should round up', function() {
				assert.equal( '151', i18n.numberFormat( 150.5 ) );
			} );
			it( 'should default to locale thousands separator (. for German in test)', function() {
				assert.equal( '1.500', i18n.numberFormat( 1500 ) );
			} );
		} );

		describe( 'with decimal', function() {
			it( 'should default to locale decimal separator (, for German in test)', function() {
				assert.equal( '150,00', i18n.numberFormat( 150, 2 ) );
			} );
			it( 'should truncate to specified decimal', function() {
				assert.equal( '150,31', i18n.numberFormat( 150.312, 2 ) );
			} );
			it( 'should accept decimal as argument or object attribute', function() {
				assert.equal( '150,00', i18n.numberFormat( 150, {
                    decimals: 2
                } ) );
			} );
		} );

		describe( 'overriding defaults', function() {
			it( 'should allow overriding of locale decimal and thousands separators', function() {
				assert.equal( '2*500@330', i18n.numberFormat( 2500.33, {
					decimals: 3,
					thousandsSep: '*',
					decPoint: '@'
				} ) );
			} );
		} );
	} );
} );
