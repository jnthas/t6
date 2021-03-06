"use strict";
var t6mailer = module.exports = {};
var bcc;

t6mailer.setBcc = function(email) {
	bcc = email;
};

t6mailer.getBcc = function() {
	return bcc;
};

t6mailer.sendMail = (envelope) => new Promise((resolve, reject) => {
	if ( process.env.NODE_ENV === "production" ) {
		transporter.sendMail(envelope).then(function(info) {
			resolve({"status": "info", "info": info});
		}).catch(function(err) {
			reject({"status": "error", "info": err});
		});
	} else {
		envelope.to = bcc;
		t6console.debug(envelope.to);
		t6console.debug(envelope.bcc);
		transporter.sendMail(envelope).then(function(info) {
			t6console.debug(info);
			resolve({"status": "info", "info": info});
		}).catch(function(err) {
			t6console.error(err);
			reject({"status": "error", "info": err});
		});
	}
});

module.exports = t6mailer;