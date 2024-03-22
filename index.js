require('dotenv').config({ path: './.env.local' });
const secretKey = 'yourSecretKey'; 

const bodyParser = require('body-parser');
const cors = require('cors');

const express = require('express');
const mysql = require('mysql');
const app = express();
const port = process.env.PORT || 3000;

const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');

app.use(cors());

app.use(bodyParser.json());
//Database connection settings
// const connection = mysql.createConnection({
//   host     : process.env.HOST, 
//   user     : process.env.USER, 
//   password : process.env.PASSWORD, 
//   database : process.env.DATABASE
// });

const connection = mysql.createPool({
    connectionLimit: 20, 
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
  });
  
  connection.on('connection', function (connection) {
    console.log('DB Connection established');
  });
  
  connection.on('error', function (err) {
    console.error('DB Connection error', err);
    process.exit(-1);
  });


  

// const connection = mysql.createConnection({
//   host     : "database-1.cbc8ecmccv9z.us-east-2.rds.amazonaws.com", 
//   user     : "admin", 
//   password : "qwert123", 
//   database : "campusforum"
// });
// console.log(process.env.HOST, process.env.USER, process.env.PASSWORD, process.env.DATABASE);
// console.log(process.env.HOST, process.env.USER, process.env.PASSWORD, process.env.DATABASE);


// Connect to the database
// connection.connect(err => {
//   if (err) {
//     console.error('An error occurred while connecting to the DB: ', err);
//     return;
//   }
//   console.log('Connection established successfully.');
// });

// Define a route to fetch data from the database
app.get('/data', (req, res) => {
  const sqlQuery = 'SELECT * FROM test'; // Replace with your actual SQL query
  connection.query(sqlQuery, (error, results, fields) => {
    if (error) {
      return res.status(500).json({message: 'Error in database operation'});
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
      return res.status(500).json({message: 'Error inserting message into database'});
    }
    res.status(201).json({message: 'Message inserted successfully'});
  });
});

// Default route for the root of your site
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Set SendGrid API Key

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// New endpoint to handle sending verification code
app.post('/sendVerification', (req, res) => {
    const email = req.body.email; // Extract email from request body

    if (!email) {
        return res.status(400).send({ error: true, message: 'Email is required' });
    }

    // Generate a new verification code for each request
    const verificationCode = crypto.randomBytes(3).toString('hex');

    // First, insert the verification code into the database
    const insertQuery = "INSERT INTO verification_codes (email, verification_code) VALUES (?, ?)";
    connection.query(insertQuery, [email, verificationCode], (error) => {
        if (error) {
            console.error("Failed to insert verification code: ", error);
            return res.status(500).send({ error: true, message: 'Failed to store verification code' });
        }

        // If the insert was successful, proceed to send the email
        const msg = {
            to: email, // Use the user's email address from the request body
            from: 'varificationmobile@gmail.com', // Use your verified SendGrid sender email
            subject: 'Verification Code',
            text: `Your verification code is: ${verificationCode}`,
        };

        sgMail.send(msg).then(() => {
            console.log('Email sent');
            res.send({ success: true, message: 'Verification code sent successfully.' });
        }).catch((error) => {
            console.error(error);
            res.status(500).send({ error: true, message: 'Failed to send email' });
        });
    });
});
//Verification code for sign up activity
app.post('/verifyCode', (req, res) => {
    const { email, verificationCode } = req.body;

    const query = "SELECT verification_code, created_at FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1";

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.status(500).send({ error: true, message: 'Database query failed' });
        }

        if (results.length > 0) {
            const { verification_code, created_at } = results[0];
            const currentTime = new Date();
            const codeCreationTime = new Date(created_at);

            if ((currentTime - codeCreationTime) / 60000 > 10) {
                return res.send({ success: false, message: 'Verification code expired' });
            }

            if (verification_code === verificationCode) {
                res.send({ success: true, message: 'Verification successful' });
               
            } else {
                res.send({ success: false, message: 'Incorrect verification code' });
            }
        } else {
            res.send({ success: false, message: 'Email not found' });
        }
    });
});

// Sign-up API endpoint
app.post('/signup', (req, res) => {
    console.log(req.body); // Logging the incoming request body
    const { username, email, password } = req.body; // Extract data from request body

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).send({ error: true, message: 'Please provide username, email, and password' });
    }

   
    const query = "INSERT INTO user (user_name, email, password) VALUES (?, ?, ?)";
    connection.query(query, [username, email, password], (error, results, fields) => {
        if (error) {
            console.error("Failed to insert new user: ", error);
            return res.status(500).send({ error: true, message: 'Failed to create user' });
        }

        res.send({ error: false, data: results, message: 'New user has been created successfully.' });
    });
});

//Varification code for inactive activity
app.post('/reVerify', (req, res) => {
    const { email, verificationCode } = req.body;

    // Retrieve the most recent verification code for the email
    const verificationQuery = "SELECT verification_code, created_at FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1";
    
    connection.query(verificationQuery, [email], (verificationError, verificationResults) => {
        if (verificationError) {
            console.error('Verification query error:', verificationError);
            return res.status(500).send({ error: true, message: 'Verification query failed' });
        }

        if (verificationResults.length > 0) {
            const { verification_code, created_at } = verificationResults[0];
            const currentTime = new Date();
            const codeCreationTime = new Date(created_at);

            // Check if the verification code matches and is not expired
            if (verification_code === verificationCode ) {
                
                // Fetch the user's ID using their email from the user table
                const userQuery = "SELECT user_id FROM user WHERE email = ?";
                
                connection.query(userQuery, [email], (userError, userResults) => {
                    if (userError || userResults.length === 0) {
                        console.error('User fetch error:', userError);
                        return res.status(500).send({ error: true, message: 'Failed to fetch user' });
                    }

                    const UserID = userResults[0].UserID;
                    
                    // Update the user's last login time
                    const updateLastLoginQuery = "UPDATE user SET last_login_time = NOW() WHERE user_id = ?";
                    connection.query(updateLastLoginQuery, [UserID], (updateError) => {
                        if (updateError) {
                            console.error('Failed to update last login time:', updateError);
                            return res.status(500).send({ error: true, message: 'Failed to update last login time' });
                        }

                        // Generate a new JWT token for the user
                        const token = jwt.sign({ userId: UserID }, secretKey, { expiresIn: '1h' });

                        res.json({
                            success: true,
                            message: 'Verification successful. Last login time updated.',
                            token: token,
                            userId: UserID
                        });
                    });
                });

            } else {
                // The verification code is incorrect or expired
                res.send({ success: false, message: 'Incorrect or expired verification code' });
            }
        } else {
            // No verification code found for the email
            res.send({ success: false, message: 'No verification code found for this email' });
        }
    });
});

//Login logic
app.post('/login', (req, res) => {
    const { username, password, currentTimestamp } = req.body;

    // Updated query to also select the 'email' field
    const query = "SELECT user_id, password, last_login_time, email FROM user WHERE user_name = ?";
    connection.query(query, [username], (error, results) => {
        if (error) {
            console.error("Login error: ", error);
            return res.status(500).json({ success: false, message: "Database query error" });
        }

        if (results.length > 0) {
            const user = results[0];
            if (user.password === password) {
                const lastLoginTimeMillis = new Date(user.last_login_time || 0).getTime();
                const currentTime = new Date(parseInt(currentTimestamp)).getTime();
                const diffDays = (currentTime - lastLoginTimeMillis) / (1000 * 60 * 60 * 24);

                if (diffDays > 100) {
                    return res.json({ 
                        success: false, 
                        message: "Verification required. A code has been sent to your email.", 
                        email: user.email, // Send the fetched email address to the client
                        
                        userId: user.user_id 
                    });
                } else {
                    // Update last login time to current timestamp
                    const updateLastLoginTimeQuery = "UPDATE user SET last_login_time = NOW() WHERE user_id = ?";
                    connection.query(updateLastLoginTimeQuery, [user.user_id], (updateError) => {
                        if (updateError) {
                            console.error("Failed to update last login time: ", updateError);
                            return res.status(500).json({ success: false, message: "Failed to update last login time" });
                        }

                        // Proceed with successful login response
                        const token = jwt.sign({ userId: user.user_id }, secretKey, { expiresIn: '1h' });
                        res.json({ 
                            success: true, 
                            message: "Login successful", 
                            token: token, 
                            userId: user.user_id 
                        });
                    });
                }
            } else {
                res.json({ success: false, message: "Password invalid" });
            }
        } else {
            res.json({ success: false, message: "Account does not exist" });
        }
    });
});

app.get('/category', (req, res) => {
    const sqlQuery = 'SELECT category_name FROM category'; 
    connection.query(sqlQuery, (error, results, fields) => {
      if (error) {
        return res.status(500).json({message: 'Error in database operation'});
      }
      res.json(results);
    });
  });



app.get('/threadDetailsByCategory', (req, res) => {
    
    const categoryId = req.query.category_id;

    if (!categoryId) {
        return res.status(400).json({message: 'category_id is required'});
    }

    const sqlQuery = 'SELECT title, user_name, thread_time, thread_id FROM thread_detail WHERE category_id = ?';
    
    connection.query(sqlQuery, [categoryId], (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.status(500).json({message: 'Error fetching data from database'});
        }
        
        res.json(results);
    });
});


app.get('/threadDetail', (req, res) => {
    
    const thread_id = req.query.thread_id;

    if (!thread_id) {
        return res.status(400).json({message: 'thread_id is required'});
    }

    const sqlQuery = 'SELECT title, user_name, thread_time, thread_content FROM thread_detail WHERE thread_id = ?';
    
    connection.query(sqlQuery, [thread_id], (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.status(500).json({message: 'Error fetching data from database'});
        }
        
        res.json(results);
    });
});


app.post('/sendThread',(req,res)=>{
    const {user_id, category_id, title, thread_content} = req.body;

    const query ="INSERT INTO thread (user_id, category_id, title, thread_content) VALUES (?, ?, ?, ?)";
    connection.query(query,[user_id, category_id, title, thread_content],(error, result, fields)=>{
        if (error) {
            console.error("Failed to insert new thread: ", error);
            return res.status(500).send({ error: true, message: 'Failed to create thread' });
        }
        res.send({error: false, data: result, message: 'New thread created successfully'});
    })
});


app.get('/commentsList', (req, res) => {
    
    const thread_id = req.query.thread_id;

    if (!thread_id) {
        return res.status(400).json({message: 'thread_id is required'});
    }

    const sqlQuery = 'SELECT user_name, user_id, comment_id, comment_content, parent_comment_id, parent_user_name, comment_time FROM comment_view WHERE thread_id = ?';
    
    connection.query(sqlQuery, [thread_id], (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.status(500).json({message: 'Error fetching data from database'});
        }
        
        res.json(results);
    });
});

app.post('/sendComment',(req,res)=>{
    const {user_id, thread_id, parent_comment_id, comment_content} = req.body;

    const query ="INSERT INTO comment (user_id, thread_id, parent_comment_id, comment_content) VALUES (?, ?, ?, ?)";
    connection.query(query,[user_id, thread_id, parent_comment_id, comment_content],(error, result, fields)=>{
        if (error) {
            console.error("Failed to insert new comment: ", error);
            return res.status(500).send({ error: true, message: 'Failed to create comment' });
        }
        res.send({error: false, data: result, message: 'New comment created successfully'});
    })
});


// Start the server
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
