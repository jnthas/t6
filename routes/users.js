"use strict";
var express = require("express");
var router = express.Router();
var UserSerializer = require("../serializers/user");
var ErrorSerializer = require("../serializers/error");
var AccessTokenSerializer = require("../serializers/accessToken");
var refreshTokenSerializer = require("../serializers/refreshToken");
var users;
var tokens;
var accessTokens;

/**
 * @api {get} /users/newcomers Get the list of 20 latest user Account created
 * @apiName Get the list of 20 latest user Account created
 * @apiGroup 8. Administration
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 201
 * @apiUse 403
 */
router.get("/newcomers", function (req, res) {
	if ( typeof req.user!=="undefined" && req.user.role === "admin" ) {
		var query = sprintf("SELECT who FROM events WHERE what='user add' ORDER BY time desc LIMIT 20");
		dbInfluxDB.query(query).then(data => {
			users	= db.getCollection("users");
			data.map(function(u) {
				if( u.who !== "" ) {
					let us = users.findOne({"id": { "$eq": u.who }});
					u.email = us!==null?us.email:"";
				}
			});
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send({query: query, err: err, "id": 819.1, "code": 500, "message": "Internal Error"});
		});
	} else {
		res.status(403).send(new ErrorSerializer({"id": 819.0, "code": 403, "message": "Forbidden, You should be an Admin!"}).serialize());
	}
});
/**
 * @api {get} /users/list Get Users list
 * @apiName Get Users list
 * @apiGroup 8. Administration
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 401
 */
router.get("/list", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( req.user.role === "admin" ) {
		var size = typeof req.query.size!=="undefined"?req.query.size:20;
		var page = typeof req.query.page!=="undefined"?req.query.page:1;
		var filter = req.query.filter==="pushSubscription"?{"pushSubscription": { "$ne": undefined }}:null;
		page = page>0?page:1;
		var offset = Math.ceil(size*(page-1));
		
		users	= db.getCollection("users");
		var json = users.chain().find(filter).simplesort("subscription_date", true).offset(offset).limit(size).data();
		json.totalcount = users.chain().find(filter).data().length;
		json.pageSelf	= page;
		json.pageFirst	= 1;
		json.pageNext	= page+1<=json.totalcount?page+1:page;
		json.pagePrev	= page-1>0?page-1:page;
		json.pageLast	= Math.ceil(json.totalcount/size);
		res.status(200).send(new UserSerializer(json).serialize());
	} else {
		res.status(401).send(new ErrorSerializer({"id": 702, "code": 401, "message": "Unauthorized"}).serialize());
	}
});

/**
 * @api {get} /users/accessTokens Get accessTokens
 * @apiName Get accessTokens list from the user account
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiUse 201
 * @apiUse 403
 * @apiUse 412
 * @apiUse 429
 */
router.get("/accessTokens", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( typeof req.user !== "undefined" ) {
		tokens	= dbTokens.getCollection("tokens");
		var accessTokens = tokens.chain().find({ "$and": [ {"user_id": req.user.id}, { "expiration" : { "$gt": moment().format("x") } } ]}).simplesort("expiration", true).data();
		res.status(200).send(new AccessTokenSerializer(accessTokens).serialize());

		var expired = tokens.find( { "$and": [ { "expiration" : { "$lt": moment().format("x") } }, { "expiration" : { "$ne": "" } }]} );
		if ( expired ) {
			tokens.remove(expired);
			db.save();
		}
	} else {
		res.status(403).send(new ErrorSerializer({"id": 204,"code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {get} /users/me/sessions Get User active sessions from JWT claim
 * @apiName Get User active sessions from JWT claim
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 500
 */
router.get("/me/sessions", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( req.user.id ) {
		tokens	= dbTokens.getCollection("tokens");
		var expired = tokens.find( { "$and": [{ "expiration" : { "$lt": moment().format("x") } }, { "expiration" : { "$ne": "" } } ]} );
		if ( expired ) {
			tokens.remove(expired);
			db.save();
		}
		res.status(200).send(new refreshTokenSerializer(tokens.find({"user_id": { "$eq": req.user.id }})).serialize());
	} else {
		res.status(403).send(new ErrorSerializer({"id": 17, "code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {get} /users/me/token Get User from JWT claim
 * @apiName Get User from JWT claim
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiUse 200
 * @apiUse 401
 * @apiUse 404
 * @apiUse 405
 * @apiUse 429
 * @apiUse 500
 */
router.get("/me/token", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( typeof req.user !== "undefined" ) {
		var options = {
			url: "https://en.gravatar.com/" + req.user.mail_hash + ".json",
			headers: {
				"User-Agent": "Mozilla/5.0 Gecko/20100101 Firefox/44.0"
			}
		};
		request(options, function(error, response, body) {
			if ( !error && response.statusCode !== 404 ) {
				req.user.gravatar = JSON.parse(body);
			} else {
				req.user.gravatar = {};
			}
			var json = new UserSerializer(req.user).serialize();
			if ( typeof json !== "undefined" ) {
				res.status(200).send(json);
			} else {
				res.status(404).send(new ErrorSerializer({"id": 11,"code": 404, "message": "Not Found"}).serialize());
			}
		});
	} else {
		res.status(403).send(new ErrorSerializer({"id": 10,"code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {get} /users/:user_id Get User
 * @apiName Get User
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiParam {uuid-v4} user_id User ID
 * 
 * @apiUse 200
 * @apiUse 401
 * @apiUse 404
 * @apiUse 405
 * @apiUse 429
 * @apiUse 500
 */
router.get("/:user_id([0-9a-z\-]+)", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var user_id = req.params.user_id;
	if ( req.user.id === user_id || req.user.role === "admin" ) {
		users	= db.getCollection("users");
		res.status(200).send(new UserSerializer(users.chain().find({"id": { "$eq": user_id }}).simplesort("expiration", true).data()).serialize());
	} else {
		res.status(403).send(new ErrorSerializer({"id": 16, "code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {get} /users/:user_id/token Get User Token
 * @apiName Get User Token
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiParam {uuid-v4} user_id User ID
 * 
 * @apiUse 200
 * @apiUse 401
 * @apiUse 404
 * @apiUse 405
 * @apiUse 429
 * @apiUse 500
 */
router.get("/:user_id([0-9a-z\-]+)/token", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var user_id = req.params.user_id;
	if ( req.user.id === user_id ) {
		users	= db.getCollection("users");
		res.status(200).send( {token: users.findOne({"id": { "$eq": user_id }}).token} );
	} else {
		res.status(403).send(new ErrorSerializer({"id": 17, "code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {post} /users Create new User
 * @apiName Create new User
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiParam {String} firstName The User First Name
 * @apiParam {String} lastName The User Last Name
 * @apiParam {String} email The User Email address
 * 
 * @apiUse 201
 * @apiUse 412
 * @apiUse 429
 */
router.post("/", function (req, res) {
	if ( !(req.body.email && escape(req.body.email).match(new RegExp(/^([a-zA-Z0-9_\-\.+]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.+)|(([a-zA-Z0-9\-]+\.+)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/)))) {
		res.status(412).send(new ErrorSerializer({"id": 9,"code": 412, "message": "Precondition Failed"}).serialize());
	} else {
		users	= db.getCollection("users");
		
		if ( users.find({"email": { "$eq": req.body.email }}).length > 0 ) {
			res.status(409).send(new ErrorSerializer({"id": 9.5,"code": 409, "message": "Conflict: User email already exists"}).serialize());
		} else {
			var my_id = uuid.v4();
			var pushSubscription = typeof req.body.pushSubscription!=="undefined"?req.body.pushSubscription:null;

			var token = passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.");
			var new_token = {
				user_id:			my_id,
				key:				passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ."),
				secret:				passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ."),
				token:				token,
				expiration:			"",
				memo:				"Automatically generated during user creation phase.",
			};
			var new_user = {
				id:					my_id,
				firstName:			typeof req.body.firstName!=="undefined"?req.body.firstName:"",
				lastName:			typeof req.body.lastName!=="undefined"?req.body.lastName:"",
				email:				typeof req.body.email!=="undefined"?req.body.email:"",
				role:				"free", // no admin creation from the API
				subscription_date:	moment().format("x"),
				token:				token,
				unsubscription_token: passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"),
				pushSubscription	: pushSubscription,
			};
			t6events.add("t6Api", "user add", new_user.id);
			users.insert(new_user);

			var tokens	= dbTokens.getCollection("tokens");
			tokens.insert(new_token);
			db.save();
			var expired = tokens.find(
				{ "$and": [
					{ "expiration" : { "$lt": moment().format("x") } },
					{ "expiration" : { "$ne": "" } },
				]}
			);
			if ( expired ) {
				tokens.remove(expired);
				db.save();
			}

			res.render("emails/welcome", {user: new_user, token: new_token.token}, function(err, html) {
				var mailOptions = {
					from: from,
					bcc: typeof bcc!=="undefined"?bcc:null,
					to: new_user.firstName+" "+new_user.lastName+" <"+new_user.email+">",
					subject: "Welcome to t6",
					text: "Html email client is required",
					html: html
				};
				t6mailer.sendMail(mailOptions).then(function(info){
					t6events.add("t6App", "user welcome mail", new_user.id);
					res.header("Location", "/v"+version+"/users/"+new_user.id);
					res.status(201).send({ "code": 201, message: "Created", user: new UserSerializer(new_user).serialize(), token: new_token });
				}).catch(function(error) {
					t6console.error("t6mailer.sendMail error" + error.info.code, error.info.response, error.info.responseCode, error.info.command);
					res.status(500).send({ "code": 500, message: "Internal Error"});
				});
			});
		}
	}
});

/**
 * @api {post} /users/accessTokens Generate Access Tokens
 * @apiName Generate Access Tokens
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiParam {String{128}} [memo] Free memo string
 * 
 * @apiUse Auth
 * @apiUse 201
 * @apiUse 403
 * @apiUse 412
 * @apiUse 429
 */
router.post("/accessTokens", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( typeof req.user !== "undefined" ) {
		if ( !req.user.id ) {
			res.status(412).send(new ErrorSerializer({"id": 203,"code": 412, "message": "Precondition Failed"}).serialize());
		} else {
			var new_token = {
				user_id:			req.user.id,
				key:				passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ."),
				secret:				passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ."),
				memo:				(req.body.memo).substring(0, 128),
				expiration:			moment().add(24, "hours").format("x"),
			};
			var tokens	= dbTokens.getCollection("tokens");
			tokens.insert(new_token);
			db.save();
			var expired = tokens.find(
				{ "$and": [
					{"user_id" : req.user.id},
					{ "expiration" : { "$lt": moment().format("x") } },
					{ "expiration" : { "$ne": "" } },
				]}
			);
			if ( expired ) {
				tokens.remove(expired);
				db.save();
			}
			res.status(201).send({ "code": 201, "id": 201.1, message: "Created", accessToken: new AccessTokenSerializer(new_token).serialize() });
		}
	} else {
		res.status(403).send(new ErrorSerializer({"id": 204,"code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {post} /users/token/:token Reset a User password
 * @apiName Reset a User password
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiParam {String} token Token to identify the user
 * @apiParam {String} password The new password
 * 
 * @apiUse 201
 * @apiUse 403
 * @apiUse 404
 * @apiUse 412
 * @apiUse 429
 */
router.post("/token/:token([0-9a-zA-Z\.]+)", function (req, res) {
	if ( !req.body.password ) {
		res.status(412).send(new ErrorSerializer({"id": 8.3,"code": 412, "message": "Precondition Failed"}).serialize());
	} else {
		users	= db.getCollection("users");
		var user = (users.chain().find({ "token": req.params.token }).data())[0];
		if ( user ) {
			t6console.debug("Found user", user, "From token", req.params.token);
			user.password = bcrypt.hashSync(req.body.password, 10);
			user.passwordLastUpdated = parseInt(moment().format("x"), 10);
			user.token = null;
			users.update(user);
			db.save();
			t6console.debug("Saved user", user, req.body.password);
			t6events.add("t6App", "user reset password", user.id);
			res.header("Location", "/v"+version+"/users/"+user.id);
			res.status(200).send({ "code": 200, message: "Successfully updated", user: new UserSerializer(user).serialize() }); 
			
		} else {
			t6console.debug("No user found with that token");
			res.status(404).send(new ErrorSerializer({"id": 8.4,"code": 404, "message": "Not Found"}).serialize());
		}
	}
});

/**
 * @api {post} /users/instruction Reset a password instruction
 * @apiName Reset a password instruction
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiParam {String} email to identify the user
 * 
 * @apiUse 200
 * @apiUse 404
 * @apiUse 412
 * @apiUse 500
 */
router.post("/instruction", function (req, res) {
	if ( !(req.body.email && escape(req.body.email).match(new RegExp(/^([a-zA-Z0-9_\-\.+]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.+)|(([a-zA-Z0-9\-]+\.+)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/)))) {
		res.status(412).send(new ErrorSerializer({"id": 8.3,"code": 412, "message": "Precondition Failed"}).serialize());
	} else {
		var query = { "email": req.body.email };
		users	= db.getCollection("users");
		var user = (users.chain().find(query).data())[0];
		if ( user ) {
			var token = passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.");
			user.token = token;
			users.update(user);
			db.save();

			res.render("emails/forgot-password", {user: user, token: token}, function(err, html) {
				var to = user.firstName+" "+user.lastName+" <"+user.email+">";
				var mailOptions = {
					from: from,
					bcc: typeof bcc!=="undefined"?bcc:null,
					to: to,
					subject: "Reset your password to t6",
					text: "Html email client is required",
					html: html
				};
				transporter.sendMail(mailOptions, function(err, info){
					if( err ){
						res.status(500).send({ "code": 500, message: "Error updating user" }); 
					} else {
						t6events.add("t6App", "user forgot password mail", user.id);
						res.header("Location", "/v"+version+"/users/"+user.id);
						res.status(200).send({ "code": 200, message: "Successfully updated" }); 
					}
				});
			});
		} else {
			res.status(404).send({ "code": 404, message: "Error updating user" }); 
		}
	}
});

/**
 * @api {post} /users/resetAllUsersTokens Reset unsubscription tokens for all users
 * @apiName Reset unsubscription tokens for all users
 * @apiGroup User
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 */
router.post("/resetAllUsersTokens", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	if ( req.user.role === "admin" ) {
		users	= db.getCollection("users");
		users.chain().find().update(function(user) {
			user.unsubscription_token = passgen.create(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
		});
		db.save();
		res.status(200).send({"status": "done", "count": users.chain().find().data().length});
	} else {
		res.status(403).send(new ErrorSerializer({"id": 18, "code": 403, "message": "Forbidden "+req.user.role+"/"+process.env.NODE_ENV}).serialize());
	}
});

/**
 * @api {post} /users/sendPush Send Push notification to a specific user
 * @apiName Send Push notification to a specific user
 * @apiGroup User
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 */
router.post("/sendPush/:user_id([0-9a-z\-]+)", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var user_id = req.params.user_id;
	if ( req.user.role === "admin" ) {
		users	= db.getCollection("users");
		var user = users.findOne({"id": { "$eq": user_id }});
		if (user && typeof user.pushSubscription !== "undefined" ) {
			var payload = typeof req.body!=="undefined"?req.body:"{\"type\": \"message\", \"title\": \"Test\", \"body\": \"Welcome back to t6! Enjoy.\", \"icon\": null, \"vibrate\":[200, 100, 200, 100, 200, 100, 200]}";
			t6notifications.sendPush(user.pushSubscription, payload);
		} else {
			res.status(404).send(new ErrorSerializer({"id": 180, "code": 404, "message": "Not Found"}).serialize());
		}
		res.status(200).send({"status": "sent", "count": 1});
	} else {
		res.status(403).send(new ErrorSerializer({"id": 181, "code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {post} /users/sendFCM Send FCM message  to a specific user
 * @apiName Send FCM message to a specific user
 * @apiGroup User
 * @apiVersion 2.0.1
 * @apiUse AuthAdmin
 * @apiPermission Admin
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 */
router.post("/sendFCM/?:token([0-9a-zA-Z\-]+)?", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var token = req.params.token;
	if ( req.user.role === "admin" ) {
		var payload = typeof req.body!=="undefined"?req.body:"{}";
		t6notifications.sendFCM(typeof token!=="undefined"?[token]:req.body.tokens, payload);
		res.status(200).send({"status": "sent", "count": 1});
	} else {
		res.status(403).send(new ErrorSerializer({"id": 181, "code": 403, "message": "Forbidden"}).serialize());
	}
});

/**
 * @api {put} /users/:user_id Edit a User
 * @apiName Edit a User
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiParam {uuid-v4} user_id User ID
 * @apiParam {String} [firstName] The new User First Name
 * @apiParam {String} [lastName] The new User Last Name
 * @apiParam {String} [email] The new User Email address
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 412
 * @apiUse 429
 */
router.put("/:user_id([0-9a-z\-]+)", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var user_id = req.params.user_id;
	if ( !( (req.body.email || req.body.lastName || req.body.firstName ) || ( req.body.password ) ) ) {
		res.status(412).send(new ErrorSerializer({"id": 8,"code": 412, "message": "Precondition Failed"}).serialize());
	} else {
		users	= db.getCollection("users");
		if ( req.user.id === user_id || req.user.role === "admin" ) {
			var result;
			users.findAndUpdate(
				function(i){return i.id==user_id;},
				function(item){
					item.firstName		= typeof req.body.firstName!=="undefined"?req.body.firstName:item.firstName;
					item.lastName		= typeof req.body.lastName!=="undefined"?req.body.lastName:item.lastName;
					item.email			= typeof req.body.email!=="undefined"&&req.body.email!==""?req.body.email:item.email;
					item.update_date	= moment().format("x");
					result = item;
				}
			);
			db.save();
			res.header("Location", "/v"+version+"/users/"+user_id);
			res.status(200).send({ "code": 200, message: "Successfully updated", user: new UserSerializer(result).serialize() });
		} else {
			res.status(403).send(new ErrorSerializer({"id": 7,"code": 403, "message": "Forbidden"}).serialize());
		}
	}
});

/**
 * @api {delete} /users/accessTokens/:key Revoke an Access Token from its key
 * @apiName Revoke an Access Token from its key
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiParam {string} key to revoke
 * @apiUse 201
 * @apiUse 403
 * @apiUse 412
 * @apiUse 429
 */
router.delete("/accessTokens/:key([0-9a-z\-.]+)", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var key = req.params.key;
	if ( key ) {
		accessTokens = dbTokens.getCollection("tokens");
		var queryT = {
			"$and": [
				{ "key": key },
				{ "user_id": req.user.id },
			]
		};
		var u = accessTokens.findOne(queryT);
		if (u) {
			accessTokens.remove(u);
			res.status(200).send({ "code": 200, message: "Successfully deleted", removed_id: key }); // TODO: missing serializer
		} else {
			res.status(404).send(new ErrorSerializer({"id": 6,"code": 404, "message": "Not Found"}).serialize());
		}
	} else {
		res.status(404).send(new ErrorSerializer({"id": 105,"code": 404, "message": "Not Found"}).serialize());
	}
});

/**
 * @api {delete} /users/:user_id Delete a User
 * @apiName Delete a User
 * @apiGroup User
 * @apiVersion 2.0.1
 * 
 * @apiUse Auth
 * @apiParam {uuid-v4} user_id User ID
 * 
 * @apiUse 200
 * @apiUse 403
 * @apiUse 404
 * @apiUse 429
 */
router.delete("/:user_id([0-9a-z\-]+)", expressJwt({secret: jwtsettings.secret, algorithms: jwtsettings.algorithms}), function (req, res) {
	var user_id = req.params.user_id;
	if ( req.user.id === user_id ) { //Well ... not sure
		users = db.getCollection("users");
		var u = users.find({"id": { "$eq": user_id }});
		if (u) {
			users.remove(u);
			res.status(200).send({ "code": 200, message: "Successfully deleted", removed_id: user_id }); // TODO: missing serializer
		} else {
			res.status(404).send(new ErrorSerializer({"id": 6,"code": 404, "message": "Not Found"}).serialize());
		}
	} else {
		res.status(403).send(new ErrorSerializer({"id": 5,"code": 403, "message": "Forbidden"}).serialize());
	}
});

module.exports = router;
