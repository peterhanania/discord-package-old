/**
 *
 * THIS PROJECT WAS MADE BY GitHUB.COM/PETERHANANIA
 * WANT TO CONTRIBUTE? DISCORD PETER_#4444
 * FEEL FREE TO SELF HOST THIS PROJECT ❤️
 */

//express stuff
const express = require('express'),
  app = express()

//handle session storage
const session = require('express-session'),
  MongoStore = require('connect-mongo')

//rendering related
const ejs = require('ejs'),
  bodyParser = require('body-parser'),
  url = require('url'),
  path = require('path')

//fetching
const fetch = require('node-fetch')

//upload stuff
var multer = require('multer'),
  AdmZip = require('adm-zip'),
  Papa = require('papaparse')

//minify the page
const minifyHTML = require('express-minify-html-terser')

//initialise the .env file
require('dotenv').config()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})

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

//keep updating the session backURL
app.use((req, res, next) => {
  if (req.url) {
    req.session.backURL = req.url
  }
  next()
})

// setting up the website
app.enable('trust proxy')
app.engine('html', ejs.renderFile)
app.set('view engine', 'html')
app.use(
  bodyParser.json({
    limit: '300mb'
  })
)
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: '300mb'
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
    user: req.session.user ? req.session.user : null,
    url: res,
    req: req,
    env: process.env
  }
  res.render(
    path.resolve(`src/frontend/templates/${template}`),
    Object.assign(websiteData, data)
  )
}

//main page
app.get('/', (req, res) => {
  render(res, req, 'index.ejs')
})

//upload data
app.post('/api/upload', (req, res) => {
  multer({
    storage: multer.memoryStorage({
      destination: (_req, _file, callback) => callback(null, '')
    })
  }).single('file')(req, res, async err => {
    if (!req.file)
      return res.redirect(
        '/?err=No%20file%20received.%20Please%20try%20reuploading'
      )

    if (req.session.user) {
      return res.redirect(
        '/?err=Your%20data%20is%20already%20uploaded.%20Redirecting%20to%20statistics'
      )
    }

    try {
      let data = {
        size: req.file.size,
        date: Date.now(),
        userStatistics: {
          id: null,
          username: 'unknown',
          discriminator: '000',
          avatar: null,
          flags: null,
          payments: {
            total: 0,
            list: ''
          },
          favoriteWords: null,
          topCursed: [],
          curseCount: 0,
          topLinks: [],
          linkCount: 0,
          topDiscordLinks: [],
          discordLinkCount: 0,
          server_count: 0,
          nitro_subscriptions: [],
          bots: [],
          topDMS: []
        },

        messageStatistics: {
          topChannels: [],
          dmChannelCount: 0,
          channelCount: 0,
          characterCount: 0,
          hoursValues: []
        }
      }

      if (req.file.mimetype === 'application/x-zip-compressed') {
        const zip = new AdmZip(req.file.buffer)
        const files = zip.getEntries()

        files.forEach(async file => {
          if (file.entryName.includes('account/user.json')) {
            const content = file.getData()
            const parsed = JSON.parse(content)

            const confirmedPayments = parsed.payments.filter(
              p => p.status === 1
            )
            if (confirmedPayments.length) {
              console.log(confirmedPayments)

              data.userStatistics.payments.total += confirmedPayments
                .map(p => p.amount / 100)
                .reduce((p, c) => p + c)
              data.userStatistics.payments.list += confirmedPayments
                .sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                )
                .map(p => `${p.description} ($${p.amount / 100})`)
                .join('<br>')
            }

            data.userStatistics.id = parsed.id || null
            data.userStatistics.username = parsed.username || 'unknown'
            data.userStatistics.discriminator = parsed.discriminator || '0000'
            data.userStatistics.avatar = parsed.avatar_hash
              ? parsed.avatar_hash
              : null
            data.userStatistics.flags = parsed.flags || null

            const nitroSubscriptions = parsed.entitlements
            if (nitroSubscriptions) {
              for (let sub of nitroSubscriptions) {
                if (sub.subscription_plan && sub.subscription_plan.name) {
                  data.userStatistics.nitro_subscriptions.push({
                    name: sub.subscription_plan.name
                  })
                }
              }
            }
          }

          if (file.entryName.includes('account/applications')) {
            if (file.entryName.includes('.json')) {
              const content = file.getData()
              const parsed = JSON.parse(content)

              if (parsed.bot && parsed.bot.bot) {
                data.userStatistics.bots.push({
                  name: parsed.bot.username,
                  id: parsed.bot.id,
                  avatar: parsed.bot.avatar,
                  discriminator: parsed.bot.discriminator,
                  public_flags: parsed.bot.public_flags
                })
              }
            }
          }
        })

        const messagesPathRegex = /messages\/c?([0-9]{16,32})\/$/
        const channelsIDsFile = files.filter(file =>
          messagesPathRegex.test(file.entryName)
        )

        const isOldPackage =
          channelsIDsFile[0].entryName.match(
            /messages\/(c)?([0-9]{16,32})\/$/
          )[1] === undefined
        const channelsIDs = channelsIDsFile.map(
          file => file.entryName.match(messagesPathRegex)[1]
        )

        const channels = []
        let messagesRead = 0
        const messagesIndex = JSON.parse(
          files
            .filter(file => file.entryName === `messages/index.json`)[0]
            .getData()
        )

        channelsIDs.map(channelID => {
          const channelDataPath = `messages/${
            isOldPackage ? '' : 'c'
          }${channelID}/channel.json`
          const channelMessagesPath = `messages/${
            isOldPackage ? '' : 'c'
          }${channelID}/messages.csv`

          if (channelDataPath && channelMessagesPath) {
            const channelData = files.filter(
              file => file.entryName === channelDataPath
            )[0]

            const channelMessages = files.filter(
              file => file.entryName === channelMessagesPath
            )[0]

            if (channelData && channelMessages) {
              messagesRead++
              const data = JSON.parse(channelData.getData())

              const messages = parseCSV(
                channelMessages.getData().toString('utf8')
              )

              const name = messagesIndex[data.id]
              const isDM = data.recipients && data.recipients.length === 2
              const dmUserID = isDM
                ? data.recipients.find(userID => userID !== data.id)
                : undefined
              channels.push({
                data,
                messages,
                name,
                isDM,
                dmUserID
              })
            }
          }
        })

        if (messagesRead === 0) {
          return res.status(400).send({
            message: 'No messages found'
          })
        }

        data.messageStatistics.channelCount = channels.filter(
          c => !c.isDM
        ).length
        data.messageStatistics.dmChannelCount =
          channels.length - data.messageStatistics.channelCount
        data.messageStatistics.topChannels = channels
          .filter(c => c.data && c.data.guild)
          .sort((a, b) => b.messages.length - a.messages.length)
          .slice(0, 100)
          .map(channel => ({
            name: channel.name,
            messageCount: channel.messages.length,
            guildName: channel.data.guild.name
          }))
        data.messageStatistics.characterCount = channels
          .map(channel => channel.messages)
          .flat()
          .map(message => message.length)
          .reduce((p, c) => p + c)

        for (let i = 0; i < 24; i++) {
          data.messageStatistics.hoursValues.push(
            channels
              .map(c => c.messages)
              .flat()
              .filter(m => new Date(m.timestamp).getHours() === i).length
          )
        }

        const words = channels
          .map(channel => channel.messages)
          .flat()
          .map(message => message.words)
          .flat()
          .filter(w => w.length > 5 && !parseMention(w))

        data.userStatistics.favoriteWords = getFavoriteWords(words)

        const curseWords = getCursedWords(words)
        data.userStatistics.topCursed = curseWords.slice(0, 10)
        data.userStatistics.curseCount = curseWords.length

        const links = getTopLinks(words)
        data.userStatistics.topLinks = links.slice(0, 10)
        data.userStatistics.linkCount = links.length

        const discordLink = getDiscordLinks(words)
        data.userStatistics.topDiscordLinks = discordLink.slice(0, 10)
        data.userStatistics.discordLinkCount = discordLink.length

        const serverIndex = JSON.parse(
          files
            .filter(file => file.entryName === 'servers/index.json')[0]
            .getData()
        )

        data.userStatistics.server_count = Object.keys(serverIndex).length

        const finaltopDMS = []
        const topDMS = channels
          .filter(channel => channel.isDM)
          .sort((a, b) => b.messages.length - a.messages.length)
          .slice(0, 10)

        for (let i = 0; i < topDMS.length; i++) {
          const channel = topDMS[i]
          const user = await fetchUser(channel.dmUserID)

          finaltopDMS.push({
            id: channel.data.id,
            dmUserID: channel.dmUserID,
            messageCount: channel.messages.length,
            userData: user
          })
        }

        data.userStatistics.topDMS = finaltopDMS

        req.session.user = data
        res.send(data)
      } else {
        res.redirect(
          '/?err=File%20is%20not%20a%20zip%20file,%20please%20upload%20a%20zip%20file'
        )
      }
    } catch (err) {
      res.redirect(
        '/?err=Failed%20to%20calculate%20your%20statistics.%20If%20this%20keeps%20happening%20please%20report%20its'
      )
    }
  })
})

app.use('/api/*', (req, res) => {
  res.status(404).send({
    status: 404,
    error: true,
    message: 'Not Found'
  })
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
    res.status(500)
    return
  }

  render(res, req, 'other/error/error.ejs', {
    error: 'An Error has occured. Please try again later.'
  })
  console.log(error)
  res.status(500)
})

module.exports = app


/**
 * Parse a messages CSV into an object
 * @param input
 */
const parseCSV = input => {
  return Papa.parse(input, {
    header: true,
    newline: ',\r'
  })
    .data.filter(m => m.Contents)
    .map(m => ({
      id: m.ID,
      timestamp: m.Timestamp,
      length: m.Contents.length,
      words: m.Contents.split(' ')
    }))
}
function getFavoriteWords (words) {
  words = words.flat(3)

  let item,
    length = words.length,
    array = [],
    object = {}

  for (let index = 0; index < length; index++) {
    item = words[index]
    if (!item) continue

    if (!object[item]) object[item] = 1
    else ++object[item]
  }

  for (let p in object) array[array.length] = p

  return array
    .sort((a, b) => object[b] - object[a])
    .map(word => ({ word: word, count: object[word] }))
    .slice(0, 100)
}

function getCursedWords (words) {
  words = words.flat(3)

  let item,
    length = words.length,
    array = [],
    object = {}

  for (let index = 0; index < length; index++) {
    item = words[index].toLowerCase()
    if (!item) continue

    if (!object[item]) object[item] = 1
    else ++object[item]
  }

  for (let p in object) array[array.length] = p

  array = array
    .sort((a, b) => object[b] - object[a])
    .map(word => ({ word: word, count: object[word] }))

  const regex = /\b(4r5e|5h1t|5hit|a55|anal|anus|ar5e|arrse|arse|ass|ass-fucker|asses|assfucker|assfukka|asshole|assholes|asswhole|a_s_s|b!tch|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bastard|beastial|beastiality|bellend|bestial|bestiality|bi\+ch|biatch|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttplug|c0ck|c0cksucker|carpet muncher|cawk|chink|cipa|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|damn|dick|dickhead|dildo|dildos|dink|dinks|dirsa|dlck|dog-fucker|doggin|dogging|donkeyribber|doosh|duche|dyke|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|f u c k|f u c k e r|f4nny|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fanny|fannyflaps|fannyfucker|fanyy|fatass|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|flange|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|God|god-dam|god-damned|goddamn|goddamned|hardcoresex|hell|heshe|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jap|jerk-off|jism|jiz|jizm|jizz|kawk|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3i\+ch|l3itch|labia|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|masochist|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|mo-fo|mof0|mofo|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muff|mutha|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pawn|pecker|penis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|poop|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|rectum|retard|rimjaw|rimming|s hit|s.o.b.|sadist|schlong|screwing|scroat|scrote|scrotum|semen|sex|sh!\+|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shi\+|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|smegma|smut|snatch|son-of-a-bitch|spac|spunk|s_h_i_t|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|vagina|viagra|vulva|w00se|wang|wank|wanker|wanky|whoar|whore|willies|willy|xrated|xxx)\b/gi

  const swearWords = []
  for (let i = 0; i < array.length; i++) {
    if (regex.test(array[i].word)) {
      swearWords.push(array[i])
    }
  }

  array = swearWords
  return array
}
function getTopLinks (words) {
  words = words.flat(3)

  let item,
    length = words.length,
    array = [],
    object = {}

  for (let index = 0; index < length; index++) {
    item = words[index]
    if (!item) continue

    if (!object[item]) object[item] = 1
    else ++object[item]
  }

  for (let p in object) array[array.length] = p

  array = array
    .sort((a, b) => object[b] - object[a])
    .map(word => ({ word: word, count: object[word] }))

  let regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi

  let links = []
  for (let i = 0; i < array.length; i++) {
    if (regex.test(array[i].word)) {
      links.push(array[i])
    }
  }

  array = links
  return array
}

function getDiscordLinks (words) {
  words = words.flat(3)

  let item,
    length = words.length,
    array = [],
    object = {}

  for (let index = 0; index < length; index++) {
    item = words[index]
    if (!item) continue

    if (!object[item]) object[item] = 1
    else ++object[item]
  }

  for (let p in object) array[array.length] = p

  array = array
    .sort((a, b) => object[b] - object[a])
    .map(word => ({ word: word, count: object[word] }))

  let links = []
  for (let i = 0; i < array.length; i++) {
    if (
      array[i].word.match(
        /(https:\/\/)?(www\.)?(discord\.gg|discord\.me|discordapp\.com\/invite|discord\.com\/invite)\/([a-z0-9-.]+)?/i
      )
    ) {
      links.push(array[i])
    }
  }

  array = links
  return array
}

function parseMention (mention) {
  const mentionRegex = /^<@!?(\d+)>$/
  return mentionRegex.test(mention) ? mention.match(mentionRegex)[1] : null
}

async function fetchUser (id) {
  let user = await (
    await fetch(`https://discord.com/api/v8/users/${id}`, {
      method: 'GET',
      headers: {
        authorization: `Bot ${process.env.main_token}`
      }
    })
  ).json()

  if (!user) {
    user = {
      username: 'unknown',
      discriminator: '0000',
      avatar: null,
      public_flags: 0
    }
  }

  return user
}

function perDay (value, userID) {
  return parseInt(
    value / ((Date.now() - getCreatedTimestamp(userID)) / 24 / 60 / 60 / 1000)
  )
}

function shuffle (array) {
  let currentIndex = array.length,
    randomIndex

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex]
    ]
  }

  return array
}
