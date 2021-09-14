/**
 *
 * THIS PROJECT WAS MADE BY GitHUB.COM/PETERHANANIA
 * WANT TO CONTRIBUTE? DISCORD PETER_#4444
 * FEEL FREE TO SELF HOST THIS PROJECT ❤️
 */

//express stuff
const express = require('express')
const app = express()

//handle requests
const rateLimit = require('express-rate-limit')

//handle session storage
const session = require('express-session')
const MongoStore = require('connect-mongo')

//handle auth stuff
const passport = require('passport')
const Strategy = require('passport-discord').Strategy

//rendering related
const ejs = require('ejs')
const bodyParser = require('body-parser')
const url = require('url')
const path = require('path')

//fetching
const fetch = require('node-fetch')

//time related
const moment = require('moment')

//minify the page
const minifyHTML = require('express-minify-html-terser')

//initialise the .env file
require('dotenv').config()

//settings
const settings = require('./settings/settings.json')

// host static files
app.use(express.static('src/frontend/static'))

// minify the page
app.use(
  minifyHTML({
    override: true,
    exception_url: false,
    htmlMinifier: {
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeEmptyAttributes: true,
      minifyJS: true
    }
  })
)

// handling auth
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))
passport.use(
  new Strategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: `${process.env.domain}/callback`,
      response_type: `token`,
      scope: ['identify', 'guilds.join']
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => done(null, profile))
    }
  )
)

//handling the session
app.use(
  session({
    secret: process.env.session_secret,
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: Date.now() + 2629800000
    },
    store: MongoStore.create({
      mongoUrl: process.env.mongodb_url
    })
  })
)

const checkLogin = (req, res, next) => {
  if (req.user) return next()
  return res.redirect('/login')
}

//keep updating the session backURL
app.use((req, res, next) => {
  if (req.url) {
    req.session.backURL = req.url
  }
  next()
})

// setting up the website
app.enable('trust proxy')
app.use(passport.initialize())
app.use(passport.session())
app.engine('html', ejs.renderFile)
app.set('view engine', 'html')
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)

//setting up rendering
const render = (res, req, template, data = {}) => {
  var hostname = req.headers.host
  var pathname = url.parse(req.url).pathname
  const websiteData = {
    hostname: hostname,
    pathname: pathname,
    path: req.path,
    user: req.user ? req.user : null,
    url: res,
    req: req,
    env: process.env
  }
  res.render(
    path.resolve(`src/frontend/templates/${template}`),
    Object.assign(websiteData, data)
  )
}

// Login endpoint to handling requests
app.get(
  '/login',
  (req, res, next) => {
    if (req.user) return res.redirect('/')
    if (req.session.backURL) {
      req.session.backURL = req.session.backURL
    } else if (req.headers.referer) {
      const parsed = url.parse(req.headers.referer)
      if (parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path
      }
    } else {
      req.session.backURL = '/'
    }
    next()
  },
  passport.authenticate('discord', { prompt: 'none' })
)

//adding the member to the discord server
async function addmember (user, guild) {
  try {
    const member = await fetch(
      `https://discord.com/api/guilds/${guild}/members/${user.id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${process.env.main_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: user.accessToken
        })
      }
    )
    return member
  } catch (err) {
    return false
  }
}

// Authenticating the user
app.get('/callback', async (req, res) => {
  try {
    if (settings.auth.addMember && settings.auth.guild) {
      const status = await addmember(req.user, settings.auth.guild)
      if (!status || status.status === 500) {
        return render(res, req, 'other/error/error.ejs', {
          error: 'Logged in but Could not add you to the associated guild'
        })
      }
      if (status.status === 201 || status.status === 204) {
        if (req.session.backURL) {
          const url = req.session.backURL
          req.session.backURL = null
          return res.redirect(url)
        } else {
          return res.redirect('/')
        }
      } else {
        return render(res, req, 'other/error/error.ejs', {
          error: 'Logged in but Could not add you to the associated guild'
        })
      }
    }

    if (req.session.backURL) {
      const url = req.session.backURL
      req.session.backURL = null
      return res.redirect(url)
    } else {
      return res.redirect('/')
    }
  } catch (err) {
    return render(res, req, 'other/error/error.ejs', {
      error: 'Logged in but Could not add you to the associated guild'
    })
  }
})

//logout
app.get('/logout', function (req, res) {
  req.session.destroy(() => {
    req.logout()
    res.redirect('/')
  })
})

//main page
app.get('/', (req, res) => {
  render(res, req, 'index.ejs')
})

//404 page
app.use(function (req, res, next) {
  render(res, req, 'other/404/404.ejs')
  res.status(404)
})

//error page
app.use((error, req, res, next) => {
  if (error.code && error.code === 'invalid_request') {
    render(res, req, 'other/error/error.ejs', {
      error: 'Invalid Session Request. Try Signing in again'
    })
    return
  }

  render(res, req, 'other/error/error.ejs', {
    error: 'An Error has occured. Please try again later.'
  })
  console.log(error)
  res.status(500)
})

//start the website
app.listen(process.env.port || 5000, null, null, () =>
  console.log('✔️ Running the website | port: ' + process.env.port)
)
