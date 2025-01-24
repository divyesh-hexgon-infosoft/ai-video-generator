const express = require("express");
const cors = require("cors");
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');

class ExpressLoader {
    static init () {
        const app = express();

        // Middleware that transforms the raw string of req.body into json
        app.use(express.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(cookieParser());
        // parses incoming requests with JSON payloads
        app.use(cors());
        app.options("*", cors());

        app.use(
            session({
                secret:"my secret key",
                cookie: {
                    secure: false,
                    maxAge: 360000000,
                },
                saveUninitialized:true ,
                resave:true
            })
        );

        app.use(flash());

        return app;
    }
}

module.exports =  ExpressLoader;
