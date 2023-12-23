app.get('/register', (req, res) => {
    res.render('register');
  });
  
  // Route to handle registration form submission
  app.post('/register', async (req, res) => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      // Here, you would insert the username and hashed password into your database
      // For now, redirect to the login page after registration
      res.redirect('/login');
    } catch {
      res.redirect('/register');
    }
  });

  app.get('/login', (req, res) => {
    res.render('login');
  });
  
  // Route to handle login form submission
  app.post('/login', (req, res) => {
    // Authentication logic goes here
    // For now, redirect to your landing page or dashboard after login
    res.redirect('/dashboard');
  });