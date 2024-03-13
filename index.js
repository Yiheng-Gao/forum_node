require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const app = express();
const port = process.env.PORT || 3000;

// Database connection settings
const connection = mysql.createConnection({
  host     : process.env.HOST, 
  user     : process.env.USER, 
  password : process.env.PASSWORD, 
  database : process.env.DATABASE  
});

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

// Default route for the root of your site
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
