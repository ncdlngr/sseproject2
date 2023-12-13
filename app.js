import express from "express";
import bcrypt from "bcrypt";
import db from "./database.js";
import session from "express-session";
import 'dotenv/config';
import e from "express";

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Use a secret key for session encryption
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using https
  })
);
app.use(express.static('public'));

// Routes

app.get('/', (req, res) => {
    if (req.session.userId) {
      res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }});

app.get('/dashboard', (req, res) => {
    if (req.session.userId) {
      res.render('dashboard');
    } else {
      res.redirect('/login');
    }
  });
  
// Route to display registration form
app.get("/register", (req, res) => {
  res.render("register");
});

// Route to handle registration form submission
app.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [req.body.username, hashedPassword],
      (err) => {
        if (err) {
          // handle error, e.g., username already exists
          return res.redirect("/register");
        }
        res.redirect("/login");
      }
    );
  } catch {
    res.redirect("/register");
  }
});

// Route to display login form
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [req.body.username],
    async (err, user) => {
      if (user && (await bcrypt.compare(req.body.password, user.password))) {
        req.session.userId = user.id; // Storing user ID in session
        res.redirect("/dashboard");
      } else {
        // Authentication failed
        res.redirect("/login");
      }
    }
  );
});

app.get('/my-tests', (req, res) => {
  const userId = req.session.userId; // Assuming you have user session management
  
  // SQL to retrieve tests belonging to the logged-in user
  const sql = `SELECT * FROM tests WHERE user_id = ?`;

  // Execute the query
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      // Handle error
      console.error(err.message);
      res.status(500).send("Error retrieving tests");
      return;
    }
    // Render a page with the list of tests
    res.render('my-tests', { tests: rows }); // Assuming you have a my-tests.ejs template
  });
});

app.get('/create-test', (req, res) => {
  res.render('create-test');
});


app.post('/create-test', (req, res) => {
  // Extract test data from the request body
  const { user_id, test_name, language_from, language_to } = req.body;

  // SQL to insert a new test into the tests table
  const sql = `INSERT INTO tests (user_id, test_name, language_from, language_to) VALUES (?, ?, ?, ?)`;

  // Execute the query
  db.run(sql, [user_id, test_name, language_from, language_to], function(err) {
    if (err) {
      // Handle error
      console.error(err.message);
      res.status(500).send("Error creating test");
      return;
    }
    // Redirect to a new page or send a success response
    res.redirect('/my-tests'); // or res.status(200).send("Test created successfully");
  });
});

app.post('/add-entry/:testId', (req, res) => {
  const testId = req.params.testId;
  const { word_or_sentence_from, word_or_sentence_to } = req.body;

  // SQL to insert a new entry into the entries table
  const sql = `INSERT INTO entries (test_id, word_or_sentence_from, word_or_sentence_to) VALUES (?, ?, ?)`;

  // Execute the query
  db.run(sql, [testId, word_or_sentence_from, word_or_sentence_to], function(err) {
    if (err) {
      // Handle error
      console.error(err.message);
      res.status(500).send("Error adding entry");
      return;
    }
    // Redirect or send a success response
    res.redirect('/edit-test/' + testId); // Redirect back to the test editing page
  });
});

app.get('/edit-test/:testId', (req, res) => {
  const testId = req.params.testId;

  // Fetch the test details
  db.get("SELECT * FROM tests WHERE id = ?", [testId], (err, test) => {
    if (err) {
      // Handle error
      res.status(500).send("Error retrieving test");
      return;
    }

    // Fetch the entries for this test
    db.all("SELECT * FROM entries WHERE test_id = ?", [testId], (err, entries) => {
      if (err) {
        // Handle error
        res.status(500).send("Error retrieving entries");
        return;
      }

      // Render the edit page, passing test details and entries
      res.render('edit-test', { test, entries });
    });
  });
});

app.post('/edit-test/:testId', (req, res) => {
  const testId = req.params.testId;
  const { test_name, language_from, language_to, entries } = req.body;

  // Update the test details
  db.run("UPDATE tests SET test_name = ?, language_from = ?, language_to = ? WHERE id = ?", [test_name, language_from, language_to, testId], err => {
    if (err) {
      // Handle error
      res.status(500).send("Error updating test");
      return;
    }

    // Update entries here...
    // Loop through `entries` and update each one

    res.redirect('/my-tests');
  });
});

app.post('/delete-test/:testId', (req, res) => {
  const testId = req.params.testId;

  // Delete the entries first
  db.run("DELETE FROM entries WHERE test_id = ?", [testId], err => {
    if (err) {
      // Handle error
      res.status(500).send("Error deleting entries");
      return;
    }

    // Now delete the test
    db.run("DELETE FROM tests WHERE id = ?", [testId], err => {
      if (err) {
        // Handle error
        res.status(500).send("Error deleting test");
        return;
      }

      res.redirect('/my-tests');
    });
  });
});

app.post('/delete-entry/:entryId', (req, res) => {
  const entryId = req.params.entryId;

  db.run("DELETE FROM entries WHERE id = ?", [entryId], err => {
    if (err) {
      // Handle error
      res.status(500).send("Error deleting entry");
      return;
    }

    // Redirect back to the test editing page or handle the response appropriately
    res.redirect('/edit-test/' + req.body.testId); // Assuming testId is sent in the request body
  });
});



app.post('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.redirect('/dashboard');
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
