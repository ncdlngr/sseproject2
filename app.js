import express from "express";
import bcrypt from "bcrypt";
import db from "./database.js";
import session from "express-session";
import "dotenv/config";
import ISO6391 from "iso-639-1";
import languageCountryMapping from "./languagemapping.js";
import { body, validationResult } from 'express-validator';

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: false, // Set to true if using https
      maxAge: 900000 // Session expires after 15 minutes of inactivity
    },
    rolling: true // Reset the cookie expiration time on every request
  })
);
app.use(express.static("public"));
app.use(express.json());

function getCountryCodeForLanguage(languageCode) {
  // Basic mapping of language codes to country codes
  return languageCountryMapping[languageCode] || "default"; // Use a default value if no mapping found
}

function getLanguageDetails(languageCode) {
  const name = ISO6391.getName(languageCode);
  const countryCode = getCountryCodeForLanguage(languageCode);
  return { name, countryCode };
}


// Routes

app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

app.get("/dashboard", (req, res) => {
  if (req.session.userId) {
    res.render("dashboard");
  } else {
    res.redirect("/login");
  }
});

// Route to display registration form
app.get("/register", (req, res) => {
  res.render("register");
});

// Route to handle registration form submission
app.post("/register",// Username validation
body('username')
  .isLength({ min: 5, max: 10 })
  .withMessage('Username must be between 5 and 10 characters long')
  .matches(/^[A-Za-z0-9]+$/)
  .withMessage('Username must only contain letters and numbers'),

// Email validation
body('email')
  .isEmail()
  .withMessage('Invalid email format')
  .matches(/@.*\.(de|net|com|org)$/)
  .withMessage('Email must end with de, net, com, or org'),

// Password validation
body('password')
  .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!"$&?§%]).+$/)
  .withMessage('Password must include one uppercase letter, one number, and one special character from !"$&?§%'),
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, password } = req.body;

  db.get("SELECT id FROM users WHERE username = ?", [username], async (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Error checking username");
    }

    if (row) {
      return res.status(400).send("Username already exists");
    }

    // If username doesn't exist, proceed with hashing password and creating new user
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (insertErr) => {
        if (insertErr) {
          console.error(insertErr.message);
          return res.status(500).send("Error creating user");
        }
        res.redirect("/login");
      });
    } catch (hashErr) {
      console.error(hashErr.message);
      res.status(500).send("Error registering user");
    }
  });
});


// Route to display login form
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", [
  body('username', 'Username is required').notEmpty(),
  body('password', 'Password is required').notEmpty()
],
(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).send("Please enter both username and password");
  }

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).send("Error logging in");
      }

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send("Incorrect username or password");
      }

      req.session.userId = user.id;
      res.redirect("/dashboard");
    }
  );
});

app.get("/my-tests", (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}

  const sql = `SELECT * FROM tests WHERE user_id = ?`;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error retrieving tests");
      return;
    }

    const testsWithDetails = rows.map((test) => ({
      ...test,
      language_from_details: getLanguageDetails(test.language_from),
      language_to_details: getLanguageDetails(test.language_to),
    }));

    res.render("my-tests", { tests: testsWithDetails });
  });
});

app.get("/create-test", (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}
  const languages = ISO6391.getAllNames(); // Get all language names
  res.render("create-test", { languages, getCode: ISO6391.getCode});
});

app.post("/create-test", [
  body('test_name', 'Test name must be between 3 and 50 characters long')
    .isLength({ min: 3, max: 50 })
    .matches(/^[A-Za-z0-9 ]+$/).withMessage('Test name must contain only letters and numbers'),
  // Include any other validators for language_from, language_to, etc., if needed
],
(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // You might want to render the same page with error messages
    // or handle the errors as per your application's design.
    return res.status(400).json({ errors: errors.array() });
  }

  // Extract test data from the request body
  const { test_name, language_from, language_to } = req.body;
  const user_id = req.session.userId;
  if (!user_id) {
    return res.redirect('/login'); // Redirect to login if not logged in
}
  console.log("Request Body:", req.body, "User ID:", user_id);
  // SQL to insert a new test into the tests table
  const sql = `INSERT INTO tests (user_id, test_name, language_from, language_to) VALUES (?, ?, ?, ?)`;

  // Execute the query
  db.run(sql, [user_id, test_name, language_from, language_to], function (err) {
    if (err) {
      // Handle error
      console.error(err.message);
      res.status(500).send("Error creating test");
      return;
    }
    // Redirect to a new page or send a success response
    res.redirect("/my-tests"); // or res.status(200).send("Test created successfully");
  });
});

app.post("/add-entry/:testId", // Add validation checks for the test entries
body('word_or_sentence_from')
  .isLength({ min: 1, max: 250 })
  .matches(/^[a-zA-Z0-9 !?,.]+$/)
  .withMessage('Entry must be between 1 and 250 characters and can only contain letters, numbers, and !?,.'),

body('word_or_sentence_to')
  .isLength({ min: 1, max: 250 })
  .matches(/^[a-zA-Z0-9 !?,.]+$/)
  .withMessage('Entry must be between 1 and 250 characters and can only contain letters, numbers, and !?,.'),

(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // You might want to render the same page with error messages
    // or handle the errors as per your application's design.
    return res.status(400).json({ errors: errors.array() });
  }
  const testId = req.params.testId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login');
  }
  if (!userId) {
    return res.redirect('/login');
  }

  // Check if the test belongs to the logged-in user
  db.get("SELECT * FROM tests WHERE id = ? AND user_id = ?", [testId, userId], (err, test) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Error checking test ownership");
    }

    if (!test) {
      return res.status(403).send("You do not have permission to add entries to this test");
    }

    // Proceed with adding the entry
    const { word_or_sentence_from, word_or_sentence_to } = req.body;
    const sql = `INSERT INTO entries (test_id, word_or_sentence_from, word_or_sentence_to) VALUES (?, ?, ?)`;

    db.run(sql, [testId, word_or_sentence_from, word_or_sentence_to], (err) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Error adding entry");
      }

      res.redirect("/edit-test/" + testId);
    });
  });
});


app.get("/edit-test/:testId", (req, res) => {
  const testId = req.params.testId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login');
  }

  // Verify that the test belongs to the logged-in user
  db.get("SELECT * FROM tests WHERE id = ? AND user_id = ?", [testId, userId], (err, test) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Error retrieving test");
    }

    if (!test) {
      // If the test does not belong to the user, redirect or show an error
      return res.status(403).send("You do not have permission to edit this test");
    }

    // Fetch the entries for this test
    db.all("SELECT * FROM entries WHERE test_id = ?", [testId], (err, entries) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Error retrieving entries");
      }

      const languageOptions = ISO6391.getAllNames().map((name) => ({
        name,
        code: ISO6391.getCode(name),
      }));

      res.render("edit-test", {
        test,
        entries,
        languageOptions,
      });
    });
  });
});


app.post("/edit-test/:testId", (req, res) => {
  const testId = req.params.testId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}
  const {
    test_name,
    language_from,
    language_to,
    word_or_sentence_from,
    word_or_sentence_to,
    entry_ids,
  } = req.body;

  // Ensure word_or_sentence_from and word_or_sentence_to are arrays
  const wordsFrom = Array.isArray(word_or_sentence_from)
    ? word_or_sentence_from
    : [word_or_sentence_from];
  const wordsTo = Array.isArray(word_or_sentence_to)
    ? word_or_sentence_to
    : [word_or_sentence_to];
  const ids = Array.isArray(entry_ids) ? entry_ids : [entry_ids];

  // Update the test details
  db.run(
    "UPDATE tests SET test_name = ?, language_from = ?, language_to = ? WHERE id = ?",
    [test_name, language_from, language_to, testId],
    (err) => {
      if (err) {
        res.status(500).send("Error updating test");
        return;
      }

      // Handle each entry
      wordsFrom.forEach((from, index) => {
        const to = wordsTo[index];
        const entryId = ids[index];

        if (entryId) {
          // Update existing entry
          db.run(
            "UPDATE entries SET word_or_sentence_from = ?, word_or_sentence_to = ? WHERE id = ?",
            [from, to, entryId]
          );
        } else if (from && to) {
          // Insert new entry
          db.run(
            "INSERT INTO entries (test_id, word_or_sentence_from, word_or_sentence_to) VALUES (?, ?, ?)",
            [testId, from, to]
          );
        }
      });

      res.redirect("/my-tests");
    }
  );
});

app.post("/delete-test/:testId", (req, res) => {
  const testId = req.params.testId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login');
  }

  // Check if the test belongs to the logged-in user
  db.get("SELECT * FROM tests WHERE id = ? AND user_id = ?", [testId, userId], (err, test) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Error checking test ownership");
    }

    if (!test) {
      return res.status(403).send("You do not have permission to delete this test");
    }

    // Proceed with deleting the test and its entries
    db.run("DELETE FROM entries WHERE test_id = ?", [testId], (err) => {
      if (err) {
        return res.status(500).send("Error deleting test entries");
      }

      db.run("DELETE FROM tests WHERE id = ?", [testId], (err) => {
        if (err) {
          return res.status(500).send("Error deleting test");
        }

        res.redirect("/my-tests");
      });
    });
  });
});

app.post("/delete-entry/:entryId", (req, res) => {
  const entryId = req.params.entryId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}

  db.run("DELETE FROM entries WHERE id = ?", [entryId], (err) => {
    if (err) {
      // Handle error
      console.error(err.message);
      res.status(500).json({ error: "Error deleting entry" });
      return;
    }

    // Send a JSON response indicating success
    res.json({
      success: true,
      message: "Entry deleted successfully",
      testId: req.body.testId,
    });
  });
});

app.get("/run-test/:testId", (req, res) => {
  const testId = req.params.testId;
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login');
  }

  // Verify that the test belongs to the logged-in user
  db.get("SELECT * FROM tests WHERE id = ? AND user_id = ?", [testId, userId], (testErr, test) => {
    if (testErr || !test) {
      console.error(testErr?.message);
      return res.status(403).send("You do not have permission to access this test");
    }

    // Add language details to the test object
    test.language_from_details = getLanguageDetails(test.language_from);
    test.language_to_details = getLanguageDetails(test.language_to);

    // Then, get all the entries for this test
    db.all(
      "SELECT * FROM entries WHERE test_id = ?",
      [testId],
      (entriesErr, entries) => {
        if (entriesErr) {
          console.error(entriesErr.message);
          res.status(500).send("Error retrieving entries");
          return;
        }

        // Shuffle entries
        const shuffledEntries = entries.sort(() => 0.5 - Math.random());

        // Render the run-test page with the test details and shuffled entries
        res.render("run-test", { test: test, entries: shuffledEntries });
      }
    );
  });
});

app.get('/run-random-test', (req, res) => {
  const userId = req.session.userId; // Assuming user ID is stored in the session
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}

  db.all("SELECT id FROM tests WHERE user_id = ?", [userId], (err, tests) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error retrieving tests");
      return;
    }

    if (tests.length > 0) {
      // Select a random test
      const randomTest = tests[Math.floor(Math.random() * tests.length)];
      // Redirect to the test-running page for this test
      res.redirect(`/run-test/${randomTest.id}`);
    } else {
      // Handle the case where the user has no tests
      res.redirect('/dashboard'); // or show a message that no tests are available
    }
  });
});


app.post('/submit-test/:testId', (req, res) => {
  const testId = req.params.testId;
  const userId = req.session.userId;
  const userAnswers = req.body.answers;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}

  // First, retrieve the test details
  db.get("SELECT * FROM tests WHERE id = ?", [testId], (testErr, test) => {
    if (testErr) {
      console.error(testErr.message);
      res.status(500).send("Error retrieving test details");
      return;
    }

    // Then, get all the correct answers for this test
    db.all("SELECT id, word_or_sentence_from, word_or_sentence_to FROM entries WHERE test_id = ? ORDER BY id", [testId], (err, correctAnswers) => {
      if (err) {
        console.error(err.message);
        res.status(500).send("Error retrieving correct answers");
        return;
      }

      let score = 0;
      const detailedResults = correctAnswers.map((answer, index) => {
        const userAnswer = userAnswers[index] || '';
        const isCorrect = userAnswer.trim().toLowerCase() === answer.word_or_sentence_to.trim().toLowerCase();
        if (isCorrect) {
          score++;
        }
        return {
          question: answer.word_or_sentence_from,
          correctAnswer: answer.word_or_sentence_to,
          userAnswer,
          isCorrect
        };
      });

      const totalQuestions = correctAnswers.length;
      const percentage = (score / totalQuestions) * 100;

      // Save the test results to the database
      const insertSql = "INSERT INTO test_results (user_id, test_id, score, total_questions, percentage) VALUES (?, ?, ?, ?, ?)";
      db.run(insertSql, [userId, testId, score, totalQuestions, percentage], insertErr => {
        if (insertErr) {
          console.error(insertErr.message);
          res.status(500).send("Error saving test results");
          return;
        }

        // Render the results page with detailed results and test information
        res.render('test-results', {
          score: score,
          totalQuestions: totalQuestions,
          percentage: percentage,
          detailedResults: detailedResults,
          test: test // Include the test object
        });
      });
    });
  });
});

app.get('/progress', (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login'); // Redirect to login if not logged in
}

  // SQL to join tests and test_results tables
  const sql = `
    SELECT test_results.*, tests.test_name 
    FROM test_results 
    JOIN tests ON test_results.test_id = tests.id 
    WHERE test_results.user_id = ? 
    ORDER BY test_results.date_taken DESC`;

  db.all(sql, [userId], (err, results) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error retrieving progress data");
      return;
    }

    let totalScore = 0, highestScore = 0, lowestScore = results[0] ? results[0].score : 0;

    results.forEach(result => {
      totalScore += result.score;
      highestScore = Math.max(highestScore, result.score);
      lowestScore = Math.min(lowestScore, result.score);
    });

    const averageScore = results.length > 0 ? totalScore / results.length : 0;
    const totalTests = results.length;

    // Pass the results and calculated statistics to the frontend
    res.render('progress', { 
      results, 
      averageScore, 
      totalTests, 
      highestScore, 
      lowestScore 
    });
  });
});

app.get('/profile', (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
      return res.redirect('/login'); // Redirect to login if not logged in
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err) {
          console.error(err.message);
          return res.status(500).send("Error retrieving user data");
      }

      // Render the profile page with user data
      res.render('profile', { user });
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/dashboard");
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
