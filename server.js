const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: true
}));

/* ---------------- DATABASE ---------------- */

const db = new sqlite3.Database("database.db");

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)`);

db.run(`
CREATE TABLE IF NOT EXISTS shipments(
id INTEGER PRIMARY KEY AUTOINCREMENT,
pickup TEXT,
delivery TEXT,
weight TEXT,
courier TEXT,
tracking TEXT UNIQUE,
status TEXT,
created DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

/* ---------------- HELPERS ---------------- */

function generateTracking(){
return "TRK" + Math.floor(Math.random()*100000000)
}

function calculatePrice(weight){

return [

{ name:"Courier Guy", price:80 + weight*5 },
{ name:"Fastway", price:70 + weight*6 },
{ name:"RAM", price:90 + weight*4 }

].sort((a,b)=>a.price-b.price)

}

/* ---------------- ADMIN PROTECTION ---------------- */

function adminAuth(req,res,next){

if(req.session.user !== 1){
return res.send("Admin only")
}

next()

}

/* ---------------- WELCOME PAGE ---------------- */

app.get("/", (req,res)=>{

res.send(`

<html>
<head>

<title>Courier Platform</title>

<style>

body{
background:black;
color:white;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
flex-direction:column;
font-family:Arial;
}

img{
width:220px;
margin-bottom:20px;
}

.loader{
border:6px solid #222;
border-top:6px solid red;
border-radius:50%;
width:50px;
height:50px;
animation:spin 1s linear infinite;
}

@keyframes spin{
0%{transform:rotate(0deg);}
100%{transform:rotate(360deg);}
}

</style>

<script>
setTimeout(()=>{window.location="/home"},4000)
</script>

</head>

<body>

<img src="/logo.png"/>

<h1>Courier Platform</h1>

<div class="loader"></div>

</body>

</html>

`)
})

/* ---------------- HOME ---------------- */

app.get("/home",(req,res)=>{

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:80px;">

<h1>Courier Booking Platform</h1>

<p>Compare courier deliveries instantly</p>

<br>

<a href="/register" style="background:red;color:white;padding:12px 20px;text-decoration:none;margin-right:10px;">Register</a>

<a href="/login" style="background:white;color:black;padding:12px 20px;text-decoration:none;margin-right:10px;">Login</a>

<a href="/track" style="background:red;color:white;padding:12px 20px;text-decoration:none;">Track Parcel</a>

</body>

`)
})

/* ---------------- REGISTER ---------------- */

app.get("/register",(req,res)=>{

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Register</h1>

<form method="POST" action="/register">

<input name="username" placeholder="Username" required style="padding:10px"><br><br>

<input name="password" type="password" placeholder="Password" required style="padding:10px"><br><br>

<button style="background:red;color:white;padding:10px 20px;">Register</button>

</form>

</body>

`)
})

app.post("/register",async(req,res)=>{

const {username,password} = req.body

const hash = await bcrypt.hash(password,10)

db.run("INSERT INTO users(username,password) VALUES (?,?)",[username,hash],(err)=>{

if(err) return res.send("Username already exists")

res.redirect("/login")

})

})

/* ---------------- LOGIN ---------------- */

app.get("/login",(req,res)=>{

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Login</h1>

<form method="POST" action="/login">

<input name="username" placeholder="Username" required style="padding:10px"><br><br>

<input name="password" type="password" placeholder="Password" required style="padding:10px"><br><br>

<button style="background:red;color:white;padding:10px 20px;">Login</button>

</form>

</body>

`)
})

app.post("/login",(req,res)=>{

const {username,password} = req.body

db.get("SELECT * FROM users WHERE username=?",[username],async(err,user)=>{

if(err) return res.send("Server error")

if(!user) return res.send("User not found")

const match = await bcrypt.compare(password,user.password)

if(!match) return res.send("Wrong password")

req.session.user = user.id

res.redirect("/dashboard")

})

})

/* ---------------- DASHBOARD ---------------- */

app.get("/dashboard",(req,res)=>{

if(!req.session.user) return res.redirect("/login")

db.all("SELECT * FROM shipments ORDER BY created DESC",(err,rows)=>{

let html = `<body style="background:black;color:white;font-family:Arial;text-align:center;padding-top:50px;">

<h1>Your Shipments</h1>`

rows.forEach(s=>{

html += `<p>${s.courier} | Tracking: ${s.tracking} | Status: ${s.status}</p>`

})

html += `

<br>

<a href="/book" style="background:red;color:white;padding:10px 20px;text-decoration:none;">Book Delivery</a>

<br><br>

<a href="/track" style="background:white;color:black;padding:10px 20px;text-decoration:none;">Track Shipment</a>

<br><br>

<a href="/logout" style="background:red;color:white;padding:10px 20px;text-decoration:none;">Logout</a>

</body>`

res.send(html)

})

})

/* ---------------- LOGOUT ---------------- */

app.get("/logout",(req,res)=>{

req.session.destroy(()=>{

res.redirect("/home")

})

})

/* ---------------- BOOK DELIVERY ---------------- */

app.get("/book",(req,res)=>{

if(!req.session.user) return res.redirect("/login")

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Book Delivery</h1>

<form method="POST" action="/prices">

<input name="pickup" placeholder="Pickup Address" required style="padding:10px"><br><br>

<input name="delivery" placeholder="Delivery Address" required style="padding:10px"><br><br>

<input name="weight" placeholder="Weight (kg)" required style="padding:10px"><br><br>

<button style="background:red;color:white;padding:10px 20px;">Compare Prices</button>

</form>

</body>

`)
})

/* ---------------- PRICE COMPARISON ---------------- */

app.post("/prices",(req,res)=>{

const {pickup,delivery,weight} = req.body

const couriers = calculatePrice(Number(weight))

let html = `<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:80px;">

<h1>Select Courier</h1>`

couriers.forEach(c=>{

html += `

<p>${c.name} - R${c.price}

<a href="/pay?amount=${c.price}&courier=${c.name}&pickup=${pickup}&delivery=${delivery}&weight=${weight}" style="background:red;color:white;padding:6px 12px;text-decoration:none;margin-left:10px;">
Pay & Book
</a>

</p>

`

})

html += `</body>`

res.send(html)

})

/* ---------------- PAYMENT ---------------- */

app.get("/pay",(req,res)=>{

const {amount,courier,pickup,delivery,weight} = req.query

const tracking = generateTracking()

db.run("INSERT INTO shipments(pickup,delivery,weight,courier,tracking,status) VALUES (?,?,?,?,?,?)",

[pickup,delivery,weight,courier,tracking,"Awaiting Payment"])

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Confirm Payment</h1>

<p>Tracking Number: ${tracking}</p>

<form action="https://www.payfast.co.za/eng/process" method="post">

<input type="hidden" name="merchant_id" value="10000100">
<input type="hidden" name="merchant_key" value="46f0cd694581a">
<input type="hidden" name="amount" value="${amount}">
<input type="hidden" name="item_name" value="Courier Delivery">

<button style="padding:15px;background:red;color:white;font-size:18px;">
Pay R${amount}
</button>

</form>

</body>

`)

})

/* ---------------- TRACK ---------------- */

app.get("/track",(req,res)=>{

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Track Shipment</h1>

<form method="GET" action="/track-result">

<input name="tracking" placeholder="Tracking Number" required style="padding:10px"><br><br>

<button style="background:red;color:white;padding:10px 20px;">Track</button>

</form>

</body>

`)

})

app.get("/track-result",(req,res)=>{

const {tracking} = req.query

db.get("SELECT * FROM shipments WHERE tracking=?",[tracking],(err,s)=>{

if(!s) return res.send("Shipment not found")

res.send(`

<body style="background:black;color:white;text-align:center;font-family:Arial;padding-top:100px;">

<h1>Tracking Result</h1>

<p>Courier: ${s.courier}</p>
<p>Status: ${s.status}</p>

<a href="/home" style="background:red;color:white;padding:10px 20px;text-decoration:none;">Home</a>

</body>

`)

})

})

/* ---------------- ADMIN ---------------- */

app.get("/admin",adminAuth,(req,res)=>{

db.all("SELECT * FROM shipments",(err,rows)=>{

let html = `<body style="background:black;color:white;font-family:Arial;text-align:center;padding-top:50px;">

<h1>Admin Panel</h1>`

rows.forEach(s=>{

html += `<p>

${s.tracking} | ${s.status}

<a href="/update?id=${s.id}&status=In Transit">In Transit</a>

<a href="/update?id=${s.id}&status=Delivered">Delivered</a>

</p>`

})

html += `</body>`

res.send(html)

})

})

app.get("/update",(req,res)=>{

const {id,status} = req.query

db.run("UPDATE shipments SET status=? WHERE id=?",[status,id])

res.redirect("/admin")

})

/* ---------------- START SERVER ---------------- */

app.listen(3000,()=>{

console.log("Server running on http://localhost:3000")

})