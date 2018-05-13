'use strict';
var express = require('express');
var router = express.Router();
var UserSerializer = require('../serializers/user');
var PermissionSerializer = require('../serializers/permission');
var ErrorSerializer = require('../serializers/error');
var AccessTokenSerializer = require('../serializers/accessToken');
var users;
var tokens;

/**
 * @api {get} /notifications/mail/reminder Send reminder Email to Users
 * @apiName Send reminder Email to Users
 * @apiGroup 8. Notifications to Users
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 */
router.get('/mail/reminder', expressJwt({secret: jwtsettings.secret}), function (req, res) {
	if ( req.user.role === 'admin' && process.env.NODE_ENV === 'production' ) {
		users	= db.getCollection('users');
		//var query = {'token': { '$eq': null }};
		var query = { '$and': [
	   	           {'subscription_date': { '$lte': moment().subtract(7, 'days') }},
	 	           {'reminderMail': undefined},
	 	           {'token': null},
	   	           {'unsubscription.reminder': undefined},
	 			]};
		var json = users.find( query );
		
		if ( json.length > 0 ) {
			/* Send a Reminder Email to each users */
			json.forEach(function(user) {
				res.render('emails/reminder', {user: user}, function(err, html) {
					var to = user.firstName+' '+user.lastName+' <'+user.email+'>';
					var mailOptions = {
						from: from,
						bcc: bcc,
						to: to,
						list: {
					        unsubscribe: {
					            url: baseUrl_https+'/mail/'+to+'/unsubscribe/reminder/',
					            comment: 'Unsubscribe from this notification'
					        },
						},
						subject: 't6 Reminder',
						text: 'Html email client is required',
						html: html
					};
					transporter.sendMail(mailOptions, function(err, info){
					    if( err ){
							var err = new Error('Internal Error');
							err.status = 500;
							res.status(err.status || 500).render(err.status, {
								title : 'Internal Error'+app.get('env'),
								user: req.session.user,
								currentUrl: req.path,
								err: err
							});
					    } else {
							users.findAndUpdate(
								function(i){return i.id==user.id;},
								function(item){
									item.reminderMail = parseInt(moment().format('x'));
								}
							);
							db.save();
					    }
					});
				});
			});
			res.status(200).send(new UserSerializer(json).serialize());
		} else {
			res.status(404).send(new ErrorSerializer({'id': 20, 'code': 404, 'message': 'Not Found'}).serialize());
		}
	} else {
		res.status(403).send(new ErrorSerializer({'id': 19, 'code': 403, 'message': 'Forbidden '+req.user.role+'/'+process.env.NODE_ENV}).serialize());
	}
});

/**
 * @api {get} /notifications/mail/changePassword Send Password Expiration Email to Users
 * @apiName Send Password Expiration Email to Users
 * @apiGroup 8. Notifications to Users
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 */
router.get('/mail/changePassword', expressJwt({secret: jwtsettings.secret}), function (req, res) {
	if ( req.user.role === 'admin' && process.env.NODE_ENV === 'production' ) {
		users	= db.getCollection('users');
		//var query = {'token': { '$eq': null }};
		var query = { '$and': [
		           {'$or': [{'passwordLastUpdated': { '$lte': moment().subtract(3, 'months') }}, {passwordLastUpdated: undefined}]},
	 	           {'changePasswordMail': { '$lte': moment().subtract(3, 'months') }},
	 	           {'token': null},
	 			]};
		var json = users.find( query );
		if ( json.length > 0 ) {
			/* Send a Reminder Email to each users */
			json.forEach(function(user) {
				//console.log(user.firstName+' '+user.lastName+' <'+user.email+'>' + ' --> ' + user.changePasswordMail + moment(user.changePasswordMail).format('DD/MM/YYYY, HH:mm'));
				res.render('emails/change-password', {user: user}, function(err, html) {
					var to = user.firstName+' '+user.lastName+' <'+user.email+'>';
					var mailOptions = {
						from: from,
						bcc: bcc,
						to: to,
						subject: 't6 Password Expiration',
						text: 'Html email client is required',
						html: html
					};
					transporter.sendMail(mailOptions, function(err, info){
					    if( err ){
							var err = new Error('Internal Error');
							err.status = 500;
							res.status(err.status || 500).render(err.status, {
								title : 'Internal Error'+app.get('env'),
								user: req.session.user,
								currentUrl: req.path,
								err: err
							});
					    } else {
							users.findAndUpdate(
								function(i){return i.id==user.id;},
								function(item){
									item.changePasswordMail = parseInt(moment().format('x'));
								}
							);
							db.save();
					    }
					});
				});
			});
			res.status(200).send(new UserSerializer(json).serialize());
		} else {
			res.status(200).send(new UserSerializer(users.chain().find().simplesort('subscription_date', true).data()).serialize());
		}
	} else {
		res.status(403).send(new ErrorSerializer({'id': 18, 'code': 403, 'message': 'Forbidden '+req.user.role+'/'+process.env.NODE_ENV}).serialize());
	}
});

module.exports = router;