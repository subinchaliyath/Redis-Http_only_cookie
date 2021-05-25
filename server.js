const express = require("express");
const fetch = require("node-fetch");
const redis = require("redis");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
var cookieParser = require("cookie-parser");

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// initialise redis client with port
const client = redis.createClient(REDIS_PORT);

const app = express();
app.use(cookieParser());

// Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} Github repos</h2>`;
}

// Make request to Github for data
async function getRepos(req, res, next) {
  try {
    console.log("Fetching Data...");

    const response = await fetch(`https://api.github.com/users/${req.user}`);

    const data = await response.json();

    const repos = data.public_repos;

    // Set data to Redis
    client.setex(req.user, 3600, repos);

    res.send(setResponse(req.user, repos));
  } catch (err) {
    console.error(err);
    res.status(500);
  }
}

// Cache middleware
function cache(req, res, next) {
  const username = req.user;

  client.get(username, (err, data) => {
    if (err) throw err;

    if (data !== null) {
      res.send(setResponse(username, data));
    } else {
      next();
    }
  });
}

// jwt verification
function checkjwt(req, res, next) {
  if (req.cookies["token"]) {
    jwt.verify(req.cookies["token"], "shhhhh", (err, { username }) => {
      if (err) return res.sendStatus(403);
      req.user = username;
      next();
    });
  } else {
    res.json("no cookie found");
  }
}

  
function firstScreen() {
  return `<h2>Login with /login/:username</h2>
            <h3>Get number of repos by /repos/:username</h3>
           `;
}


function login(req, res) {
  const token = jwt.sign({ username: req.params.username }, "shhhhh");
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: "strict",
      path: "/",
    })
  );
  res.json("cookie set");
}


// to check the server
app.get("/", (req, res) => res.send(firstScreen()));

app.get("/login/:username", login);

// this is a protected route
// redis cache implemented
app.get("/repos/:username", checkjwt, cache, getRepos);


app.listen(5000, () => {
  console.log(`App listening on port ${PORT}`);
});
