'use strict';
var express = require('express');
var router = express.Router();
var ErrorSerializer = require('../serializers/error');
var tokens;
var users;
var qt;

/**
 * @apiDefine 400
 * @apiError 400 Require a Bearer Authentication.
 * @apiErrorExample 400 Response
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Bad Request",
 *       "id": "",
 *       "code": 400
 *     }
 */

/**
 * @apiDefine 401
 * @apiError 401 Require a Bearer Authentication.
 * @apiErrorExample 401 Response
 *     HTTP/1.1 401 Not Authorized
 *     {
 *       "message": "Not Authorized",
 *       "id": "",
 *       "code": 401
 *     }
 */

/**
 * @apiDefine 403
 * @apiError 403 Forbidden - Token used in transaction is not valid. Check your token and/or permission.
 * @apiErrorExample 403 Response
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "message": "Forbidden",
 *       "id": "",
 *       "code": 403
 *     }
 */

/**
 * @apiDefine 404
 * @apiError 404 Not Found - We couldn't find the element you are trying to access.
 * @apiErrorExample 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Not Found",
 *       "id": "",
 *       "code": 404
 *     }
 */

/**
 * @apiDefine 405
 * @apiError 405 Method Not Allowed - API endpoint does not accept the method used..
 * @apiErrorExample 405 Response
 *     HTTP/1.1 405 Method Not Allowed
 *     {
 *       "message": "Not Authorized",
 *       "id": "",
 *       "code": 405
 *     }
 */

/**
 * @apiDefine 412
 * @apiError 412 Precondition Failed.
 * @apiErrorExample 412 Response
 *     HTTP/1.1 412 Precondition Failed
 *     {
 *       "message": "Precondition Failed",
 *       "id": "",
 *       "code": 412
 *     }
 */

/**
 * @apiDefine 429
 * @apiError 429 Too Many Requests.
 * @apiErrorExample 429 Response
 *     HTTP/1.1 429 Too Many Requests
 *     {
 *       "message": "Too Many Requests",
 *       "id": "",
 *       "code": 429
 *     }
 */

/**
 * @apiDefine 500
 * @apiError 500 Internal Error.
 * @apiErrorExample 500 Response
 *     HTTP/1.1 500 Internal Error
 *     {
 *       "message": "Internal Error",
 *       "id": "",
 *       "code": 500
 *     }
 */

/**
 * @apiDefine Auth
 * @apiHeader {String} Authorization Bearer &lt;Token&gt;
 * @apiHeader {String} [Accept] application/json
 * @apiHeader {String} [Content-Type] application/json
 */

/**
 * @apiDefine admin Admin access rights needed.
 * Only t6 Administrator user have permission to this Endpoint.
 */

//catch API calls for quotas
router.all('*', function (req, res, next) {
	tokens	= db.getCollection('tokens');
	users	= db.getCollection('users');
	qt 		= dbQuota.getCollection('quota');
	var unlimited = false;
	var bearerHeader = req.headers['authorization'];
	if ( bearerHeader ) {
		var bearer = bearerHeader.split(" ");// TODO split with Bearer as prefix!
		req.token = bearer[1];
		req.bearer = tokens.findOne(
			{ '$and': [
	           {'token': { '$eq': req.token }},
	           {'expiration': { '$gte': moment().format('x') }},
			]}
		);
	} else if ( req.session ) {
		req.user = req.session.user;
		req.token = req.session.token;
		req.bearer = req.session.bearer;
	} else {
		// there might be no Auth, when creating a User. :-)
		unlimited = true; 
		req.bearer.user_id = null;
	}
	
	var o = {
		key:		req.bearer!==undefined?req.bearer.key:req.session.bearer!==undefined?req.session.bearer.key:null,
		secret:		req.bearer!==undefined?req.bearer.secret:req.session.bearer!==undefined?req.session.bearer.secret:null,
		user_id:	req.bearer!==undefined?req.bearer.user_id:req.session.bearer!==undefined?req.session.bearer.user_id:null,
		session_id:	req.bearer!==undefined?req.bearer.session_id:req.session.bearer!==undefined?req.session.bearer.session_id:null,
		verb:		req.method,
		url:		req.originalUrl,
		date:		moment().format('x')
	};
	
	var queryQ = { '$and': [
       {'user_id' : req.bearer!==undefined?req.bearer.user_id:req.session.bearer!==undefined?req.session.bearer.user_id:null},
       {'date': { '$gte': moment().subtract(7, 'days').format('x') }},
	]};
	req.user = users.findOne({'id': { '$eq': o.user_id }});
	var i = (qt.find(queryQ)).length;
	if( (req.user && i >= (quota[req.user.role]).calls) && !unlimited ) {
		// TODO: what a fucking workaround!... when creating a User, we do not need any Auth, nor limitation
		res.status(429).send(new ErrorSerializer({'id': 99, 'code': 429, 'message': 'Too Many Requests'}));
	} else {
		qt.insert(o);
		next();
	}
});

router.get('/authenticate', function (req, res) {
	// TODO
	// should refresh the Bearer for 1 hour then Bearer is not valid anymore
});

/**
 * @api {get} /status API Status
 * @apiName API Status
 * @apiGroup General
 * @apiVersion 2.0.1
 */
router.get('/status', function(req, res, next) {
	var status = {
		version: version,
		status: 'running',
		mqtt_info: mqtt_info,
		appName: process.env.NAME,
		started_at: moment(process.env.STARTED*1000).format('DD/MM/Y H:m:s'),
	};
	res.status(200).send(status);
});

module.exports = router;
