import express from 'express';
import bcrypt from 'bcrypt';
import db from './database.js'; 

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Routes
// Route to display registration form
app.get('/register', (req, res) => {
    res.render('register');
  });
  
  // Route to handle registration form submission
  app.post('/register', async (req, res) => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [req.body.username, hashedPassword], (err) => {
        if (err) {
          // handle error, e.g., username already exists
          return res.redirect('/register');
        }
        res.redirect('/login');
      });
    } catch {
      res.redirect('/register');
    }
  });

  // Route to display login form
app.get('/login', (req, res) => {
    res.render('login');
  });

  app.post('/login', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.body.username], async (err, user) => {
      if (user && await bcrypt.compare(req.body.password, user.password)) {
        // User authentication is successful
        // Create a session or token here
        res.redirect('/dashboard'); // Redirect to a protected route after login
      } else {
        // Authentication failed
        res.redirect('/login');
      }
    });
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
