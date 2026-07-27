Feature: Movie Matching
  As a couple
  We want to discover movies we both like
  So that we can find something to watch together

  Background:
    Given the app has seeded users "Partner 1" (id=1) and "Partner 2" (id=2)
    And movies exist in the database with TMDB data

  Scenario: Both partners swipe right on the same movie
    Given user id=2 (Partner 2) has already swiped right on "Casablanca" (id=201)
    And user id=1 (Partner 1) is viewing the movie card for "Casablanca"
    When user id=1 clicks the ❤️ Like button
    Then POST /api/swipe is called with { movieId: 201, direction: "right" }
    And the API checks if user id=2 has a right swipe on movie id=201
    And the API response includes { matched: true, matchId: <swipe-id> }
    And the MatchModal component appears on screen

  Scenario: Match modal shows with poster and providers
    Given a match occurred on "Casablanca" (id=201)
    And the movie has posterUrl and providers ["Netflix", "Max"]
    When the MatchModal is displayed
    Then the modal has aria-modal="true" and aria-label="Match notification"
    And the heading "It's a Match!" is visible
    And the text "You both liked this movie!" is shown
    And the movie poster image is displayed
    And the text "Available on: Netflix, Max" is shown
    And a "💕 View Matches" link to /matches is visible
    And a "Keep Swiping" button is visible

  Scenario: Only one partner swipes right (no match)
    Given user id=1 swipes right on "The Godfather" (id=202)
    And user id=2 has not swiped on "The Godfather"
    When the POST /api/swipe request completes
    Then the API response includes { matched: false }
    And no MatchModal appears
    And the next movie card is loaded after the swipe animation

  Scenario: Both partners swipe left (no match)
    Given user id=2 has already swiped left on "Twilight" (id=203)
    When user id=1 swipes left on "Twilight"
    Then the API response includes { matched: false }
    And no match is recorded
    And the next movie card is loaded

  Scenario: Match history shows all mutual matches
    Given user id=1 has right-swiped on movies [201, 204, 205]
    And user id=2 has right-swiped on movies [201, 204, 206]
    When user id=1 navigates to /matches
    Then the page heading "Your Matches 💕" is displayed
    And the text "2 movies you both love" is shown
    And movie cards for "Casablanca" (id=201) and the other mutual match are displayed
    And each card shows the poster, title, year, rating, and provider badges
    And clicking a card opens the TMDB page for that movie
    And a "← Back to Swiping" link to /swipe is visible

  Scenario: Match history is empty for new couples
    Given user id=1 and user id=2 have no right swipes
    When user id=1 navigates to /matches
    Then the text "No matches yet!" is displayed
    And the text "Keep swiping to find your perfect movie." is shown
    And a "Start Swiping" button linking to /swipe is visible

  Scenario: Match includes "otherLiked" indicator before matching
    Given user id=2 has right-swiped on "Interstellar" (id=207)
    And user id=1 has not yet swiped on "Interstellar"
    When GET /api/movies/next returns "Interstellar" for user id=1
    Then the response includes otherLiked: true
    And the SwipeCard displays the "❤️ They liked this!" badge
    And the badge helps user id=1 know their partner already likes this movie

  Scenario: Match modal close behavior
    Given a MatchModal is displayed for "Casablanca"
    When the user clicks the backdrop blur overlay
    Then the modal closes (onClose is called)
    And the user returns to the swipe page
    When the user clicks "Keep Swiping"
    Then the modal closes and swiping continues
