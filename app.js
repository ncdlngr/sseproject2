import express from "express";
import bcrypt from "bcrypt";
import db from "./database.js";
import session from "express-session";
import 'dotenv/config';
import e from "express";
import ISO6391 from 'iso-639-1';

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

function getLanguageDetails(languageCode) {
  const name = ISO6391.getName(languageCode);
  const countryCode = getCountryCodeForLanguage(languageCode); // Implement this function based on your mapping
  return { name, countryCode };
}

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
  const userId = req.session.userId;

  const sql = `SELECT * FROM tests WHERE user_id = ?`;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error retrieving tests");
      return;
    }

    const testsWithDetails = rows.map(test => ({
      ...test,
      language_from_details: getLanguageDetails(test.language_from),
      language_to_details: getLanguageDetails(test.language_to)
    }));

    res.render('my-tests', { tests: testsWithDetails });
  });
});

app.get('/create-test', (req, res) => {
  const languages = ISO6391.getAllNames(); // Get all language names
  res.render('create-test', { languages, getCode: ISO6391.getCode });
});


app.post('/create-test', (req, res) => {
  // Extract test data from the request body
  const { test_name, language_from, language_to } = req.body;
  const user_id = req.session.userId;
  console.log('Request Body:', req.body, 'User ID:', user_id);
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
