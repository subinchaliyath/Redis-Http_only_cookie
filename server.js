const express = require("express");
const fetch = require("node-fetch");
const redis = require("redis");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
var cookieParser = require('cookie-parser');

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

    const { username } = req.params;

    const response = await fetch(`https://api.github.com/users/${username}`);

    const data = await response.json();

    const repos = data.public_repos;

    // Set data to Redis
    client.setex(username, 3600, repos);

    res.send(setResponse(username, repos));
  } catch (err) {
    console.error(err);
    res.status(500);
  }
}

// Cache middleware
function cache(req, res, next) {
  const { username } = req.params;

  client.get(username, (err, data) => {
    if (err) throw err;

    if (data !== null) {
      res.send(setResponse(username, data));
    } else {
      next();
    }
  });
}
function checkjwt(req,res,next){
   if(req.cookies['token']===token) {
       next();
   }else{
       res.json("no cookie found")
   }
}
var token = "generatetoken";
function login(req, res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: "strict",
      path: "/",
    })
  );
  res.json("cookie set");
}

app.get("/repos/:username", checkjwt,cache, getRepos);
app.get("/", (req, res) => res.json("running"));
app.get("/login", login);

app.listen(5000, () => {
  console.log(`App listening on port ${PORT}`);
});
