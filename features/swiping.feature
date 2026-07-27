Feature: Movie Swiping
  As a user
  I want to swipe through movies
  So that I can express my preferences

  Background:
    Given the app has seeded users "Partner 1" (id=1) and "Partner 2" (id=2)
    And the TMDB API is configured with a valid API key
    And movies exist in the database from TMDB discover

  Scenario: User sees a movie card with details
    Given user id=1 is logged in and on /swipe
    And the MoodSelector component is rendered above the SwipeCard
    When the GET /api/movies/next?page=1 request succeeds
    Then a movie card is displayed with:
      | backdrop image (if backdropUrl exists) |
      | poster image (if posterUrl exists)     |
      | movie title in an h2 element           |
      | release year                           |
      | star rating (voteAverage)              |
      | truncated overview (max 3 lines)       |
      | streaming provider badges              |
    And the card has a glassmorphism style with rounded-2xl border

  Scenario: User swipes right on a movie they like
    Given user id=1 is viewing a movie card for "Inception" (id=101)
    When the user clicks the ❤️ Like button (aria-label="Like")
    Then a POST /api/swipe request is sent with { movieId: 101, direction: "right" }
    And the card animates with translate-x-full rotate-12 opacity-0
    And after 400ms the next movie is fetched via GET /api/movies/next

  Scenario: User swipes left on a movie they dislike
    Given user id=1 is viewing a movie card for "The Room" (id=102)
    When the user clicks the ❌ Pass button (aria-label="Pass")
    Then a POST /api/swipe request is sent with { movieId: 102, direction: "left" }
    And the card animates with -translate-x-full -rotate-12 opacity-0
    And after 400ms the next movie is fetched via GET /api/movies/next

  Scenario: User sees "They liked this!" when partner already right-swiped
    Given user id=2 previously swiped right on "Arrival" (id=103)
    And user id=1 is viewing the movie card for "Arrival"
    When the GET /api/movies/next response includes otherLiked: true
    Then a badge with text "❤️ They liked this!" is shown next to the movie title
    And the badge has class "text-rose-300 bg-rose-500/20" with an animate-pulse class

  Scenario: User exhausts available movies
    Given user id=1 has swiped on all available movies in the database
    When GET /api/movies/next?page=1 returns HTTP 404
    Then an EmptyState component is displayed
    And the text "No more movies to browse!" is visible
    And a "🔄 Load More Movies" button is shown

  Scenario: User loads more movies
    Given the EmptyState is displayed with no more movies
    When the user clicks "🔄 Load More Movies"
    Then GET /api/movies/next?page=2 is called (incrementing the page counter)
    And if movies are found, a new SwipeCard is rendered
    And if no movies are found, the EmptyState remains

  Scenario: Swipe records interest signals
    Given user id=1 swipes right on "Inception" (id=101)
    And "Inception" has genreIds [878, 28, 53] (Sci-Fi, Action, Thriller)
    And "Inception" has llmTags with vibes ["mind-bending", "intense"]
    When the POST /api/swipe request completes
    Then recordSwipeSignal is called asynchronously (fire-and-forget)
    And interestSignals records are created for:
      | dimension | dimensionValue | signal |
      | genre     | sci-fi         | 1      |
      | genre     | action         | 1      |
      | genre     | thriller       | 1      |
      | vibe      | mind-bending   | 1      |
      | vibe      | intense        | 1      |

  Scenario: Swipe triggers background LLM enrichment
    Given user id=1 swipes right on "Dune" (id=104)
    And "Dune" has no llmTags yet (llmTags is null)
    When the POST /api/swipe request completes with direction "right"
    Then enrichMovie(104) is called asynchronously (fire-and-forget)
    And the LLM enrichment checks the llmCache before making an API call
    And the movie's llmTags and llmEnrichedAt fields are updated in the database

  Scenario: Duplicate swipe is rejected
    Given user id=1 already swiped right on "Inception" (id=101)
    When user id=1 attempts to swipe on "Inception" again
    Then the database unique constraint on (userId, movieId) is triggered
    And the API returns HTTP 409 with error "Already swiped on this movie"

  Scenario: Swipe animation is disabled during animation
    Given user id=1 is viewing a movie card
    When the user clicks the Like button
    Then the animating state is set to true
    And both swipe buttons are disabled (disabled:opacity-50 disabled:cursor-not-allowed)
    And additional clicks are ignored until animating resets after 400ms
