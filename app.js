import express from "express";
import bcrypt from "bcrypt";
import db from "./database.js";
import session from "express-session";
import "dotenv/config";
import ISO6391 from "iso-639-1";
import languageCountryMapping from "./languagemapping.js";

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

app.get("/my-tests", (req, res) => {
  const userId = req.session.userId;

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
  const languages = ISO6391.getAllNames(); // Get all language names
  res.render("create-test", { languages, getCode: ISO6391.getCode });
});

app.post("/create-test", (req, res) => {
  // Extract test data from the request body
  const { test_name, language_from, language_to } = req.body;
  const user_id = req.session.userId;
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

app.post("/add-entry/:testId", (req, res) => {
  const testId = req.params.testId;
  const { word_or_sentence_from, word_or_sentence_to } = req.body;

  // SQL to insert a new entry into the entries table
  const sql = `INSERT INTO entries (test_id, word_or_sentence_from, word_or_sentence_to) VALUES (?, ?, ?)`;

  // Execute the query
  db.run(
    sql,
    [testId, word_or_sentence_from, word_or_sentence_to],
    function (err) {
      if (err) {
        // Handle error
        console.error(err.message);
        res.status(500).send("Error adding entry");
        return;
      }
      // Redirect or send a success response
      res.redirect("/edit-test/" + testId); // Redirect back to the test editing page
    }
  );
});

app.get("/edit-test/:testId", (req, res) => {
  const testId = req.params.testId;

  // Fetch the test details
  db.get("SELECT * FROM tests WHERE id = ?", [testId], (err, test) => {
    if (err) {
      // Handle error
      res.status(500).send("Error retrieving test");
      return;
    }

    // Fetch the entries for this test
    db.all(
      "SELECT * FROM entries WHERE test_id = ?",
      [testId],
      (err, entries) => {
        if (err) {
          // Handle error
          res.status(500).send("Error retrieving entries");
          return;
        }

        const languageOptions = ISO6391.getAllNames().map((name) => ({
          name,
          code: ISO6391.getCode(name),
        }));

        // Render the edit page, passing test details, entries, and language options
        res.render("edit-test", {
          test,
          entries,
          languageOptions,
        });
      }
    );
  });
});

app.post("/edit-test/:testId", (req, res) => {
  const testId = req.params.testId;
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

  // Delete the entries first
  db.run("DELETE FROM entries WHERE test_id = ?", [testId], (err) => {
    if (err) {
      // Handle error
      res.status(500).send("Error deleting entries");
      return;
    }

    // Now delete the test
    db.run("DELETE FROM tests WHERE id = ?", [testId], (err) => {
      if (err) {
        // Handle error
        res.status(500).send("Error deleting test");
        return;
      }

      res.redirect("/my-tests");
    });
  });
});

app.post("/delete-entry/:entryId", (req, res) => {
  const entryId = req.params.entryId;

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

  // First, get the test details
  db.get("SELECT * FROM tests WHERE id = ?", [testId], (testErr, test) => {
    if (testErr) {
      console.error(testErr.message);
      res.status(500).send("Error retrieving test details");
      return;
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
  // SQL to fetch test results for the current user
  const sql = "SELECT * FROM test_results WHERE user_id = ?";
  db.all(sql, [userId], (err, results) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error retrieving progress data");
      return;
    }

    // Calculate statistics
    let totalScore = 0;
    let highestScore = 0;
    let lowestScore = results[0] ? results[0].score : 0;

    results.forEach(result => {
      totalScore += result.score;
      if (result.score > highestScore) highestScore = result.score;
      if (result.score < lowestScore) lowestScore = result.score;
    });

    const averageScore = totalScore / results.length;
    const totalTests = results.length;

    // Pass the results to the frontend
    res.render('progress', { results, averageScore, 
      totalTests, 
      highestScore, 
      lowestScore });
  });
});




app.post("/logout", (req, res) => {
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
