require('dotenv').config({ path: './.env.local' });
const bodyParser = require('body-parser');
const cors = require('cors');

const express = require('express');
const mysql = require('mysql');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(bodyParser.json());
// Database connection settings
const connection = mysql.createConnection({
  host     : process.env.HOST, 
  user     : process.env.USER, 
  password : process.env.PASSWORD, 
  database : process.env.DATABASE  
});
//console.log(process.env.HOST, process.env.USER, process.env.PASSWORD, process.env.DATABASE);


// Connect to the database
connection.connect(err => {
  if (err) {
    console.error('An error occurred while connecting to the DB: ', err);
    return;
  }
  console.log('Connection established successfully.');
});

// Define a route to fetch data from the database
app.get('/data', (req, res) => {
  const sqlQuery = 'SELECT * FROM test'; // Replace with your actual SQL query
  connection.query(sqlQuery, (error, results, fields) => {
    if (error) {
      return res.status(500).send('Error in database operation');
    }
    res.json(results);
  });
});




// Endpoint to insert a new message
app.post('/data', (req, res) => {
  const message = req.body.message; // Assuming the message is sent in the body of the POST request
  const sqlInsert = 'INSERT INTO test (testcol) VALUES (?);'; // Replace 'column_name' with the actual column name in your table

  connection.query(sqlInsert, [message], (error, results, fields) => {
    if (error) {
      return res.status(500).send('Error inserting message into database');
    }
    res.status(201).send('Message inserted successfully');
  });
});

// Default route for the root of your site
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
