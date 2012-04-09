
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
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
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


// 데이터모델 정의
//--------------------------------------------------------------------------------------------//
models.defineModels(mongoose, function() {
    app.User = User = mongoose.model('User');
    app.LoginToken = LoginToken = mongoose.model('LoginToken');
    db = mongoose.connect(app.set('db-uri'));
})

// 유저 찾기
//--------------------------------------------------------------------------------------------//
function loadUser(req, res, next) {
    if (req.session.user_id) {
        User.findById(req.session.user_id, function(err, user) {
            if (user) {
                req.currentUser = user;
                next();
            } else {
                console.log('not found............1!!!');
                res.redirect('/signin');
            }
        });
    } else if (req.cookies.logintoken) {
        console.log('login by token');
        authenticateFromLoginToken(req, res, next);
    } else {
        console.log('not found!!!');
        res.redirect('/signin');
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

// 로그인
//--------------------------------------------------------------------------------------------//
app.get('/signin', function(req, res) {
    res.render('index.jade', {
        locals: { user: new User() }
    });
});

// 신규사용자
//--------------------------------------------------------------------------------------------//
app.get('/users/new', function(req, res) {
    res.render('new.jade', {
        locals: { user: new User() }
    });
});


// 유저 추가
//--------------------------------------------------------------------------------------------//
app.post('/users.:format?', function(req, res) {
    var user = new User(req.body.user);

    function userSaveFailed() {
        req.session.user_id = user.id;
        res.render('showuser', {
                user: user
                , title: 'Express'
            }
        );
    }

    user.save(function(err) {
        if (err) {
            console.log('저장실패');
            return userSaveFailed();
        } else {
            console.log('저장OK');
            req.flash('info', 'Your account has been created');
        }

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


// 로그인
//--------------------------------------------------------------------------------------------//
app.post('/sessions', function(req, res) {
    console.log('로그인 : %s', req.body.user.email);
    User.findOne({ email: req.body.user.email }, function(err, user) {
        if (user && user.authenticate(req.body.user.password)) {
            req.session.user_id = user.id;

            if (req.body.remember_me) {
                // 쿠키에 사용자 저장
                var loginToken = new LoginToken({ email: user.email });
                loginToken.save(function() {
                    res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
                    res.redirect('/');
                });
            } else {
                res.redirect('/');
            }
        } else {
            // 사용자가 없거나 패스워드 오류
            res.render('notfound.jade');
        }
    });
});

// 로그아웃
//--------------------------------------------------------------------------------------------//
app.del('/sessions', loadUser, function(req, res) {
    console.log('로그아웃');
    if (req.session) {
        LoginToken.remove({ email: req.currentUser.email }, function() {});
        res.clearCookie('logintoken');
        req.session.destroy(function() {});
    }
    res.redirect('/signin');
});



// 서버 스타트
//--------------------------------------------------------------------------------------------//
app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
