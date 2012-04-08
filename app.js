
/**
 * Module dependencies.
 */

//--------------------------------------------------------------------------------------------//
var express = require('express')
  , routes = require('./routes')
  , mongoose = require('mongoose')
  , models = require('./models');


var db, User, LoginToken;

var app = module.exports = express.createServer();

//--------------------------------------------------------------------------------------------//
// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'secret is none' }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.set('db-uri', 'mongodb://localhost/logging-development');
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

//--------------------------------------------------------------------------------------------//
models.defineModels(mongoose, function() {
    app.User = User = mongoose.model('User');
    app.LoginToken = LoginToken = mongoose.model('LoginToken');
    db = mongoose.connect(app.set('db-uri'));
})

//--------------------------------------------------------------------------------------------//
function loadUser(req, res, next) {
    if (req.session.user_id) {
        User.findById(req.session.user_id, function(err, user) {
            if (user) {
                req.currentUser = user;
                next();
            } else {
                res.redirect('/sessions/new');
            }
        });
    } else if (req.cookies.logintoken) {
        authenticateFromLoginToken(req, res, next);
    } else {
        res.redirect('/sessions/new');
    }
}

//--------------------------------------------------------------------------------------------//
// Routes
app.get('/', loadUser, function(req, res){
    res.render('showuser', {
            user: req.currentUser
            , title: 'Express'
        }
    );
});
app.get('/list', routes.list);

//--------------------------------------------------------------------------------------------//
// Sessions
app.get('/sessions/new', function(req, res) {
    res.render('index.jade', {
        locals: { user: new User() }
    });
});

//--------------------------------------------------------------------------------------------//
// 유저 추가
app.post('/users.:format?', function(req, res) {
    var user = new User(req.body.user);

    function userSaveFailed() {
        req.flash('error', 'Account creation failed');
        res.render('index.jade', {
            locals: { user: user }
        });
    }

    user.save(function(err) {
        if (err) return userSaveFailed();
        req.flash('info', 'Your account has been created');

        switch (req.params.format) {
            case 'json':
                res.send(user.toObject());
                break;

            default:
                req.session.user_id = user.id;
                res.render('showuser', {
                        user: user
                        , title: 'Express'
                    }
                );
        }
    });
});


//--------------------------------------------------------------------------------------------//
app.post('/sessions', function(req, res) {
    User.findOne({ email: req.body.user.email }, function(err, user) {
        if (user && user.authenticate(req.body.user.password)) {
            req.session.user_id = user.id;

            // Remember me
            if (req.body.remember_me) {
                var loginToken = new LoginToken({ email: user.email });
                loginToken.save(function() {
                    res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
                    res.redirect('/documents');
                });
            } else {
                res.redirect('/documents');
            }
        } else {
            req.flash('error', 'Incorrect credentials');
            res.redirect('/sessions/new');
        }
    });
});

app.del('/sessions', loadUser, function(req, res) {
    if (req.session) {
        LoginToken.remove({ email: req.currentUser.email }, function() {});
        res.clearCookie('logintoken');
        req.session.destroy(function() {});
    }
    res.redirect('/sessions/new');
});



//--------------------------------------------------------------------------------------------//

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
