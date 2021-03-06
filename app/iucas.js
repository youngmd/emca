/**
 * Created by youngmd on 8/17/17.
 */

//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');

//mine
var config = require('config');
var logger = new winston.Logger(config.logger.winston);
//
// var common = require('../common');
// var db = require('../models');


// //TODO - maybe I should refactor this?
// function associate(jwt, uid, res, cb) {
//     logger.info("associating user with iucas id:"+uid);
//     db.User.findOne({where: {id: jwt.sub}}).then(function(user) {
//         if(!user) return cb("couldn't find user record with sub:"+jwt.sub);
//         user.iucas = uid;
//         user.save().then(function() {
//             var messages = [{type: "success", /*title: "IUCAS ID Associated",*/ message: "We have associated IU ID:"+uid+" to your account"}];
//             res.cookie('messages', JSON.stringify(messages), {path: '/'});
//             issue_jwt(user, function(err, jwt) {
//                 if(err) return cb(err);
//                 cb(null, jwt);
//             });
//         });
//     });
// }
//
// function register_newuser(uid, res, next) {
//     logger.info("registering new user with iucas id:"+uid);
//     db.User.findOne({where: {'username': uid}}).then(function(user) {
//         if(user) {
//             logger.warn("username already registered:"+uid+"(can't auto register)");
//             //TODO - instead of showing this error message, maybe I should redirect user to
//             //a page to force user to login via user/pass, then associate the IU CAS IU once user logs in
//             next("This is the first time you login with IU CAS account, "+
//                 "but we couldn't register this account since the username '"+uid+"' is already registered in our system. "+
//                 "If you have already registered with username / password, please login with username / password first, ");
//         } else {
//             //brand new user - go ahead and create a new account using IU id as sca user id
//             var u = clone(config.auth.default);
//             u.username = uid; //let's use IU id as local username
//             u.email = uid+"@iu.edu";
//             u.email_confirmed = true; //let's trust IU..
//             u.iucas = uid;
//             //TODO I should refactor this part somehow..
//             db.User.create(u).then(function(user) {
//                 user.addMemberGroups(u.gids, function() {
//                     issue_jwt(user, function(err, jwt) {
//                         if(err) return next(err);
//                         res.json({jwt:jwt, registered: true});
//                     });
//                 });
//             });
//         }
//     });
// }

function issue_jwt(user, cb) {
    common.createClaim(user, function(err, claim) {
        if(err) return cb(err);
        user.updateTime('iucas_login');
        user.save().then(function() {
            cb(null, common.signJwt(claim));
        });
    });
}

//XHR get only
router.get('/verify', jwt({secret: "abcdefg", credentialsRequired: false}), function(req, res, next) {
    console.log("Got into here");
    var ticket = req.query.casticket;

    //guess casurl using referer - TODO - should I use cookie and pass it from the UI method begin_iucas() instead?
    //var casurl = config.iucas.home_url;
    if(!req.headers.referer) return next("Referer not set in header..");
    casurl = req.headers.referer;
    request({
        url: 'https://cas.iu.edu/cas/validate?cassvc=IU&casticket='+ticket+'&casurl='+casurl,
        timeout: 1000*5, //long enough?
    }, function (err, response, body) {
        if(err) return next(err);
        logger.info("verify responded", response.statusCode, body);
        if (response.statusCode == 200) {
            var reslines = body.split("\n");
            if(reslines[0].trim() == "yes") {
                var uid = reslines[1].trim();

                    logger.info("iucas authentication successful. iu id:"+uid);
                    issue_jwt(user, function(err, jwt) {
                        if(err) return next(err);
                        console.log("issued token", jwt);
                        res.json({jwt:jwt});
                    });
            } else {
                logger.error("IUCAS failed to validate");
                res.sendStatus("403");//Is 403:Forbidden appropriate return code?
            }
        } else {
            //non 200 code...
            next(body);
        }
    })
});

// router.put('/disconnect', jwt({secret: 'acdefg'}), function(req, res, next) {
//     db.User.findOne({
//         where: {id: req.user.sub}
//     }).then(function(user) {
//         if(!user) res.status(401).end();
//         user.iucas = null;
//         user.save().then(function() {
//             res.json({message: "Successfully disconnected IUCAS account.", user: user});
//         });
//     });
// });

module.exports = router;