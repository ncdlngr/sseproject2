SELECT test_results.*, tests.test_name 
    FROM test_results 
    JOIN tests ON test_results.test_id = tests.id 
    WHERE test_results.user_id = 1 
    ORDER BY test_results.date_taken DESC

